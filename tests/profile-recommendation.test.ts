import { BASE_PROFILE_DEFINITIONS } from '../src/common/constants/default-profiles';
import { NormalizedJobPosting, ProfileDefaultsDocument } from '../src/common/types';
import { ProfileRecommendationService } from '../src/profiles/profile-recommendation.service';

describe('ProfileRecommendationService', () => {
  const service = new ProfileRecommendationService();

  function buildDefaults(): ProfileDefaultsDocument {
    return {
      generatedAt: '2026-04-15T00:00:00.000Z',
      sourceFiles: [],
      profiles: BASE_PROFILE_DEFINITIONS.map((profile) => ({ ...profile })),
    };
  }

  function buildJob(overrides: Partial<NormalizedJobPosting>): NormalizedJobPosting {
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
      domainClassification: ['software-engineering'],
      confidence: 0.8,
      rawText: '',
      signal: {
        level: 'strong',
        score: 0.9,
        reasons: [],
      },
      ...overrides,
    };
  }

  it('recommends backend-engineer for strong backend jobs', () => {
    const recommendation = service.recommend(
      buildDefaults(),
      buildJob({
        jobTitle: 'Senior Backend Engineer',
        responsibilities: ['Design APIs and integration workflows for backend services.'],
        minimumQualifications: ['Experience with distributed systems and platform reliability.'],
        domainKeywords: ['backend', 'api', 'integration'],
        atsKeywords: ['typescript', 'microservices'],
        domainClassification: ['backend-engineering'],
      }),
    );

    expect(recommendation.profileId).toBe('backend-engineer');
    expect(recommendation.confidence).toBeGreaterThanOrEqual(0.72);
    expect(recommendation.shouldPrompt).toBe(false);
  });

  it('falls back conservatively and prompts on thin generic pages', () => {
    const recommendation = service.recommend(
      buildDefaults(),
      buildJob({
        jobTitle: 'Careers',
        responsibilities: [],
        minimumQualifications: [],
        preferredQualifications: [],
        domainKeywords: [],
        atsKeywords: [],
        domainClassification: [],
        rawText: 'Join our team.',
        signal: {
          level: 'thin',
          score: 0.22,
          reasons: ['Only a small amount of role-specific content was found.'],
        },
      }),
    );

    expect(recommendation.profileId).toBe('public-service');
    expect(recommendation.shouldPrompt).toBe(true);
    expect(recommendation.rationale).toContain(
      'Job page signal is thin, so the recommendation remains conservative.',
    );
  });
});
