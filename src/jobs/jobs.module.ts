import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { JobFetchService } from './job-fetch.service';
import { JobParseService } from './job-parse.service';
import { JobSignalService } from './job-signal.service';

@Module({
  imports: [LlmModule],
  providers: [JobFetchService, JobParseService, JobSignalService],
  exports: [JobFetchService, JobParseService, JobSignalService],
})
export class JobsModule {}
