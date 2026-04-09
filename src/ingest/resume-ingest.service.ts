import { Inject, Injectable } from '@nestjs/common';
import { RESUME_EXTRACTION_PROVIDER } from '../common/constants';
import { createChecksum } from '../common/utils';
import { ResumeExtractionProvider } from '../llm/interfaces';
import { ProfileRegistryService } from '../profiles/profile-registry.service';
import { ResumeMasterBuilderService } from './resume-master-builder.service';
import { ResumeMergeService } from './resume-merge.service';
import { ResumeTextExtractionService } from './resume-text-extraction.service';

@Injectable()
export class ResumeIngestService {
  constructor(
    private readonly textExtractionService: ResumeTextExtractionService,
    @Inject(RESUME_EXTRACTION_PROVIDER)
    private readonly extractionProvider: ResumeExtractionProvider,
    private readonly resumeMergeService: ResumeMergeService,
    private readonly masterBuilderService: ResumeMasterBuilderService,
    private readonly profileRegistryService: ProfileRegistryService,
  ) {}

  async ingest(
    resumePaths: string[],
    _options?: {
      metadataPath?: string;
    },
  ): Promise<{
    resumeMasterPath: string;
    bulletBankPath: string;
    profileDefaultsPath: string;
  }> {
    if (resumePaths.length === 0) {
      throw new Error('Provide at least one resume file to ingest.');
    }

    const extractedResumes = await Promise.all(
      resumePaths.map(async (resumePath) => {
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

    return this.masterBuilderService.persist(canonicalResume, bulletBank, profileDefaults);
  }
}
