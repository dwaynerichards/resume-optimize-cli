import { BulletBankDocument, CanonicalResume, TailoredResumeDocument } from '../src/common/types';
import { ClaimTraceabilityService } from '../src/validation/claim-traceability.service';
import { ResumeValidationService } from '../src/validation/resume-validation.service';

describe('ResumeValidationService', () => {
  it('flags unsupported technologies and year inflation', async () => {
    const canonicalResume: CanonicalResume = {
      identity: { fullName: 'Jordan Example' },
      contact: { email: 'jordan@example.com' },
      education: [],
      certifications: [],
      summaryVariants: [],
      skills: [{ category: 'Backend', items: ['Node.js', 'TypeScript'] }],
      experience: [
        {
          id: 'jpmc-role',
          company: 'JP Morgan Chase',
          roleTitle: 'Senior Software Engineer',
          dateRange: { start: '2021-01', end: '2024-01' },
          bullets: [],
          tags: ['backend'],
          domainTags: ['finance'],
          alternatePhrasings: [],
          safeReframingCategories: [],
          optionality: { defaultIncluded: true, blockIds: [] },
          sourceReferences: [],
          chronologyIndex: 0,
          confidence: 0.9,
        },
      ],
      roleClusters: [],
      domainTags: ['finance'],
      optionalSections: [],
      sourceReferences: [],
    };
    const bulletBank: BulletBankDocument = {
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
          domainTags: ['finance'],
          safeReframes: ['enterprise integration'],
          allowedProfiles: ['backend-engineer', 'general-swe'],
          riskLevel: 'low',
          confidence: 0.9,
        },
      ],
    };
    const tailoredResume: TailoredResumeDocument = {
      profileId: 'backend-engineer',
      identity: canonicalResume.identity,
      contact: canonicalResume.contact,
      summary: 'Senior backend engineer with broad platform experience.',
      skills: canonicalResume.skills,
      experience: [
        {
          experienceId: 'jpmc-role',
          company: 'JP Morgan Chase',
          roleTitle: 'Senior Software Engineer',
          dateRange: { start: '2021-01', end: '2024-01' },
          bullets: [
            {
              text: 'Built AWS GIS services and delivered 12 years of platform leadership.',
              sourceBulletIds: ['jpmc-role-bullet-1'],
              tags: ['backend'],
            },
          ],
          emphasis: 'high',
        },
      ],
      education: [],
      certifications: [],
      job: {
        sourceUrl: 'https://example.com/jobs/backend',
        fetchedAt: '2026-04-09T00:00:00.000Z',
        jobTitle: 'Senior Backend Engineer',
        responsibilities: [],
        minimumQualifications: [],
        preferredQualifications: [],
        domainKeywords: [],
        atsKeywords: [],
        seniorityIndicators: [],
        domainClassification: [],
        confidence: 0.8,
      },
      requirementMappings: [],
      selectedBlocks: ['org-jpmc'],
      omittedBlocks: [],
      lengthTarget: 'standard',
      generatedAt: '2026-04-09T00:00:00.000Z',
    };
    const service = new ResumeValidationService(new ClaimTraceabilityService());

    const result = await service.validate(tailoredResume, canonicalResume, bulletBank);

    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'unsupported_technology')).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'unsupported_year')).toBe(true);
  });

  it('rejects empty tailored output as an effective failure', async () => {
    const canonicalResume: CanonicalResume = {
      identity: { fullName: 'Jordan Example' },
      contact: { email: 'jordan@example.com' },
      education: [],
      certifications: [],
      summaryVariants: [],
      skills: [],
      experience: [],
      roleClusters: [],
      domainTags: [],
      optionalSections: [],
      sourceReferences: [],
    };
    const bulletBank: BulletBankDocument = { bullets: [] };
    const tailoredResume: TailoredResumeDocument = {
      profileId: 'backend-engineer',
      identity: canonicalResume.identity,
      contact: canonicalResume.contact,
      summary: '   ',
      skills: [],
      experience: [],
      education: [],
      certifications: [],
      job: {
        sourceUrl: 'https://example.com/jobs/backend',
        fetchedAt: '2026-04-09T00:00:00.000Z',
        jobTitle: 'Senior Backend Engineer',
        responsibilities: [],
        minimumQualifications: [],
        preferredQualifications: [],
        domainKeywords: [],
        atsKeywords: [],
        seniorityIndicators: [],
        domainClassification: [],
        confidence: 0.8,
      },
      requirementMappings: [],
      selectedBlocks: [],
      omittedBlocks: [],
      lengthTarget: 'standard',
      generatedAt: '2026-04-09T00:00:00.000Z',
    };
    const service = new ResumeValidationService(new ClaimTraceabilityService());

    const result = await service.validate(tailoredResume, canonicalResume, bulletBank);

    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'empty_tailored_output')).toBe(true);
  });
});
