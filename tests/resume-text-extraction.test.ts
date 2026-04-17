import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ResumeTextExtractionService } from '../src/ingest/resume-text-extraction.service';

describe('ResumeTextExtractionService', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'resume-text-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('preserves markdown line structure for resume sections and bullets', async () => {
    const path = join(tempDir, 'resume.md');
    writeFileSync(
      path,
      [
        '# DWAYNE RICHARDS',
        '',
        '## PROFESSIONAL EXPERIENCE',
        '',
        '### Senior Software Engineer',
        '',
        '- Built backend APIs',
        '- Led integration delivery',
      ].join('\n'),
      'utf8',
    );

    const service = new ResumeTextExtractionService();
    const text = await service.extract(path);

    expect(text).toContain('# DWAYNE RICHARDS\n\n## PROFESSIONAL EXPERIENCE\n\n### Senior Software Engineer');
    expect(text).toContain('- Built backend APIs\n- Led integration delivery');
  });
});
