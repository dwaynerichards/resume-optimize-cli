export type SupportedProfileId =
  | 'public-service'
  | 'backend-engineer'
  | 'general-swe'
  | 'blockchain-engineer';

export type JobSignalLevel = 'strong' | 'weak' | 'thin';
export type JobSignalPolicy = 'warn' | 'confirm' | 'abort';

export type RiskLevel = 'low' | 'medium' | 'high';
export type LengthTarget = 'concise' | 'standard' | 'expanded';
export type OutputFormat = 'md' | 'docx' | 'both';
export type EmphasisLevel = 'low' | 'medium' | 'high';
export type ExperienceBlockType = 'organization' | 'domain' | 'focus-area' | 'section';

export interface DateRange {
  start: string;
  end?: string;
  current?: boolean;
}

export interface SourceReference {
  sourceFile: string;
  sourceType: 'pdf' | 'markdown' | 'text' | 'json' | 'html';
  extractedAt: string;
  checksum?: string;
  snippets?: string[];
}

export interface IdentityInfo {
  fullName: string;
  headline?: string;
  location?: string;
}

export interface ContactInfo {
  email?: string;
  phone?: string;
  website?: string;
  linkedin?: string;
  github?: string;
  location?: string;
}

export interface EducationEntry {
  institution: string;
  degree?: string;
  fieldOfStudy?: string;
  location?: string;
  graduationDate?: string;
  honors?: string[];
}

export interface CertificationEntry {
  name: string;
  issuer?: string;
  issueDate?: string;
  expirationDate?: string;
  credentialId?: string;
}

export interface SummaryVariant {
  id: string;
  label: string;
  text: string;
  tags: string[];
  sourceBulletIds?: string[];
}

export interface SkillCategory {
  category: string;
  items: string[];
  evidence?: string[];
}

export interface ResumeBullet {
  id: string;
  sourceFile: string;
  sourceRoleId: string;
  company: string;
  role: string;
  original: string;
  alternates: string[];
  tags: string[];
  domainTags: string[];
  safeReframes: string[];
  allowedProfiles: SupportedProfileId[];
  riskLevel: RiskLevel;
  confidence: number;
}

export interface ExperienceOptionality {
  defaultIncluded: boolean;
  rationale?: string;
  blockIds: string[];
}

export interface ExperienceEntry {
  id: string;
  company: string;
  roleTitle: string;
  dateRange: DateRange;
  location?: string;
  bullets: ResumeBullet[];
  tags: string[];
  domainTags: string[];
  alternatePhrasings: string[];
  safeReframingCategories: string[];
  optionality: ExperienceOptionality;
  sourceReferences: SourceReference[];
  chronologyIndex: number;
  confidence: number;
}

export interface RoleCluster {
  id: string;
  label: string;
  type: ExperienceBlockType;
  tags: string[];
  domainTags: string[];
  experienceIds: string[];
  bulletIds: string[];
  defaultInclusion: boolean;
  inferredSupportProfiles: SupportedProfileId[];
}

export interface ProfileDefinition {
  id: SupportedProfileId;
  label: string;
  summaryStyle: string;
  skillsOrdering: string[];
  preferredDomainTags: string[];
  preferredBulletTags: string[];
  disfavoredBulletTags: string[];
  typicalExperienceInclusionDefaults: string[];
  toneGuidance: string;
  supportScore?: number;
  supported?: boolean;
  recommendedDefaultExperienceBlocks: string[];
  hiddenIfUnsupported: boolean;
}

export interface ProfileRecommendationCandidate {
  profileId: SupportedProfileId;
  score: number;
}

export interface ProfileRecommendation {
  profileId: SupportedProfileId;
  confidence: number;
  rationale: string[];
  shouldPrompt: boolean;
  alternatives: ProfileRecommendationCandidate[];
}

export interface CanonicalResume {
  identity: IdentityInfo;
  contact: ContactInfo;
  education: EducationEntry[];
  certifications: CertificationEntry[];
  summaryVariants: SummaryVariant[];
  skills: SkillCategory[];
  experience: ExperienceEntry[];
  roleClusters: RoleCluster[];
  domainTags: string[];
  optionalSections: RoleCluster[];
  sourceReferences: SourceReference[];
}

export interface BulletBankDocument {
  bullets: ResumeBullet[];
}

export interface ProfileDefaultsDocument {
  generatedAt: string;
  sourceFiles: string[];
  profiles: ProfileDefinition[];
}

export interface ExtractedResumeBullet {
  original: string;
  alternates: string[];
  tags: string[];
  domainTags: string[];
  safeReframes: string[];
  allowedProfiles: SupportedProfileId[];
  riskLevel: RiskLevel;
  confidence: number;
}

export interface ExtractedResumeExperience {
  company: string;
  roleTitle: string;
  dateRange: DateRange;
  location?: string;
  bullets: ExtractedResumeBullet[];
  tags: string[];
  domainTags: string[];
  alternatePhrasings: string[];
  safeReframingCategories: string[];
  confidence: number;
}

export interface ExtractedResumeDocument {
  sourceFile: string;
  identity: IdentityInfo;
  contact: ContactInfo;
  education: EducationEntry[];
  certifications: CertificationEntry[];
  summaryVariants: SummaryVariant[];
  skills: SkillCategory[];
  experience: ExtractedResumeExperience[];
  domainTags: string[];
  notes: string[];
  sourceReference: SourceReference;
}

export interface ResumeExtractionInput {
  sourceFile: string;
  text: string;
}

export interface ResumeMergeInput {
  resumes: ExtractedResumeDocument[];
  profiles: ProfileDefinition[];
}

export interface ResumeMergeAssistResult {
  summaryVariants: SummaryVariant[];
  additionalRoleClusters: Omit<RoleCluster, 'experienceIds' | 'bulletIds'>[];
  supportSignals: Record<SupportedProfileId, string[]>;
}

export interface RawJobDocument {
  sourceUrl: string;
  fetchedAt: string;
  pageTitle?: string;
  metaDescription?: string;
  headings: string[];
  listItems: string[];
  paragraphs: string[];
  bodyText: string;
}

export interface JobSignalAssessment {
  level: JobSignalLevel;
  score: number;
  reasons: string[];
}

export type RoleClassification =
  | 'software-engineering'
  | 'backend-engineering'
  | 'frontend-engineering'
  | 'full-stack-engineering'
  | 'blockchain-engineering'
  | 'data-engineering'
  | 'devops-sre'
  | 'non-technical'
  | 'unknown';

export type EmployerContext =
  | 'public-sector'
  | 'private-sector'
  | 'non-profit'
  | 'education'
  | 'startup'
  | 'enterprise'
  | 'unknown';

export interface NormalizedJobPosting {
  sourceUrl: string;
  fetchedAt: string;
  pageTitle?: string;
  jobTitle: string;
  employer?: string;
  location?: string;
  responsibilities: string[];
  minimumQualifications: string[];
  preferredQualifications: string[];
  domainKeywords: string[];
  atsKeywords: string[];
  seniorityIndicators: string[];
  roleClassification: RoleClassification;
  employerContext: EmployerContext;
  /** @deprecated derived from roleClassification + employerContext for one release. */
  domainClassification: string[];
  confidence: number;
  rawText?: string;
  signal?: JobSignalAssessment;
}

export interface RequirementMapping {
  requirement: string;
  matchedBulletIds: string[];
  rationale: string;
  confidence: number;
}

export interface ExperienceControl {
  blockId: string;
  include: boolean;
  emphasis: EmphasisLevel;
  orderPriority?: number;
}

export interface DiscoveredExperienceBlock {
  id: string;
  label: string;
  type: ExperienceBlockType;
  experienceIds: string[];
  bulletIds: string[];
  tags: string[];
  domainTags: string[];
  defaultInclude: boolean;
  supportedProfiles: SupportedProfileId[];
}

export interface TailoredBullet {
  text: string;
  sourceBulletIds: string[];
  tags: string[];
  rationale?: string;
}

export interface TailoredExperienceEntry {
  experienceId: string;
  company: string;
  roleTitle: string;
  dateRange: DateRange;
  location?: string;
  bullets: TailoredBullet[];
  emphasis: EmphasisLevel;
}

export interface TailoredResumeDocument {
  profileId: SupportedProfileId;
  identity: IdentityInfo;
  contact: ContactInfo;
  summary: string;
  skills: SkillCategory[];
  experience: TailoredExperienceEntry[];
  education: EducationEntry[];
  certifications: CertificationEntry[];
  job: NormalizedJobPosting;
  requirementMappings: RequirementMapping[];
  selectedBlocks: string[];
  omittedBlocks: string[];
  lengthTarget: LengthTarget;
  generatedAt: string;
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  sourceBulletIds?: string[];
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  traceabilityCoverage: number;
}

export interface TailoringArtifacts {
  markdownPath?: string;
  docxPath?: string;
  reportPath?: string;
  validation: ValidationResult;
}

export interface TailoringRequest {
  jobUrl?: string;
  job?: NormalizedJobPosting;
  profileId: SupportedProfileId;
  experienceControls: ExperienceControl[];
  lengthTarget: LengthTarget;
  outputFormat: OutputFormat;
}

export interface ResumeRewriteInput {
  canonicalResume: CanonicalResume;
  bulletBank: BulletBankDocument;
  profile: ProfileDefinition;
  job: NormalizedJobPosting;
  experienceControls: ExperienceControl[];
  lengthTarget: LengthTarget;
  requirementMappings: RequirementMapping[];
}

export interface ChangeReportInput {
  tailoredResume: TailoredResumeDocument;
  canonicalResume: CanonicalResume;
  bulletBank: BulletBankDocument;
  profile: ProfileDefinition;
}
