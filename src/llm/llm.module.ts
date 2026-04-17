import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  JOB_ANALYSIS_PROVIDER,
  LLM_CLIENT,
  REPORT_GENERATION_PROVIDER,
  RESUME_EXTRACTION_PROVIDER,
  RESUME_MERGE_PROVIDER,
  RESUME_REWRITE_PROVIDER,
} from '../common/constants';
import { OpenAiJobAnalysisProvider } from './openai/openai-job-analysis.provider';
import { OpenAiLlmClient } from './openai/openai-llm.client';
import { OpenAiReportGenerationProvider } from './openai/openai-report-generation.provider';
import { OpenAiResumeExtractionProvider } from './openai/openai-resume-extraction.provider';
import { OpenAiResumeMergeProvider } from './openai/openai-resume-merge.provider';
import { OpenAiResumeRewriteProvider } from './openai/openai-resume-rewrite.provider';

type SupportedLlmProvider = 'openai';

const SUPPORTED_LLM_PROVIDERS: SupportedLlmProvider[] = ['openai'];

const getConfiguredLlmProvider = (
  configService: ConfigService,
): SupportedLlmProvider => {
  const configured = configService
    .get<string>('LLM_PROVIDER')
    ?.trim()
    .toLowerCase();

  if (!configured || configured === 'openai') {
    return 'openai';
  }

  throw new Error(
    `Unsupported LLM_PROVIDER "${configured}". Supported providers: ${SUPPORTED_LLM_PROVIDERS.join(', ')}.`,
  );
};

const selectProvider = <T>(
  configService: ConfigService,
  providers: Record<SupportedLlmProvider, T>,
): T => providers[getConfiguredLlmProvider(configService)];

@Module({
  imports: [ConfigModule],
  providers: [
    OpenAiLlmClient,
    OpenAiResumeExtractionProvider,
    OpenAiResumeMergeProvider,
    OpenAiJobAnalysisProvider,
    OpenAiResumeRewriteProvider,
    OpenAiReportGenerationProvider,
    {
      provide: LLM_CLIENT,
      useFactory: (
        configService: ConfigService,
        openAiLlmClient: OpenAiLlmClient,
      ) => selectProvider(configService, { openai: openAiLlmClient }),
      inject: [ConfigService, OpenAiLlmClient],
    },
    {
      provide: RESUME_EXTRACTION_PROVIDER,
      useFactory: (
        configService: ConfigService,
        openAiResumeExtractionProvider: OpenAiResumeExtractionProvider,
      ) =>
        selectProvider(configService, {
          openai: openAiResumeExtractionProvider,
        }),
      inject: [ConfigService, OpenAiResumeExtractionProvider],
    },
    {
      provide: RESUME_MERGE_PROVIDER,
      useFactory: (
        configService: ConfigService,
        openAiResumeMergeProvider: OpenAiResumeMergeProvider,
      ) => selectProvider(configService, { openai: openAiResumeMergeProvider }),
      inject: [ConfigService, OpenAiResumeMergeProvider],
    },
    {
      provide: JOB_ANALYSIS_PROVIDER,
      useFactory: (
        configService: ConfigService,
        openAiJobAnalysisProvider: OpenAiJobAnalysisProvider,
      ) => selectProvider(configService, { openai: openAiJobAnalysisProvider }),
      inject: [ConfigService, OpenAiJobAnalysisProvider],
    },
    {
      provide: RESUME_REWRITE_PROVIDER,
      useFactory: (
        configService: ConfigService,
        openAiResumeRewriteProvider: OpenAiResumeRewriteProvider,
      ) =>
        selectProvider(configService, {
          openai: openAiResumeRewriteProvider,
        }),
      inject: [ConfigService, OpenAiResumeRewriteProvider],
    },
    {
      provide: REPORT_GENERATION_PROVIDER,
      useFactory: (
        configService: ConfigService,
        openAiReportGenerationProvider: OpenAiReportGenerationProvider,
      ) =>
        selectProvider(configService, {
          openai: openAiReportGenerationProvider,
        }),
      inject: [ConfigService, OpenAiReportGenerationProvider],
    },
  ],
  exports: [
    LLM_CLIENT,
    RESUME_EXTRACTION_PROVIDER,
    RESUME_MERGE_PROVIDER,
    JOB_ANALYSIS_PROVIDER,
    RESUME_REWRITE_PROVIDER,
    REPORT_GENERATION_PROVIDER,
  ],
})
export class LlmModule {}
