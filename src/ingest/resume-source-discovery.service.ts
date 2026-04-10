import { Injectable } from '@nestjs/common';
import { readdir, stat } from 'fs/promises';
import { extname, isAbsolute, relative, resolve } from 'path';

const SUPPORTED_RESUME_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.pdf']);

@Injectable()
export class ResumeSourceDiscoveryService {
  async collectSources(resumePaths: string[], resumeDirPaths: string[]): Promise<string[]> {
    const discovered = new Map<string, string>();

    for (const resumePath of resumePaths) {
      await this.addFile(resumePath, discovered);
    }

    for (const resumeDirPath of resumeDirPaths) {
      await this.addDirectory(resumeDirPath, discovered);
    }

    return [...discovered.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, displayPath]) => displayPath);
  }

  private async addFile(inputPath: string, discovered: Map<string, string>): Promise<void> {
    const absolutePath = resolve(process.cwd(), inputPath);
    const fileStats = await this.readStats(absolutePath, inputPath);

    if (fileStats.isDirectory()) {
      throw new Error(`Resume source is a directory. Use --resume-dir for folders: ${inputPath}`);
    }

    if (!fileStats.isFile()) {
      throw new Error(`Unsupported resume source: ${inputPath}`);
    }

    this.addSupportedFile(absolutePath, discovered, inputPath);
  }

  private async addDirectory(inputPath: string, discovered: Map<string, string>): Promise<void> {
    const absolutePath = resolve(process.cwd(), inputPath);
    const directoryStats = await this.readStats(absolutePath, inputPath);

    if (!directoryStats.isDirectory()) {
      throw new Error(`Resume directory path is not a folder: ${inputPath}`);
    }

    const entries = await readdir(absolutePath, { withFileTypes: true });
    const supportedFiles = entries
      .filter((entry) => entry.isFile())
      .map((entry) => resolve(absolutePath, entry.name))
      .filter((filePath) => SUPPORTED_RESUME_EXTENSIONS.has(extname(filePath).toLowerCase()));

    if (supportedFiles.length === 0) {
      throw new Error(`No supported resume files found in folder: ${inputPath}`);
    }

    for (const filePath of supportedFiles) {
      this.addSupportedFile(filePath, discovered);
    }
  }

  private addSupportedFile(absolutePath: string, discovered: Map<string, string>, inputPath?: string): void {
    const extension = extname(absolutePath).toLowerCase();

    if (!SUPPORTED_RESUME_EXTENSIONS.has(extension)) {
      throw new Error(`Unsupported resume file type: ${inputPath ?? absolutePath}`);
    }

    if (!discovered.has(absolutePath)) {
      discovered.set(absolutePath, this.displayPath(absolutePath));
    }
  }

  private async readStats(absolutePath: string, inputPath: string) {
    try {
      return await stat(absolutePath);
    } catch {
      throw new Error(`Resume source not found: ${inputPath}`);
    }
  }

  private displayPath(absolutePath: string): string {
    const relativePath = relative(process.cwd(), absolutePath);

    if (relativePath.length > 0 && !relativePath.startsWith('..') && !isAbsolute(relativePath)) {
      return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
    }

    return absolutePath;
  }
}
