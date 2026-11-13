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

const MAX_TURNS = 5;
const MAX_ORCHESTRATION_TIME_MS = 20000; // 20 seconds maximum orchestrator runtime

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
    languagePreference?: 'auto' | 'hi' | 'en',
  ): Promise<AiResponseDto> {
    const session = this.sessionService.getOrCreateSession(
      userContext.userId,
      userContext.role,
      conversationId,
    );

    const userLanguage = this.detectLanguage(message, languagePreference);

    // 1. If explicit confirmation ID is submitted
    if (confirmationId && confirmed !== undefined) {
      if (confirmed) {
        const result = await this.toolRegistry.executeConfirmation(
          confirmationId,
          userContext.userId,
        );
        const replyText = result.success
          ? result.data?.message ||
            (userLanguage === 'en'
              ? 'Operation confirmed and completed successfully!'
              : 'Operation confirm ho gayi hai aur safaltapoorvak complete ho chuki hai!')
          : result.error ||
            (userLanguage === 'en'
              ? 'Operation failed.'
              : 'Operation fail ho gayi hai.');

        const response: AiResponseDto = {
          message: replyText,
          spokenSummary: replyText,
          language: userLanguage === 'en' ? 'en' : 'hi',
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
        const replyText =
          userLanguage === 'en'
            ? 'Operation cancelled.'
            : 'Operation cancel kar di gayi hai.';
        return {
          message: replyText,
          spokenSummary: replyText,
          language: userLanguage === 'en' ? 'en' : 'hi',
          actions: [],
          requiresConfirmation: false,
          conversationId: session.id,
        };
      }
    }

    // 2. Check if user wrote a voice/text confirmation like "haan confirm karo", "yes confirm", "book karo"
    if (session.pendingConfirmation) {
      const lower = message.toLowerCase().trim().replace(/[.,!?-]/g, '');
      const confirmKeywords = [
        'haan confirm karo',
        'haan',
        'ha',
        'yes',
        'confirm',
        'yes confirm',
        'ha confirm karo',
        'kar do',
        'kardo',
        'theek hai kar do',
        'ha kardo',
        'haan kardo',
        'confirm kardo',
        'please confirm',
        'confirm it',
        'book karo',
        'book kardo',
        'book kar do',
        'slot book karo',
        'isko book karo',
        'appointment book karo',
        'proceed',
        'aage badho',
        'theek hai',
        'ok',
        'okay',
        'done',
        'book it',
        'yes book it',
        'yes please',
      ];

      const isConfirm = confirmKeywords.some(
        (kw) => lower === kw || lower.startsWith(kw + ' ') || lower.endsWith(' ' + kw),
      );

      const cancelKeywords = [
        'nahi',
        'no',
        'cancel',
        'mat karo',
        'ruk jao',
        'stop',
        'dont do it',
        'reject',
        'rehne do',
      ];

      const isCancel = cancelKeywords.some(
        (kw) => lower === kw || lower.startsWith(kw + ' ') || lower.endsWith(' ' + kw),
      );

      if (isConfirm) {
        return this.processMessage(
          userContext,
          message,
          session.id,
          session.pendingConfirmation.id,
          true,
          languagePreference,
        );
      } else if (isCancel) {
        return this.processMessage(
          userContext,
          message,
          session.id,
          session.pendingConfirmation.id,
          false,
          languagePreference,
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

    // 4. Build prompt and tools with session context
    const tools = this.toolRegistry.getFunctionDeclarationsForRole(
      userContext.role,
    );
    const systemPrompt = this.buildSystemPrompt(userContext, userLanguage, session);

    // Build Gemini contents from trimmed session history ensuring strict alternating turns
    const contents: GeminiContent[] = [];
    for (const msg of session.messages) {
      const role = msg.role === 'user' ? 'user' : 'model';
      let text = (msg.content || '').trim();

      // If assistant message had structured actions/data (like doctor preview or slot), append context note
      if (role === 'model' && msg.data) {
        const d = msg.data;
        const extraHints: string[] = [];
        if (d.doctorName) extraHints.push(`Doctor: ${d.doctorName}`);
        if (d.date) extraHints.push(`Date: ${d.date}`);
        if (d.time) extraHints.push(`Time: ${d.time}`);
        if (d.fee !== undefined) extraHints.push(`Fee: ₹${d.fee}`);
        if (d.shiftDate) extraHints.push(`ShiftDate: ${d.shiftDate}`);
        if (d.startTime && d.endTime) extraHints.push(`Hours: ${d.startTime}-${d.endTime}`);
        if (extraHints.length > 0) {
          text = `${text}\n[Context: ${extraHints.join(', ')}]`.trim();
        }
      }

      if (!text) continue;

      if (contents.length > 0 && contents[contents.length - 1].role === role) {
        // Merge consecutive same-role messages so Gemini never throws 400 Invalid Argument
        contents[contents.length - 1].parts.push({ text });
      } else {
        contents.push({
          role,
          parts: [{ text }],
        });
      }
    }

    // Gemini strictly requires conversation to start with a user turn
    while (contents.length > 0 && contents[0].role === 'model') {
      contents.shift();
    }

    if (contents.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: message }],
      });
    }

    let currentTurn = 0;
    let pendingConfirmationResult: ToolExecutionResult | null = null;
    let finalModelText = '';
    const executedToolCalls = new Map<string, ToolExecutionResult>();
    let lastToolSignature = '';
    const orchestratorStartTime = Date.now();

    while (currentTurn < MAX_TURNS) {
      // Time-budget safeguard: if multi-step tool calls exceed 20s, break early to synthesize text
      if (Date.now() - orchestratorStartTime > MAX_ORCHESTRATION_TIME_MS) {
        this.logger.warn(
          `Orchestration exceeded ${MAX_ORCHESTRATION_TIME_MS}ms budget. Breaking tool loop early to synthesize response.`,
        );
        break;
      }

      currentTurn++;

      const request: GeminiGenerateRequest = {
        contents,
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        tools: tools.length > 0 ? [{ functionDeclarations: tools }] : undefined,
        generationConfig: {
          temperature: 0.2, // Low temperature for factual accuracy
          maxOutputTokens: 700,
        },
      };

      const response = await this.geminiClient.generateContent(request);

      if (response.error) {
        this.logger.error(`Gemini Error: ${response.error.message}`);
        const fallbackText =
          userLanguage === 'en'
            ? response.error.code === 429
              ? 'AI Assistant is currently busy. Please try again in a few moments.'
              : 'AI Assistant is temporarily unavailable. You can browse and book appointments directly on the website.'
            : response.error.code === 429
              ? 'AI abhi busy hai. Kripya thodi der baad dobara koshish karein.'
              : 'AI service temporary unavailable hai. Aap normal website se appointments dekh aur book kar sakte hain.';

        // Save assistant response to session so conversation history maintains alternating turns
        this.sessionService.addMessage(session.id, {
          id: String(Date.now()),
          role: 'assistant',
          content: fallbackText,
          spokenSummary: fallbackText,
          timestamp: new Date(),
        });

        return {
          message: fallbackText,
          spokenSummary: fallbackText,
          language: userLanguage === 'en' ? 'en' : 'hi',
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
                  content: executionResult.data || {
                    success: executionResult.success,
                    error: executionResult.error,
                  },
                },
              },
            },
          ],
        });
        continue;
      }

      // If model provided text response
      if (textParts) {
        finalModelText = textParts;
        break;
      }

      break;
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
                  `\n\nIMPORTANT: Do not make any more tool calls. Summarize the tool results retrieved above and provide a complete, clear, and helpful answer to the user in their language (${userLanguage.toUpperCase()}).`,
              },
            ],
          },
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 700,
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
        userLanguage === 'en'
          ? pendingConfirmationResult?.data
            ? 'Please review the confirmation card below.'
            : 'Your request has been processed.'
          : pendingConfirmationResult?.data
            ? 'Kripya confirmation card check karein.'
            : 'Aapki request process ho gayi hai.';
    }

    // Aggregate actions and data from all executed tools so recommendation cards and previews are not lost
    const aggregatedActions: any[] = [];
    let lastToolData: any = undefined;

    for (const res of executedToolCalls.values()) {
      if (res.actions && Array.isArray(res.actions)) {
        aggregatedActions.push(...res.actions);
      }
      if (res.data) {
        lastToolData = res.data;
      }
    }
    if (pendingConfirmationResult?.actions && Array.isArray(pendingConfirmationResult.actions)) {
      aggregatedActions.push(...pendingConfirmationResult.actions);
    }

    const spokenSummary = this.buildSpokenSummary(finalModelText, userLanguage === 'en' ? 'en' : 'hi');

    const responseDto: AiResponseDto = {
      message: finalModelText,
      spokenSummary,
      language: userLanguage === 'en' ? 'en' : 'hi',
      actions: aggregatedActions,
      data: pendingConfirmationResult?.data || lastToolData,
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
      data: responseDto.data,
    });

    return responseDto;
  }

  /**
   * Builds the role-specific instructions and contextual date/time information.
   */
  private buildSystemPrompt(
    userContext: AiUserContext,
    targetLanguage: 'en' | 'hi' | 'hinglish',
    session?: any,
  ): string {
    const now = new Date();
    const todayIST = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
    }).format(now);
    const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowIST = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
    }).format(tomorrowDate);

    const isDoctor = userContext.role === Role.DOCTOR;

    const languageDirective =
      targetLanguage === 'en'
        ? `MANDATORY LANGUAGE REQUIREMENT: The user is speaking in ENGLISH. You MUST formulate your entire response in clear, professional, fluent ENGLISH.
DO NOT use any Hindi or Hinglish words (do NOT say 'Aapka', 'Bimari', 'Dawa', 'Hain', 'Ji', 'Kripya', 'Subah', 'Sham'). Keep all guidance, doctor recommendations, greetings, and questions 100% in English.`
        : targetLanguage === 'hi'
          ? `MANDATORY LANGUAGE REQUIREMENT: The user is speaking in HINDI. You MUST formulate your entire response in HINDI (Devanagari script).`
          : `MANDATORY LANGUAGE REQUIREMENT: The user is speaking in HINGLISH. You MUST formulate your response in natural, friendly, conversational Hinglish (Roman Hindi script).`;

    let contextDirectives = '';
    if (session?.pendingConfirmation) {
      const p = session.pendingConfirmation;
      contextDirectives += `
ACTIVE PENDING ACTION READY FOR USER CONFIRMATION:
- Action Type: ${p.actionType}
- Action Summary: ${p.summary}
- Action Details: ${JSON.stringify(p.actionPayload)}
- If user confirms ('haan', 'yes', 'book karo', 'kar do', 'ok', 'proceed', etc.), immediately acknowledge and proceed with this exact action!
`;
    }

    contextDirectives += `
CONVERSATION CONTINUITY & CONTEXT MEMORY:
- You must retain full context of earlier turns in this chat.
- If the patient previously asked about a specific doctor or slot (e.g. Dr. Rahul at 10:00 AM), and now says "book karo", "confirm kar do", or "isko reschedule karo", resolve the doctor and slot directly from chat history without asking the user to repeat the details!
`;

    return `
You are the AI Healthcare & Appointment Assistant for CareUp platform.
Current Timezone: Asia/Kolkata (IST).
Today's Date: ${todayIST}
Tomorrow's Date: ${tomorrowIST}

User Role: ${userContext.role} (User ID: ${userContext.userId})
Role Scope: ${
      isDoctor
        ? "DOCTOR ASSISTANT: You assist the doctor with checking their schedule, today's appointments, availability management (recurring or custom), and elastic scheduling (shrink/expand shifts with automated patient reschedule dispatch). You NEVER access another doctor's data."
        : "PATIENT ASSISTANT: You assist the patient with viewing their own appointments, checking available doctors and slots, and previewing booking, rescheduling, or cancellation. You NEVER access another patient's data."
    }

${languageDirective}
${contextDirectives}

CRITICAL RULES:
1. STRICT LANGUAGE MATCHING:
   - Always match the user's language exactly as specified in the MANDATORY LANGUAGE REQUIREMENT above.
   - When answering in English, every sentence must be natural English. Never leak Hinglish vocabulary into an English response.
2. HEALTHCARE SAFETY & ADVICE:
   - You provide empathetic health guidance, probable root-cause insights, and practical lifestyle/home-care tips (e.g. hydration, warm salt-water rinse, rest, avoiding spicy foods).
   - You do NOT prescribe prescription medications or guarantee diagnoses. Always encourage consulting a doctor.
3. FREE-TIER PRIVACY: Never ask for or output sensitive private identifiers, full address, or phone numbers.
4. TWO-STEP ACTIONS & CONFIRMATION:
   - You CANNOT finalize booking, rescheduling, cancellation, setting availability, or shrinking/expanding shifts on your own!
   - Always use the preview tools (previewAppointmentBooking, previewAppointmentReschedule, previewAppointmentCancellation, previewDoctorSetAvailability, previewDoctorElasticSchedule).
   - State the key details clearly and ask the user to confirm via button or voice/text ('Confirm', 'Yes', 'Haan confirm karo').
5. CONCISENESS & CLEAN PRESENTATION:
   - Keep answers clear, direct, and helpful. Do not output raw JSON or internal database IDs.
   - Format lists and details cleanly using bullet points (•) or key-value format. Avoid excessive markdown asterisks.
6. FAST & FOCUSED TOOL USE:
   - When a patient asks general questions like "Kal doctor ke paas koi slot available hai?" without specifying a doctor, call getAvailableDoctors first. If doctors are found, show their available slots or list the doctors. Avoid calling getAvailableSlots in a long sequential loop for multiple doctors. Keep response fast and direct.

${
  isDoctor
    ? `
DOCTOR SPECIFIC CAPABILITIES & WORKFLOWS:
A. DOCTOR AVAILABILITY SETTING (previewDoctorSetAvailability):
   - The doctor can ask to set recurring weekly availability (e.g., 'Set availability for Sunday 10am to 12pm') or custom date availability.
   - REQUIRED INFORMATION CHECK:
     Before calling previewDoctorSetAvailability, make sure you know:
     1. Day(s) of week (e.g. SUNDAY) OR specific date (YYYY-MM-DD).
     2. Start time & End time (e.g. 10:00 to 12:00 in 24-hr format).
     3. Shift type: RECURRING (every week) vs CUSTOM (specific date).
     4. Slot duration per patient: (e.g. 15, 20, or 30 minutes).
     5. Scheduling type: STREAM (1-to-1) vs WAVE (group).
   - CLARIFICATION RULE: If the doctor forgot to mention slot duration or shift type, DO NOT guess! Ask them politely in their language:
     e.g. in English: 'I have noted Sunday 10:00 AM to 12:00 PM. Could you please specify: (1) Is this recurring every Sunday or for a specific date? (2) What is your preferred slot duration per patient (e.g., 15 or 30 mins)?'
     e.g. in Hinglish: 'Sunday 10:00 AM se 12:00 PM note kar liya hai. Kripya confirm karein: (1) Kya yeh har Sunday ke liye recurring shift hai ya kisi specific date ke liye? (2) Har patient ke liye slot duration kitni rakhni hai (e.g., 15 ya 30 minute)?'
   - Once all details are provided, call previewDoctorSetAvailability. Present the confirmation details clearly.

B. ELASTIC SCHEDULING - SHRINK & EXPAND (previewDoctorElasticSchedule):
   - EXPAND SHIFT: When doctor wants to extend their hours (e.g. 'expand shift till 2pm'), call previewDoctorElasticSchedule with actionType: 'EXPAND'. Previews the new expanded capacity.
   - SHRINK SHIFT: When doctor wants to reduce hours (e.g. 'shrink shift from 9-1 to 9-11'), call previewDoctorElasticSchedule with actionType: 'SHRINK'.
     * The tool will check conflicts and return any affected appointments.
     * Report to the doctor: How many patients are affected and their names/times.
     * Clearly state: 'Upon your confirmation, the shift will be shrunken and the system will automatically dispatch reschedule requests and notifications to all affected patients.'
     * Ask the doctor to confirm! When confirmed, the backend handles everything automatically.

C. DOCTOR DAILY SCHEDULE & APPOINTMENT ROSTER (getDoctorDailySchedule):
   - When the doctor asks about their appointments, schedule, or daily roster (e.g. 'Aaj mere kitne appointment hain?', 'Show my schedule for today', 'Today appointments'):
     * Call getDoctorDailySchedule (or getDoctorAppointmentSummary).
     * Provide a clear overview in their language: total appointments count, confirmed count, and list of scheduled patients with their token numbers, time windows, and statuses.
     * Remind the doctor: 'You can tap on any patient's summary button or ask "Raj ki summary do" to view their full clinical history.'

D. 30-SECOND PATIENT CLINICAL DOSSIER (getPatientClinicalSummary):
   - When the doctor asks for a patient's clinical summary, history, previous diagnosis, or past medicines (e.g. 'Raj ki summary do', 'Tell me about patient Priya', 'Iske pehle kya bimari thi aur kya dawai di thi?'):
     * Extract the patient name and call getPatientClinicalSummary(patientName: '...').
     * If patient is found, deliver a crisp, structured 30-second clinical briefing covering:
       1. Demographics & Blood Group.
       2. 🚨 Safety Alerts: Known drug allergies (highlight in bold) and chronic history/conditions.
       3. Last Consultation Details: Date, reported symptoms, and previous diagnosis/clinical notes.
       4. Past Medications: Prescribed medicines with exact dosages and timing.
       5. Today's Token & Slot (if scheduled today).
     * If multiple patients match the name, list the matching names with age/gender and ask the doctor to pick one.
`
    : `
PATIENT SPECIFIC CAPABILITIES & WORKFLOWS:
A. CLINICAL SYMPTOM ANALYSIS & GUIDED BOOKING:
   - When a patient describes symptoms, discomfort, illness, or complaints:
     a) FIRST: Explain possible root causes and give 2 practical home-care tips.
     b) SECOND: Determine which medical specialist is suited (e.g. Dentist, ENT Specialist, Cardiologist, Dermatologist, General Physician).
     c) THIRD: Call checkSymptomsAndRecommendDoctors with the symptoms and your chosen specialization.
     d) FOURTH: If foundExactSpecialist is false, explain transparently that General Physician alternatives are provided.
     e) FIFTH: Present doctor options with their clinic, fee, and earliest available slot. Mention that they can click 'View Profile' to verify doctor credentials or click 'Book Slot' to proceed immediately.
`
}
`.trim();
  }

  /**
   * Extracts or condenses a short 1-2 sentence spoken summary for browser TTS.
   */
  private buildSpokenSummary(text: string, language: 'en' | 'hi'): string {
    if (text.length <= 140) {
      return text.replace(/[*#_`]/g, '');
    }

    const sentences = text
      .split(/(?<=[.!?।])\s+/)
      .map((s) => s.trim().replace(/[*#_`]/g, ''))
      .filter((s) => s.length > 0);

    const summary = sentences.slice(0, 2).join(' ');
    return summary.length > 180 ? summary.slice(0, 177) + '...' : summary;
  }

  /**
   * Robust language detector for English, Devanagari Hindi, and Hinglish.
   */
  private detectLanguage(
    text: string,
    preference?: 'auto' | 'hi' | 'en',
  ): 'en' | 'hi' | 'hinglish' {
    if (preference === 'en') return 'en';
    if (preference === 'hi') return 'hi';

    const hasDevanagari = /[\u0900-\u097F]/.test(text);
    if (hasDevanagari) return 'hi';

    const hinglishWords = [
      'aaj', 'kal', 'parso', 'meri', 'mera', 'mere', 'hai', 'hain', 'ho', 'hoga', 'hogi',
      'karo', 'kardo', 'karni', 'karna', 'dikhao', 'kitne', 'kitna', 'kab', 'kahan', 'haan',
      'nahi', 'theek', 'dhundo', 'batao', 'bataoo', 'dawai', 'bimari', 'dard', 'seene',
      'chaale', 'bukhar', 'pet', 'khana', 'khali', 'ghanta', 'baje', 'subah', 'sham', 'dopahar',
      'chahiye', 'karwa', 'sakta', 'sakti', 'mujhe', 'hum', 'tum', 'aap', 'aapka', 'aapki',
      'shirnk', 'shrink', 'bataiye', 'set', 'kariye', 'kardo', 'karna'
    ];

    const tokens = (text || '').toLowerCase().split(/[\s,?.!;:()"\']+/);
    const hasHinglish = tokens.some((t) => hinglishWords.includes(t));
    return hasHinglish ? 'hinglish' : 'en';
  }
}
