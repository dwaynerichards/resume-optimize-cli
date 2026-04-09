import { Injectable } from '@nestjs/common';
import { resolve } from 'path';
import {
  BULLET_BANK_FILENAME,
  DEFAULT_DATA_DIR,
  PROFILE_DEFAULTS_FILENAME,
  RESUME_MASTER_FILENAME,
} from '../common/constants';
import { BulletBankDocument, CanonicalResume, ProfileDefaultsDocument } from '../common/types';
import { ensureDirectory, writeYamlFile } from '../common/utils';

@Injectable()
export class ResumeMasterBuilderService {
  async persist(
    canonicalResume: CanonicalResume,
    bulletBank: BulletBankDocument,
    profileDefaults: ProfileDefaultsDocument,
  ): Promise<{
    resumeMasterPath: string;
    bulletBankPath: string;
    profileDefaultsPath: string;
  }> {
    const dataDir = resolve(process.cwd(), process.env.DATA_DIR ?? DEFAULT_DATA_DIR);
    await ensureDirectory(dataDir);

    const resumeMasterPath = resolve(dataDir, RESUME_MASTER_FILENAME);
    const bulletBankPath = resolve(dataDir, BULLET_BANK_FILENAME);
    const profileDefaultsPath = resolve(dataDir, PROFILE_DEFAULTS_FILENAME);

    await writeYamlFile(resumeMasterPath, canonicalResume);
    await writeYamlFile(bulletBankPath, bulletBank);
    await writeYamlFile(profileDefaultsPath, profileDefaults);

    return { resumeMasterPath, bulletBankPath, profileDefaultsPath };
  }
}
