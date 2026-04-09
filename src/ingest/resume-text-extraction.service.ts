import { Injectable } from '@nestjs/common';
import { extname, resolve } from 'path';
import pdf from 'pdf-parse';
import { readFile } from 'fs/promises';
import { normalizeWhitespace, readTextFile } from '../common/utils';

@Injectable()
export class ResumeTextExtractionService {
  async extract(filePath: string): Promise<string> {
    const resolvedPath = resolve(process.cwd(), filePath);
    const extension = extname(resolvedPath).toLowerCase();

    if (extension === '.md' || extension === '.markdown' || extension === '.txt') {
      return normalizeWhitespace(await readTextFile(resolvedPath));
    }

    if (extension === '.pdf') {
      const buffer = await readFile(resolvedPath);
      const parsed = await pdf(buffer);
      return normalizeWhitespace(parsed.text);
    }

    throw new Error(`Unsupported resume file type: ${filePath}`);
  }
}
