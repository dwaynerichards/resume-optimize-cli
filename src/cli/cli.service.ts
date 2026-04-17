import { Injectable } from '@nestjs/common';
import { resolve } from 'path';
import { AppService } from '../app.service';
import { IngestCommandOptions, TailorCommandOptions } from '../common/dto/cli-options.dto';
import { runLogger } from '../common/logging';
import {
  DEFAULT_DATA_DIR,
  PROFILE_DEFAULTS_FILENAME,
  RESUME_MASTER_FILENAME,
} from '../common/constants';
import { TailoringArtifacts } from '../common/types';
import { readStructuredFile } from '../common/utils';
import { ExperienceControlDiscoveryService } from '../profiles/experience-control-discovery.service';
import { ProfileRecommendationService } from '../profiles/profile-recommendation.service';
import { ProfileResolutionService } from '../profiles/profile-resolution.service';
import { ResumeDataLoaderService } from '../tailoring/resume-data-loader.service';
import { JobParseService } from '../jobs/job-parse.service';
import { CorpusInspectionService } from './corpus-inspection.service';
import { InteractivePromptService } from './interactive-prompt.service';

@Injectable()
export class CliService {
  constructor(
    private readonly appService: AppService,
    private readonly promptService: InteractivePromptService,
    private readonly jobParseService: JobParseService,
    private readonly profileRecommendationService: ProfileRecommendationService,
    private readonly profileResolutionService: ProfileResolutionService,
    private readonly experienceControlDiscoveryService: ExperienceControlDiscoveryService,
    private readonly resumeDataLoaderService: ResumeDataLoaderService,
    private readonly corpusInspectionService: CorpusInspectionService,
  ) {}

  async runInteractive(): Promise<void> {
    const dataDir = resolve(process.cwd(), process.env.DATA_DIR ?? DEFAULT_DATA_DIR);
    runLogger.info('interactive flow start', { dataDir });

    if (!(await this.resumeDataLoaderService.canonicalExists(dataDir))) {
      runLogger.info('interactive flow falling back to initial ingest', { dataDir });
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
    const jobUrl = await this.promptService.promptForJobUrl();
    const preparedOptions = await this.preflightJobSignal({ jobUrl }, 'confirm');
    const recommendation = this.profileRecommendationService.recommend(profileDefaults, preparedOptions.job!);
    process.stdout.write(
      [
        `Recommended profile: ${this.describeProfileRecommendation(profileDefaults, recommendation)}`,
        ...recommendation.rationale.slice(0, 2).map((reason) => `- ${reason}`),
        '',
      ].join('\n'),
    );
    const options = await this.promptService.promptForTailoring(
      profiles,
      experienceBlocks,
      recommendation,
    );
    const finalOptions = {
      ...preparedOptions,
      ...options,
      profileId: options.profileId ?? recommendation.profileId,
    };
    const artifacts = await this.appService.tailorResume(finalOptions);

    this.printTailorSummary(artifacts, {
      profileId: finalOptions.profileId,
      recommended: finalOptions.profileId === recommendation.profileId,
      recommendationConfidence: recommendation.confidence,
    });
    runLogger.info('interactive flow complete');
  }

  async runIngest(options: IngestCommandOptions): Promise<void> {
    runLogger.info('ingest flow start', {
      resumePaths: options.resumePaths.length,
      resumeDirPaths: options.resumeDirPaths.length,
      metadataProvided: Boolean(options.metadataPath),
    });
    const result = await this.appService.ingestResumes(options);
    runLogger.info('ingest flow complete', {
      sourceFiles: result.sourceFiles.length,
      resumeMasterPath: result.resumeMasterPath,
      bulletBankPath: result.bulletBankPath,
      profileDefaultsPath: result.profileDefaultsPath,
    });
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
    runLogger.info('tailor flow start', {
      profileId: options.profileId ?? undefined,
      lengthTarget: options.lengthTarget ?? undefined,
      outputFormat: options.outputFormat ?? undefined,
      jobSignalPolicy: options.jobSignalPolicy ?? undefined,
      skipValidation: Boolean(options.skipValidation),
      experienceControls: options.experienceControls?.length ?? 0,
      configProvided: Boolean(options.configPath),
      experienceConfigProvided: Boolean(options.experienceConfigPath),
      jobUrlProvided: Boolean(options.jobUrl),
    });
    const resolvedOptions = await this.resolveTailorOptions(options);
    const preparedOptions = await this.preflightJobSignal(
      resolvedOptions,
      resolvedOptions.jobSignalPolicy ?? 'warn',
    );
    const finalOptions = await this.applyRecommendedProfile(preparedOptions);
    const artifacts = await this.appService.tailorResume(finalOptions);
    this.printTailorSummary(artifacts, {
      profileId: finalOptions.profileId,
      recommended: !resolvedOptions.profileId,
      recommendationConfidence: resolvedOptions.profileId ? undefined : finalOptions.recommendationConfidence,
    });
    runLogger.info('tailor flow complete', {
      markdownPath: artifacts.markdownPath ?? undefined,
      docxPath: artifacts.docxPath ?? undefined,
      reportPath: artifacts.reportPath ?? undefined,
      validationValid: artifacts.validation.valid,
      validationIssueCount: artifacts.validation.issues.length,
    });
  }

  async runInspectCorpus(): Promise<void> {
    const dataDir = resolve(process.cwd(), process.env.DATA_DIR ?? DEFAULT_DATA_DIR);
    runLogger.info('corpus inspection start', { dataDir });
    const summary = await this.corpusInspectionService.inspect(dataDir);
    runLogger.info('corpus inspection summary', {
      dataDir: summary.dataDir,
      sourceFiles: summary.sourceFiles.length,
      experienceCount: summary.experienceCount,
      bulletCount: summary.bulletCount,
      roleClusterCount: summary.roleClusterCount,
      profileCount: summary.profileCount,
      profileDefaultsSourceFiles: summary.profileDefaultsSourceFiles.length,
    });

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
        '  npm run start -- tailor --job-url https://example.com/job --output md,docx',
        '  npm run start',
        '',
        'Commands:',
        '  ingest    Build or rebuild the canonical resume source from one or more resumes or folders',
        '  inspect   Print a corpus summary for the current canonical resume data',
        '  tailor    Generate tailored resume artifacts from a job posting URL',
        '',
        'Tailor flags:',
        '  --job-url URL',
        '  --profile PROFILE_ID (optional; auto-recommended from the job when omitted)',
        '  --experience-config path/to/experience-config.yaml',
        '  --max-length concise|standard|expanded',
        '  --output md|docx|md,docx',
        '  --job-signal warn|confirm|abort',
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

  printTailorSummary(
    artifacts: TailoringArtifacts,
    context?: {
      profileId?: TailorCommandOptions['profileId'];
      recommended?: boolean;
      recommendationConfidence?: number;
    },
  ): void {
    const lines = [
      'Tailored resume generated.',
      context?.profileId
        ? `- profile: ${context.profileId}${
            context.recommended && context.recommendationConfidence !== undefined
              ? ` (recommended, ${Math.round(context.recommendationConfidence * 100)}% confidence)`
              : ''
          }`
        : undefined,
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
      runLogger.info('loading tailor config', { configPath: options.configPath });
      const config = await readStructuredFile<TailorCommandOptions>(options.configPath);
      resolved = { ...config, ...resolved };
    }

    if (options.experienceConfigPath) {
      runLogger.info('loading experience controls config', {
        experienceConfigPath: options.experienceConfigPath,
      });
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

  private async preflightJobSignal(
    options: TailorCommandOptions,
    policy: NonNullable<TailorCommandOptions['jobSignalPolicy']> | 'warn' = 'warn',
  ): Promise<TailorCommandOptions> {
    if (!options.jobUrl && !options.job) {
      return options;
    }

    const jobUrl = options.jobUrl;
    const job = options.job ?? (await this.jobParseService.fetchAndNormalize(jobUrl!));

    if (!job.signal || job.signal.level === 'strong') {
      return { ...options, job };
    }

    runLogger.warn('job signal below threshold', {
      jobUrl: options.jobUrl,
      jobTitle: job.jobTitle,
      signalLevel: job.signal.level,
      signalScore: job.signal.score,
      signalReasons: job.signal.reasons,
      policy,
    });

    if (policy === 'abort') {
      throw new Error(this.buildLowSignalAbortMessage(job.jobTitle, job.signal));
    }

    if (policy === 'confirm') {
      const proceed = await this.promptService.promptForLowSignalJob(job.jobTitle, job.signal);

      if (!proceed) {
        throw new Error(this.buildLowSignalAbortMessage(job.jobTitle, job.signal));
      }
    }

    return { ...options, job };
  }

  private async applyRecommendedProfile(
    options: TailorCommandOptions,
  ): Promise<TailorCommandOptions & { recommendationConfidence?: number }> {
    if (options.profileId || !options.job) {
      return options;
    }

    const dataDir = resolve(process.cwd(), process.env.DATA_DIR ?? DEFAULT_DATA_DIR);
    const profileDefaults = await this.profileResolutionService.loadProfileDefaults(
      resolve(dataDir, PROFILE_DEFAULTS_FILENAME),
    );
    const recommendation = this.profileRecommendationService.recommend(profileDefaults, options.job);
    runLogger.info('auto-selected profile recommendation', {
      profileId: recommendation.profileId,
      confidence: recommendation.confidence,
      rationale: recommendation.rationale,
    });

    return {
      ...options,
      profileId: recommendation.profileId,
      recommendationConfidence: recommendation.confidence,
    };
  }

  private describeProfileRecommendation(
    profileDefaults: Awaited<ReturnType<ProfileResolutionService['loadProfileDefaults']>>,
    recommendation: ReturnType<ProfileRecommendationService['recommend']>,
  ): string {
    const profile = profileDefaults.profiles.find((item) => item.id === recommendation.profileId);
    return `${profile?.label ?? recommendation.profileId} (${Math.round(recommendation.confidence * 100)}% confidence)`;
  }

  private buildLowSignalAbortMessage(jobTitle: string, signal: { level: string; score: number; reasons: string[] }): string {
    const reasonText = signal.reasons.length > 0 ? ` ${signal.reasons.join(' ')}` : '';
    return `Job posting "${jobTitle}" looks too ${signal.level} to tailor confidently (${Math.round(signal.score * 100)}% signal).${reasonText}`;
  }
}
