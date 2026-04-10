import { Inject, Injectable } from '@nestjs/common';
import { basename } from 'path';
import { RESUME_EXTRACTION_PROVIDER } from '../common/constants';
import { createChecksum } from '../common/utils';
import { ResumeExtractionProvider } from '../llm/interfaces';
import { ProfileRegistryService } from '../profiles/profile-registry.service';
import { normalizeExtractedResumeDocument } from './resume-extraction-normalizer';
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
      onProgress?: (message: string) => void;
    },
  ): Promise<{
    sourceFiles: string[];
    resumeMasterPath: string;
    bulletBankPath: string;
    profileDefaultsPath: string;
  }> {
    _options?.onProgress?.('Discovering resume sources');
    const sourceFiles = await this.resumeSourceDiscoveryService.collectSources(
      resumePaths,
      _options?.resumeDirPaths ?? [],
    );

    if (sourceFiles.length === 0) {
      throw new Error('Provide at least one resume file to ingest.');
    }

    const extractedResumes = [];

    for (const [index, resumePath] of sourceFiles.entries()) {
      _options?.onProgress?.(
        `Extracting resume ${index + 1}/${sourceFiles.length}: ${basename(resumePath)}`,
      );
      const text = await this.textExtractionService.extract(resumePath);
      const extraction = normalizeExtractedResumeDocument(
        await this.extractionProvider.extract({
          sourceFile: resumePath,
          text,
        }),
        resumePath,
      );

      extractedResumes.push({
        ...extraction,
        sourceFile: resumePath,
        sourceReference: {
          ...extraction.sourceReference,
          sourceFile: resumePath,
          checksum: createChecksum(text),
          extractedAt: extraction.sourceReference?.extractedAt ?? new Date().toISOString(),
        },
      });
    }

    const baseProfiles = this.profileRegistryService.getBaseProfiles();
    _options?.onProgress?.('Merging canonical resume data');
    const { canonicalResume, bulletBank, mergeAssist } = await this.resumeMergeService.merge(
      extractedResumes,
      baseProfiles,
    );
    const profileDefaults = this.profileRegistryService.buildProfileDefaults(
      canonicalResume,
      mergeAssist.supportSignals,
    );

    _options?.onProgress?.('Writing canonical resume artifacts');
    const persisted = await this.masterBuilderService.persist(canonicalResume, bulletBank, profileDefaults);

    return {
      ...persisted,
      sourceFiles,
    };
  }
}
