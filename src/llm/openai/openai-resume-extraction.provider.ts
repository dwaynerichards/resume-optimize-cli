import { Inject, Injectable } from '@nestjs/common';
import { LLM_CLIENT } from '../../common/constants';
import { renderPrompt, loadPrompt } from '../../common/utils';
import { ExtractedResumeDocument, ResumeExtractionInput } from '../../common/types';
import { LlmClient, ResumeExtractionProvider } from '../interfaces';

@Injectable()
export class OpenAiResumeExtractionProvider implements ResumeExtractionProvider {
  constructor(@Inject(LLM_CLIENT) private readonly llmClient: LlmClient) {}

  async extract(input: ResumeExtractionInput): Promise<ExtractedResumeDocument> {
    const systemPrompt = await loadPrompt('ingest_resume.md');
    return this.llmClient.completeJson<ExtractedResumeDocument>({
      systemPrompt,
      userPrompt: renderPrompt('Extract a structured resume document from this input.', input),
    });
  }
}
