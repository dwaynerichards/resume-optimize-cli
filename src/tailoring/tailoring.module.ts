import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { LlmModule } from '../llm/llm.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ChangeReportService } from './change-report.service';
import { ExperienceMappingService } from './experience-mapping.service';
import { ResumeDataLoaderService } from './resume-data-loader.service';
import { ResumeTailorService } from './resume-tailor.service';

@Module({
  imports: [LlmModule, JobsModule, ProfilesModule],
  providers: [
    ResumeDataLoaderService,
    ExperienceMappingService,
    ResumeTailorService,
    ChangeReportService,
  ],
  exports: [
    ResumeDataLoaderService,
    ExperienceMappingService,
    ResumeTailorService,
    ChangeReportService,
  ],
})
export class TailoringModule {}
