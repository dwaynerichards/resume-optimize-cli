import { NormalizedJobPosting, RawJobDocument } from '../../common/types';

export interface JobAnalysisProvider {
  analyze(rawJob: RawJobDocument): Promise<NormalizedJobPosting>;
}
