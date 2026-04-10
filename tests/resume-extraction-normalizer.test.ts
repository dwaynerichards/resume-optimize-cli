import { normalizeExtractedResumeDocument } from '../src/ingest/resume-extraction-normalizer';

describe('normalizeExtractedResumeDocument', () => {
  it('filters undefined nested entries and defaults malformed extraction fields', () => {
    const result = normalizeExtractedResumeDocument(
      {
        identity: { fullName: ' Jordan Example ' },
        contact: null,
        education: [undefined, { institution: ' State University ', degree: ' BS ' }, { degree: 'MS' }],
        certifications: [undefined, { issuer: 'AWS' }, { name: ' AWS Solutions Architect ' }],
        summaryVariants: [undefined, { text: ' Backend engineer building APIs ', tags: ['backend', '', 'backend'] }],
        skills: [undefined, { items: [' TypeScript ', '', 'Node.js'] }],
        experience: [
          undefined,
          {
            company: ' Acme ',
            roleTitle: ' Senior Engineer ',
            dateRange: { start: ' 2021-01 ' },
            bullets: [
              undefined,
              {
                original: ' Built internal APIs ',
                tags: ['backend'],
                domainTags: ['platform'],
                allowedProfiles: ['backend-engineer', 'not-a-profile'],
                riskLevel: 'not-a-risk-level',
                confidence: '0.9',
              },
            ],
            confidence: '0.8',
          },
        ],
        domainTags: [' backend ', '', 'backend'],
        notes: [' needs review ', '', 'needs review'],
      },
      '../Resumes/resume.md',
    );

    expect(result.identity).toEqual({
      fullName: 'Jordan Example',
      headline: undefined,
      location: undefined,
    });
    expect(result.education).toEqual([
      {
        institution: 'State University',
        degree: 'BS',
        fieldOfStudy: undefined,
        location: undefined,
        graduationDate: undefined,
        honors: [],
      },
    ]);
    expect(result.certifications).toEqual([
      {
        name: 'AWS Solutions Architect',
        issuer: undefined,
        issueDate: undefined,
        expirationDate: undefined,
        credentialId: undefined,
      },
    ]);
    expect(result.summaryVariants).toEqual([
      {
        id: 'backend-engineer-building-apis',
        label: 'general',
        text: 'Backend engineer building APIs',
        tags: ['backend'],
        sourceBulletIds: [],
      },
    ]);
    expect(result.skills).toEqual([
      {
        category: 'General',
        items: ['TypeScript', 'Node.js'],
        evidence: [],
      },
    ]);
    expect(result.experience).toEqual([
      {
        company: 'Acme',
        roleTitle: 'Senior Engineer',
        dateRange: {
          start: '2021-01',
          end: undefined,
          current: undefined,
        },
        location: undefined,
        bullets: [
          {
            original: 'Built internal APIs',
            alternates: [],
            tags: ['backend'],
            domainTags: ['platform'],
            safeReframes: [],
            allowedProfiles: ['backend-engineer'],
            riskLevel: 'low',
            confidence: 0.9,
          },
        ],
        tags: [],
        domainTags: [],
        alternatePhrasings: [],
        safeReframingCategories: [],
        confidence: 0.8,
      },
    ]);
    expect(result.domainTags).toEqual(['backend']);
    expect(result.notes).toEqual(['needs review']);
    expect(result.sourceReference.sourceFile).toBe('../Resumes/resume.md');
    expect(result.sourceReference.sourceType).toBe('markdown');
  });
});
