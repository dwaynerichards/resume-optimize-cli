import { ChangeReportInput } from '../../common/types';

export interface ReportGenerationProvider {
  generate(input: ChangeReportInput): Promise<string>;
}
