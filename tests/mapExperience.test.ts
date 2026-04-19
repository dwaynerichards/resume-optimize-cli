import { BASE_PROFILE_DEFINITIONS } from '../src/common/constants';
import { BulletBankDocument, CanonicalResume } from '../src/common/types';
import { ExperienceMappingService } from '../src/tailoring/experience-mapping.service';

describe('ExperienceMappingService', () => {
  it('prioritizes selected experience blocks and filters omitted ones', async () => {
    const service = new ExperienceMappingService({
      mapRequirements: async () => [
        {
          requirement: 'Node.js APIs',
          matchedBulletIds: ['jpmc-role-bullet-1'],
          rationale: 'Direct API match.',
          confidence: 0.9,
        },
      ],
      tailor: async () => {
        throw new Error('not used in this test');
      },
    });
    const canonicalResume: CanonicalResume = {
      identity: { fullName: 'Jordan Example' },
      contact: { email: 'jordan@example.com' },
      education: [],
      certifications: [],
      summaryVariants: [],
      skills: [
        { category: 'Backend', items: ['Node.js', 'TypeScript'] },
        { category: 'Leadership', items: ['Mentoring'] },
      ],
      experience: [
        {
          id: 'jpmc-role',
          company: 'JP Morgan Chase',
          roleTitle: 'Senior Software Engineer',
          dateRange: { start: '2021-01', end: '2024-01' },
          location: 'New York, NY',
          bullets: [
            {
              id: 'jpmc-role-bullet-1',
              sourceFile: 'resume-a.md',
              sourceRoleId: 'jpmc-role',
              company: 'JP Morgan Chase',
              role: 'Senior Software Engineer',
              original: 'Built Node.js APIs for enterprise integrations.',
              alternates: [],
              tags: ['backend', 'api'],
              domainTags: ['enterprise-platform'],
              safeReframes: ['enterprise integration'],
              allowedProfiles: ['backend-engineer', 'general-swe'],
              riskLevel: 'low',
              confidence: 0.9,
            },
          ],
          tags: ['backend'],
          domainTags: ['enterprise-platform'],
          alternatePhrasings: [],
          safeReframingCategories: ['enterprise integration'],
          optionality: { defaultIncluded: true, blockIds: ['org-jpmc', 'focus-backend'] },
          sourceReferences: [],
          chronologyIndex: 0,
          confidence: 0.9,
        },
        {
          id: 'fdny-role',
          company: 'Fire Department',
          roleTitle: 'Technology Volunteer',
          dateRange: { start: '2020-01', end: '2020-12' },
          location: 'New York, NY',
          bullets: [
            {
              id: 'fdny-role-bullet-1',
              sourceFile: 'resume-b.md',
              sourceRoleId: 'fdny-role',
              company: 'Fire Department',
              role: 'Technology Volunteer',
              original: 'Supported public service reporting workflows.',
              alternates: [],
              tags: ['public-sector'],
              domainTags: ['public-sector'],
              safeReframes: ['service delivery'],
              allowedProfiles: ['public-service', 'general-swe'],
              riskLevel: 'low',
              confidence: 0.8,
            },
          ],
          tags: ['public-sector'],
          domainTags: ['public-sector'],
          alternatePhrasings: [],
          safeReframingCategories: ['service delivery'],
          optionality: { defaultIncluded: true, blockIds: ['org-fdny', 'focus-public-sector'] },
          sourceReferences: [],
          chronologyIndex: 1,
          confidence: 0.8,
        },
      ],
      roleClusters: [
        {
          id: 'org-jpmc',
          label: 'JP Morgan Chase roles',
          type: 'organization',
          tags: ['backend'],
          domainTags: ['enterprise-platform'],
          experienceIds: ['jpmc-role'],
          bulletIds: ['jpmc-role-bullet-1'],
          defaultInclusion: true,
          inferredSupportProfiles: ['backend-engineer', 'general-swe'],
        },
        {
          id: 'focus-backend',
          label: 'backend',
          type: 'focus-area',
          tags: ['backend'],
          domainTags: ['enterprise-platform'],
          experienceIds: ['jpmc-role'],
          bulletIds: ['jpmc-role-bullet-1'],
          defaultInclusion: true,
          inferredSupportProfiles: ['backend-engineer', 'general-swe'],
        },
        {
          id: 'org-fdny',
          label: 'Fire Department roles',
          type: 'organization',
          tags: ['public-sector'],
          domainTags: ['public-sector'],
          experienceIds: ['fdny-role'],
          bulletIds: ['fdny-role-bullet-1'],
          defaultInclusion: true,
          inferredSupportProfiles: ['public-service', 'general-swe'],
        },
        {
          id: 'focus-public-sector',
          label: 'public sector',
          type: 'domain',
          tags: ['public-sector'],
          domainTags: ['public-sector'],
          experienceIds: ['fdny-role'],
          bulletIds: ['fdny-role-bullet-1'],
          defaultInclusion: false,
          inferredSupportProfiles: ['public-service', 'general-swe'],
        },
      ],
      domainTags: ['enterprise-platform', 'public-sector'],
      optionalSections: [],
      sourceReferences: [],
    };
    const bulletBank: BulletBankDocument = {
      bullets: canonicalResume.experience.flatMap((entry) => entry.bullets),
    };
    const backendProfile = BASE_PROFILE_DEFINITIONS.find((profile) => profile.id === 'backend-engineer');

    if (!backendProfile) {
      throw new Error('backend-engineer profile missing');
    }

    const prepared = await service.prepareRewriteInput(
      canonicalResume,
      bulletBank,
      backendProfile,
      {
        sourceUrl: 'https://example.com/jobs/backend',
        fetchedAt: '2026-04-09T00:00:00.000Z',
        jobTitle: 'Senior Backend Engineer',
        responsibilities: ['Design backend APIs'],
        minimumQualifications: ['Node.js APIs'],
        preferredQualifications: [],
        domainKeywords: ['backend'],
        atsKeywords: ['node.js', 'typescript'],
        seniorityIndicators: ['senior'],
        roleClassification: 'backend-engineering',
        employerContext: 'unknown',
        domainClassification: ['backend-engineering'],
        confidence: 0.8,
      },
      [
        { blockId: 'focus-backend', include: true, emphasis: 'high', orderPriority: 1 },
        { blockId: 'org-fdny', include: false, emphasis: 'low' },
      ],
      'standard',
    );

    expect(prepared.rewriteInput.canonicalResume.experience.map((entry) => entry.id)).toEqual(['jpmc-role']);
    expect(prepared.selectedBlocks).toContain('focus-backend');
    expect(prepared.omittedBlocks).toContain('org-fdny');
    expect(prepared.rewriteInput.requirementMappings[0]?.matchedBulletIds).toContain('jpmc-role-bullet-1');
  });
});
