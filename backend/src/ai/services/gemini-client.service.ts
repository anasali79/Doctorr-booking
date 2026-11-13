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
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-2.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-3-flash-preview',
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
  ];
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  // In-memory model health tracker to eliminate latency from dead/overloaded models
  private readonly permanentlyDisabledModels = new Set<string>();
  private readonly temporaryCooldownModels = new Map<string, number>();
  private preferredModel: string | null = null;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
    this.primaryModel =
      this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.0-flash';
    this.preferredModel = this.primaryModel;
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  getModelName(): string {
    return this.preferredModel || this.primaryModel;
  }

  /**
   * Builds ordered list of models: preferred working model first, then configured models,
   * skipping retired (404) or temporarily cooling down (503/timeout) models.
   */
  private getCandidateModels(): string[] {
    const now = Date.now();
    const rawList = [
      this.preferredModel,
      this.primaryModel,
      ...this.fallbackModels,
    ].filter(Boolean) as string[];

    // Filter out duplicates and permanently dead models (404)
    const validModels = Array.from(new Set(rawList)).filter(
      (m) => !this.permanentlyDisabledModels.has(m),
    );

    // Prefer models not currently in temporary cooldown
    const readyModels = validModels.filter((m) => {
      const cooldownUntil = this.temporaryCooldownModels.get(m);
      return !cooldownUntil || cooldownUntil <= now;
    });

    return readyModels.length > 0 ? readyModels : validModels;
  }

  /**
   * Calls the free-tier Gemini API with automatic model fallback for 404/503/429 and fast failover.
   */
  async generateContent(
    request: GeminiGenerateRequest,
    retries = 1,
    delayMs = 800,
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

    const candidateModels = this.getCandidateModels();
    let lastError: any = null;

    for (const model of candidateModels) {
      const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const controller = new AbortController();
          // Fast 7s timeout so hanging requests quickly fail over to working fallbacks
          const timeoutId = setTimeout(() => controller.abort(), 7000);

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
            // Remember this working model for future calls to eliminate failover latency
            this.preferredModel = model;
            this.temporaryCooldownModels.delete(model);
            return data;
          }

          // Handle 404: Model retired or disabled -> permanently blacklist in memory
          if (response.status === 404) {
            this.logger.warn(
              `Model "${model}" returned 404 (Retired). Blacklisting permanently and switching to next model...`,
            );
            this.permanentlyDisabledModels.add(model);
            if (this.preferredModel === model) {
              this.preferredModel = null;
            }
            lastError = data.error;
            break; // Immediately move to next candidate model
          }

          // Handle 503: High demand / overloaded -> 60s cooldown and switch immediately
          if (response.status === 503) {
            this.logger.warn(
              `Model "${model}" returned 503 (High demand). Putting on 60s cooldown and switching to next model...`,
            );
            this.temporaryCooldownModels.set(model, Date.now() + 60000);
            if (this.preferredModel === model) {
              this.preferredModel = null;
            }
            lastError = data.error;
            break; // Immediately move to next candidate model
          }

          // Handle 429: Rate limit / Quota exceeded -> switch to next model or short delay
          if (response.status === 429) {
            this.logger.warn(
              `Gemini API rate limit hit (429) on model ${model}. Switching to next candidate model...`,
            );
            this.temporaryCooldownModels.set(model, Date.now() + 30000);
            if (this.preferredModel === model) {
              this.preferredModel = null;
            }
            lastError = data.error;
            break;
          }

          this.logger.error(
            `Gemini API error ${response.status} on ${model}: ${JSON.stringify(data.error || data)}`,
          );
          lastError = data.error;
          break;
        } catch (err: any) {
          if (err.name === 'AbortError') {
            this.logger.warn(
              `Model "${model}" timed out (7s). Putting on 60s cooldown and switching to next candidate model...`,
            );
            this.temporaryCooldownModels.set(model, Date.now() + 60000);
            lastError = {
              code: 504,
              message: `Model ${model} timed out after 7s.`,
            };
            break;
          } else {
            this.logger.error(`Gemini fetch error on model ${model}: ${err.message}`);
          }

          if (this.preferredModel === model) {
            this.preferredModel = null;
          }

          // Move to next candidate model
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
