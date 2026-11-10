import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GeminiGenerateRequest,
  GeminiGenerateResponse,
} from '../interfaces/gemini.interface';

@Injectable()
export class GeminiClientService {
  private readonly logger = new Logger(GeminiClientService.name);
  private readonly apiKey: string;
  private readonly primaryModel: string;
  private readonly fallbackModels: string[] = [
    'gemini-3.1-flash-lite',
    'gemini-3-flash-preview',
    'gemini-3.6-flash',
  ];
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
    this.primaryModel =
      this.configService.get<string>('GEMINI_MODEL') || 'gemini-3.1-flash-lite';
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  getModelName(): string {
    return this.primaryModel;
  }

  /**
   * Calls the free-tier Gemini API with automatic model fallback for 404/503 and retry for 429.
   */
  async generateContent(
    request: GeminiGenerateRequest,
    retries = 2,
    delayMs = 1000,
  ): Promise<GeminiGenerateResponse> {
    if (!this.isAvailable()) {
      return {
        error: {
          code: 503,
          message:
            'AI Assistant is currently offline. Please configure GEMINI_API_KEY in the backend.',
          status: 'UNAVAILABLE',
        },
      };
    }

    // Try primary model first, followed by active free fallbacks
    const candidateModels = Array.from(
      new Set([this.primaryModel, ...this.fallbackModels]),
    );

    let lastError: any = null;

    for (const model of candidateModels) {
      const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          const data: GeminiGenerateResponse = await response.json();

          if (response.ok) {
            return data;
          }

          // Handle 404 (model retired) or 503 (high demand) -> immediately switch to next fallback model
          if (response.status === 404 || response.status === 503) {
            this.logger.warn(
              `Model "${model}" returned ${response.status} (${data.error?.message || 'unavailable'}). Switching to next candidate model...`,
            );
            lastError = data.error;
            break; // Break inner retry loop to try next candidate model
          }

          // Handle Rate Limit / Quota Exceeded (429)
          if (response.status === 429) {
            this.logger.warn(
              `Gemini API rate limit hit (429 RESOURCE_EXHAUSTED) on model ${model}. Attempt ${attempt + 1}/${retries + 1}`,
            );
            if (attempt < retries) {
              await new Promise((resolve) =>
                setTimeout(resolve, delayMs * (attempt + 1)),
              );
              continue;
            }
            return {
              error: {
                code: 429,
                message:
                  'AI abhi busy hai. Kripya thodi der baad dobara koshish karein.',
                status: 'RESOURCE_EXHAUSTED',
              },
            };
          }

          this.logger.error(
            `Gemini API error ${response.status} on ${model}: ${JSON.stringify(data.error || data)}`,
          );
          lastError = data.error;
          break;
        } catch (err: any) {
          if (err.name === 'AbortError') {
            this.logger.warn(
              `Gemini API request timed out on model ${model} (attempt ${attempt + 1})`,
            );
          } else {
            this.logger.error(`Gemini fetch error on model ${model}: ${err.message}`);
          }

          if (attempt < retries) {
            await new Promise((resolve) =>
              setTimeout(resolve, delayMs * (attempt + 1)),
            );
            continue;
          }
          break;
        }
      }
    }

    return {
      error: lastError || {
        code: 503,
        message: 'AI request failed across all free candidate models.',
        status: 'UNAVAILABLE',
      },
    };
  }
}
