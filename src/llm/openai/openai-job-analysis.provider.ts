import { Inject, Injectable } from '@nestjs/common';
import { LLM_CLIENT } from '../../common/constants';
import { loadPrompt, renderPrompt } from '../../common/utils';
import { NormalizedJobPosting, RawJobDocument } from '../../common/types';
import { JobAnalysisProvider, LlmClient } from '../interfaces';

@Injectable()
export class OpenAiJobAnalysisProvider implements JobAnalysisProvider {
  constructor(@Inject(LLM_CLIENT) private readonly llmClient: LlmClient) {}

  async analyze(rawJob: RawJobDocument): Promise<NormalizedJobPosting> {
    const systemPrompt = await loadPrompt('extract_job.md');
    return this.llmClient.completeJson<NormalizedJobPosting>({
      systemPrompt,
      userPrompt: renderPrompt('Normalize this fetched job posting.', rawJob),
    });
  }
}
