import { JobSignalService } from '../src/jobs/job-signal.service';

describe('JobSignalService', () => {
  it('treats a structured job posting as a strong signal', () => {
    const service = new JobSignalService();

    const assessment = service.assess({
      sourceUrl: 'https://example.com/jobs/backend',
      fetchedAt: '2026-04-11T00:00:00.000Z',
      pageTitle: 'Senior Backend Engineer | Example Corp',
      metaDescription:
        'Build resilient APIs and platform integrations for a distributed public-sector platform.',
      headings: ['Senior Backend Engineer', 'Responsibilities', 'Minimum Qualifications'],
      listItems: [
        'Design and implement backend APIs and integration workflows.',
        'Partner with platform teams to improve reliability and observability.',
        '5+ years of software engineering experience.',
        'Experience building Node.js or TypeScript services.',
      ],
      paragraphs: ['Public-sector delivery experience is a plus.'],
      bodyText:
        'Senior Backend Engineer Responsibilities Design and implement backend APIs and integration workflows. Partner with platform teams to improve reliability and observability. Minimum Qualifications 5+ years of software engineering experience. Experience building Node.js or TypeScript services. Public-sector delivery experience is a plus.',
    });

    expect(assessment.level).toBe('strong');
    expect(assessment.score).toBeGreaterThanOrEqual(0.65);
    expect(assessment.reasons).toHaveLength(0);
  });

  it('flags a thin careers page as a thin signal', () => {
    const service = new JobSignalService();

    const assessment = service.assess({
      sourceUrl: 'https://example.com/jobs/careers',
      fetchedAt: '2026-04-11T00:00:00.000Z',
      pageTitle: 'Careers',
      headings: ['Careers'],
      listItems: ['Apply now'],
      paragraphs: ['Join our team.'],
      bodyText: 'Careers Apply now Join our team.',
    });

    expect(assessment.level).toBe('thin');
    expect(assessment.score).toBeLessThan(0.4);
    expect(assessment.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining('responsibilities or qualifications'),
        expect.stringContaining('generic'),
      ]),
    );
  });
});
