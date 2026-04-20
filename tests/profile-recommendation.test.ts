import { BASE_PROFILE_DEFINITIONS } from '../src/common/constants/default-profiles';
import { NormalizedJobPosting, ProfileDefaultsDocument } from '../src/common/types';
import { ProfileRecommendationService } from '../src/profiles/profile-recommendation.service';

function profileDefaultsFixture(): ProfileDefaultsDocument {
  return {
    generatedAt: '2026-04-15T00:00:00.000Z',
    sourceFiles: [],
    profiles: BASE_PROFILE_DEFINITIONS.map((profile) => ({ ...profile })),
  };
}

function baseJob(): NormalizedJobPosting {
  return {
    sourceUrl: 'https://example.com/jobs/role',
    fetchedAt: '2026-04-15T00:00:00.000Z',
    pageTitle: 'Example Job',
    jobTitle: 'Software Engineer',
    responsibilities: [],
    minimumQualifications: [],
    preferredQualifications: [],
    domainKeywords: [],
    atsKeywords: [],
    seniorityIndicators: [],
    roleClassification: 'unknown',
    employerContext: 'unknown',
    domainClassification: [],
    confidence: 0.8,
    rawText: '',
    signal: {
      level: 'strong',
      score: 0.9,
      reasons: [],
    },
  };
}

describe('ProfileRecommendationService', () => {
  it('does not prompt when the role signal is strong and unambiguous', () => {
    const service = new ProfileRecommendationService();
    const result = service.recommend(profileDefaultsFixture(), {
      ...baseJob(),
      jobTitle: 'Backend Engineer',
      roleClassification: 'backend-engineering',
      employerContext: 'private-sector',
    });
    expect(result.profileId).toBe('backend-engineer');
    expect(result.shouldPrompt).toBe(false);
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('recommends general-swe for public-sector Full Stack Developer role', () => {
    const service = new ProfileRecommendationService();
    const result = service.recommend(profileDefaultsFixture(), {
      ...baseJob(),
      roleClassification: 'full-stack-engineering',
      employerContext: 'public-sector',
    });
    expect(['general-swe', 'backend-engineer']).toContain(result.profileId);
    expect(result.profileId).not.toBe('public-service');
  });

  it('recommends public-service for explicitly non-technical public-sector role', () => {
    const service = new ProfileRecommendationService();
    const result = service.recommend(profileDefaultsFixture(), {
      ...baseJob(),
      jobTitle: 'Policy Analyst',
      roleClassification: 'non-technical',
      employerContext: 'public-sector',
    });
    expect(result.profileId).toBe('public-service');
  });

  it('falls back to general-swe when role and employer give no signal', () => {
    const service = new ProfileRecommendationService();
    const result = service.recommend(profileDefaultsFixture(), {
      ...baseJob(),
      roleClassification: 'unknown',
      employerContext: 'unknown',
    });
    expect(result.profileId).toBe('general-swe');
    expect(result.shouldPrompt).toBe(true);
    expect(result.rationale).toEqual([
      'No strong profile-specific signals were found; defaulted to general-swe.',
    ]);
    expect(result.alternatives[0]?.profileId).toBe('general-swe');
  });

  it('avoids hidden unsupported profiles even when the role maps to them', () => {
    const service = new ProfileRecommendationService();
    const defaults = profileDefaultsFixture();
    defaults.profiles = defaults.profiles.map((profile) =>
      profile.id === 'blockchain-engineer' ? { ...profile, supported: false } : profile,
    );

    const result = service.recommend(defaults, {
      ...baseJob(),
      jobTitle: 'Blockchain Engineer',
      roleClassification: 'blockchain-engineering',
      employerContext: 'private-sector',
    });

    expect(result.profileId).toBe('general-swe');
  });
});
