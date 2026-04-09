import { Injectable } from '@nestjs/common';
import { BASE_PROFILE_DEFINITIONS } from '../common/constants';
import {
  CanonicalResume,
  ProfileDefaultsDocument,
  ProfileDefinition,
  RoleCluster,
  SupportedProfileId,
} from '../common/types';

@Injectable()
export class ProfileRegistryService {
  getBaseProfiles(): ProfileDefinition[] {
    return BASE_PROFILE_DEFINITIONS.map((profile) => ({ ...profile }));
  }

  buildProfileDefaults(
    canonicalResume: CanonicalResume,
    supportSignals: Record<SupportedProfileId, string[]>,
  ): ProfileDefaultsDocument {
    const profiles = this.getBaseProfiles().map((profile) =>
      this.applySupportMetadata(profile, canonicalResume, supportSignals[profile.id] ?? []),
    );

    return {
      generatedAt: new Date().toISOString(),
      sourceFiles: canonicalResume.sourceReferences.map((reference) => reference.sourceFile),
      profiles,
    };
  }

  private applySupportMetadata(
    profile: ProfileDefinition,
    canonicalResume: CanonicalResume,
    llmSignals: string[],
  ): ProfileDefinition {
    const allDomainTags = canonicalResume.experience.flatMap((experience) => experience.domainTags);
    const allBulletTags = canonicalResume.experience.flatMap((experience) =>
      experience.bullets.flatMap((bullet) => bullet.tags),
    );

    const preferredDomainMatches = profile.preferredDomainTags.filter((tag) =>
      allDomainTags.includes(tag),
    ).length;
    const preferredBulletMatches = profile.preferredBulletTags.filter((tag) =>
      allBulletTags.includes(tag),
    ).length;
    const signalBoost = Math.min(llmSignals.length * 0.05, 0.25);
    const domainScore =
      preferredDomainMatches / Math.max(profile.preferredDomainTags.length, 1);
    const bulletScore =
      preferredBulletMatches / Math.max(profile.preferredBulletTags.length, 1);
    const supportScore = Number(
      Math.min(1, domainScore * 0.45 + bulletScore * 0.45 + signalBoost).toFixed(2),
    );
    const recommendedDefaultExperienceBlocks = canonicalResume.roleClusters
      .filter((cluster) => this.clusterSupportsProfile(cluster, profile))
      .map((cluster) => cluster.id);
    const supportThreshold = profile.hiddenIfUnsupported ? 0.25 : 0.15;

    return {
      ...profile,
      supportScore,
      supported: supportScore >= supportThreshold,
      recommendedDefaultExperienceBlocks,
    };
  }

  private clusterSupportsProfile(cluster: RoleCluster, profile: ProfileDefinition): boolean {
    return (
      cluster.inferredSupportProfiles.includes(profile.id) ||
      cluster.domainTags.some((tag) => profile.preferredDomainTags.includes(tag)) ||
      cluster.tags.some((tag) => profile.preferredBulletTags.includes(tag))
    );
  }
}
