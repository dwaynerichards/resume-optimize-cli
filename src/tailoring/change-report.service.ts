import { Inject, Injectable, Logger } from '@nestjs/common';
import { REPORT_GENERATION_PROVIDER } from '../common/constants';
import { ChangeReportInput } from '../common/types';
import { ReportGenerationProvider } from '../llm/interfaces';

@Injectable()
export class ChangeReportService {
  private readonly logger = new Logger(ChangeReportService.name);

  constructor(
    @Inject(REPORT_GENERATION_PROVIDER)
    private readonly reportGenerationProvider: ReportGenerationProvider,
  ) {}

  async generate(input: ChangeReportInput): Promise<string> {
    try {
      return await this.reportGenerationProvider.generate(input);
    } catch (error) {
      this.logger.warn(
        `Falling back to deterministic change report: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return [
        '# Change Report',
        '',
        `- Profile: ${input.profile.label}`,
        `- Job Target: ${input.tailoredResume.job.jobTitle} at ${input.tailoredResume.job.employer ?? 'Unknown employer'}`,
        `- Selected Blocks: ${input.tailoredResume.selectedBlocks.join(', ') || 'None'}`,
        `- Omitted Blocks: ${input.tailoredResume.omittedBlocks.join(', ') || 'None'}`,
        '',
        '## Requirement Mapping',
        ...input.tailoredResume.requirementMappings.map(
          (mapping) =>
            `- ${mapping.requirement}: ${mapping.matchedBulletIds.join(', ') || 'no direct evidence mapped'}`,
        ),
      ].join('\n');
    }
  }
}
