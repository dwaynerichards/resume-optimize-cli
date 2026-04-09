import { Inject, Injectable, Logger } from '@nestjs/common';
import { RESUME_REWRITE_PROVIDER } from '../common/constants';
import {
  BulletBankDocument,
  CanonicalResume,
  ExperienceControl,
  ExperienceEntry,
  LengthTarget,
  NormalizedJobPosting,
  ProfileDefinition,
  RequirementMapping,
  ResumeRewriteInput,
  RoleCluster,
} from '../common/types';
import { countOverlap, tokenize, uniqueStrings } from '../common/utils';
import { ResumeRewriteProvider } from '../llm/interfaces';

interface PreparedRewriteContext {
  rewriteInput: ResumeRewriteInput;
  selectedBlocks: string[];
  omittedBlocks: string[];
}

@Injectable()
export class ExperienceMappingService {
  private readonly logger = new Logger(ExperienceMappingService.name);

  constructor(
    @Inject(RESUME_REWRITE_PROVIDER)
    private readonly resumeRewriteProvider: ResumeRewriteProvider,
  ) {}

  async prepareRewriteInput(
    canonicalResume: CanonicalResume,
    bulletBank: BulletBankDocument,
    profile: ProfileDefinition,
    job: NormalizedJobPosting,
    experienceControls: ExperienceControl[],
    lengthTarget: LengthTarget,
  ): Promise<PreparedRewriteContext> {
    const controlMap = new Map(experienceControls.map((control) => [control.blockId, control]));
    const selectedBlocks: string[] = [];
    const omittedBlocks: string[] = [];

    canonicalResume.roleClusters.forEach((cluster) => {
      const control = controlMap.get(cluster.id);
      const selected =
        control?.include ??
        (profile.recommendedDefaultExperienceBlocks.includes(cluster.id) || cluster.defaultInclusion);

      if (selected) {
        selectedBlocks.push(cluster.id);
      } else {
        omittedBlocks.push(cluster.id);
      }
    });

    const selectedExperience = this.selectExperience(
      canonicalResume.experience,
      canonicalResume.roleClusters,
      profile,
      job,
      experienceControls,
      lengthTarget,
    );
    const selectedExperienceIds = new Set(selectedExperience.map((entry) => entry.id));
    const filteredBulletBank: BulletBankDocument = {
      bullets: bulletBank.bullets.filter((bullet) => selectedExperienceIds.has(bullet.sourceRoleId)),
    };
    const filteredResume: CanonicalResume = {
      ...canonicalResume,
      skills: this.reorderSkills(canonicalResume.skills, profile),
      experience: selectedExperience,
      roleClusters: canonicalResume.roleClusters.filter((cluster) =>
        cluster.experienceIds.some((experienceId) => selectedExperienceIds.has(experienceId)),
      ),
      optionalSections: canonicalResume.optionalSections.filter((cluster) =>
        cluster.experienceIds.some((experienceId) => selectedExperienceIds.has(experienceId)),
      ),
    };

    const rewriteInputBase: ResumeRewriteInput = {
      canonicalResume: filteredResume,
      bulletBank: filteredBulletBank,
      profile,
      job,
      experienceControls,
      lengthTarget,
      requirementMappings: [],
    };
    const requirementMappings = await this.safeRequirementMapping(rewriteInputBase);

    return {
      rewriteInput: {
        ...rewriteInputBase,
        requirementMappings,
      },
      selectedBlocks,
      omittedBlocks,
    };
  }

  private selectExperience(
    experienceEntries: ExperienceEntry[],
    clusters: RoleCluster[],
    profile: ProfileDefinition,
    job: NormalizedJobPosting,
    experienceControls: ExperienceControl[],
    lengthTarget: LengthTarget,
  ): ExperienceEntry[] {
    const controlMap = new Map(experienceControls.map((control) => [control.blockId, control]));
    const priorityMap = new Map<string, number>();
    const selectedEntries = experienceEntries
      .map((entry) => {
        const entryClusters = clusters.filter((cluster) => cluster.experienceIds.includes(entry.id));
        const organizationExcluded = entryClusters.some((cluster) => {
          const control = controlMap.get(cluster.id);
          return cluster.type === 'organization' && control?.include === false;
        });

        if (organizationExcluded) {
          return undefined;
        }

        const score = entryClusters.reduce((total, cluster) => {
          const control = controlMap.get(cluster.id);
          const explicitlyIncluded = control?.include === true;
          const explicitlyExcluded = control?.include === false;

          if (explicitlyExcluded) {
            return total - 1.25;
          }

          const clusterWeight = explicitlyIncluded
            ? emphasisWeight(control.emphasis)
            : profile.recommendedDefaultExperienceBlocks.includes(cluster.id) || cluster.defaultInclusion
              ? 1
              : 0;
          const tagWeight =
            cluster.domainTags.filter((tag) => profile.preferredDomainTags.includes(tag)).length * 0.4 +
            cluster.tags.filter((tag) => profile.preferredBulletTags.includes(tag)).length * 0.25;

          if (control?.orderPriority !== undefined) {
            const current = priorityMap.get(entry.id);
            priorityMap.set(entry.id, current === undefined ? control.orderPriority : Math.min(current, control.orderPriority));
          }

          return total + clusterWeight + tagWeight;
        }, 0);

        const scoredBullets = [...entry.bullets]
          .map((bullet) => ({
            bullet,
            score:
              this.bulletJobScore(
                `${bullet.original} ${bullet.alternates.join(' ')}`,
                job,
                profile,
                entryClusters,
                controlMap,
              ) + emphasisClusterBoost(entryClusters, controlMap),
          }))
          .sort((left, right) => right.score - left.score)
          .slice(0, maxBulletsForLength(lengthTarget))
          .map((item) => item.bullet);

        if (score <= 0 || scoredBullets.length === 0) {
          return undefined;
        }

        return {
          ...entry,
          bullets: scoredBullets,
        };
      })
      .filter((entry): entry is ExperienceEntry => Boolean(entry));

    return selectedEntries.sort((left, right) => {
      const leftPriority = priorityMap.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightPriority = priorityMap.get(right.id) ?? Number.MAX_SAFE_INTEGER;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return left.dateRange.start < right.dateRange.start ? 1 : -1;
    });
  }

  private reorderSkills(
    skills: CanonicalResume['skills'],
    profile: ProfileDefinition,
  ): CanonicalResume['skills'] {
    const orderedGroups = [...skills];
    const ordering = profile.skillsOrdering.map((item) => item.toLowerCase());

    return orderedGroups.sort((left, right) => {
      const leftIndex = ordering.findIndex((item) => left.category.toLowerCase().includes(item.toLowerCase()));
      const rightIndex = ordering.findIndex((item) => right.category.toLowerCase().includes(item.toLowerCase()));

      if (leftIndex === -1 && rightIndex === -1) {
        return left.category.localeCompare(right.category);
      }

      if (leftIndex === -1) {
        return 1;
      }

      if (rightIndex === -1) {
        return -1;
      }

      return leftIndex - rightIndex;
    });
  }

  private bulletJobScore(
    text: string,
    job: NormalizedJobPosting,
    profile: ProfileDefinition,
    clusters: RoleCluster[],
    controlMap: Map<string, ExperienceControl>,
  ): number {
    const bulletTokens = tokenize(text);
    const jobTokens = tokenize(
      [
        job.jobTitle,
        ...job.responsibilities,
        ...job.minimumQualifications,
        ...job.preferredQualifications,
        ...job.atsKeywords,
      ].join(' '),
    );
    const overlapScore = countOverlap(bulletTokens, jobTokens);
    const profileBias =
      clusters.flatMap((cluster) => cluster.domainTags).filter((tag) => profile.preferredDomainTags.includes(tag))
        .length +
      clusters.flatMap((cluster) => cluster.tags).filter((tag) => profile.preferredBulletTags.includes(tag)).length;
    const explicitBoost = clusters.reduce((total, cluster) => {
      const control = controlMap.get(cluster.id);
      return total + (control?.include ? emphasisWeight(control.emphasis) * 0.5 : 0);
    }, 0);

    return overlapScore + profileBias + explicitBoost;
  }

  private async safeRequirementMapping(
    rewriteInput: ResumeRewriteInput,
  ): Promise<RequirementMapping[]> {
    try {
      return await this.resumeRewriteProvider.mapRequirements(rewriteInput);
    } catch (error) {
      this.logger.warn(
        `Falling back to heuristic requirement mapping: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      const requirements = uniqueStrings([
        ...rewriteInput.job.minimumQualifications,
        ...rewriteInput.job.preferredQualifications,
      ]);

      return requirements.map((requirement) => {
        const requirementTokens = tokenize(requirement);
        const matches = rewriteInput.bulletBank.bullets
          .map((bullet) => ({
            bulletId: bullet.id,
            score: countOverlap(requirementTokens, tokenize(`${bullet.original} ${bullet.alternates.join(' ')}`)),
          }))
          .filter((match) => match.score > 0)
          .sort((left, right) => right.score - left.score)
          .slice(0, 3)
          .map((match) => match.bulletId);

        return {
          requirement,
          matchedBulletIds: matches,
          rationale:
            matches.length > 0
              ? 'Heuristic keyword overlap found supporting bullets.'
              : 'No direct evidence found; requirement should not be overstated.',
          confidence: matches.length > 0 ? 0.6 : 0.2,
        };
      });
    }
  }
}

const emphasisWeight = (emphasis: ExperienceControl['emphasis'] = 'medium'): number => {
  if (emphasis === 'high') {
    return 1.75;
  }

  if (emphasis === 'low') {
    return 0.6;
  }

  return 1;
};

const emphasisClusterBoost = (
  clusters: RoleCluster[],
  controlMap: Map<string, ExperienceControl>,
): number =>
  clusters.reduce((total, cluster) => {
    const control = controlMap.get(cluster.id);
    return total + (control?.include ? emphasisWeight(control.emphasis) : 0);
  }, 0);

const maxBulletsForLength = (lengthTarget: LengthTarget): number => {
  if (lengthTarget === 'concise') {
    return 2;
  }

  if (lengthTarget === 'expanded') {
    return 4;
  }

  return 3;
};
