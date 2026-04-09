import { ResumeMergeAssistResult, ResumeMergeInput } from '../../common/types';

export interface ResumeMergeProvider {
  merge(input: ResumeMergeInput): Promise<ResumeMergeAssistResult>;
}
