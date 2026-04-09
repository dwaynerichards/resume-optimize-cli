import { Inject, Injectable } from '@nestjs/common';
import { load } from 'cheerio';
import { JOB_ANALYSIS_PROVIDER } from '../common/constants';
import { NormalizedJobPosting, RawJobDocument } from '../common/types';
import { normalizeWhitespace, uniqueStrings } from '../common/utils';
import { JobAnalysisProvider } from '../llm/interfaces';
import { JobClassificationService } from './job-classification.service';
import { JobFetchService } from './job-fetch.service';

@Injectable()
export class JobParseService {
  constructor(
    private readonly jobFetchService: JobFetchService,
    @Inject(JOB_ANALYSIS_PROVIDER)
    private readonly jobAnalysisProvider: JobAnalysisProvider,
    private readonly jobClassificationService: JobClassificationService,
  ) {}

  async fetchAndNormalize(url: string): Promise<NormalizedJobPosting> {
    const html = await this.jobFetchService.fetch(url);
    const rawJob = this.parse(url, html);
    const analyzed = await this.jobAnalysisProvider.analyze(rawJob);
    return this.jobClassificationService.merge(rawJob, analyzed);
  }

  parse(sourceUrl: string, html: string): RawJobDocument {
    const $ = load(html);

    $('script, style, noscript, svg').remove();

    const headings = uniqueStrings(
      $('h1, h2, h3, h4')
        .toArray()
        .map((element) => normalizeWhitespace($(element).text()))
        .filter(Boolean),
    );
    const listItems = uniqueStrings(
      $('li')
        .toArray()
        .map((element) => normalizeWhitespace($(element).text()))
        .filter((item) => item.length > 25),
    );
    const paragraphs = uniqueStrings(
      $('p')
        .toArray()
        .map((element) => normalizeWhitespace($(element).text()))
        .filter((item) => item.length > 40),
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
