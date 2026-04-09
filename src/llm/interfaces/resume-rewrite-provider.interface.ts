import {
  RequirementMapping,
  ResumeRewriteInput,
  TailoredResumeDocument,
} from '../../common/types';

export interface ResumeRewriteProvider {
  mapRequirements(input: ResumeRewriteInput): Promise<RequirementMapping[]>;
  tailor(input: ResumeRewriteInput): Promise<TailoredResumeDocument>;
}
