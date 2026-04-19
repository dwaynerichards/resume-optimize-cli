import { Inject, Injectable } from '@nestjs/common';
import { LLM_CLIENT } from '../../common/constants';
import { ResumeRewriteInput, TailoredResumeDocument } from '../../common/types';
import { loadPrompt, renderPrompt } from '../../common/utils';
import { LlmClient, ResumeRewriteProvider } from '../interfaces';

@Injectable()
export class OpenAiResumeRewriteProvider implements ResumeRewriteProvider {
  constructor(@Inject(LLM_CLIENT) private readonly llmClient: LlmClient) {}

  async tailor(input: ResumeRewriteInput): Promise<TailoredResumeDocument> {
    const systemPrompt = await loadPrompt('tailor_resume.md');
    return this.llmClient.completeJson<TailoredResumeDocument>({
      systemPrompt,
      userPrompt: renderPrompt('Generate a tailored resume using only this canonical evidence.', input),
    });
  }
}
