import { Inject, Injectable } from '@nestjs/common';
import { resolve } from 'path';
import {
  BULLET_BANK_FILENAME,
  DEFAULT_DATA_DIR,
  PROFILE_DEFAULTS_FILENAME,
  RESUME_MASTER_FILENAME,
  RESUME_REWRITE_PROVIDER,
} from '../common/constants';
import { TailoringRequest, TailoredResumeDocument } from '../common/types';
import { ResumeRewriteProvider } from '../llm/interfaces';
import { JobParseService } from '../jobs/job-parse.service';
import { ProfileResolutionService } from '../profiles/profile-resolution.service';
import { ExperienceMappingService } from './experience-mapping.service';
import { ResumeDataLoaderService } from './resume-data-loader.service';

@Injectable()
export class ResumeTailorService {
  constructor(
    private readonly resumeDataLoaderService: ResumeDataLoaderService,
    private readonly jobParseService: JobParseService,
    private readonly profileResolutionService: ProfileResolutionService,
    private readonly experienceMappingService: ExperienceMappingService,
    @Inject(RESUME_REWRITE_PROVIDER)
    private readonly resumeRewriteProvider: ResumeRewriteProvider,
  ) {}

  async generate(request: TailoringRequest): Promise<TailoredResumeDocument> {
    const dataDir = resolve(process.cwd(), process.env.DATA_DIR ?? DEFAULT_DATA_DIR);
    const canonicalResume = await this.resumeDataLoaderService.loadCanonicalResume(
      resolve(dataDir, RESUME_MASTER_FILENAME),
    );
    const bulletBank = await this.resumeDataLoaderService.loadBulletBank(
      resolve(dataDir, BULLET_BANK_FILENAME),
    );
    const profileDefaults = await this.profileResolutionService.loadProfileDefaults(
      resolve(dataDir, PROFILE_DEFAULTS_FILENAME),
    );
    const profile = this.profileResolutionService.resolveProfile(profileDefaults, request.profileId);
    const job = await this.jobParseService.fetchAndNormalize(request.jobUrl);
    const prepared = await this.experienceMappingService.prepareRewriteInput(
      canonicalResume,
      bulletBank,
      profile,
      job,
      request.experienceControls,
      request.lengthTarget,
    );

    const tailored = await this.resumeRewriteProvider.tailor(prepared.rewriteInput);
    const experienceOrder = new Map(
      prepared.rewriteInput.canonicalResume.experience.map((entry, index) => [entry.id, index]),
    );

    return {
      ...tailored,
      profileId: request.profileId,
      identity: tailored.identity ?? prepared.rewriteInput.canonicalResume.identity,
      contact: tailored.contact ?? prepared.rewriteInput.canonicalResume.contact,
      education:
        tailored.education && tailored.education.length > 0
          ? tailored.education
          : prepared.rewriteInput.canonicalResume.education,
      certifications:
        tailored.certifications && tailored.certifications.length > 0
          ? tailored.certifications
          : prepared.rewriteInput.canonicalResume.certifications,
      summary: tailored.summary ?? '',
      skills:
        tailored.skills && tailored.skills.length > 0
          ? tailored.skills
          : prepared.rewriteInput.canonicalResume.skills,
      experience: [...(tailored.experience ?? [])].sort(
        (left, right) =>
          (experienceOrder.get(left.experienceId) ?? Number.MAX_SAFE_INTEGER) -
          (experienceOrder.get(right.experienceId) ?? Number.MAX_SAFE_INTEGER),
      ),
      job,
      requirementMappings:
        tailored.requirementMappings && tailored.requirementMappings.length > 0
          ? tailored.requirementMappings
          : prepared.rewriteInput.requirementMappings,
      selectedBlocks: prepared.selectedBlocks,
      omittedBlocks: prepared.omittedBlocks,
      lengthTarget: request.lengthTarget,
      generatedAt: tailored.generatedAt ?? new Date().toISOString(),
    };
  }
}
