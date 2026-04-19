import { readFileSync } from 'fs';
import { resolve } from 'path';
import { JobParseService } from '../src/jobs/job-parse.service';
import { JobFetchService } from '../src/jobs/job-fetch.service';
import { JobSignalService } from '../src/jobs/job-signal.service';
import { JobAnalysisProvider } from '../src/llm/interfaces';
import { NormalizedJobPosting } from '../src/common/types';

class FakeJobFetchService extends JobFetchService {
  constructor(private readonly html: string) {
    super();
  }
  async fetch(): Promise<string> {
    return this.html;
  }
}

const stubAnalyzed: NormalizedJobPosting = {
  sourceUrl: '',
  fetchedAt: '',
  jobTitle: 'Full Stack Developer',
  employer: 'City of New York',
  location: 'Brooklyn, NY',
  responsibilities: ['Build full-stack web applications'],
  minimumQualifications: ['TypeScript, React, Node.js'],
  preferredQualifications: ['Docker, Kubernetes'],
  domainKeywords: ['typescript', 'react', 'node', 'postgresql'],
  atsKeywords: ['full stack', 'rest api'],
  seniorityIndicators: [],
  roleClassification: 'full-stack-engineering',
  employerContext: 'public-sector',
  domainClassification: [],
  confidence: 0.88,
};

class FakeJobAnalysisProvider implements JobAnalysisProvider {
  async analyze(): Promise<NormalizedJobPosting> {
    return stubAnalyzed;
  }
}

describe('JobParseService — LLM-first classification', () => {
  it('preserves LLM role + employer classification for public-sector Full Stack role', async () => {
    const html = readFileSync(resolve(__dirname, 'fixtures/public-sector-swe.html'), 'utf-8');
    const service = new JobParseService(
      new FakeJobFetchService(html),
      new FakeJobAnalysisProvider(),
      new JobSignalService(),
    );

    const result = await service.fetchAndNormalize(
      'https://cityjobs.nyc.gov/job/full-stack-developer-in-brooklyn-jid-41824',
    );

    expect(result.roleClassification).toBe('full-stack-engineering');
    expect(result.employerContext).toBe('public-sector');
    expect(result.domainClassification).toContain('full-stack-engineering');
    expect(result.domainClassification).toContain('public-sector');
  });
});
