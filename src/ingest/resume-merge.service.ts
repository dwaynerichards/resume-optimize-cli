import { Inject, Injectable, Logger } from '@nestjs/common';
import { RESUME_MERGE_PROVIDER } from '../common/constants';
import {
  BulletBankDocument,
  CanonicalResume,
  ExperienceEntry,
  ExtractedResumeDocument,
  ProfileDefaultsDocument,
  ProfileDefinition,
  ResumeBullet,
  ResumeMergeAssistResult,
  RoleCluster,
} from '../common/types';
import { slugify, uniqueStrings } from '../common/utils';
import { ResumeMergeProvider } from '../llm/interfaces';

@Injectable()
export class ResumeMergeService {
  private readonly logger = new Logger(ResumeMergeService.name);

  constructor(
    @Inject(RESUME_MERGE_PROVIDER)
    private readonly resumeMergeProvider: ResumeMergeProvider,
  ) {}

  async merge(
    resumes: ExtractedResumeDocument[],
    profiles: ProfileDefinition[],
  ): Promise<{
    canonicalResume: CanonicalResume;
    bulletBank: BulletBankDocument;
    mergeAssist: ResumeMergeAssistResult;
  }> {
    const mergeAssist = await this.safeMergeAssist(resumes, profiles);

    const experienceByFingerprint = new Map<string, ExperienceEntry>();
    const summaryVariants = new Map<string, CanonicalResume['summaryVariants'][number]>();
    const skillsByCategory = new Map<string, Set<string>>();
    const sourceReferences = resumes.map((resume) => resume.sourceReference);
    let identity = resumes[0]?.identity ?? { fullName: 'Unknown Candidate' };
    let contact = resumes[0]?.contact ?? {};
    const education = uniqueBy(
      resumes.flatMap((resume) => resume.education),
      (entry) => `${entry.institution}|${entry.degree ?? ''}|${entry.graduationDate ?? ''}`,
    );
    const certifications = uniqueBy(
      resumes.flatMap((resume) => resume.certifications),
      (entry) => `${entry.name}|${entry.issuer ?? ''}|${entry.issueDate ?? ''}`,
    );

    resumes.forEach((resume) => {
      if (Object.values(resume.contact).filter(Boolean).length > Object.values(contact).filter(Boolean).length) {
        contact = resume.contact;
      }

      if ((resume.identity.fullName?.length ?? 0) > (identity.fullName?.length ?? 0)) {
        identity = resume.identity;
      }

      resume.summaryVariants.forEach((variant) => {
        const key = slugify(variant.text);

        if (!summaryVariants.has(key)) {
          summaryVariants.set(key, variant);
        }
      });

      resume.skills.forEach((category) => {
        const key = category.category.toLowerCase();
        const items = skillsByCategory.get(key) ?? new Set<string>();
        category.items.forEach((item) => items.add(item));
        skillsByCategory.set(key, items);
      });

      resume.experience.forEach((experience, experienceIndex) => {
        const fingerprint = `${slugify(experience.company)}|${slugify(
          experience.roleTitle,
        )}|${experience.dateRange.start}|${experience.dateRange.end ?? 'present'}`;
        const existing = experienceByFingerprint.get(fingerprint);

        if (!existing) {
          const experienceId = `${slugify(experience.company)}-${slugify(experience.roleTitle)}-${
            experience.dateRange.start
          }`;
          const bullets = experience.bullets.map((bullet, bulletIndex) =>
            this.toCanonicalBullet(bullet, {
              id: `${experienceId}-bullet-${bulletIndex + 1}`,
              sourceFile: resume.sourceFile,
              sourceRoleId: experienceId,
              company: experience.company,
              role: experience.roleTitle,
            }),
          );

          experienceByFingerprint.set(fingerprint, {
            id: experienceId,
            company: experience.company,
            roleTitle: experience.roleTitle,
            dateRange: experience.dateRange,
            location: experience.location,
            bullets,
            tags: uniqueStrings(experience.tags),
            domainTags: uniqueStrings(experience.domainTags),
            alternatePhrasings: uniqueStrings(experience.alternatePhrasings),
            safeReframingCategories: uniqueStrings(experience.safeReframingCategories),
            optionality: { defaultIncluded: true, blockIds: [] },
            sourceReferences: [resume.sourceReference],
            chronologyIndex: experienceIndex,
            confidence: experience.confidence,
          });
          return;
        }

        experience.bullets.forEach((bullet) => {
          const duplicate = existing.bullets.find(
            (item) => slugify(item.original) === slugify(bullet.original),
          );

          if (!duplicate) {
            existing.bullets.push(
              this.toCanonicalBullet(bullet, {
                id: `${existing.id}-bullet-${existing.bullets.length + 1}`,
                sourceFile: resume.sourceFile,
                sourceRoleId: existing.id,
                company: existing.company,
                role: existing.roleTitle,
              }),
            );
          }
        });

        existing.tags = uniqueStrings([...existing.tags, ...experience.tags]);
        existing.domainTags = uniqueStrings([...existing.domainTags, ...experience.domainTags]);
        existing.alternatePhrasings = uniqueStrings([
          ...existing.alternatePhrasings,
          ...experience.alternatePhrasings,
        ]);
        existing.safeReframingCategories = uniqueStrings([
          ...existing.safeReframingCategories,
          ...experience.safeReframingCategories,
        ]);
        existing.sourceReferences = uniqueBy(
          [...existing.sourceReferences, resume.sourceReference],
          (reference) => reference.sourceFile,
        );
        existing.confidence = Math.max(existing.confidence, experience.confidence);
      });
    });

    mergeAssist.summaryVariants.forEach((variant) => {
      summaryVariants.set(slugify(variant.text), variant);
    });

    const experience = [...experienceByFingerprint.values()].sort((left, right) =>
      left.dateRange.start < right.dateRange.start ? 1 : -1,
    );
    const roleClusters = this.buildRoleClusters(experience, profiles, mergeAssist);
    const optionalSections = roleClusters.filter((cluster) => cluster.type !== 'organization');

    experience.forEach((entry) => {
      entry.optionality.blockIds = roleClusters
        .filter((cluster) => cluster.experienceIds.includes(entry.id))
        .map((cluster) => cluster.id);
    });

    const bulletBank: BulletBankDocument = {
      bullets: experience.flatMap((entry) => entry.bullets),
    };

    const canonicalResume: CanonicalResume = {
      identity,
      contact,
      education,
      certifications,
      summaryVariants: [...summaryVariants.values()],
      skills: [...skillsByCategory.entries()].map(([category, items]) => ({
        category,
        items: [...items].sort((left, right) => left.localeCompare(right)),
      })),
      experience,
      roleClusters,
      optionalSections,
      domainTags: uniqueStrings(experience.flatMap((entry) => entry.domainTags)),
      sourceReferences,
    };

    return { canonicalResume, bulletBank, mergeAssist };
  }

  private toCanonicalBullet(
    bullet: ExtractedResumeDocument['experience'][number]['bullets'][number],
    metadata: {
      id: string;
      sourceFile: string;
      sourceRoleId: string;
      company: string;
      role: string;
    },
  ): ResumeBullet {
    return {
      id: metadata.id,
      sourceFile: metadata.sourceFile,
      sourceRoleId: metadata.sourceRoleId,
      company: metadata.company,
      role: metadata.role,
      original: bullet.original,
      alternates: uniqueStrings(bullet.alternates),
      tags: uniqueStrings(bullet.tags),
      domainTags: uniqueStrings(bullet.domainTags),
      safeReframes: uniqueStrings(bullet.safeReframes),
      allowedProfiles: bullet.allowedProfiles,
      riskLevel: bullet.riskLevel,
      confidence: bullet.confidence,
    };
  }

  private buildRoleClusters(
    experience: ExperienceEntry[],
    profiles: ProfileDefinition[],
    mergeAssist: ResumeMergeAssistResult,
  ): RoleCluster[] {
    const clusters = new Map<string, RoleCluster>();

    experience.forEach((entry) => {
      const organizationId = `org-${slugify(entry.company)}`;
      this.upsertCluster(clusters, {
        id: organizationId,
        label: `${entry.company} roles`,
        type: 'organization',
        tags: entry.tags,
        domainTags: entry.domainTags,
        experienceIds: [entry.id],
        bulletIds: entry.bullets.map((bullet) => bullet.id),
        defaultInclusion: true,
        inferredSupportProfiles: this.matchProfiles(entry.tags, entry.domainTags, profiles),
      });

      uniqueStrings([...entry.domainTags, ...entry.tags]).forEach((tag) => {
        const tagId = `focus-${slugify(tag)}`;
        this.upsertCluster(clusters, {
          id: tagId,
          label: tag.replace(/-/g, ' '),
          type: entry.domainTags.includes(tag) ? 'domain' : 'focus-area',
          tags: entry.tags,
          domainTags: entry.domainTags,
          experienceIds: [entry.id],
          bulletIds: entry.bullets.map((bullet) => bullet.id),
          defaultInclusion: ['backend', 'leadership', 'public-sector'].includes(tag),
          inferredSupportProfiles: this.matchProfiles([tag, ...entry.tags], entry.domainTags, profiles),
        });
      });
    });

    mergeAssist.additionalRoleClusters.forEach((cluster) => {
      if (!clusters.has(cluster.id)) {
        clusters.set(cluster.id, {
          ...cluster,
          experienceIds: experience
            .filter((entry) =>
              entry.domainTags.some((tag) => cluster.domainTags.includes(tag)) ||
              entry.tags.some((tag) => cluster.tags.includes(tag)),
            )
            .map((entry) => entry.id),
          bulletIds: experience
            .flatMap((entry) => entry.bullets)
            .filter(
              (bullet) =>
                bullet.domainTags.some((tag) => cluster.domainTags.includes(tag)) ||
                bullet.tags.some((tag) => cluster.tags.includes(tag)),
            )
            .map((bullet) => bullet.id),
        });
      }
    });

    return [...clusters.values()]
      .filter((cluster) => cluster.experienceIds.length > 0)
      .sort((left, right) => right.experienceIds.length - left.experienceIds.length);
  }

  private matchProfiles(
    tags: string[],
    domainTags: string[],
    profiles: ProfileDefinition[],
  ): ProfileDefinition['id'][] {
    return profiles
      .filter(
        (profile) =>
          tags.some((tag) => profile.preferredBulletTags.includes(tag)) ||
          domainTags.some((tag) => profile.preferredDomainTags.includes(tag)),
      )
      .map((profile) => profile.id);
  }

  private upsertCluster(clusterMap: Map<string, RoleCluster>, nextCluster: RoleCluster): void {
    const existing = clusterMap.get(nextCluster.id);

    if (!existing) {
      clusterMap.set(nextCluster.id, {
        ...nextCluster,
        tags: uniqueStrings(nextCluster.tags),
        domainTags: uniqueStrings(nextCluster.domainTags),
        experienceIds: uniqueStrings(nextCluster.experienceIds),
        bulletIds: uniqueStrings(nextCluster.bulletIds),
      });
      return;
    }

    existing.tags = uniqueStrings([...existing.tags, ...nextCluster.tags]);
    existing.domainTags = uniqueStrings([...existing.domainTags, ...nextCluster.domainTags]);
    existing.experienceIds = uniqueStrings([...existing.experienceIds, ...nextCluster.experienceIds]);
    existing.bulletIds = uniqueStrings([...existing.bulletIds, ...nextCluster.bulletIds]);
    existing.inferredSupportProfiles = uniqueStrings([
      ...existing.inferredSupportProfiles,
      ...nextCluster.inferredSupportProfiles,
    ]) as RoleCluster['inferredSupportProfiles'];
    existing.defaultInclusion = existing.defaultInclusion || nextCluster.defaultInclusion;
  }

  private async safeMergeAssist(
    resumes: ExtractedResumeDocument[],
    profiles: ProfileDefinition[],
  ): Promise<ResumeMergeAssistResult> {
    try {
      return this.normalizeMergeAssist(await this.resumeMergeProvider.merge({ resumes, profiles }));
    } catch (error) {
      this.logger.warn(
        `Falling back to deterministic merge assistance: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return {
        summaryVariants: [],
        additionalRoleClusters: [],
        supportSignals: {
          'public-service': [],
          'backend-engineer': [],
          'general-swe': [],
          'blockchain-engineer': [],
        },
      };
    }
  }

  private normalizeMergeAssist(value: ResumeMergeAssistResult | undefined): ResumeMergeAssistResult {
    const record = asRecord(value);
    const supportSignals = asRecord(record.supportSignals);

    return {
      summaryVariants: asArray(record.summaryVariants)
        .map((variant, index) => this.normalizeSummaryVariant(variant, index))
        .filter(isDefined),
      additionalRoleClusters: asArray(record.additionalRoleClusters)
        .map((cluster) => this.normalizeRoleCluster(cluster))
        .filter(isDefined),
      supportSignals: {
        'public-service': toStringArray(supportSignals['public-service']),
        'backend-engineer': toStringArray(supportSignals['backend-engineer']),
        'general-swe': toStringArray(supportSignals['general-swe']),
        'blockchain-engineer': toStringArray(supportSignals['blockchain-engineer']),
      },
    };
  }

  private normalizeSummaryVariant(
    value: unknown,
    index: number,
  ): ResumeMergeAssistResult['summaryVariants'][number] | undefined {
    const record = asRecord(value);
    const text = toOptionalString(record.text);

    if (!text) {
      return undefined;
    }

    return {
      id: toOptionalString(record.id) ?? (slugify(text) || `summary-${index + 1}`),
      label: toOptionalString(record.label) ?? 'general',
      text,
      tags: toStringArray(record.tags),
      sourceBulletIds: toStringArray(record.sourceBulletIds),
    };
  }

  private normalizeRoleCluster(
    value: unknown,
  ): ResumeMergeAssistResult['additionalRoleClusters'][number] | undefined {
    const record = asRecord(value);
    const id = toOptionalString(record.id);
    const label = toOptionalString(record.label);
    const type = toClusterType(record.type);

    if (!id || !label || !type) {
      return undefined;
    }

    return {
      id,
      label,
      type,
      tags: toStringArray(record.tags),
      domainTags: toStringArray(record.domainTags),
      defaultInclusion: Boolean(record.defaultInclusion),
      inferredSupportProfiles: toSupportedProfileIds(record.inferredSupportProfiles),
    };
  }
}

function uniqueBy<T>(values: T[], keyFn: (value: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = keyFn(value);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() || undefined : undefined;
}

function toStringArray(value: unknown): string[] {
  return uniqueStrings(asArray(value).map((item) => toOptionalString(item)).filter(isDefined));
}

function toClusterType(value: unknown): RoleCluster['type'] | undefined {
  return value === 'organization' || value === 'domain' || value === 'focus-area' || value === 'section'
    ? value
    : undefined;
}

function toSupportedProfileIds(value: unknown): RoleCluster['inferredSupportProfiles'] {
  return asArray(value).filter(
    (item): item is RoleCluster['inferredSupportProfiles'][number] =>
      item === 'public-service' ||
      item === 'backend-engineer' ||
      item === 'general-swe' ||
      item === 'blockchain-engineer',
  );
}
