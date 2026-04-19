import { Injectable } from '@nestjs/common';
import {
  NormalizedJobPosting,
  ProfileDefaultsDocument,
  ProfileDefinition,
  ProfileRecommendation,
  ProfileRecommendationCandidate,
  RoleClassification,
  EmployerContext,
} from '../common/types';

const ROLE_PROFILE_MAP: Record<RoleClassification, ProfileDefinition['id'] | undefined> = {
  'backend-engineering': 'backend-engineer',
  'frontend-engineering': 'general-swe',
  'full-stack-engineering': 'general-swe',
  'software-engineering': 'general-swe',
  'blockchain-engineering': 'blockchain-engineer',
  'data-engineering': 'general-swe',
  'devops-sre': 'general-swe',
  'non-technical': 'public-service',
  unknown: undefined,
};

const EMPLOYER_BONUS: Partial<Record<EmployerContext, { profile: ProfileDefinition['id']; bonus: number }>> = {
  'public-sector': { profile: 'public-service', bonus: 0.08 },
};

@Injectable()
export class ProfileRecommendationService {
  recommend(
    profileDefaults: ProfileDefaultsDocument,
    job: NormalizedJobPosting,
  ): ProfileRecommendation {
    const visible = profileDefaults.profiles.filter(
      (p) => p.supported !== false || !p.hiddenIfUnsupported,
    );
    const profiles = visible.length > 0 ? visible : profileDefaults.profiles;

    const primary = ROLE_PROFILE_MAP[job.roleClassification];
    const employerModifier = EMPLOYER_BONUS[job.employerContext];

    const scored = profiles.map((profile) => {
      const reasons: string[] = [];
      let score = 0;

      if (primary === profile.id) {
        score += 0.6;
        reasons.push(`Role classification "${job.roleClassification}" maps to ${profile.label}.`);
      }

      if (employerModifier && employerModifier.profile === profile.id) {
        score += employerModifier.bonus;
        reasons.push(`Employer context "${job.employerContext}" favors ${profile.label}.`);
      }

      if (profile.supportScore !== undefined) {
        score += profile.supportScore * 0.12;
      }

      if (profile.supported === false) {
        score -= profile.hiddenIfUnsupported ? 0.25 : 0.08;
        reasons.push(`Current corpus support for ${profile.label} is limited.`);
      }

      return { profile, score: Number(score.toFixed(2)), reasons };
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored[0];
    const runnerUp = scored[1];
    const margin = top && runnerUp ? top.score - runnerUp.score : top?.score ?? 0;
    const signalBonus =
      job.signal?.level === 'strong' ? 0.12 : job.signal?.level === 'weak' ? 0.04 : 0;
    const confidence = Math.max(
      0.35,
      Math.min(0.97, Number((0.45 + (top?.score ?? 0) * 0.3 + margin * 0.35 + signalBonus).toFixed(2))),
    );

    const alternatives: ProfileRecommendationCandidate[] = scored
      .slice(0, 3)
      .map(({ profile, score }) => ({ profileId: profile.id, score }));

    return {
      profileId: top?.profile.id ?? 'general-swe',
      confidence,
      rationale:
        top && top.reasons.length > 0
          ? top.reasons
          : ['No strong profile-specific signals were found; defaulted to general-swe.'],
      shouldPrompt: confidence < 0.72 || margin < 0.12 || (top?.score ?? 0) < 0.5,
      alternatives,
    };
  }
}
