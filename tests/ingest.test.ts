import { BASE_PROFILE_DEFINITIONS } from '../src/common/constants';
import { ExtractedResumeDocument, ResumeMergeAssistResult } from '../src/common/types';
import { ResumeMergeService } from '../src/ingest/resume-merge.service';

describe('ResumeMergeService', () => {
  it('merges duplicate experience across multiple resume sources and discovers clusters', async () => {
    const service = new ResumeMergeService({
      merge: async (): Promise<ResumeMergeAssistResult> => ({
        summaryVariants: [],
        additionalRoleClusters: [],
        supportSignals: {
          'public-service': ['public sector work'],
          'backend-engineer': ['backend APIs'],
          'general-swe': [],
          'blockchain-engineer': [],
        },
      }),
    });
    const resumes: ExtractedResumeDocument[] = [
      {
        sourceFile: 'resume-a.md',
        identity: { fullName: 'Jordan Example' },
        contact: { email: 'jordan@example.com' },
        education: [],
        certifications: [],
        summaryVariants: [{ id: 'summary-a', label: 'general', text: 'Backend engineer', tags: ['backend'] }],
        skills: [{ category: 'Backend', items: ['TypeScript', 'Node.js'] }],
        domainTags: ['backend', 'finance'],
        notes: [],
        sourceReference: {
          sourceFile: 'resume-a.md',
          sourceType: 'markdown',
          extractedAt: '2026-04-09T00:00:00.000Z',
        },
        experience: [
          {
            company: 'JP Morgan Chase',
            roleTitle: 'Senior Software Engineer',
            dateRange: { start: '2021-01', end: '2024-01' },
            bullets: [
              {
                original: 'Built backend APIs for enterprise integrations.',
                alternates: [],
                tags: ['backend', 'api'],
                domainTags: ['finance', 'enterprise-platform'],
                safeReframes: ['backend systems'],
                allowedProfiles: ['backend-engineer', 'general-swe'],
                riskLevel: 'low',
                confidence: 0.9,
              },
            ],
            tags: ['backend'],
            domainTags: ['finance'],
            alternatePhrasings: [],
            safeReframingCategories: ['backend systems'],
            confidence: 0.9,
          },
        ],
      },
      {
        sourceFile: 'resume-b.md',
        identity: { fullName: 'Jordan Example' },
        contact: { email: 'jordan@example.com', linkedin: 'linkedin.com/in/jordan-example' },
        education: [],
        certifications: [],
        summaryVariants: [],
        skills: [{ category: 'Leadership', items: ['Cross-functional leadership'] }],
        domainTags: ['public-sector'],
        notes: [],
        sourceReference: {
          sourceFile: 'resume-b.md',
          sourceType: 'markdown',
          extractedAt: '2026-04-09T00:00:00.000Z',
        },
        experience: [
          {
            company: 'JP Morgan Chase',
            roleTitle: 'Senior Software Engineer',
            dateRange: { start: '2021-01', end: '2024-01' },
            bullets: [
              {
                original: 'Built backend APIs for enterprise integrations.',
                alternates: ['Implemented API integrations for enterprise systems.'],
                tags: ['backend', 'integration'],
                domainTags: ['finance'],
                safeReframes: ['enterprise integration'],
                allowedProfiles: ['backend-engineer', 'general-swe'],
                riskLevel: 'low',
                confidence: 0.9,
              },
            ],
            tags: ['backend'],
            domainTags: ['finance'],
            alternatePhrasings: [],
            safeReframingCategories: ['enterprise integration'],
            confidence: 0.9,
          },
          {
            company: 'Fire Department',
            roleTitle: 'Technology Volunteer',
            dateRange: { start: '2020-01', end: '2020-12' },
            bullets: [
              {
                original: 'Supported incident reporting workflows for a public service program.',
                alternates: [],
                tags: ['public-sector', 'operations'],
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
            confidence: 0.8,
          },
        ],
      },
    ];

    const result = await service.merge(resumes, BASE_PROFILE_DEFINITIONS);

    expect(result.canonicalResume.experience).toHaveLength(2);
    expect(result.bulletBank.bullets).toHaveLength(2);
    expect(result.canonicalResume.roleClusters.map((cluster) => cluster.id)).toContain(
      'org-jp-morgan-chase',
    );
    expect(result.canonicalResume.roleClusters.map((cluster) => cluster.id)).toContain(
      'focus-public-sector',
    );
  });
});
