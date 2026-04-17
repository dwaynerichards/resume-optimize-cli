import { Injectable } from '@nestjs/common';
import { BulletBankDocument, CanonicalResume, TailoredResumeDocument, ValidationIssue } from '../common/types';
import { normalizeWhitespace, tokenize, uniqueStrings } from '../common/utils';

const WATCHED_DOMAIN_TERMS = [
  'blockchain',
  'geospatial',
  'gis',
  'healthcare',
  'defense',
  'machine learning',
  'ai',
  'artificial intelligence',
  'cryptography',
  'trading',
];

const SENIORITY_TERMS = ['principal', 'staff', 'architect', 'director', 'head of', 'expert'];

@Injectable()
export class ClaimTraceabilityService {
  validate(
    tailoredResume: TailoredResumeDocument,
    canonicalResume: CanonicalResume,
    bulletBank: BulletBankDocument,
  ): { issues: ValidationIssue[]; coveredBullets: number; totalBullets: number } {
    const issues: ValidationIssue[] = [];
    const bulletMap = new Map(bulletBank.bullets.map((bullet) => [bullet.id, bullet]));
    const supportedSkills = new Set(
      canonicalResume.skills.flatMap((category) => category.items.map((item) => item.toLowerCase())),
    );
    const allTitles = canonicalResume.experience.map((entry) => entry.roleTitle.toLowerCase());

    tailoredResume.experience.forEach((experience) => {
      experience.bullets.forEach((bullet) => {
        if (bullet.sourceBulletIds.length === 0) {
          issues.push({
            severity: 'error',
            code: 'missing_traceability',
            message: `Bullet "${bullet.text}" is missing source bullet ids.`,
          });
          return;
        }

        const sourceBullets = bullet.sourceBulletIds
          .map((sourceId) => bulletMap.get(sourceId))
          .filter((item): item is NonNullable<typeof item> => Boolean(item));

        if (sourceBullets.length !== bullet.sourceBulletIds.length) {
          issues.push({
            severity: 'error',
            code: 'invalid_traceability',
            message: `Bullet "${bullet.text}" references unknown source bullet ids.`,
            sourceBulletIds: bullet.sourceBulletIds,
          });
          return;
        }

        const supportedCorpus = normalizeWhitespace(
          sourceBullets
            .flatMap((sourceBullet) => [
              sourceBullet.original,
              ...sourceBullet.alternates,
              ...sourceBullet.safeReframes,
              sourceBullet.company,
              sourceBullet.role,
            ])
            .join(' '),
        ).toLowerCase();
        const supportedDomains = new Set(
          sourceBullets.flatMap((sourceBullet) => [...sourceBullet.domainTags, ...sourceBullet.safeReframes]),
        );

        extractYearClaims(bullet.text).forEach((claim) => {
          if (!supportedCorpus.includes(claim.toLowerCase())) {
            issues.push({
              severity: 'error',
              code: 'unsupported_year',
              message: `Bullet "${bullet.text}" introduces an unsupported year claim (${claim}).`,
              sourceBulletIds: bullet.sourceBulletIds,
            });
          }
        });

        extractTechnologyClaims(bullet.text).forEach((claim) => {
          const supported =
            supportedCorpus.includes(claim.toLowerCase()) || supportedSkills.has(claim.toLowerCase());

          if (!supported) {
            issues.push({
              severity: 'error',
              code: 'unsupported_technology',
              message: `Bullet "${bullet.text}" introduces an unsupported technology or tool (${claim}).`,
              sourceBulletIds: bullet.sourceBulletIds,
            });
          }
        });

        WATCHED_DOMAIN_TERMS.forEach((term) => {
          if (
            bullet.text.toLowerCase().includes(term) &&
            !supportedCorpus.includes(term) &&
            !supportedDomains.has(term)
          ) {
            issues.push({
              severity: 'warning',
              code: 'domain_overreach',
              message: `Bullet "${bullet.text}" may overreach into unsupported domain language (${term}).`,
              sourceBulletIds: bullet.sourceBulletIds,
            });
          }
        });
      });
    });

    SENIORITY_TERMS.forEach((term) => {
      if (
        tailoredResume.summary.toLowerCase().includes(term) &&
        !allTitles.some((title) => title.includes(term))
      ) {
        issues.push({
          severity: 'warning',
          code: 'seniority_inflation',
          message: `Summary may overstate seniority by using "${term}" without matching source titles.`,
        });
      }
    });

    return {
      issues,
      coveredBullets: tailoredResume.experience.flatMap((entry) => entry.bullets).length,
      totalBullets: tailoredResume.experience.flatMap((entry) => entry.bullets).length,
    };
  }
}

const extractYearClaims = (text: string): string[] =>
  uniqueStrings([
    ...(text.match(/\b(?:19|20)\d{2}\b/g) ?? []),
    ...(text.match(/\b\d+\+?\s+years?\b/gi) ?? []),
  ]);

const extractTechnologyClaims = (text: string): string[] => {
  const directMatches = text.match(
    /\b(?:AWS|Azure|GCP|Node\.js|TypeScript|JavaScript|Python|Java|Kotlin|Go|Rust|React|Angular|Vue|Docker|Kubernetes|PostgreSQL|MySQL|MongoDB|Redis|Kafka|Terraform|GraphQL|REST|gRPC|Solidity|Ethereum|Hyperledger|C#|C\+\+)\b/g,
  );

  return uniqueStrings([...(directMatches ?? [])]);
};
