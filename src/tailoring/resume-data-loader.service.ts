import { Injectable } from '@nestjs/common';
import { access } from 'fs/promises';
import { resolve } from 'path';
import {
  BULLET_BANK_FILENAME,
  DEFAULT_DATA_DIR,
  RESUME_MASTER_FILENAME,
} from '../common/constants';
import { BulletBankDocument, CanonicalResume } from '../common/types';
import { readYamlFile } from '../common/utils';

@Injectable()
export class ResumeDataLoaderService {
  async canonicalExists(dataDir = resolve(process.cwd(), process.env.DATA_DIR ?? DEFAULT_DATA_DIR)): Promise<boolean> {
    try {
      await access(resolve(dataDir, RESUME_MASTER_FILENAME));
      await access(resolve(dataDir, BULLET_BANK_FILENAME));
      return true;
    } catch {
      return false;
    }
  }

  async loadCanonicalResume(path: string): Promise<CanonicalResume> {
    return readYamlFile<CanonicalResume>(path);
  }

  async loadBulletBank(path: string): Promise<BulletBankDocument> {
    return readYamlFile<BulletBankDocument>(path);
  }
}
