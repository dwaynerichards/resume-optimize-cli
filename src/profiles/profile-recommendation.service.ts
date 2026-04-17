import { Injectable } from '@nestjs/common';
import {
  NormalizedJobPosting,
  ProfileDefaultsDocument,
  ProfileDefinition,
  ProfileRecommendation,
  ProfileRecommendationCandidate,
} from '../common/types';

const CLASSIFICATION_PROFILE_MAP: Record<string, ProfileDefinition['id']> = {
  'backend-engineering': 'backend-engineer',
  blockchain: 'blockchain-engineer',
  'public-service': 'public-service',
  'software-engineering': 'general-swe',
};

@Injectable()
export class ProfileRecommendationService {
  recommend(
    profileDefaults: ProfileDefaultsDocument,
    job: NormalizedJobPosting,
  ): ProfileRecommendation {
    const visibleProfiles = profileDefaults.profiles.filter(
      (profile) => profile.supported !== false || !profile.hiddenIfUnsupported,
    );
    const profiles = visibleProfiles.length > 0 ? visibleProfiles : profileDefaults.profiles;
    const scored = profiles.map((profile) => this.scoreProfile(profile, job));
    scored.sort((left, right) => right.score - left.score);

    const top = scored[0];
    const runnerUp = scored[1];
    const margin = top && runnerUp ? top.score - runnerUp.score : top?.score ?? 0;
    const signalBonus =
      job.signal?.level === 'strong' ? 0.12 : job.signal?.level === 'weak' ? 0.04 : 0;
    const confidence = Math.max(
      0.35,
      Math.min(
        0.97,
        Number((0.45 + (top?.score ?? 0) * 0.3 + margin * 0.35 + signalBonus).toFixed(2)),
      ),
    );
    const shouldPrompt = confidence < 0.72 || margin < 0.12 || (top?.score ?? 0) < 0.5;

    const alternatives: ProfileRecommendationCandidate[] = scored
      .slice(0, 3)
      .map(({ profile, score }) => ({ profileId: profile.id, score: Number(score.toFixed(2)) }));

    return {
      profileId: top?.profile.id ?? 'public-service',
      confidence,
      rationale:
        top?.reasons.length > 0
          ? top.reasons
          : ['No strong profile-specific signals were found, so the baseline profile was used.'],
      shouldPrompt,
      alternatives,
    };
  }

  private scoreProfile(profile: ProfileDefinition, job: NormalizedJobPosting): {
    profile: ProfileDefinition;
    score: number;
    reasons: string[];
  } {
    const haystack = this.normalize(
      [
        job.jobTitle,
        job.employer,
        job.location,
        ...job.domainClassification,
        ...job.domainKeywords,
        ...job.atsKeywords,
        ...job.seniorityIndicators,
        ...job.responsibilities,
        ...job.minimumQualifications,
        ...job.preferredQualifications,
        job.rawText,
      ]
        .filter(Boolean)
        .join(' '),
    );

    const reasons: string[] = [];
    let score = profile.id === 'public-service' ? 0.12 : 0.08;

    for (const classification of job.domainClassification) {
      if (CLASSIFICATION_PROFILE_MAP[classification] === profile.id) {
        score += 0.5;
        reasons.push(`Matched job classification "${classification}".`);
      }
    }

    const domainOverlap = this.computeOverlap(profile.preferredDomainTags, haystack);
    if (domainOverlap > 0) {
      score += domainOverlap * 0.28;
      reasons.push(`Job content overlaps preferred domain tags for ${profile.label}.`);
    }

    const bulletOverlap = this.computeOverlap(profile.preferredBulletTags, haystack);
    if (bulletOverlap > 0) {
      score += bulletOverlap * 0.2;
      reasons.push(`Job requirements align with ${profile.label} emphasis tags.`);
    }

    if (profile.supportScore !== undefined) {
      score += profile.supportScore * 0.12;
      if (profile.supportScore > 0.2) {
        reasons.push(`Current corpus support for ${profile.label} is above baseline.`);
      }
    }

    if (profile.supported === false) {
      score -= profile.hiddenIfUnsupported ? 0.25 : 0.08;
      reasons.push(`Current corpus support for ${profile.label} is limited.`);
    }

    if (job.signal?.level === 'thin') {
      score -= 0.04;
      reasons.push('Job page signal is thin, so the recommendation remains conservative.');
    }

    return {
      profile,
      score: Number(score.toFixed(2)),
      reasons: this.unique(reasons),
    };
  }

  private computeOverlap(phrases: string[], haystack: string): number {
    if (phrases.length === 0 || !haystack) {
      return 0;
    }

    const matches = phrases.filter((phrase) => this.matchesPhrase(phrase, haystack)).length;
    return matches / phrases.length;
  }

  private matchesPhrase(phrase: string, haystack: string): boolean {
    const normalizedPhrase = this.normalize(phrase);
    if (!normalizedPhrase) {
      return false;
    }

    if (haystack.includes(normalizedPhrase)) {
      return true;
    }

    const haystackTokens = new Set(haystack.split(' ').filter(Boolean));
    return normalizedPhrase.split(' ').every((token) => haystackTokens.has(token));
  }

  private normalize(value: string | undefined): string {
    return (value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private unique(values: string[]): string[] {
    return [...new Set(values)];
  }
}
