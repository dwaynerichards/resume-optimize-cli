import { readFileSync } from 'fs';
import { resolve } from 'path';
import { JobClassificationService } from '../src/jobs/job-classification.service';
import { JobParseService } from '../src/jobs/job-parse.service';
import { JobSignalService } from '../src/jobs/job-signal.service';
import { KeywordExtractionService } from '../src/jobs/keyword-extraction.service';

describe('JobParseService', () => {
  it('parses html and merges LLM analysis with heuristic keywords', async () => {
    const fixture = readFileSync(resolve(__dirname, 'fixtures/sample-job.html'), 'utf8');
    const service = new JobParseService(
      { fetch: async () => fixture },
      {
        analyze: async (rawJob) => ({
          sourceUrl: rawJob.sourceUrl,
          fetchedAt: rawJob.fetchedAt,
          pageTitle: rawJob.pageTitle,
          jobTitle: 'Senior Backend Engineer',
          employer: 'Example Corp',
          location: 'Remote',
          responsibilities: ['Design and implement backend APIs and integration workflows.'],
          minimumQualifications: ['5+ years of software engineering experience.'],
          preferredQualifications: ['Public-sector delivery experience is a plus.'],
          domainKeywords: ['backend'],
          atsKeywords: ['typescript'],
          seniorityIndicators: ['senior'],
          domainClassification: [],
          confidence: 0.8,
        }),
      },
      new JobClassificationService(new KeywordExtractionService()),
      new JobSignalService(),
    );

    const result = await service.fetchAndNormalize('https://example.com/jobs/backend');

    expect(result.jobTitle).toBe('Senior Backend Engineer');
    expect(result.employer).toBe('Example Corp');
    expect(result.atsKeywords).toContain('typescript');
    expect(result.domainClassification).toContain('backend-engineering');
    expect(result.signal?.level).toBe('strong');
  });
});
