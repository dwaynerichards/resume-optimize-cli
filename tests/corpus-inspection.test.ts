import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { resolve } from 'path';
import { CorpusInspectionService } from '../src/cli/corpus-inspection.service';
import { ExperienceControlDiscoveryService } from '../src/profiles/experience-control-discovery.service';
import { ProfileRegistryService } from '../src/profiles/profile-registry.service';
import { ProfileResolutionService } from '../src/profiles/profile-resolution.service';
import { ResumeDataLoaderService } from '../src/tailoring/resume-data-loader.service';

describe('CorpusInspectionService', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), 'corpus-inspection-'));

    const canonicalResume = {
      identity: { fullName: 'Jordan Example' },
      contact: { email: 'jordan@example.com' },
      education: [],
      certifications: [],
      summaryVariants: [],
      skills: [],
      experience: [
        {
          id: 'role-1',
          company: 'JP Morgan Chase',
          roleTitle: 'Senior Software Engineer',
          dateRange: { start: '2021-01', end: '2024-01' },
          bullets: [
            {
              id: 'role-1-bullet-1',
              sourceFile: './resume-a.md',
              sourceRoleId: 'role-1',
              company: 'JP Morgan Chase',
              role: 'Senior Software Engineer',
              original: 'Built APIs.',
              alternates: [],
              tags: ['backend'],
              domainTags: ['enterprise-platform'],
              safeReframes: ['backend systems'],
              allowedProfiles: ['backend-engineer', 'general-swe'],
              riskLevel: 'low',
              confidence: 0.9,
            },
          ],
          tags: ['backend'],
          domainTags: ['enterprise-platform'],
          alternatePhrasings: [],
          safeReframingCategories: ['backend systems'],
          optionality: { defaultIncluded: true, blockIds: ['org-jpmc'] },
          sourceReferences: [],
          chronologyIndex: 0,
          confidence: 0.9,
        },
        {
          id: 'role-2',
          company: 'Fire Department',
          roleTitle: 'Technology Volunteer',
          dateRange: { start: '2020-01', end: '2020-12' },
          bullets: [
            {
              id: 'role-2-bullet-1',
              sourceFile: './resume-b.md',
              sourceRoleId: 'role-2',
              company: 'Fire Department',
              role: 'Technology Volunteer',
              original: 'Supported reporting workflows.',
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
          optionality: { defaultIncluded: true, blockIds: ['focus-public-sector'] },
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
          experienceIds: ['role-1'],
          bulletIds: ['role-1-bullet-1'],
          defaultInclusion: true,
          inferredSupportProfiles: ['backend-engineer', 'general-swe'],
        },
        {
          id: 'focus-public-sector',
          label: 'public sector',
          type: 'domain',
          tags: ['public-sector'],
          domainTags: ['public-sector'],
          experienceIds: ['role-2'],
          bulletIds: ['role-2-bullet-1'],
          defaultInclusion: false,
          inferredSupportProfiles: ['public-service', 'general-swe'],
        },
      ],
      domainTags: ['enterprise-platform', 'public-sector'],
      optionalSections: [],
      sourceReferences: [
        {
          sourceFile: './resume-a.md',
          sourceType: 'markdown',
          extractedAt: '2026-04-09T00:00:00.000Z',
        },
        {
          sourceFile: './resume-b.md',
          sourceType: 'markdown',
          extractedAt: '2026-04-09T00:00:00.000Z',
        },
      ],
    };

    const bulletBank = {
      bullets: canonicalResume.experience.flatMap((experience) => experience.bullets),
    };
    const profileDefaults = {
      generatedAt: '2026-04-09T00:00:00.000Z',
      sourceFiles: ['./resume-a.md', './resume-b.md'],
      profiles: [
        {
          id: 'backend-engineer',
          label: 'Backend Engineer',
          summaryStyle: 'Systems-focused.',
          skillsOrdering: ['Backend'],
          preferredDomainTags: ['enterprise-platform'],
          preferredBulletTags: ['backend'],
          disfavoredBulletTags: [],
          typicalExperienceInclusionDefaults: [],
          toneGuidance: 'Direct.',
          supportScore: 0.88,
          supported: true,
          recommendedDefaultExperienceBlocks: ['org-jpmc'],
          hiddenIfUnsupported: false,
        },
        {
          id: 'public-service',
          label: 'Public Service',
          summaryStyle: 'Mission-focused.',
          skillsOrdering: ['Leadership'],
          preferredDomainTags: ['public-sector'],
          preferredBulletTags: ['operations'],
          disfavoredBulletTags: [],
          typicalExperienceInclusionDefaults: [],
          toneGuidance: 'Measured.',
          supportScore: 0.54,
          supported: true,
          recommendedDefaultExperienceBlocks: ['focus-public-sector'],
          hiddenIfUnsupported: false,
        },
      ],
    };

    await writeFile(resolve(tempDir, 'resume_master.yaml'), JSON.stringify(canonicalResume, null, 2));
    await writeFile(resolve(tempDir, 'bullet_bank.yaml'), JSON.stringify(bulletBank, null, 2));
    await writeFile(resolve(tempDir, 'profile_defaults.yaml'), JSON.stringify(profileDefaults, null, 2));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('summarizes canonical corpus files and profile support metadata', async () => {
    const service = new CorpusInspectionService(
      new ResumeDataLoaderService(),
      new ExperienceControlDiscoveryService(),
      new ProfileResolutionService(new ProfileRegistryService()),
    );

    const summary = await service.inspect(tempDir);

    expect(summary.dataDir).toBe(resolve(tempDir));
    expect(summary.sourceFiles).toEqual(['./resume-a.md', './resume-b.md']);
    expect(summary.experienceCount).toBe(2);
    expect(summary.bulletCount).toBe(2);
    expect(summary.roleClusterCount).toBe(2);
    expect(summary.blockTypeCounts.organization).toBe(1);
    expect(summary.blockTypeCounts.domain).toBe(1);
    expect(summary.profileCount).toBe(2);
    expect(summary.profileSummaries[0]?.id).toBe('backend-engineer');
  });
});
