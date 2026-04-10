import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ResumeIngestService } from './resume-ingest.service';
import { ResumeMasterBuilderService } from './resume-master-builder.service';
import { ResumeMergeService } from './resume-merge.service';
import { ResumeSourceDiscoveryService } from './resume-source-discovery.service';
import { ResumeTextExtractionService } from './resume-text-extraction.service';

@Module({
  imports: [LlmModule, ProfilesModule],
  providers: [
    ResumeIngestService,
    ResumeTextExtractionService,
    ResumeSourceDiscoveryService,
    ResumeMergeService,
    ResumeMasterBuilderService,
  ],
  exports: [ResumeIngestService, ResumeTextExtractionService, ResumeMergeService, ResumeSourceDiscoveryService],
})
export class IngestModule {}
