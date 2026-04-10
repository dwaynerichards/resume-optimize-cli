import { Inject, Injectable } from '@nestjs/common';
import { RESUME_EXTRACTION_PROVIDER } from '../common/constants';
import { createChecksum } from '../common/utils';
import { ResumeExtractionProvider } from '../llm/interfaces';
import { ProfileRegistryService } from '../profiles/profile-registry.service';
import { ResumeMasterBuilderService } from './resume-master-builder.service';
import { ResumeMergeService } from './resume-merge.service';
import { ResumeSourceDiscoveryService } from './resume-source-discovery.service';
import { ResumeTextExtractionService } from './resume-text-extraction.service';

@Injectable()
export class ResumeIngestService {
  constructor(
    private readonly textExtractionService: ResumeTextExtractionService,
    @Inject(RESUME_EXTRACTION_PROVIDER)
    private readonly extractionProvider: ResumeExtractionProvider,
    private readonly resumeSourceDiscoveryService: ResumeSourceDiscoveryService,
    private readonly resumeMergeService: ResumeMergeService,
    private readonly masterBuilderService: ResumeMasterBuilderService,
    private readonly profileRegistryService: ProfileRegistryService,
  ) {}

  async ingest(
    resumePaths: string[],
    _options?: {
      resumeDirPaths?: string[];
      metadataPath?: string;
    },
  ): Promise<{
    sourceFiles: string[];
    resumeMasterPath: string;
    bulletBankPath: string;
    profileDefaultsPath: string;
  }> {
    const sourceFiles = await this.resumeSourceDiscoveryService.collectSources(
      resumePaths,
      _options?.resumeDirPaths ?? [],
    );

    if (sourceFiles.length === 0) {
      throw new Error('Provide at least one resume file to ingest.');
    }

    const extractedResumes = await Promise.all(
      sourceFiles.map(async (resumePath) => {
        const text = await this.textExtractionService.extract(resumePath);
        const extraction = await this.extractionProvider.extract({
          sourceFile: resumePath,
          text,
        });

        return {
          ...extraction,
          sourceFile: resumePath,
          sourceReference: {
            ...extraction.sourceReference,
            sourceFile: resumePath,
            checksum: createChecksum(text),
            extractedAt: extraction.sourceReference?.extractedAt ?? new Date().toISOString(),
          },
        };
      }),
    );
    const baseProfiles = this.profileRegistryService.getBaseProfiles();
    const { canonicalResume, bulletBank, mergeAssist } = await this.resumeMergeService.merge(
      extractedResumes,
      baseProfiles,
    );
    const profileDefaults = this.profileRegistryService.buildProfileDefaults(
      canonicalResume,
      mergeAssist.supportSignals,
    );

    const persisted = await this.masterBuilderService.persist(canonicalResume, bulletBank, profileDefaults);

    return {
      ...persisted,
      sourceFiles,
    };
  }
}
