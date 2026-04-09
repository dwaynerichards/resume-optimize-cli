import { Inject, Injectable } from '@nestjs/common';
import { LLM_CLIENT } from '../../common/constants';
import { loadPrompt, renderPrompt } from '../../common/utils';
import { ResumeMergeAssistResult, ResumeMergeInput } from '../../common/types';
import { LlmClient, ResumeMergeProvider } from '../interfaces';

@Injectable()
export class OpenAiResumeMergeProvider implements ResumeMergeProvider {
  constructor(@Inject(LLM_CLIENT) private readonly llmClient: LlmClient) {}

  async merge(input: ResumeMergeInput): Promise<ResumeMergeAssistResult> {
    const systemPrompt = await loadPrompt('merge_resumes.md');
    return this.llmClient.completeJson<ResumeMergeAssistResult>({
      systemPrompt,
      userPrompt: renderPrompt('Merge these extracted resumes conservatively.', input),
    });
  }
}
