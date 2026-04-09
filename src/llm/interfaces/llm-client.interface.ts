export interface LlmTextRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

export interface LlmJsonRequest extends LlmTextRequest {}

export interface LlmClient {
  completeText(request: LlmTextRequest): Promise<string>;
  completeJson<T>(request: LlmJsonRequest): Promise<T>;
}
