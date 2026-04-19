import { Inject, Injectable } from '@nestjs/common';
import { load } from 'cheerio';
import { JOB_ANALYSIS_PROVIDER } from '../common/constants';
import { NormalizedJobPosting, RawJobDocument } from '../common/types';
import { normalizeWhitespace, uniqueStrings } from '../common/utils';
import { JobAnalysisProvider } from '../llm/interfaces';
import { JobFetchService } from './job-fetch.service';
import { JobSignalService } from './job-signal.service';

@Injectable()
export class JobParseService {
  constructor(
    private readonly jobFetchService: JobFetchService,
    @Inject(JOB_ANALYSIS_PROVIDER)
    private readonly jobAnalysisProvider: JobAnalysisProvider,
    private readonly jobSignalService: JobSignalService,
  ) {}

  async fetchAndNormalize(url: string): Promise<NormalizedJobPosting> {
    const html = await this.jobFetchService.fetch(url);
    const rawJob = this.parse(url, html);
    const analyzed = await this.jobAnalysisProvider.analyze(rawJob);

    return {
      ...analyzed,
      sourceUrl: analyzed.sourceUrl || rawJob.sourceUrl,
      fetchedAt: analyzed.fetchedAt || rawJob.fetchedAt,
      pageTitle: analyzed.pageTitle || rawJob.pageTitle,
      jobTitle: analyzed.jobTitle || rawJob.headings[0] || rawJob.pageTitle || 'Untitled Role',
      confidence: analyzed.confidence || 0.65,
      domainClassification: deriveLegacyDomainClassification(analyzed),
      rawText: rawJob.bodyText,
      signal: this.jobSignalService.assess(rawJob),
    };
  }

  parse(sourceUrl: string, html: string): RawJobDocument {
    const $ = load(html);
    $('script, style, noscript, svg').remove();

    const headings = uniqueStrings(
      $('h1, h2, h3, h4').toArray().map((el) => normalizeWhitespace($(el).text())).filter(Boolean),
    );
    const listItems = uniqueStrings(
      $('li').toArray().map((el) => normalizeWhitespace($(el).text())).filter((item) => item.length > 25),
    );
    const paragraphs = uniqueStrings(
      $('p').toArray().map((el) => normalizeWhitespace($(el).text())).filter((item) => item.length > 40),
    );
    const pageTitle = normalizeWhitespace($('title').first().text());
    const metaDescription = $('meta[name="description"]').attr('content');
    const bodyText = normalizeWhitespace(
      uniqueStrings([pageTitle, metaDescription ?? '', ...headings, ...listItems, ...paragraphs]).join('\n'),
    );

    return {
      sourceUrl,
      fetchedAt: new Date().toISOString(),
      pageTitle: pageTitle || undefined,
      metaDescription: metaDescription ? normalizeWhitespace(metaDescription) : undefined,
      headings,
      listItems,
      paragraphs,
      bodyText,
    };
  }
}

const deriveLegacyDomainClassification = (job: NormalizedJobPosting): string[] => {
  const labels = new Set<string>();
  if (job.roleClassification && job.roleClassification !== 'unknown') {
    labels.add(job.roleClassification);
  }
  if (
    job.employerContext &&
    job.employerContext !== 'unknown' &&
    job.employerContext !== 'private-sector'
  ) {
    labels.add(job.employerContext);
  }
  return [...labels];
};
