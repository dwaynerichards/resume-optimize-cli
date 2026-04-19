import { Injectable } from '@nestjs/common';
import {
  BulletBankDocument,
  CanonicalResume,
  ExperienceControl,
  LengthTarget,
  NormalizedJobPosting,
  ProfileDefinition,
  ResumeRewriteInput,
} from '../common/types';

interface PreparedRewriteContext {
  rewriteInput: ResumeRewriteInput;
  selectedBlocks: string[];
  omittedBlocks: string[];
}

@Injectable()
export class ExperienceMappingService {
  async prepareRewriteInput(
    canonicalResume: CanonicalResume,
    bulletBank: BulletBankDocument,
    profile: ProfileDefinition,
    job: NormalizedJobPosting,
    experienceControls: ExperienceControl[],
    lengthTarget: LengthTarget,
  ): Promise<PreparedRewriteContext> {
    const controlMap = new Map(experienceControls.map((c) => [c.blockId, c]));
    const selectedBlocks: string[] = [];
    const omittedBlocks: string[] = [];

    for (const cluster of canonicalResume.roleClusters) {
      const control = controlMap.get(cluster.id);
      const explicitlyExcluded = control?.include === false;
      const selected = !explicitlyExcluded;
      (selected ? selectedBlocks : omittedBlocks).push(cluster.id);
    }

    const excludedExperienceIds = new Set(
      canonicalResume.roleClusters
        .filter((c) => controlMap.get(c.id)?.include === false)
        .flatMap((c) => c.experienceIds),
    );
    const experience = canonicalResume.experience.filter((e) => !excludedExperienceIds.has(e.id));
    const experienceIds = new Set(experience.map((e) => e.id));
    const filteredBulletBank: BulletBankDocument = {
      bullets: bulletBank.bullets.filter((b) => experienceIds.has(b.sourceRoleId)),
    };
    const filteredResume: CanonicalResume = {
      ...canonicalResume,
      experience,
      roleClusters: canonicalResume.roleClusters.filter((c) =>
        c.experienceIds.some((id) => experienceIds.has(id)),
      ),
      optionalSections: canonicalResume.optionalSections.filter((c) =>
        c.experienceIds.some((id) => experienceIds.has(id)),
      ),
    };

    return {
      rewriteInput: {
        canonicalResume: filteredResume,
        bulletBank: filteredBulletBank,
        profile,
        job,
        experienceControls,
        lengthTarget,
        requirementMappings: [],
      },
      selectedBlocks,
      omittedBlocks,
    };
  }
}
