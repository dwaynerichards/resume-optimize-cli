import { ExtractedResumeDocument, ResumeExtractionInput } from '../../common/types';

export interface ResumeExtractionProvider {
  extract(input: ResumeExtractionInput): Promise<ExtractedResumeDocument>;
}
