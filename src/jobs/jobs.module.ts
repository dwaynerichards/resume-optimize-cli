import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { JobClassificationService } from './job-classification.service';
import { JobFetchService } from './job-fetch.service';
import { JobParseService } from './job-parse.service';
import { KeywordExtractionService } from './keyword-extraction.service';

@Module({
  imports: [LlmModule],
  providers: [
    JobFetchService,
    JobParseService,
    JobClassificationService,
    KeywordExtractionService,
  ],
  exports: [JobFetchService, JobParseService, JobClassificationService, KeywordExtractionService],
})
export class JobsModule {}
