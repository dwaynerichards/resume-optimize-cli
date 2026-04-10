import { Injectable } from '@nestjs/common';
import { resolve } from 'path';
import { IngestCommandOptions, TailorCommandOptions } from './common/dto/cli-options.dto';
import {
  BULLET_BANK_FILENAME,
  DEFAULT_DATA_DIR,
  DEFAULT_OUTPUT_DIR,
  PROFILE_DEFAULTS_FILENAME,
  RESUME_MASTER_FILENAME,
} from './common/constants';
import { TailoringArtifacts } from './common/types';
import { ensureDirectory } from './common/utils';
import { MarkdownExportService } from './export/markdown-export.service';
import { DocxExportService } from './export/docx-export.service';
import { ResumeIngestService } from './ingest/resume-ingest.service';
import { ProfileResolutionService } from './profiles/profile-resolution.service';
import { ResumeTailorService } from './tailoring/resume-tailor.service';
import { ChangeReportService } from './tailoring/change-report.service';
import { ResumeDataLoaderService } from './tailoring/resume-data-loader.service';
import { ResumeValidationService } from './validation/resume-validation.service';

@Injectable()
export class AppService {
  constructor(
    private readonly resumeIngestService: ResumeIngestService,
    private readonly profileResolutionService: ProfileResolutionService,
    private readonly resumeDataLoaderService: ResumeDataLoaderService,
    private readonly resumeTailorService: ResumeTailorService,
    private readonly resumeValidationService: ResumeValidationService,
    private readonly markdownExportService: MarkdownExportService,
    private readonly docxExportService: DocxExportService,
    private readonly changeReportService: ChangeReportService,
  ) {}

  async ingestResumes(options: IngestCommandOptions): Promise<{
    sourceFiles: string[];
    resumeMasterPath: string;
    bulletBankPath: string;
    profileDefaultsPath: string;
  }> {
    return this.resumeIngestService.ingest(options.resumePaths, {
      resumeDirPaths: options.resumeDirPaths,
      metadataPath: options.metadataPath,
    });
  }

  async tailorResume(options: TailorCommandOptions): Promise<TailoringArtifacts> {
    if (!options.jobUrl || !options.profileId || !options.lengthTarget || !options.outputFormat) {
      throw new Error('Tailor command requires jobUrl, profileId, lengthTarget, and outputFormat.');
    }

    const dataDir = resolve(process.cwd(), process.env.DATA_DIR ?? DEFAULT_DATA_DIR);
    const outputDir = resolve(process.cwd(), process.env.OUTPUT_DIR ?? DEFAULT_OUTPUT_DIR);

    await ensureDirectory(dataDir);
    await ensureDirectory(outputDir);

    const canonicalResume = await this.resumeDataLoaderService.loadCanonicalResume(
      resolve(dataDir, RESUME_MASTER_FILENAME),
    );
    const bulletBank = await this.resumeDataLoaderService.loadBulletBank(
      resolve(dataDir, BULLET_BANK_FILENAME),
    );
    const profileDefaults = await this.profileResolutionService.loadProfileDefaults(
      resolve(dataDir, PROFILE_DEFAULTS_FILENAME),
    );
    const selectedProfile = this.profileResolutionService.resolveProfile(profileDefaults, options.profileId);

    const tailoredResume = await this.resumeTailorService.generate({
      jobUrl: options.jobUrl,
      profileId: options.profileId,
      experienceControls: options.experienceControls ?? [],
      lengthTarget: options.lengthTarget,
      outputFormat: options.outputFormat,
    });

    const validation = options.skipValidation
      ? { valid: true, issues: [], traceabilityCoverage: 1 }
      : await this.resumeValidationService.validate(tailoredResume, canonicalResume, bulletBank);

    if (!validation.valid) {
      return { validation };
    }

    const runFolder = resolve(
      outputDir,
      `${new Date().toISOString().replace(/[:.]/g, '-')}-${selectedProfile.id}`,
    );
    await ensureDirectory(runFolder);

    const markdownPath = resolve(runFolder, 'tailored_resume.md');
    const docxPath = resolve(runFolder, 'tailored_resume.docx');
    const reportPath = resolve(runFolder, 'change_report.md');

    await this.markdownExportService.writeToFile(markdownPath, tailoredResume);

    if (options.outputFormat === 'docx' || options.outputFormat === 'both') {
      await this.docxExportService.writeToFile(docxPath, tailoredResume);
    }

    const changeReport = await this.changeReportService.generate({
      tailoredResume,
      canonicalResume,
      bulletBank,
      profile: selectedProfile,
    });
    await this.markdownExportService.writeReportToFile(reportPath, changeReport);

    return {
      markdownPath,
      docxPath: options.outputFormat === 'md' ? undefined : docxPath,
      reportPath,
      validation,
    };
  }
}
