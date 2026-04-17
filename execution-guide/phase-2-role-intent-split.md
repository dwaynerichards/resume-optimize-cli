# Phase 2 Execution Guide — Separate Role Intent From Employer Context

**Target model:** Sonnet
**Branch:** `refactor/role-intent-split` (already created, based on `feature/v1`)
**Upstream context:** `session-handoff/2026-04-15T21-08 - phase-plan-refinements-and-normalizer-contract.md`

## Goal

Stop public-sector employers from hijacking role classification for technical roles. Split
`NormalizedJobPosting` so role type is driven by job title + required technologies, and employer
context acts only as a modifier.

## Success Criterion (verify before declaring done)

Run the NYC Full Stack Developer job end-to-end; `ProfileRecommendationService.recommend()` must
return `profileId` of `general-swe` or `backend-engineer`, **not** `public-service`. The
confidence should remain ≥ 0.5 and `shouldPrompt` may be true or false — classification correctness
is the target, not prompting behavior.

Canonical target job:
`https://cityjobs.nyc.gov/job/full-stack-developer-in-brooklyn-jid-41824`

## Scope Boundaries (do not exceed)

- **In scope:**
  - `src/common/types/resume-tailor.types.ts` — new fields on `NormalizedJobPosting`
  - `src/jobs/job-classification.service.ts` — split classification logic
  - `src/jobs/job-parse.service.ts` — pass through new fields
  - `tests/job-classification.test.ts` — new assertions
  - `tests/fixtures/` — new HTML fixture for public-sector software role
  - `src/profiles/profile-recommendation.service.ts` — **read-only consumer update** (use new
    fields; do not restructure the scorer)
- **Out of scope (do NOT touch):**
  - Any normalizer refactor work (that's Phase 1, a different branch)
  - Splitting validation into tiers (separate phase)
  - Creating a `RewritePlan` object or scorer (Phase 4)
  - Changing prompts in `prompts/`
  - Any file under `src/ingest/`, `src/tailoring/`, or `src/validation/`

## Pre-Flight (critical)

The branch was created from `feature/v1` which has **extensive uncommitted work in the working
tree**. That work is intentional and belongs to prior sessions — it will appear in `git status`
but it is **not yours to commit**.

Before staging anything:

```bash
git status --short
```

Only stage files you actually modified for Phase 2. Use explicit paths:

```bash
git add src/common/types/resume-tailor.types.ts \
        src/jobs/job-classification.service.ts \
        src/jobs/job-parse.service.ts \
        src/profiles/profile-recommendation.service.ts \
        tests/job-classification.test.ts \
        tests/fixtures/public-sector-swe.html
```

**Never run `git add -A` or `git add .` on this branch.**

## Step 1 — Extend `NormalizedJobPosting`

**File:** `src/common/types/resume-tailor.types.ts`

Add a new type and new fields on `NormalizedJobPosting`. Keep existing fields for backward
compatibility; the old `domainClassification` becomes legacy but remains populated so current
consumers don't break.

### Find (exact, line-anchored around `NormalizedJobPosting`)

```ts
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
  domainClassification: string[];
  confidence: number;
  rawText?: string;
  signal?: JobSignalAssessment;
}
```

### Replace with

```ts
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

export interface RoleSignals {
  titleTokens: string[];
  technologyTokens: string[];
  responsibilityTokens: string[];
  seniorityTokens: string[];
}

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
  /** @deprecated retained for backward compatibility; prefer roleClassification + employerContext. */
  domainClassification: string[];
  roleClassification: RoleClassification;
  employerContext: EmployerContext;
  technicalSignals: RoleSignals;
  deliverySignals: string[];
  confidence: number;
  rawText?: string;
  signal?: JobSignalAssessment;
}
```

## Step 2 — Split Classification Logic

**File:** `src/jobs/job-classification.service.ts`

Rewrite the service so role type is computed from title + tech signals, employer context is
computed separately from employer + location + domain cues, and the legacy `domainClassification`
is derived from both as a union of labels.

### Rules

1. **Role classification precedence:**
   - Title tokens (e.g. "full stack", "backend", "blockchain") are the primary signal.
   - Technology tokens in minimum/preferred qualifications (e.g. `react`, `node`, `solidity`,
     `postgres`, `kubernetes`) are the secondary signal.
   - Responsibility verbs (e.g. "build APIs", "deploy contracts") tertiary.
   - If title says "Full Stack Developer" the role is `full-stack-engineering` regardless of
     employer.
2. **Employer context is independent:**
   - Employer name matching `/nyc|.gov|city of|department of|agency|authority/i` → `public-sector`.
   - Employer or domain matching `/university|college|school/i` → `education`.
   - Otherwise default `private-sector` when employer is present, else `unknown`.
3. **Employer context must not modify role classification.** It may appear in
   `domainClassification` (the legacy array) alongside the role, but it must not replace it.
4. **Legacy `domainClassification`** is the union of:
   - The role classification label
   - The employer context label (if not `private-sector` or `unknown`)

### Token Lists (minimum; extend as needed)

```ts
const FULL_STACK_TITLE_TOKENS = ['full stack', 'fullstack', 'full-stack'];
const BACKEND_TITLE_TOKENS = ['backend', 'back-end', 'server', 'api engineer', 'platform engineer'];
const FRONTEND_TITLE_TOKENS = ['frontend', 'front-end', 'ui engineer', 'web developer'];
const BLOCKCHAIN_TITLE_TOKENS = ['blockchain', 'web3', 'smart contract', 'solidity'];
const DATA_TITLE_TOKENS = ['data engineer', 'data platform', 'etl', 'analytics engineer'];
const DEVOPS_TITLE_TOKENS = ['devops', 'sre', 'site reliability', 'platform reliability'];

const BACKEND_TECH_TOKENS = ['node', 'express', 'nestjs', 'java', 'spring', 'go', 'python', 'django', 'flask', 'postgres', 'mysql', 'mongodb', 'redis', 'kafka'];
const FRONTEND_TECH_TOKENS = ['react', 'angular', 'vue', 'typescript', 'javascript', 'html', 'css', 'tailwind'];
const BLOCKCHAIN_TECH_TOKENS = ['solidity', 'hardhat', 'ethers', 'web3', 'evm', 'ethereum', 'foundry'];
const DEVOPS_TECH_TOKENS = ['kubernetes', 'docker', 'terraform', 'aws', 'gcp', 'azure', 'jenkins', 'ci/cd'];
```

### Required public method shape

Keep `merge(rawJob, normalizedJob)` but additionally compute and return the new fields:

```ts
merge(rawJob: RawJobDocument, normalizedJob: NormalizedJobPosting): NormalizedJobPosting {
  // ... existing normalization of arrays ...
  const jobTitle = /* as today */;
  const roleClassification = this.classifyRole(jobTitle, normalizedJob, rawJob);
  const employerContext = this.classifyEmployer(normalizedJob, rawJob);
  const technicalSignals = this.extractRoleSignals(jobTitle, normalizedJob, rawJob);
  const deliverySignals = this.extractDeliverySignals(normalizedJob, rawJob);
  const domainClassification = this.composeLegacyDomainClassification(
    normalizedJob.domainClassification,
    roleClassification,
    employerContext,
    heuristicKeywords,
  );

  return {
    ...normalizedJob,
    jobTitle,
    // ... existing fields ...
    domainClassification,
    roleClassification,
    employerContext,
    technicalSignals,
    deliverySignals,
    // ... existing trailing fields ...
  };
}
```

Add private methods:

- `classifyRole(jobTitle, normalized, raw) → RoleClassification`
- `classifyEmployer(normalized, raw) → EmployerContext`
- `extractRoleSignals(jobTitle, normalized, raw) → RoleSignals`
- `extractDeliverySignals(normalized, raw) → string[]`
- `composeLegacyDomainClassification(existing, role, employer, heuristics) → string[]`

### Delete the old `heuristicDomainClassification` method

The old method conflated public-service employers with role type. Remove it. Its logic is
redistributed between `classifyRole` (which ignores "public", "agency") and `classifyEmployer`
(which handles public-sector employer classification).

## Step 3 — Update `job-parse.service.ts`

**File:** `src/jobs/job-parse.service.ts`

No changes required beyond ensuring the new `NormalizedJobPosting` fields pass through. Because
`merge()` now returns them, the existing spread-return in `fetchAndNormalize` is sufficient. Run
`npm run build` (or the project's type-check command — check `package.json` first) to confirm.

## Step 4 — Update `profile-recommendation.service.ts` (read-only consumer)

**File:** `src/profiles/profile-recommendation.service.ts`

Minimal change: teach the recommender to prefer `roleClassification` over
`domainClassification` when deciding profile fit, and treat `employerContext` as a modifier only.

### Find

```ts
const CLASSIFICATION_PROFILE_MAP: Record<string, ProfileDefinition['id']> = {
  'backend-engineering': 'backend-engineer',
  blockchain: 'blockchain-engineer',
  'public-service': 'public-service',
  'software-engineering': 'general-swe',
};
```

### Replace with

```ts
const ROLE_PROFILE_MAP: Record<string, ProfileDefinition['id']> = {
  'backend-engineering': 'backend-engineer',
  'frontend-engineering': 'general-swe',
  'full-stack-engineering': 'general-swe',
  'software-engineering': 'general-swe',
  'blockchain-engineering': 'blockchain-engineer',
};

const EMPLOYER_PROFILE_MODIFIER: Record<string, { profile: ProfileDefinition['id']; bonus: number }> = {
  'public-sector': { profile: 'public-service', bonus: 0.08 },
};
```

### In `scoreProfile`, replace the classification-loop block

**Find:**

```ts
for (const classification of job.domainClassification) {
  if (CLASSIFICATION_PROFILE_MAP[classification] === profile.id) {
    score += 0.5;
    reasons.push(`Matched job classification "${classification}".`);
  }
}
```

**Replace with:**

```ts
const roleMappedProfile = ROLE_PROFILE_MAP[job.roleClassification];
if (roleMappedProfile === profile.id) {
  score += 0.5;
  reasons.push(`Matched role classification "${job.roleClassification}".`);
}

const employerModifier = EMPLOYER_PROFILE_MODIFIER[job.employerContext];
if (employerModifier && employerModifier.profile === profile.id) {
  score += employerModifier.bonus;
  reasons.push(`Employer context "${job.employerContext}" favors ${profile.label}.`);
}
```

The key invariant: **employer context only adds a small bonus; it never replaces the role-based
classification match.** This prevents public-sector employers from outranking the correct
technical-role profile.

## Step 5 — Add Test Fixture for Public-Sector Software Role

**File:** `tests/fixtures/public-sector-swe.html` (new)

Create a minimal HTML fixture that mimics the NYC Full Stack Developer page structure:

```html
<!doctype html>
<html>
  <head>
    <title>Full Stack Developer — City of New York</title>
    <meta name="description" content="Full Stack Developer position at the City of New York." />
  </head>
  <body>
    <h1>Full Stack Developer</h1>
    <h2>Department of Information Technology and Telecommunications</h2>
    <p>The City of New York is hiring a Full Stack Developer to build internal web applications.</p>
    <h3>Minimum Qualifications</h3>
    <ul>
      <li>Bachelor's degree in Computer Science or related field.</li>
      <li>Three or more years of experience with JavaScript, TypeScript, React, and Node.js.</li>
      <li>Experience designing and building REST APIs against PostgreSQL or MongoDB.</li>
    </ul>
    <h3>Preferred Qualifications</h3>
    <ul>
      <li>Experience with Docker, Kubernetes, and CI/CD pipelines.</li>
      <li>Prior work in civic technology or public-sector software.</li>
    </ul>
    <h3>Responsibilities</h3>
    <ul>
      <li>Build and maintain full-stack web applications serving City agencies.</li>
      <li>Design and implement REST APIs and database schemas.</li>
      <li>Collaborate with product managers and designers on new features.</li>
    </ul>
  </body>
</html>
```

## Step 6 — Add Classification Tests

**File:** `tests/job-classification.test.ts`

Append new test cases. **Do not remove the existing test.**

```ts
it('classifies NYC Full Stack Developer as full-stack-engineering, not public-service role', () => {
  const service = new JobClassificationService(new KeywordExtractionService());

  const result = service.merge(
    {
      sourceUrl: 'https://cityjobs.nyc.gov/job/full-stack-developer-in-brooklyn-jid-41824',
      fetchedAt: '2026-04-15T21:00:00.000Z',
      pageTitle: 'Full Stack Developer — City of New York',
      metaDescription: 'Full Stack Developer at the City of New York.',
      headings: [
        'Full Stack Developer',
        'Department of Information Technology and Telecommunications',
        'Minimum Qualifications',
      ],
      listItems: [
        "Three or more years of experience with JavaScript, TypeScript, React, and Node.js.",
        'Experience designing and building REST APIs against PostgreSQL or MongoDB.',
      ],
      paragraphs: [
        'The City of New York is hiring a Full Stack Developer to build internal web applications.',
      ],
      bodyText:
        'Full Stack Developer City of New York TypeScript React Node PostgreSQL MongoDB REST APIs',
    },
    {
      sourceUrl: 'https://cityjobs.nyc.gov/job/full-stack-developer-in-brooklyn-jid-41824',
      fetchedAt: '2026-04-15T21:00:00.000Z',
      jobTitle: 'Full Stack Developer',
      employer: 'City of New York',
      responsibilities: [
        'Build and maintain full-stack web applications serving City agencies.',
      ],
      minimumQualifications: [
        "Three or more years of experience with JavaScript, TypeScript, React, and Node.js.",
      ],
      preferredQualifications: ['Experience with Docker, Kubernetes, and CI/CD pipelines.'],
      domainKeywords: [],
      atsKeywords: [],
      seniorityIndicators: [],
      domainClassification: [],
      roleClassification: 'unknown',
      employerContext: 'unknown',
      technicalSignals: { titleTokens: [], technologyTokens: [], responsibilityTokens: [], seniorityTokens: [] },
      deliverySignals: [],
      confidence: 0.8,
    },
  );

  expect(result.roleClassification).toBe('full-stack-engineering');
  expect(result.employerContext).toBe('public-sector');
  expect(result.domainClassification).toContain('full-stack-engineering');
});

it('does not let public-sector employer override technical role classification', () => {
  const service = new JobClassificationService(new KeywordExtractionService());

  const result = service.merge(
    {
      sourceUrl: 'https://example.gov/job/backend',
      fetchedAt: '2026-04-15T21:00:00.000Z',
      pageTitle: 'Backend Engineer — State Agency',
      headings: ['Backend Engineer', 'State Agency'],
      listItems: ['Five years of experience with Go, PostgreSQL, and Kafka.'],
      paragraphs: [],
      bodyText: 'Backend Engineer State Agency Go PostgreSQL Kafka',
    },
    {
      sourceUrl: 'https://example.gov/job/backend',
      fetchedAt: '2026-04-15T21:00:00.000Z',
      jobTitle: 'Backend Engineer',
      employer: 'State Agency',
      responsibilities: [],
      minimumQualifications: ['Five years of experience with Go, PostgreSQL, and Kafka.'],
      preferredQualifications: [],
      domainKeywords: [],
      atsKeywords: [],
      seniorityIndicators: [],
      domainClassification: [],
      roleClassification: 'unknown',
      employerContext: 'unknown',
      technicalSignals: { titleTokens: [], technologyTokens: [], responsibilityTokens: [], seniorityTokens: [] },
      deliverySignals: [],
      confidence: 0.8,
    },
  );

  expect(result.roleClassification).toBe('backend-engineering');
  expect(result.employerContext).toBe('public-sector');
});
```

Also update the existing test's dummy object literals so TypeScript compiles against the new
required fields (`roleClassification`, `employerContext`, `technicalSignals`, `deliverySignals`).
Use the same defaults as shown above (`'unknown'`, empty arrays).

## Step 7 — Add Recommender Test

**File:** `tests/profile-recommendation.test.ts` (append)

Add one assertion that the NYC-like input resolves to `general-swe` (or `backend-engineer`), not
`public-service`:

```ts
it('recommends general-swe for public-sector Full Stack Developer role', () => {
  // construct a NormalizedJobPosting with
  //   roleClassification: 'full-stack-engineering'
  //   employerContext: 'public-sector'
  //   jobTitle: 'Full Stack Developer'
  //   employer: 'City of New York'
  // and a standard profileDefaults fixture.
  // Assert: result.profileId is 'general-swe' or 'backend-engineer', not 'public-service'.
});
```

Fill in the fixture bodies consistent with the existing test in the file (use the same
`profileDefaults` shape).

## Step 8 — Verify

Run in order. All must pass.

1. Type-check (check `package.json` for the exact script; likely `npm run build` or `npm run typecheck`):
   ```bash
   npm run build
   ```
2. Unit tests (check `package.json`; likely `npm test`):
   ```bash
   npm test -- tests/job-classification.test.ts tests/profile-recommendation.test.ts
   ```
3. End-to-end against the NYC job (check the CLI's invocation shape in `README.md` — there's a
   documented command for `--job-url`). Expected: output directory does not end in
   `-public-service`. Expected: `profileId` in the artifacts is `general-swe` or
   `backend-engineer`.

If any verification step fails, **stop and report** — do not commit partial work.

## Step 9 — Commit

Only after all verification passes:

```bash
git add src/common/types/resume-tailor.types.ts \
        src/jobs/job-classification.service.ts \
        src/profiles/profile-recommendation.service.ts \
        tests/job-classification.test.ts \
        tests/profile-recommendation.test.ts \
        tests/fixtures/public-sector-swe.html \
        execution-guide/phase-2-role-intent-split.md

git commit -m "refactor(jobs): split role intent from employer context

Adds roleClassification + employerContext + technicalSignals + deliverySignals
to NormalizedJobPosting. Role type is driven by job title and technology
signals; employer context acts only as a scoring modifier. Fixes the case
where public-sector employers overrode technical role classification (e.g.
NYC Full Stack Developer misclassified as public-service).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

Then report:

- Which tests pass
- Result of the NYC end-to-end run (profile ID, confidence, output directory name)
- Any deviations from this guide with rationale

## What NOT to Do

- Do not commit the pre-existing uncommitted work in `feature/v1`.
- Do not add normalizer refactors, validation tier splits, or rewrite-plan scaffolding.
- Do not rename or restructure `NormalizedJobPosting` beyond the additions specified.
- Do not touch prompts under `prompts/`.
- Do not rewrite `ProfileRecommendationService` beyond the two replacements specified.
- Do not delete `domainClassification`. It is deprecated, not removed, for compatibility with
  consumers on `feature/v1`.
