import { Inject, Injectable } from '@nestjs/common';
import { LLM_CLIENT } from '../../common/constants';
import { ChangeReportInput } from '../../common/types';
import { loadPrompt, renderPrompt } from '../../common/utils';
import { LlmClient, ReportGenerationProvider } from '../interfaces';

@Injectable()
export class OpenAiReportGenerationProvider implements ReportGenerationProvider {
  constructor(@Inject(LLM_CLIENT) private readonly llmClient: LlmClient) {}

  async generate(input: ChangeReportInput): Promise<string> {
    const systemPrompt = await loadPrompt('generate_change_report.md');
    return this.llmClient.completeText({
      systemPrompt,
      userPrompt: renderPrompt('Write a markdown change report for this tailoring run.', input),
    });
  }
}
