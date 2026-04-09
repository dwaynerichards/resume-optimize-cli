import { Injectable } from '@nestjs/common';
import { RawJobDocument } from '../common/types';
import { tokenize, uniqueStrings } from '../common/utils';

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'will',
  'your',
  'our',
  'you',
  'are',
  'have',
  'has',
  'into',
  'about',
  'their',
  'they',
  'them',
  'role',
  'team',
  'work',
  'years',
  'year',
  'experience',
]);

@Injectable()
export class KeywordExtractionService {
  extractKeywords(rawJob: RawJobDocument): string[] {
    const counts = new Map<string, number>();
    const content = [...rawJob.headings, ...rawJob.listItems, ...rawJob.paragraphs];

    content.forEach((segment) => {
      tokenize(segment).forEach((token) => {
        if (token.length < 3 || STOP_WORDS.has(token)) {
          return;
        }

        counts.set(token, (counts.get(token) ?? 0) + 1);
      });
    });

    const repeatedTokens = [...counts.entries()]
      .filter(([, count]) => count > 1)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 25)
      .map(([token]) => token);
    const acronymMatches = rawJob.bodyText.match(/\b[A-Z]{2,}\b/g) ?? [];

    return uniqueStrings([...repeatedTokens, ...acronymMatches.map((match) => match.toLowerCase())]);
  }
}
