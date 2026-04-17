import { Injectable } from '@nestjs/common';
import { basename, resolve } from 'path';
import { DEFAULT_DATA_DIR } from '../common/constants';
import { writeTextFile, ensureDirectory, slugify } from '../common/utils';
import { ExtractedResumeDocument } from '../common/types';

export interface ResumeExtractionDebugArtifactInput {
  sourceFile: string;
  textLength: number;
  normalizedPayload: ExtractedResumeDocument;
}

@Injectable()
export class ResumeExtractionDebugArtifactService {
  async writeArtifact(input: ResumeExtractionDebugArtifactInput): Promise<string> {
    const debugDir = resolve(process.cwd(), process.env.DATA_DIR ?? DEFAULT_DATA_DIR, 'ingest-debug');
    await ensureDirectory(debugDir);

    const filename = `${slugify(basename(input.sourceFile)) || 'source'}-${input.textLength}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
    const artifactPath = resolve(debugDir, filename);

    await writeTextFile(
      artifactPath,
      JSON.stringify(
        {
          runId: process.env.RESUME_TAILOR_RUN_ID,
          sourcePath: input.sourceFile,
          textLength: input.textLength,
          extractedIdentity: input.normalizedPayload.identity,
          experienceCount: input.normalizedPayload.experience.length,
          skillCount: input.normalizedPayload.skills.length,
          normalizedPayloadSnapshot: input.normalizedPayload,
        },
        null,
        2,
      ),
    );

    return artifactPath;
  }
}
