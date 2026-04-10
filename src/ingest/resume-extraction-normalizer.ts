import { extname } from 'path';
import {
  ContactInfo,
  EducationEntry,
  ExtractedResumeDocument,
  ExtractedResumeExperience,
  RiskLevel,
  SkillCategory,
  SourceReference,
  SummaryVariant,
  SupportedProfileId,
} from '../common/types';
import { normalizeWhitespace, slugify, uniqueStrings } from '../common/utils';

const SUPPORTED_PROFILE_IDS: SupportedProfileId[] = [
  'public-service',
  'backend-engineer',
  'general-swe',
  'blockchain-engineer',
];
const SUPPORTED_PROFILE_ID_SET = new Set<string>(SUPPORTED_PROFILE_IDS);
const SUPPORTED_RISK_LEVELS = new Set<RiskLevel>(['low', 'medium', 'high']);

export const normalizeExtractedResumeDocument = (
  value: unknown,
  sourceFile: string,
): ExtractedResumeDocument => {
  const record = asRecord(value);

  return {
    sourceFile,
    identity: normalizeIdentity(record.identity),
    contact: normalizeContact(record.contact),
    education: asArray(record.education).map(normalizeEducation).filter(isDefined),
    certifications: asArray(record.certifications)
      .map(normalizeCertification)
      .filter(isDefined),
    summaryVariants: asArray(record.summaryVariants)
      .map((variant, index) => normalizeSummaryVariant(variant, index))
      .filter(isDefined),
    skills: asArray(record.skills).map(normalizeSkillCategory).filter(isDefined),
    experience: asArray(record.experience).map(normalizeExperience).filter(isDefined),
    domainTags: toStringArray(record.domainTags),
    notes: toStringArray(record.notes),
    sourceReference: normalizeSourceReference(record.sourceReference, sourceFile),
  };
};

const normalizeIdentity = (value: unknown): ExtractedResumeDocument['identity'] => {
  const record = asRecord(value);

  return {
    fullName: toOptionalString(record.fullName) ?? 'Unknown Candidate',
    headline: toOptionalString(record.headline),
    location: toOptionalString(record.location),
  };
};

const normalizeContact = (value: unknown): ContactInfo => {
  const record = asRecord(value);

  return {
    email: toOptionalString(record.email),
    phone: toOptionalString(record.phone),
    website: toOptionalString(record.website),
    linkedin: toOptionalString(record.linkedin),
    github: toOptionalString(record.github),
    location: toOptionalString(record.location),
  };
};

const normalizeEducation = (value: unknown): EducationEntry | undefined => {
  const record = asRecord(value);
  const institution = toOptionalString(record.institution);

  if (!institution) {
    return undefined;
  }

  return {
    institution,
    degree: toOptionalString(record.degree),
    fieldOfStudy: toOptionalString(record.fieldOfStudy),
    location: toOptionalString(record.location),
    graduationDate: toOptionalString(record.graduationDate),
    honors: toStringArray(record.honors),
  };
};

const normalizeCertification = (
  value: unknown,
): ExtractedResumeDocument['certifications'][number] | undefined => {
  const record = asRecord(value);
  const name = toOptionalString(record.name);

  if (!name) {
    return undefined;
  }

  return {
    name,
    issuer: toOptionalString(record.issuer),
    issueDate: toOptionalString(record.issueDate),
    expirationDate: toOptionalString(record.expirationDate),
    credentialId: toOptionalString(record.credentialId),
  };
};

const normalizeSummaryVariant = (value: unknown, index: number): SummaryVariant | undefined => {
  const record = asRecord(value);
  const text = toOptionalString(record.text);

  if (!text) {
    return undefined;
  }

  return {
    id: toOptionalString(record.id) ?? (slugify(text) || `summary-${index + 1}`),
    label: toOptionalString(record.label) ?? 'general',
    text,
    tags: toStringArray(record.tags),
    sourceBulletIds: toStringArray(record.sourceBulletIds),
  };
};

const normalizeSkillCategory = (value: unknown): SkillCategory | undefined => {
  const record = asRecord(value);
  const items = toStringArray(record.items);

  if (items.length === 0) {
    return undefined;
  }

  return {
    category: toOptionalString(record.category) ?? 'General',
    items,
    evidence: toStringArray(record.evidence),
  };
};

const normalizeExperience = (value: unknown): ExtractedResumeExperience | undefined => {
  const record = asRecord(value);
  const bullets = asArray(record.bullets).map(normalizeBullet).filter(isDefined);
  const company = toOptionalString(record.company);
  const roleTitle = toOptionalString(record.roleTitle);

  if (!company && !roleTitle && bullets.length === 0) {
    return undefined;
  }

  return {
    company: company ?? 'Unknown Company',
    roleTitle: roleTitle ?? 'Unknown Role',
    dateRange: normalizeDateRange(record.dateRange),
    location: toOptionalString(record.location),
    bullets,
    tags: toStringArray(record.tags),
    domainTags: toStringArray(record.domainTags),
    alternatePhrasings: toStringArray(record.alternatePhrasings),
    safeReframingCategories: toStringArray(record.safeReframingCategories),
    confidence: toConfidence(record.confidence),
  };
};

const normalizeBullet = (
  value: unknown,
): ExtractedResumeExperience['bullets'][number] | undefined => {
  const record = asRecord(value);
  const original = toOptionalString(record.original);

  if (!original) {
    return undefined;
  }

  return {
    original,
    alternates: toStringArray(record.alternates),
    tags: toStringArray(record.tags),
    domainTags: toStringArray(record.domainTags),
    safeReframes: toStringArray(record.safeReframes),
    allowedProfiles: toSupportedProfileIds(record.allowedProfiles),
    riskLevel: toRiskLevel(record.riskLevel),
    confidence: toConfidence(record.confidence),
  };
};

const normalizeDateRange = (
  value: unknown,
): ExtractedResumeExperience['dateRange'] => {
  const record = asRecord(value);

  return {
    start: toOptionalString(record.start) ?? 'unknown',
    end: toOptionalString(record.end),
    current: typeof record.current === 'boolean' ? record.current : undefined,
  };
};

const normalizeSourceReference = (value: unknown, sourceFile: string): SourceReference => {
  const record = asRecord(value);

  return {
    sourceFile,
    sourceType: toSourceType(record.sourceType) ?? inferSourceType(sourceFile),
    extractedAt: toOptionalString(record.extractedAt) ?? new Date().toISOString(),
    checksum: toOptionalString(record.checksum),
    snippets: toStringArray(record.snippets),
  };
};

const inferSourceType = (sourceFile: string): SourceReference['sourceType'] => {
  const extension = extname(sourceFile).toLowerCase();

  if (extension === '.pdf') {
    return 'pdf';
  }

  if (extension === '.txt') {
    return 'text';
  }

  if (extension === '.json') {
    return 'json';
  }

  if (extension === '.html' || extension === '.htm') {
    return 'html';
  }

  return 'markdown';
};

const toSourceType = (value: unknown): SourceReference['sourceType'] | undefined => {
  if (value === 'pdf' || value === 'markdown' || value === 'text' || value === 'json' || value === 'html') {
    return value;
  }

  return undefined;
};

const toRiskLevel = (value: unknown): RiskLevel => {
  if (typeof value === 'string' && SUPPORTED_RISK_LEVELS.has(value as RiskLevel)) {
    return value as RiskLevel;
  }

  return 'low';
};

const toSupportedProfileIds = (value: unknown): SupportedProfileId[] =>
  asArray(value)
    .filter((item): item is SupportedProfileId => typeof item === 'string' && SUPPORTED_PROFILE_ID_SET.has(item))
    .filter((item, index, values) => values.indexOf(item) === index);

const toStringArray = (value: unknown): string[] =>
  uniqueStrings(
    asArray(value)
      .map((item) => toOptionalString(item))
      .filter(isDefined),
  );

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = normalizeWhitespace(value);
  return normalized.length > 0 ? normalized : undefined;
};

const toConfidence = (value: unknown): number => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length > 0
        ? Number(value)
        : undefined;

  if (typeof parsed !== 'number' || Number.isNaN(parsed)) {
    return 0.5;
  }

  return Math.min(1, Math.max(0, parsed));
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const isDefined = <T>(value: T | undefined): value is T => value !== undefined;
