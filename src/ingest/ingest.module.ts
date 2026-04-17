import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ResumeExtractionDebugArtifactService } from './resume-extraction-debug-artifact.service';
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
    ResumeExtractionDebugArtifactService,
    ResumeMergeService,
    ResumeMasterBuilderService,
  ],
  exports: [ResumeIngestService, ResumeTextExtractionService, ResumeMergeService, ResumeSourceDiscoveryService],
})
export class IngestModule {}
