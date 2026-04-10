import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { LlmClient, LlmJsonRequest, LlmTextRequest } from '../interfaces';

@Injectable()
export class OpenAiLlmClient implements LlmClient {
  private client?: OpenAI;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    this.model = this.configService.get<string>('OPENAI_MODEL') ?? 'gpt-5.4-mini';
  }

  async completeText(request: LlmTextRequest): Promise<string> {
    const response = await this.getClient().chat.completions.create({
      model: this.model,
      temperature: request.temperature ?? this.defaultTemperature(),
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt },
      ],
    });

    const content: unknown = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error('OpenAI response did not include any content.');
    }

    return this.extractTextContent(content);
  }

  async completeJson<T>(request: LlmJsonRequest): Promise<T> {
    const response = await this.getClient().chat.completions.create({
      model: this.model,
      temperature: request.temperature ?? this.defaultTemperature(),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt },
      ],
    });

    const content: unknown = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error('OpenAI JSON response did not include any content.');
    }

    const jsonText = this.extractTextContent(content);

    return JSON.parse(jsonText) as T;
  }

  private defaultTemperature(): number {
    const configured = this.configService.get<string>('OPENAI_TEMPERATURE');
    return configured ? Number(configured) : 0.2;
  }

  private getClient(): OpenAI {
    if (this.client) {
      return this.client;
    }

    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required to run the OpenAI-backed v1 provider.');
    }

    this.client = new OpenAI({ apiKey });
    return this.client;
  }

  private extractTextContent(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((segment) => {
          if (typeof segment === 'string') {
            return segment;
          }

          if (segment && typeof segment === 'object' && 'text' in segment) {
            return String((segment as { text?: unknown }).text ?? '');
          }

          return '';
        })
        .join('');
    }

    return String(content);
  }
}
