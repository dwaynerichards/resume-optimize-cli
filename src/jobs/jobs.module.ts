import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { JobClassificationService } from './job-classification.service';
import { JobFetchService } from './job-fetch.service';
import { JobParseService } from './job-parse.service';
import { JobSignalService } from './job-signal.service';
import { KeywordExtractionService } from './keyword-extraction.service';

@Module({
  imports: [LlmModule],
  providers: [
    JobFetchService,
    JobParseService,
    JobClassificationService,
    JobSignalService,
    KeywordExtractionService,
  ],
  exports: [
    JobFetchService,
    JobParseService,
    JobClassificationService,
    JobSignalService,
    KeywordExtractionService,
  ],
})
export class JobsModule {}
