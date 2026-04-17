import { Injectable } from '@nestjs/common';
import {
  BulletBankDocument,
  CanonicalResume,
  TailoredResumeDocument,
  ValidationResult,
} from '../common/types';
import { ClaimTraceabilityService } from './claim-traceability.service';

@Injectable()
export class ResumeValidationService {
  constructor(private readonly claimTraceabilityService: ClaimTraceabilityService) {}

  async validate(
    tailoredResume: TailoredResumeDocument,
    canonicalResume: CanonicalResume,
    bulletBank: BulletBankDocument,
  ): Promise<ValidationResult> {
    const issues = [...this.validateStructure(tailoredResume, canonicalResume)];

    if (!hasMeaningfulTailoredContent(tailoredResume)) {
      issues.push({
        severity: 'error',
        code: 'empty_tailored_output',
        message: 'Tailored resume has no experience bullets and cannot be treated as a successful output.',
      });
    }

    const traceability = this.claimTraceabilityService.validate(
      tailoredResume,
      canonicalResume,
      bulletBank,
    );

    issues.push(...traceability.issues);

    return {
      valid: issues.every((issue) => issue.severity !== 'error'),
      issues,
      traceabilityCoverage:
        traceability.totalBullets === 0 ? 1 : traceability.coveredBullets / traceability.totalBullets,
    };
  }

  private validateStructure(
    tailoredResume: TailoredResumeDocument,
    canonicalResume: CanonicalResume,
  ): ValidationResult['issues'] {
    const issues: ValidationResult['issues'] = [];
    const experienceMap = new Map(canonicalResume.experience.map((entry) => [entry.id, entry]));

    tailoredResume.experience.forEach((entry, index) => {
      const sourceEntry = experienceMap.get(entry.experienceId);

      if (!sourceEntry) {
        issues.push({
          severity: 'error',
          code: 'unknown_experience',
          message: `Tailored experience entry ${entry.experienceId} does not exist in the canonical resume.`,
        });
        return;
      }

      if (entry.company !== sourceEntry.company || entry.roleTitle !== sourceEntry.roleTitle) {
        issues.push({
          severity: 'error',
          code: 'experience_identity_mismatch',
          message: `Tailored experience entry ${entry.experienceId} changes the source company or role title.`,
        });
      }

      if (index > 0) {
        const previous = tailoredResume.experience[index - 1];
        if (previous.dateRange.start < entry.dateRange.start) {
          issues.push({
            severity: 'warning',
            code: 'chronology_reordered',
            message: 'Tailored experience ordering may distort chronology.',
          });
        }
      }
    });

    return issues;
  }
}

const hasMeaningfulTailoredContent = (tailoredResume: TailoredResumeDocument): boolean =>
  tailoredResume.experience.some((entry) => entry.bullets.length > 0);
