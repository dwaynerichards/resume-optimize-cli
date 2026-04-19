import { ResumeTailorService } from '../src/tailoring/resume-tailor.service';

describe('ResumeTailorService', () => {
  it('normalizes missing bullet traceability fields from the rewrite provider', async () => {
    const service = new ResumeTailorService(
      {
        loadCanonicalResume: async () => ({
          identity: { fullName: 'Dwayne Richards' },
          contact: {},
          education: [],
          certifications: [],
          summaryVariants: [],
          skills: [],
          experience: [{ id: 'exp-1' }],
          roleClusters: [],
          domainTags: [],
          optionalSections: [],
          sourceReferences: [],
        }),
        loadBulletBank: async () => ({ bullets: [] }),
      } as never,
      {} as never,
      {
        loadProfileDefaults: async () => ({ profiles: [{ id: 'general-swe' }] }),
        resolveProfile: () => ({ id: 'general-swe' }),
      } as never,
      {
        prepareRewriteInput: async () => ({
          rewriteInput: {
            canonicalResume: {
              identity: { fullName: 'Dwayne Richards' },
              contact: {},
              education: [],
              certifications: [],
              summaryVariants: [],
              skills: [],
              experience: [{ id: 'exp-1' }],
              roleClusters: [],
              domainTags: [],
              optionalSections: [],
              sourceReferences: [],
            },
            bulletBank: { bullets: [] },
            profile: { id: 'general-swe' },
            job: { jobTitle: 'Engineer' },
            experienceControls: [],
            lengthTarget: 'standard',
            requirementMappings: [],
          },
          selectedBlocks: [],
          omittedBlocks: [],
        }),
      } as never,
      {
        tailor: async () => ({
          summary: 'Tailored summary',
          experience: [
            {
              experienceId: 'exp-1',
              company: 'Acme',
              roleTitle: 'Engineer',
              dateRange: { start: '2024-01' },
              bullets: [{ text: 'Built APIs.' }],
              emphasis: 'high',
            },
          ],
        }),
      } as never,
    );

    const result = await service.generate({
      job: {
        sourceUrl: 'https://example.com/job',
        fetchedAt: '2026-04-16T00:00:00.000Z',
        jobTitle: 'Engineer',
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
      },
      profileId: 'general-swe',
      experienceControls: [],
      lengthTarget: 'standard',
      outputFormat: 'md',
    });

    expect(result.experience[0]?.bullets[0]?.sourceBulletIds).toEqual([]);
    expect(result.experience[0]?.bullets[0]?.tags).toEqual([]);
  });
});
