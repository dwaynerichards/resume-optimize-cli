import { Injectable } from '@nestjs/common';
import { resolve } from 'path';
import { AppService } from '../app.service';
import { IngestCommandOptions, TailorCommandOptions } from '../common/dto/cli-options.dto';
import {
  DEFAULT_DATA_DIR,
  PROFILE_DEFAULTS_FILENAME,
  RESUME_MASTER_FILENAME,
} from '../common/constants';
import { TailoringArtifacts } from '../common/types';
import { readStructuredFile } from '../common/utils';
import { ExperienceControlDiscoveryService } from '../profiles/experience-control-discovery.service';
import { ProfileResolutionService } from '../profiles/profile-resolution.service';
import { ResumeDataLoaderService } from '../tailoring/resume-data-loader.service';
import { CorpusInspectionService } from './corpus-inspection.service';
import { InteractivePromptService } from './interactive-prompt.service';

@Injectable()
export class CliService {
  constructor(
    private readonly appService: AppService,
    private readonly promptService: InteractivePromptService,
    private readonly profileResolutionService: ProfileResolutionService,
    private readonly experienceControlDiscoveryService: ExperienceControlDiscoveryService,
    private readonly resumeDataLoaderService: ResumeDataLoaderService,
    private readonly corpusInspectionService: CorpusInspectionService,
  ) {}

  async runInteractive(): Promise<void> {
    const dataDir = resolve(process.cwd(), process.env.DATA_DIR ?? DEFAULT_DATA_DIR);

    if (!(await this.resumeDataLoaderService.canonicalExists(dataDir))) {
      const ingestOptions = await this.promptService.promptForInitialIngest();
      await this.runIngest(ingestOptions);
    }

    const canonicalResume = await this.resumeDataLoaderService.loadCanonicalResume(
      resolve(dataDir, RESUME_MASTER_FILENAME),
    );
    const profileDefaults = await this.profileResolutionService.loadProfileDefaults(
      resolve(dataDir, PROFILE_DEFAULTS_FILENAME),
    );
    const profiles = this.profileResolutionService.listProfiles(profileDefaults);
    const experienceBlocks = this.experienceControlDiscoveryService.discover(canonicalResume);
    const options = await this.promptService.promptForTailoring(profiles, experienceBlocks);
    const artifacts = await this.appService.tailorResume(options);

    this.printTailorSummary(artifacts);
  }

  async runIngest(options: IngestCommandOptions): Promise<void> {
    const result = await this.appService.ingestResumes(options);
    process.stdout.write(
      [
        'Canonical resume source generated.',
        `- source files (${result.sourceFiles.length}):`,
        ...result.sourceFiles.map((sourceFile) => `  - ${sourceFile}`),
        `- resume master: ${result.resumeMasterPath}`,
        `- bullet bank: ${result.bulletBankPath}`,
        `- profile defaults: ${result.profileDefaultsPath}`,
        '',
      ].join('\n'),
    );
  }

  async runTailor(options: TailorCommandOptions): Promise<void> {
    const resolvedOptions = await this.resolveTailorOptions(options);
    const artifacts = await this.appService.tailorResume(resolvedOptions);
    this.printTailorSummary(artifacts);
  }

  async runInspectCorpus(): Promise<void> {
    const dataDir = resolve(process.cwd(), process.env.DATA_DIR ?? DEFAULT_DATA_DIR);
    const summary = await this.corpusInspectionService.inspect(dataDir);

    process.stdout.write(
      [
        'Corpus inspection',
        `- data dir: ${summary.dataDir}`,
        `- source files (${summary.sourceFiles.length}):`,
        ...summary.sourceFiles.map((sourceFile) => `  - ${sourceFile}`),
        `- canonical experience entries: ${summary.experienceCount}`,
        `- bullet bank bullets: ${summary.bulletCount}`,
        `- role clusters: ${summary.roleClusterCount}`,
        ...Object.entries(summary.blockTypeCounts).map(
          ([type, count]) => `  - ${type}: ${count}`,
        ),
        `- profiles: ${summary.profileCount}`,
        ...summary.profileSummaries.map((profile) => {
          const support =
            profile.supportScore !== undefined ? `${Math.round(profile.supportScore * 100)}% support` : 'no score';
          const supported = profile.supported === false ? 'unsupported' : 'supported';
          return `  - ${profile.id}: ${support}, ${supported}`;
        }),
        summary.profileDefaultsSourceFiles.length === 0
          ? '- profile defaults: using built-in base profiles'
          : `- profile defaults source files: ${summary.profileDefaultsSourceFiles.length}`,
        '',
      ].join('\n'),
    );
  }

  printHelp(): void {
    process.stdout.write(
      [
        'resume-tailor',
        '',
        'Usage:',
        '  npm run start -- ingest --resume path/to/resume.md --resume-dir path/to/resumes',
        '  npm run start -- inspect corpus',
        '  npm run start -- tailor --job-url https://example.com/job --profile backend-engineer --output md,docx',
        '  npm run start',
        '',
        'Commands:',
        '  ingest    Build or rebuild the canonical resume source from one or more resumes or folders',
        '  inspect   Print a corpus summary for the current canonical resume data',
        '  tailor    Generate tailored resume artifacts from a job posting URL',
        '',
        'Tailor flags:',
        '  --job-url URL',
        '  --profile PROFILE_ID',
        '  --experience-config path/to/experience-config.yaml',
        '  --max-length concise|standard|expanded',
        '  --output md|docx|md,docx',
        '  --config path/to/tailor-config.yaml',
        '  --skip-validation',
        '',
        'Ingest flags:',
        '  --resume path/to/resume.md',
        '  --resume-dir path/to/resume-folder',
        '  --metadata path/to/resume-metadata.yaml',
        '',
      ].join('\n'),
    );
  }

  printTailorSummary(artifacts: TailoringArtifacts): void {
    const lines = [
      'Tailored resume generated.',
      artifacts.markdownPath ? `- markdown: ${artifacts.markdownPath}` : undefined,
      artifacts.docxPath ? `- docx: ${artifacts.docxPath}` : undefined,
      artifacts.reportPath ? `- change report: ${artifacts.reportPath}` : undefined,
      `- validation: ${artifacts.validation.valid ? 'passed' : 'failed'}`,
      ...artifacts.validation.issues.map(
        (issue) => `  ${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}`,
      ),
      '',
    ].filter((line): line is string => Boolean(line));

    process.stdout.write(lines.join('\n'));
  }

  private async resolveTailorOptions(options: TailorCommandOptions): Promise<TailorCommandOptions> {
    let resolved: TailorCommandOptions = { ...options };

    if (options.configPath) {
      const config = await readStructuredFile<TailorCommandOptions>(options.configPath);
      resolved = { ...config, ...resolved };
    }

    if (options.experienceConfigPath) {
      const config = await readStructuredFile<
        | { experienceControls?: TailorCommandOptions['experienceControls'] }
        | TailorCommandOptions['experienceControls']
      >(options.experienceConfigPath);
      resolved.experienceControls = Array.isArray(config)
        ? config
        : config?.experienceControls ?? resolved.experienceControls;
    }

    return resolved;
  }
}
