import { Injectable, Logger } from '@nestjs/common';
import { Role } from '../../common/enums/role.enum';
import { AiUserContext, ToolExecutionResult } from '../interfaces/ai-tool.interface';
import {
  GeminiContent,
  GeminiGenerateRequest,
  GeminiPart,
} from '../interfaces/gemini.interface';
import { AiResponseDto } from '../dto/ai-response.dto';
import { GeminiClientService } from './gemini-client.service';
import { AiToolRegistryService } from './ai-tool-registry.service';
import { AiSessionService } from './ai-session.service';
import { AiPermissionService } from './ai-permission.service';

const MAX_TURNS = 8;

@Injectable()
export class AiOrchestratorService {
  private readonly logger = new Logger(AiOrchestratorService.name);

  constructor(
    private readonly geminiClient: GeminiClientService,
    private readonly toolRegistry: AiToolRegistryService,
    private readonly sessionService: AiSessionService,
    private readonly permissionService: AiPermissionService,
  ) {}

  /**
   * Main entry point for processing a chat message.
   */
  async processMessage(
    userContext: AiUserContext,
    message: string,
    conversationId?: string,
    confirmationId?: string,
    confirmed?: boolean,
  ): Promise<AiResponseDto> {
    const session = this.sessionService.getOrCreateSession(
      userContext.userId,
      userContext.role,
      conversationId,
    );

    // 1. If explicit confirmation ID is submitted
    if (confirmationId && confirmed !== undefined) {
      if (confirmed) {
        const result = await this.toolRegistry.executeConfirmation(
          confirmationId,
          userContext.userId,
        );
        const replyText = result.success
          ? result.data?.message || 'Operation confirmed and completed successfully!'
          : result.error || 'Operation failed.';

        const response: AiResponseDto = {
          message: replyText,
          spokenSummary: replyText,
          language: this.detectLanguage(replyText),
          actions: result.actions || [],
          requiresConfirmation: false,
          requiresPayment: Boolean(result.requiresPayment),
          data: result.data,
          conversationId: session.id,
        };

        this.sessionService.addMessage(session.id, {
          id: String(Date.now()),
          role: 'assistant',
          content: replyText,
          spokenSummary: replyText,
          timestamp: new Date(),
          requiresPayment: Boolean(result.requiresPayment),
          actions: result.actions || [],
          data: result.data,
        });

        return response;
      } else {
        // User explicitly cancelled the confirmation
        this.sessionService.clearPendingConfirmation(confirmationId);
        const replyText = 'Operation cancel kar di gayi hai.';
        return {
          message: replyText,
          spokenSummary: replyText,
          language: 'hi',
          actions: [],
          requiresConfirmation: false,
          conversationId: session.id,
        };
      }
    }

    // 2. Check if user wrote a voice/text confirmation like "haan confirm karo", "yes confirm"
    if (session.pendingConfirmation) {
      const lower = message.toLowerCase().trim();
      if (
        [
          'haan confirm karo',
          'haan',
          'yes',
          'confirm',
          'yes confirm',
          'ha confirm karo',
          'kar do',
          'kardo',
          'theek hai kar do',
        ].includes(lower)
      ) {
        return this.processMessage(
          userContext,
          message,
          session.id,
          session.pendingConfirmation.id,
          true,
        );
      } else if (
        ['nahi', 'no', 'cancel', 'mat karo', 'ruk jao', 'stop'].includes(lower)
      ) {
        return this.processMessage(
          userContext,
          message,
          session.id,
          session.pendingConfirmation.id,
          false,
        );
      }
    }

    // 3. Save incoming user message
    this.sessionService.addMessage(session.id, {
      id: String(Date.now()),
      role: 'user',
      content: message,
      timestamp: new Date(),
    });

    // 4. Build prompt and tools
    const tools = this.toolRegistry.getFunctionDeclarationsForRole(
      userContext.role,
    );
    const systemPrompt = this.buildSystemPrompt(userContext);

    // Build Gemini contents from trimmed session history
    const contents: GeminiContent[] = [];
    for (const msg of session.messages) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }

    let currentTurn = 0;
    let pendingConfirmationResult: ToolExecutionResult | null = null;
    let finalModelText = '';
    const executedToolCalls = new Map<string, ToolExecutionResult>();
    let lastToolSignature = '';

    while (currentTurn < MAX_TURNS) {
      currentTurn++;

      const request: GeminiGenerateRequest = {
        contents,
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        tools: tools.length > 0 ? [{ functionDeclarations: tools }] : undefined,
        generationConfig: {
          temperature: 0.2, // Low temperature for factual accuracy
          maxOutputTokens: 600,
        },
      };

      const response = await this.geminiClient.generateContent(request);

      if (response.error) {
        this.logger.error(`Gemini Error: ${response.error.message}`);
        const fallbackText =
          response.error.code === 429
            ? 'AI abhi busy hai. Kripya thodi der baad dobara koshish karein.'
            : 'AI service temporary unavailable hai. Aap normal website se appointments dekh aur book kar sakte hain.';
        return {
          message: fallbackText,
          spokenSummary: fallbackText,
          language: 'hi',
          actions: [],
          requiresConfirmation: false,
          conversationId: session.id,
        };
      }

      const candidate = response.candidates?.[0];
      if (!candidate?.content?.parts || candidate.content.parts.length === 0) {
        break;
      }

      const functionCallPart = candidate.content.parts.find((p) => p.functionCall);
      const textParts = candidate.content.parts
        .filter((p) => p.text)
        .map((p) => p.text)
        .join('\n')
        .trim();

      // Check if model wants to call a function
      if (functionCallPart?.functionCall) {
        const { name, args } = functionCallPart.functionCall;
        const toolSignature = `${name}:${JSON.stringify(args || {})}`;

        // Guard against duplicate consecutive tool calls in the same turn
        if (toolSignature === lastToolSignature && executedToolCalls.has(toolSignature)) {
          this.logger.warn(`AI Orchestrator detected repeated identical tool call for ${name}. Forcing synthesis.`);
          break;
        }
        lastToolSignature = toolSignature;

        this.logger.log(`AI Orchestrator calling tool: ${name} with args: ${JSON.stringify(args)}`);

        // Record the model's exact candidate content in contents (preserves thoughtSignature, thoughts, etc.)
        contents.push(candidate.content);

        const tool = this.toolRegistry.getTool(name);
        let executionResult: ToolExecutionResult;

        if (!tool || !this.permissionService.canExecuteTool(userContext, tool)) {
          executionResult = {
            success: false,
            error: 'You do not have permission to execute this tool.',
          };
        } else {
          try {
            // Automatically attach conversationId to tool args for previews
            const argsWithContext = { ...args, conversationId: session.id };
            executionResult = await tool.execute(userContext, argsWithContext);
            executedToolCalls.set(toolSignature, executionResult);
          } catch (err: any) {
            executionResult = {
              success: false,
              error: err.message || 'Tool execution error',
            };
          }
        }

        if (executionResult.requiresConfirmation) {
          pendingConfirmationResult = executionResult;
        }

        // Send function response back to Gemini for natural synthesis (role: 'user' for Gemini 3.x REST compatibility)
        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name,
                response: {
                  name,
                  content: executionResult.data || { error: executionResult.error },
                },
              },
            },
          ],
        });

        // Continue loop to get synthesized text
        continue;
      }

      // Model returned text
      if (textParts) {
        finalModelText = textParts;
        break;
      }
    }

    // If tools were called but loop finished without a text response from the model,
    // make one final call without tools to force natural language answer synthesis.
    if (!finalModelText && contents.length > session.messages.length) {
      try {
        const forcedReq: GeminiGenerateRequest = {
          contents,
          systemInstruction: {
            parts: [
              {
                text:
                  systemPrompt +
                  '\n\nIMPORTANT: Do not make any more tool calls. Summarize the tool results retrieved above and provide a complete, clear, and helpful answer to the user in their language (Hindi/Hinglish/English).',
              },
            ],
          },
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 600,
          },
        };
        const forcedResp = await this.geminiClient.generateContent(forcedReq);
        const forcedCand = forcedResp.candidates?.[0];
        const forcedText = forcedCand?.content?.parts
          ?.filter((p) => p.text)
          .map((p) => p.text)
          .join('\n')
          .trim();
        if (forcedText) {
          finalModelText = forcedText;
        }
      } catch (err: any) {
        this.logger.error(`Failed to force final text generation: ${err.message}`);
      }
    }

    if (!finalModelText) {
      finalModelText =
        pendingConfirmationResult?.data
          ? `Kripya confirmation check karein.`
          : 'Aapki request process ho gayi hai.';
    }

    const language = this.detectLanguage(message + ' ' + finalModelText);
    const spokenSummary = this.buildSpokenSummary(finalModelText, language);

    const responseDto: AiResponseDto = {
      message: finalModelText,
      spokenSummary,
      language,
      actions: pendingConfirmationResult?.actions || [],
      requiresConfirmation: Boolean(pendingConfirmationResult?.requiresConfirmation),
      confirmationId: pendingConfirmationResult?.confirmationId || null,
      expiresAt: pendingConfirmationResult?.expiresAt || null,
      conversationId: session.id,
    };

    // Save assistant response to session
    this.sessionService.addMessage(session.id, {
      id: String(Date.now()),
      role: 'assistant',
      content: finalModelText,
      spokenSummary,
      timestamp: new Date(),
      requiresConfirmation: responseDto.requiresConfirmation,
      confirmationId: responseDto.confirmationId || undefined,
      expiresAt: responseDto.expiresAt || undefined,
      actions: responseDto.actions,
    });

    return responseDto;
  }

  /**
   * Builds the role-specific instructions and contextual date/time information.
   */
  private buildSystemPrompt(userContext: AiUserContext): string {
    const now = new Date();
    const todayIST = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
    }).format(now);
    const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowIST = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
    }).format(tomorrowDate);

    const isDoctor = userContext.role === Role.DOCTOR;

    return `
You are the AI Appointment Assistant for Doctorr-booking platform.
Current Timezone: Asia/Kolkata (IST).
Today's Date: ${todayIST}
Tomorrow's Date: ${tomorrowIST}

User Role: ${userContext.role} (User ID: ${userContext.userId})
Role Scope: ${
      isDoctor
        ? "DOCTOR ASSISTANT: You assist the doctor with checking their schedule, today's appointments, availability, and smart rescheduling previews. You NEVER access another doctor's data."
        : "PATIENT ASSISTANT: You assist the patient with viewing their own appointments, checking available doctors and slots, and previewing booking, rescheduling, or cancellation. You NEVER access another patient's data."
    }

CRITICAL RULES:
1. HEALTHCARE SAFETY & ADVICE: You provide empathetic health guidance, probable root-cause insights, and practical lifestyle/home-care tips (e.g. hydration, warm salt-water rinse, rest, avoiding spicy foods). You do NOT prescribe prescription medications or guarantee diagnoses. Always encourage consulting a doctor.
2. FREE-TIER PRIVACY: Never ask for or output sensitive private identifiers, full address, or phone numbers.
3. TWO-STEP ACTIONS: You CANNOT finalize booking, rescheduling, or cancellation on your own! Always use the preview tools (previewAppointmentBooking, previewAppointmentReschedule, previewAppointmentCancellation). State the key details clearly (Doctor, Date, Time, Fee) and ask the user to confirm.
4. LANGUAGE & TONE:
   - Understand Hindi, English, and Hinglish ("aaj ke appointments", "muu me chaale ho gaye", "kal mera slot kab hai", "isko reschedule kar do").
   - Match the user's language: If user writes in Hinglish, reply in clear, friendly Hinglish. If in Hindi, reply in Hindi. If in English, reply in English.
   - Resolve date words accurately: "aaj" = ${todayIST}, "kal" = ${tomorrowIST}.
5. CONCISENESS & EMPATHY: Keep answers clear, empathetic, and direct. Do not output raw JSON, internal database IDs, or code blocks.
6. CLEAN PRESENTATION: Format lists and details cleanly using bullet points (•) or key-value format (e.g. Doctor: Dr. Rahul, Date: 18 Nov, Time: 9:00 AM, Fee: ₹500).
7. CLINICAL SYMPTOM ANALYSIS & GUIDED BOOKING:
   - When a patient describes symptoms, discomfort, illness, or health complaints (e.g. "muu me chaale aa jate hai", "seene me dard", "fever", "skin rash", "teeth pain"):
     a) FIRST: Explain possible root causes (e.g., deficiency of B12/iron, stress, acidity, stomach heat, infection) and give 2 practical home-care tips (e.g., stay hydrated, avoid spicy/acidic foods, rinse with salt water).
     b) SECOND: Determine which medical specialist is suited (e.g. "Dentist", "ENT Specialist", "Cardiologist", "Dermatologist", "General Physician").
     c) THIRD: Call checkSymptomsAndRecommendDoctors with the symptoms and your chosen specialization.
     d) FOURTH: If the tool returns foundExactSpecialist: false (meaning the exact specialist is not registered on the platform), explain transparently: "Is samasya ke liye aamtaur par [Specialist] se milna behtar hota hai. Hamare platform par abhi [Specialist] directly available nahi hain, isliye main aapko General Physician suggest kar raha hoon jo root cause check kar sakte hain."
     e) FIFTH: Present the doctor options with their earliest next available free slot and fee.
     f) SIXTH: Guide forward: Ask the patient if they would like to book an appointment (e.g. "Kya main Dr. [Name] ke saath [Date] ko [Time] baje appointment book kar doon?"). If they agree, call previewAppointmentBooking!
8. PRESCRIPTION EXPLAINER & MEDICATION GUIDE:
   - When a patient asks about their prescriptions (e.g. "mere kitne prescription hain", "meri dawaiyan dikhao", "prescription list dikhao"):
     Call getMyPrescriptions tool to list them with doctor name and date.
   - When a patient asks to explain or decode a prescription (e.g. "ye prescription samjha do", "dawaiyan kab leni hai", "Dr. Aryan ka prescription samjhao", "mujhe dawai samajh nahi aa rahi"):
     Call explainPrescriptionDetails tool.
   - Present the explanation in warm, comforting, easy-to-understand language (especially suited for elderly patients):
     • Doctor Name & Date
     • Diagnosis in plain words: "Doctor ne yeh [Diagnosis] ke liye likha hai."
     • Har Dawa ka poora timetable:
       - Dawa ka naam aur dose (e.g. 1 Tablet)
       - Kab lena hai (Subah khali pet / khana khane ke baad)
       - Kitni baar aur kitne din tak
       - Special instructions (e.g. gungune paani ke sath)
     • Parhez aur doctor ki advice (diet/rest)
     • Next follow-up checkup date
     • End with reassuring safety advice: "Dawa ka dose doctor ke bataye anusar hi lein aur course poora karein."
`.trim();
  }

  /**
   * Extracts or condenses a short 1-2 sentence spoken summary for browser TTS.
   */
  private buildSpokenSummary(text: string, language: 'en' | 'hi'): string {
    // If text is short, use as-is
    if (text.length <= 140) {
      return text.replace(/[*#_`]/g, '');
    }

    // Take the first 1-2 sentences
    const sentences = text
      .split(/(?<=[.!?।])\s+/)
      .map((s) => s.trim().replace(/[*#_`]/g, ''))
      .filter((s) => s.length > 0);

    const summary = sentences.slice(0, 2).join(' ');
    return summary.length > 180 ? summary.slice(0, 177) + '...' : summary;
  }

  /**
   * Simple language detector for Hindi vs English.
   */
  private detectLanguage(text: string): 'en' | 'hi' {
    // Detect Devanagari Unicode range or common Hinglish words
    const hasDevanagari = /[\u0900-\u097F]/.test(text);
    if (hasDevanagari) return 'hi';

    const hinglishWords = [
      'aaj',
      'kal',
      'parso',
      'meri',
      'mera',
      'mere',
      'hai',
      'hain',
      'karo',
      'kardo',
      'karni',
      'dikhao',
      'kitne',
      'kab',
      'haan',
      'nahi',
      'theek',
      'dhundo',
    ];

    const tokens = text.toLowerCase().split(/\W+/);
    const hasHinglish = tokens.some((t) => hinglishWords.includes(t));
    return hasHinglish ? 'hi' : 'en';
  }
}

