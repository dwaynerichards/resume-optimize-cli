import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CliModule } from './cli/cli.module';
import { ExportModule } from './export/export.module';
import { IngestModule } from './ingest/ingest.module';
import { JobsModule } from './jobs/jobs.module';
import { LlmModule } from './llm/llm.module';
import { ProfilesModule } from './profiles/profiles.module';
import { TailoringModule } from './tailoring/tailoring.module';
import { ValidationModule } from './validation/validation.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LlmModule,
    IngestModule,
    JobsModule,
    ProfilesModule,
    ValidationModule,
    ExportModule,
    TailoringModule,
    CliModule,
  ],
})
export class AppModule {}
