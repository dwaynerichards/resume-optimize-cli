import { ResumeRewriteInput, TailoredResumeDocument } from '../../common/types';

export interface ResumeRewriteProvider {
  tailor(input: ResumeRewriteInput): Promise<TailoredResumeDocument>;
}
