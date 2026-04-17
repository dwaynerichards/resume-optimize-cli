import { JobClassificationService } from '../src/jobs/job-classification.service';
import { KeywordExtractionService } from '../src/jobs/keyword-extraction.service';

describe('JobClassificationService', () => {
  it('normalizes missing array fields from job analysis output', () => {
    const service = new JobClassificationService(new KeywordExtractionService());

    const result = service.merge(
      {
        sourceUrl: 'https://example.com/job',
        fetchedAt: '2026-04-16T00:00:00.000Z',
        pageTitle: 'Full Stack Developer',
        metaDescription: 'Build internal apps',
        headings: ['Full Stack Developer'],
        listItems: ['TypeScript', 'React'],
        paragraphs: ['Build internal applications and APIs.'],
        bodyText: 'Full Stack Developer TypeScript React APIs',
      },
      {
        sourceUrl: 'https://example.com/job',
        fetchedAt: '2026-04-16T00:00:00.000Z',
        jobTitle: 'Full Stack Developer',
        responsibilities: [],
        minimumQualifications: [],
        preferredQualifications: [],
        domainKeywords: undefined as never,
        atsKeywords: undefined as never,
        seniorityIndicators: undefined as never,
        domainClassification: undefined as never,
        confidence: 0.8,
      },
    );

    expect(Array.isArray(result.atsKeywords)).toBe(true);
    expect(Array.isArray(result.domainClassification)).toBe(true);
    expect(result.domainClassification.length).toBeGreaterThan(0);
  });
});
