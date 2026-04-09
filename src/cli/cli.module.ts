import { Module } from '@nestjs/common';
import { AppService } from '../app.service';
import { ExportModule } from '../export/export.module';
import { IngestModule } from '../ingest/ingest.module';
import { JobsModule } from '../jobs/jobs.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { TailoringModule } from '../tailoring/tailoring.module';
import { ValidationModule } from '../validation/validation.module';
import { CliService } from './cli.service';
import { CommandRunnerService } from './command-runner.service';
import { InteractivePromptService } from './interactive-prompt.service';

@Module({
  imports: [IngestModule, JobsModule, ProfilesModule, TailoringModule, ValidationModule, ExportModule],
  providers: [AppService, CliService, InteractivePromptService, CommandRunnerService],
  exports: [AppService, CliService, InteractivePromptService, CommandRunnerService],
})
export class CliModule {}
