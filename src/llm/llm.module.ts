import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [ConfigModule],
  providers: [
    OpenAiLlmClient,
    OpenAiResumeExtractionProvider,
    OpenAiResumeMergeProvider,
    OpenAiJobAnalysisProvider,
    OpenAiResumeRewriteProvider,
    OpenAiReportGenerationProvider,
    { provide: LLM_CLIENT, useExisting: OpenAiLlmClient },
    { provide: RESUME_EXTRACTION_PROVIDER, useExisting: OpenAiResumeExtractionProvider },
    { provide: RESUME_MERGE_PROVIDER, useExisting: OpenAiResumeMergeProvider },
    { provide: JOB_ANALYSIS_PROVIDER, useExisting: OpenAiJobAnalysisProvider },
    { provide: RESUME_REWRITE_PROVIDER, useExisting: OpenAiResumeRewriteProvider },
    { provide: REPORT_GENERATION_PROVIDER, useExisting: OpenAiReportGenerationProvider },
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
