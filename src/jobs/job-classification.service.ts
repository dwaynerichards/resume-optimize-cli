import { Injectable } from '@nestjs/common';
import { NormalizedJobPosting, RawJobDocument } from '../common/types';
import { uniqueStrings } from '../common/utils';
import { KeywordExtractionService } from './keyword-extraction.service';

@Injectable()
export class JobClassificationService {
  constructor(private readonly keywordExtractionService: KeywordExtractionService) {}

  merge(rawJob: RawJobDocument, normalizedJob: NormalizedJobPosting): NormalizedJobPosting {
    const heuristicKeywords = this.keywordExtractionService.extractKeywords(rawJob);
    const atsKeywords = Array.isArray(normalizedJob.atsKeywords) ? normalizedJob.atsKeywords : [];
    const domainKeywords = Array.isArray(normalizedJob.domainKeywords) ? normalizedJob.domainKeywords : [];
    const seniorityIndicators = Array.isArray(normalizedJob.seniorityIndicators)
      ? normalizedJob.seniorityIndicators
      : [];
    const domainClassificationInput = Array.isArray(normalizedJob.domainClassification)
      ? normalizedJob.domainClassification
      : [];
    const jobTitle =
      normalizedJob.jobTitle ||
      rawJob.headings[0] ||
      rawJob.pageTitle ||
      'Untitled Role';
    const domainClassification =
      domainClassificationInput.length > 0
        ? domainClassificationInput
        : this.heuristicDomainClassification(heuristicKeywords);

    return {
      ...normalizedJob,
      jobTitle,
      pageTitle: normalizedJob.pageTitle || rawJob.pageTitle,
      fetchedAt: normalizedJob.fetchedAt || rawJob.fetchedAt,
      sourceUrl: normalizedJob.sourceUrl || rawJob.sourceUrl,
      atsKeywords: uniqueStrings([...atsKeywords, ...heuristicKeywords]),
      domainKeywords: uniqueStrings([...domainKeywords, ...heuristicKeywords.slice(0, 12)]),
      seniorityIndicators: uniqueStrings(seniorityIndicators),
      domainClassification,
      confidence: normalizedJob.confidence || 0.65,
      rawText: rawJob.bodyText,
    };
  }

  private heuristicDomainClassification(keywords: string[]): string[] {
    const classifications = new Set<string>();

    if (keywords.some((keyword) => ['api', 'backend', 'microservices', 'integration'].includes(keyword))) {
      classifications.add('backend-engineering');
    }

    if (keywords.some((keyword) => ['blockchain', 'ledger', 'distributed'].includes(keyword))) {
      classifications.add('blockchain');
    }

    if (keywords.some((keyword) => ['government', 'public', 'agency', 'service'].includes(keyword))) {
      classifications.add('public-service');
    }

    if (classifications.size === 0) {
      classifications.add('software-engineering');
    }

    return [...classifications];
  }
}
