import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ResumeExtractionDebugArtifactService } from '../src/ingest/resume-extraction-debug-artifact.service';
import { ResumeIngestService } from '../src/ingest/resume-ingest.service';
import { ResumeMasterBuilderService } from '../src/ingest/resume-master-builder.service';
import { ResumeMergeService } from '../src/ingest/resume-merge.service';
import { ResumeSourceDiscoveryService } from '../src/ingest/resume-source-discovery.service';
import { ResumeTextExtractionService } from '../src/ingest/resume-text-extraction.service';
import { ProfileRegistryService } from '../src/profiles/profile-registry.service';
import { ResumeExtractionProvider } from '../src/llm/interfaces';

describe('ResumeIngestService', () => {
  const originalDataDir = process.env.DATA_DIR;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'resume-ingest-'));
    process.env.DATA_DIR = tempDir;
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    if (originalDataDir === undefined) {
      delete process.env.DATA_DIR;
    } else {
      process.env.DATA_DIR = originalDataDir;
    }
  });

  it('writes one extraction artifact per source and includes the normalized snapshot', async () => {
    const service = new ResumeIngestService(
      {
        extract: async () => '',
      } as unknown as ResumeTextExtractionService,
      {
        extract: async ({ sourceFile }: { sourceFile: string }) =>
          sourceFile.includes('one')
            ? {
                sourceFile,
                identity: { fullName: 'Jordan Example' },
                contact: { email: 'jordan@example.com' },
                education: [],
                certifications: [],
                summaryVariants: [],
                skills: [{ category: 'Backend', items: ['TypeScript'] }],
                experience: [
                  {
                    company: 'Acme',
                    roleTitle: 'Engineer',
                    dateRange: { start: '2021-01' },
                    bullets: [{ original: 'Built APIs.' }],
                    tags: [],
                    domainTags: [],
                    alternatePhrasings: [],
                    safeReframingCategories: [],
                    confidence: 0.9,
                  },
                ],
                domainTags: [],
                notes: [],
                sourceReference: { sourceFile, sourceType: 'markdown' },
              }
            : {
                identity: { fullName: 'Jordan Example' },
                contact: { email: 'jordan@example.com' },
                education: [],
                certifications: [],
                summaryVariants: [{ text: 'Backend engineer', tags: [] }],
                skills: [{ category: 'Leadership', items: ['Cross-functional leadership'] }],
                experience: [],
                domainTags: [],
                notes: [],
                sourceReference: { sourceFile, sourceType: 'markdown' },
              },
      } as unknown as ResumeExtractionProvider,
      {
        collectSources: async (resumePaths: string[]) => resumePaths,
      } as unknown as ResumeSourceDiscoveryService,
      new ResumeExtractionDebugArtifactService(),
      {
        merge: async () => ({
          canonicalResume: {
            identity: { fullName: 'Jordan Example' },
            contact: { email: 'jordan@example.com' },
            education: [],
            certifications: [],
            summaryVariants: [{ id: 'summary-a', label: 'general', text: 'Backend engineer', tags: [] }],
            skills: [{ category: 'Backend', items: ['TypeScript'] }],
            experience: [
              {
                id: 'acme-engineer-2021-01',
                company: 'Acme',
                roleTitle: 'Engineer',
                dateRange: { start: '2021-01' },
                bullets: [],
                tags: [],
                domainTags: [],
                alternatePhrasings: [],
                safeReframingCategories: [],
                optionality: { defaultIncluded: true, blockIds: [] },
                sourceReferences: [],
                chronologyIndex: 0,
                confidence: 0.9,
              },
            ],
            roleClusters: [],
            domainTags: [],
            optionalSections: [],
            sourceReferences: [],
          },
          bulletBank: { bullets: [] },
          mergeAssist: {
            summaryVariants: [],
            additionalRoleClusters: [],
            supportSignals: {
              'public-service': [],
              'backend-engineer': [],
              'general-swe': [],
              'blockchain-engineer': [],
            },
          },
        }),
      } as unknown as ResumeMergeService,
      {
        persist: async () => ({
          resumeMasterPath: join(tempDir, 'resume_master.yaml'),
          bulletBankPath: join(tempDir, 'bullet_bank.yaml'),
          profileDefaultsPath: join(tempDir, 'profile_defaults.yaml'),
        }),
      } as unknown as ResumeMasterBuilderService,
      {
        getBaseProfiles: () => [],
        buildProfileDefaults: () => ({
          generatedAt: '2026-04-11T00:00:00.000Z',
          sourceFiles: [],
          profiles: [],
        }),
      } as unknown as ProfileRegistryService,
    );

    const result = await service.ingest(['/corpus/one.md', '/corpus/two.md']);

    expect(result.sourceFiles).toEqual(['/corpus/one.md', '/corpus/two.md']);

    const debugDir = join(tempDir, 'ingest-debug');
    const artifactFiles = readdirSync(debugDir).sort();
    expect(artifactFiles).toHaveLength(2);

    const firstArtifact = JSON.parse(readFileSync(join(debugDir, artifactFiles[0]), 'utf8'));
    expect(firstArtifact).toMatchObject({
      sourcePath: expect.any(String),
      textLength: expect.any(Number),
      extractedIdentity: { fullName: 'Jordan Example' },
      experienceCount: expect.any(Number),
      skillCount: expect.any(Number),
    });
    expect(firstArtifact.normalizedPayloadSnapshot).toBeDefined();
  });

  it('fails loudly when every extracted source normalizes to empty content', async () => {
    const service = new ResumeIngestService(
      {
        extract: async () => '',
      } as unknown as ResumeTextExtractionService,
      {
        extract: async () => ({
          sourceFile: 'empty.md',
          identity: { fullName: 'Unknown Candidate' },
          contact: {},
          education: [],
          certifications: [],
          summaryVariants: [],
          skills: [],
          experience: [],
          domainTags: [],
          notes: [],
          sourceReference: { sourceFile: 'empty.md', sourceType: 'markdown' },
        }),
      } as unknown as ResumeExtractionProvider,
      {
        collectSources: async () => ['/corpus/empty.md'],
      } as unknown as ResumeSourceDiscoveryService,
      new ResumeExtractionDebugArtifactService(),
      {
        merge: async () => {
          throw new Error('merge should not run for empty corpus');
        },
      } as unknown as ResumeMergeService,
      {
        persist: async () => {
          throw new Error('persist should not run for empty corpus');
        },
      } as unknown as ResumeMasterBuilderService,
      {
        getBaseProfiles: () => [],
        buildProfileDefaults: () => ({
          generatedAt: '2026-04-11T00:00:00.000Z',
          sourceFiles: [],
          profiles: [],
        }),
      } as unknown as ProfileRegistryService,
    );

    await expect(service.ingest(['/corpus/empty.md'])).rejects.toThrow(
      'Ingest produced an empty corpus. No meaningful resume content was extracted.',
    );

    const debugDir = join(tempDir, 'ingest-debug');
    const artifactFiles = require('fs').readdirSync(debugDir);
    expect(artifactFiles).toHaveLength(1);
  });

  it('fails loudly when extraction only returns education without any tailoring content', async () => {
    const service = new ResumeIngestService(
      {
        extract: async () => 'resume text',
      } as unknown as ResumeTextExtractionService,
      {
        extract: async () => ({
          sourceFile: 'education-only.md',
          identity: { fullName: 'Jordan Example' },
          contact: {},
          education: [{ institution: 'Example University' }],
          certifications: [],
          summaryVariants: [],
          skills: [],
          experience: [],
          domainTags: [],
          notes: [],
          sourceReference: { sourceFile: 'education-only.md', sourceType: 'markdown' },
        }),
      } as unknown as ResumeExtractionProvider,
      {
        collectSources: async () => ['/corpus/education-only.md'],
      } as unknown as ResumeSourceDiscoveryService,
      new ResumeExtractionDebugArtifactService(),
      {
        merge: async () => {
          throw new Error('merge should not run for education-only extraction');
        },
      } as unknown as ResumeMergeService,
      {
        persist: async () => {
          throw new Error('persist should not run for education-only extraction');
        },
      } as unknown as ResumeMasterBuilderService,
      {
        getBaseProfiles: () => [],
        buildProfileDefaults: () => ({
          generatedAt: '2026-04-11T00:00:00.000Z',
          sourceFiles: [],
          profiles: [],
        }),
      } as unknown as ProfileRegistryService,
    );

    await expect(service.ingest(['/corpus/education-only.md'])).rejects.toThrow(
      'Ingest produced an empty corpus. No meaningful resume content was extracted.',
    );
  });

  it('fails loudly when the merge step returns an empty canonical resume', async () => {
    const service = new ResumeIngestService(
      {
        extract: async () => '',
      } as unknown as ResumeTextExtractionService,
      {
        extract: async () => ({
          sourceFile: 'source.md',
          identity: { fullName: 'Jordan Example' },
          contact: { email: 'jordan@example.com' },
          education: [],
          certifications: [],
          summaryVariants: [],
          skills: [{ category: 'Backend', items: ['TypeScript'] }],
          experience: [
            {
              company: 'Acme',
              roleTitle: 'Engineer',
              dateRange: { start: '2021-01' },
              bullets: [{ original: 'Built APIs.' }],
              tags: [],
              domainTags: [],
              alternatePhrasings: [],
              safeReframingCategories: [],
              confidence: 0.9,
            },
          ],
          domainTags: [],
          notes: [],
          sourceReference: { sourceFile: 'source.md', sourceType: 'markdown' },
        }),
      } as unknown as ResumeExtractionProvider,
      {
        collectSources: async () => ['/corpus/source.md'],
      } as unknown as ResumeSourceDiscoveryService,
      new ResumeExtractionDebugArtifactService(),
      {
        merge: async () => ({
          canonicalResume: {
            identity: { fullName: 'Unknown Candidate' },
            contact: {},
            education: [],
            certifications: [],
            summaryVariants: [],
            skills: [],
            experience: [],
            roleClusters: [],
            domainTags: [],
            optionalSections: [],
            sourceReferences: [],
          },
          bulletBank: { bullets: [] },
          mergeAssist: {
            summaryVariants: [],
            additionalRoleClusters: [],
            supportSignals: {
              'public-service': [],
              'backend-engineer': [],
              'general-swe': [],
              'blockchain-engineer': [],
            },
          },
        }),
      } as unknown as ResumeMergeService,
      {
        persist: async () => {
          throw new Error('persist should not run for empty canonical content');
        },
      } as unknown as ResumeMasterBuilderService,
      {
        getBaseProfiles: () => [],
        buildProfileDefaults: () => ({
          generatedAt: '2026-04-11T00:00:00.000Z',
          sourceFiles: [],
          profiles: [],
        }),
      } as unknown as ProfileRegistryService,
    );

    await expect(service.ingest(['/corpus/source.md'])).rejects.toThrow(
      'Ingest produced an empty canonical resume. No meaningful canonical content was built.',
    );
  });
});
