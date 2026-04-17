import { Injectable } from '@nestjs/common';
import { resolve } from 'path';
import { DEFAULT_DATA_DIR, BULLET_BANK_FILENAME, PROFILE_DEFAULTS_FILENAME, RESUME_MASTER_FILENAME } from '../common/constants';
import { runLogger } from '../common/logging';
import { ResumeDataLoaderService } from '../tailoring/resume-data-loader.service';
import { ExperienceControlDiscoveryService } from '../profiles/experience-control-discovery.service';
import { ProfileResolutionService } from '../profiles/profile-resolution.service';

export interface CorpusInspectionProfileSummary {
  id: string;
  label: string;
  supportScore?: number;
  supported?: boolean;
}

export interface CorpusInspectionSummary {
  dataDir: string;
  sourceFiles: string[];
  experienceCount: number;
  bulletCount: number;
  roleClusterCount: number;
  blockTypeCounts: Record<string, number>;
  profileCount: number;
  profileSummaries: CorpusInspectionProfileSummary[];
  profileDefaultsSourceFiles: string[];
}

@Injectable()
export class CorpusInspectionService {
  constructor(
    private readonly resumeDataLoaderService: ResumeDataLoaderService,
    private readonly experienceControlDiscoveryService: ExperienceControlDiscoveryService,
    private readonly profileResolutionService: ProfileResolutionService,
  ) {}

  async inspect(dataDirInput = resolve(process.cwd(), process.env.DATA_DIR ?? DEFAULT_DATA_DIR)): Promise<CorpusInspectionSummary> {
    const startedAtMs = Date.now();
    runLogger.info('corpus inspection boundary start', { dataDir: dataDirInput });
    if (!(await this.resumeDataLoaderService.canonicalExists(dataDirInput))) {
      runLogger.warn('corpus inspection aborted because canonical corpus is missing', {
        dataDir: dataDirInput,
      });
      throw new Error('Canonical corpus not found. Run ingest first.');
    }

    const dataDir = resolve(dataDirInput);
    const canonicalResume = await this.resumeDataLoaderService.loadCanonicalResume(
      resolve(dataDir, RESUME_MASTER_FILENAME),
    );
    const bulletBank = await this.resumeDataLoaderService.loadBulletBank(resolve(dataDir, BULLET_BANK_FILENAME));
    const profileDefaults = await this.profileResolutionService.loadProfileDefaults(
      resolve(dataDir, PROFILE_DEFAULTS_FILENAME),
    );
    const discoveredBlocks = this.experienceControlDiscoveryService.discover(canonicalResume);

    const summary = {
      dataDir,
      sourceFiles: profileDefaults.sourceFiles,
      experienceCount: canonicalResume.experience.length,
      bulletCount: bulletBank.bullets.length,
      roleClusterCount: canonicalResume.roleClusters.length,
      blockTypeCounts: discoveredBlocks.reduce<Record<string, number>>((counts, block) => {
        counts[block.type] = (counts[block.type] ?? 0) + 1;
        return counts;
      }, {}),
      profileCount: profileDefaults.profiles.length,
      profileSummaries: profileDefaults.profiles.map((profile) => ({
        id: profile.id,
        label: profile.label,
        supportScore: profile.supportScore,
        supported: profile.supported,
      })),
      profileDefaultsSourceFiles: profileDefaults.sourceFiles,
    };

    runLogger.info('corpus inspection boundary end', {
      durationMs: Date.now() - startedAtMs,
      dataDir,
      sourceFiles: summary.sourceFiles.length,
      experienceCount: summary.experienceCount,
      bulletCount: summary.bulletCount,
      roleClusterCount: summary.roleClusterCount,
      profileCount: summary.profileCount,
    });

    return summary;
  }
}
