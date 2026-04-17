import { Injectable } from '@nestjs/common';
import { JobSignalAssessment, RawJobDocument } from '../common/types';
import { normalizeWhitespace, tokenize, uniqueStrings } from '../common/utils';

const JOB_SIGNAL_CUES = [
  'responsibilities',
  'requirements',
  'qualifications',
  'minimum qualifications',
  'preferred qualifications',
  'what you will do',
  "what you'll do",
  'about the role',
  'job summary',
  'who you are',
  'what we are looking for',
  'role summary',
];

const GENERIC_TITLE_MARKERS = [
  'career',
  'careers',
  'job',
  'jobs',
  'open position',
  'open positions',
  'apply now',
  'join our team',
];

@Injectable()
export class JobSignalService {
  assess(rawJob: RawJobDocument): JobSignalAssessment {
    const combinedText = normalizeWhitespace(
      [rawJob.pageTitle ?? '', rawJob.metaDescription ?? '', ...rawJob.headings, ...rawJob.listItems, ...rawJob.paragraphs].join(' '),
    );
    const lowerCombinedText = combinedText.toLowerCase();
    const wordCount = tokenize(combinedText).length;
    const sectionCount = rawJob.headings.length + rawJob.listItems.length + rawJob.paragraphs.length;
    const cueHits = uniqueStrings(JOB_SIGNAL_CUES.filter((cue) => lowerCombinedText.includes(cue)));
    const titleText = normalizeWhitespace(rawJob.pageTitle ?? rawJob.metaDescription ?? '');
    const genericTitle = this.hasGenericTitle(titleText);

    let score = 0;

    score += wordCount >= 180 ? 0.3 : wordCount >= 100 ? 0.22 : wordCount >= 60 ? 0.12 : 0.04;
    score += sectionCount >= 8 ? 0.28 : sectionCount >= 5 ? 0.2 : sectionCount >= 3 ? 0.1 : 0.02;
    score += cueHits.length >= 3 ? 0.25 : cueHits.length >= 1 ? 0.15 : 0;

    if (rawJob.metaDescription) {
      score += 0.05;
    }

    if (rawJob.headings.length > 0) {
      score += 0.05;
    }

    if (rawJob.listItems.length > 0) {
      score += 0.05;
    }

    if (genericTitle) {
      score -= 0.2;
    }

    score = Math.max(0, Math.min(1, score));

    const strongSignal = score >= 0.65 && wordCount >= 50 && sectionCount >= 5 && cueHits.length > 0;
    const level = strongSignal ? 'strong' : score >= 0.4 ? 'weak' : 'thin';
    const reasons =
      level === 'strong'
        ? []
        : uniqueStrings([
            ...(wordCount < 120 ? [`Only ${wordCount} extracted words were available.`] : []),
            ...(sectionCount < 5 ? [`Only ${sectionCount} content sections were available.`] : []),
            ...(cueHits.length === 0
              ? ['No clear responsibilities or qualifications cues were found.']
              : []),
            ...(genericTitle ? [`Page title "${titleText || 'unknown'}" looks generic.`] : []),
          ]);

    return {
      level,
      score: Number(score.toFixed(2)),
      reasons,
    };
  }

  private hasGenericTitle(value: string): boolean {
    const lowered = normalizeWhitespace(value).toLowerCase();
    if (!lowered) {
      return false;
    }

    return GENERIC_TITLE_MARKERS.some((marker) => lowered.includes(marker));
  }
}
