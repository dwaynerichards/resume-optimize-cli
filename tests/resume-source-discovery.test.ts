import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { resolve } from 'path';
import { ResumeSourceDiscoveryService } from '../src/ingest/resume-source-discovery.service';

describe('ResumeSourceDiscoveryService', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), 'resume-source-discovery-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('expands top-level folder sources, deduplicates files, and sorts them deterministically', async () => {
    const folderA = resolve(tempDir, 'sources');
    await mkdir(resolve(folderA, 'nested'), { recursive: true });
    await writeFile(resolve(folderA, 'b.md'), 'b');
    await writeFile(resolve(folderA, 'a.txt'), 'a');
    await writeFile(resolve(folderA, 'ignored.docx'), 'ignored');
    await writeFile(resolve(folderA, 'nested', 'c.pdf'), 'nested');

    const service = new ResumeSourceDiscoveryService();
    const result = await service.collectSources([resolve(folderA, 'b.md')], [folderA]);

    expect(result).toEqual([resolve(folderA, 'a.txt'), resolve(folderA, 'b.md')]);
  });

  it('fails when a folder contains no supported resume files', async () => {
    const emptyFolder = resolve(tempDir, 'empty');
    await mkdir(emptyFolder, { recursive: true });

    const service = new ResumeSourceDiscoveryService();

    await expect(service.collectSources([], [emptyFolder])).rejects.toThrow(
      'No supported resume files found in folder',
    );
  });
});
