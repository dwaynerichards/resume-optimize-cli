# Execution Guide — LLM-First Pipeline Simplification

**Runtime scope:** provider-neutral configuration seam with `openai` as the only implemented backend in Phase 0
**Target branch:** `refactor/llm-first-pipeline` (new — see Pre-Flight)
**Supersedes:** `phase-2-role-intent-split.md` (keep the file for history; do not execute it)
**Upstream context:** `session-handoff/2026-04-11T02-54 - profile-selection-recommendation-handoff.md`

## Goal

Before more LLM-first simplification work, make the runtime provider choice explicit. Then reduce
the pipeline to:

1. Select the active LLM backend via `LLM_PROVIDER` (default `openai`)
2. Fetch + parse HTML → raw text (deterministic)
3. **LLM** classifies job (role + employer context) via structured output
4. **LLM** tailors resume from canonical corpus + job posting in one shot
5. **Deterministic validator** gates the LLM output (traceability, chronology, identity)

Delete the heuristic classifier/scorer/keyword layers that sit between those steps.

## Success Criteria (verify before declaring the work done)

1. Phase 0 provider selection →
   - `LLM_PROVIDER=openai` remains the default working path
   - unsupported `LLM_PROVIDER` values fail fast in `LlmModule` with a clear error
   - `.env.example` and `README.md` explain provider selection and note that only OpenAI is
     implemented today
2. NYC Full Stack Developer end-to-end →
   - `roleClassification === 'full-stack-engineering'`
   - `employerContext === 'public-sector'`
   - Recommended `profileId` is `general-swe` or `backend-engineer`, **not** `public-service`
   - Canonical target: `https://cityjobs.nyc.gov/job/full-stack-developer-in-brooklyn-jid-41824`
3. The following files are deleted:
   - `src/jobs/keyword-extraction.service.ts`
   - `src/jobs/job-classification.service.ts`
   - `src/llm/interfaces/job-analysis-provider.interface.ts` → collapsed into a single extract prompt (or kept if a second phase wants it; see Phase 1 notes)
4. The following methods are deleted:
   - `ProfileRecommendationService.scoreProfile` (replaced by a minimal mapper)
   - `ProfileRecommendationService.computeOverlap`, `.matchesPhrase`, `.normalize`
   - `ExperienceMappingService.selectExperience`, `.bulletJobScore`, `.reorderSkills`, `.safeRequirementMapping`
5. Validator still rejects: empty tailored output, unknown `experienceId`, company/role identity mismatch, chronology drift, missing `sourceBulletIds`.
6. `npm run build` clean. `npm test` green.

## Pre-Flight (critical — do NOT skip)

### Starting state assumption

When work on this guide starts, the working tree is clean and the branch is `refactor/llm-first-pipeline`. Verify:

```bash
git rev-parse --abbrev-ref HEAD   # expect: refactor/llm-first-pipeline
git status --short                # expect: empty
```

If either check fails, **stop and report**. Do not attempt to clean up yourself — the uncommitted work belongs to the user.

### If the user has not yet cut the branch

Do not cut it from the assistant. The uncommitted `feature/v1` tree state is the user's responsibility. Report back with:

> "Tree is not clean / branch is not `refactor/llm-first-pipeline`. Requesting user confirmation that pre-flight is complete before proceeding."

## Structure

Seven phases, **one PR per phase**, human review between phases. Phases
0–5 are the core LLM-first refactor; Phase 6 is an additive extension
(clipping-as-job-input) that runs after Phase 5 ships and the validator
gate is in place.

Each phase ends with:

- `npm run build` passes
- `npm test` passes
- `node dist/src/main.js tailor --job-url <NYC URL> ...` succeeds (Phases 1, 2, 3, 5 only)
- **Atomic commit** with conventional message + co-author trailer
- **Stop and report** to user. Do not start the next phase without explicit user go-ahead.

Commit template:

```
<type>(<scope>): <subject>

<body>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## Phase 0 — Provider-neutral config seam

**Goal:** Make provider choice explicit in configuration and dependency injection before further
LLM-first simplification. OpenAI remains the only implemented backend in this phase.

### Step 0.1 — Update `LlmModule` to select the active provider

**File:** `src/llm/llm.module.ts`

Replace the direct `useExisting` token bindings with `ConfigService`-backed factories that:

- read `LLM_PROVIDER`
- default to `openai`
- resolve every LLM token to the OpenAI implementation when `LLM_PROVIDER=openai`
- throw a clear error for any unsupported provider value

Do **not** add new SDK dependencies or provider classes in this phase. The goal is to create the
selection seam, not to implement Anthropic/Gemini/etc yet.

### Step 0.2 — Update `.env.example`

Add `LLM_PROVIDER=openai` at the top. Keep `OPENAI_API_KEY`, `OPENAI_MODEL`, and
`OPENAI_TEMPERATURE` as the active provider settings for now, and note that only OpenAI is
implemented today.

### Step 0.3 — Update `README.md`

Document the new provider selector in setup. Clarify:

- only the selected provider's key should be required
- only `openai` is supported in this phase
- future providers should be added behind `src/llm/interfaces` and `src/llm/llm.module.ts`, not
  threaded through jobs, ingest, tailoring, or validation logic

### Step 0.4 — Verify & commit

```bash
npm run build
npm test
```

If both pass, commit:

```bash
git add src/llm/llm.module.ts \
        .env.example \
        README.md \
        execution-guide/llm-first-pipeline.md

git commit -m "$(cat <<'EOF'
refactor(llm): add provider-selection seam with openai default

- LlmModule now resolves every LLM DI token through a ConfigService-backed
  factory keyed on LLM_PROVIDER instead of hard-wiring OpenAI via
  useExisting. OpenAI remains the default and only implemented backend.
- Unsupported LLM_PROVIDER values fail fast in LlmModule with a clear
  error listing the supported providers.
- .env.example introduces LLM_PROVIDER=openai and documents that only the
  OpenAI adapter is wired today.
- README setup instructions explain the provider selector and direct
  future Anthropic/Gemini/etc work to src/llm/interfaces plus
  src/llm/llm.module.ts rather than threading vendor checks through
  jobs, ingest, tailoring, or validation.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

### Step 0.5 — Report & stop

Report back to the user with:

- default provider behavior
- unsupported-provider behavior
- docs updated

**Do not start Phase 1 without explicit user approval.**

### Adding a second provider (future work — not in scope for Phase 0)

When a second backend (e.g. Anthropic) is wired in:

1. Extend the `SupportedLlmProvider` union in `src/llm/llm.module.ts` (e.g. `'openai' | 'anthropic'`).
2. Add the new task providers under a sibling folder: `src/llm/anthropic/` (client + one class per `src/llm/interfaces/*` task, mirroring the OpenAI shape).
3. Extend each factory's provider map in `LlmModule` (`{ openai: ..., anthropic: ... }`) and add the new class to `inject` + `providers`.
4. Add the provider-specific key to `.env.example` commented-out until the adapter is wired, e.g. `# ANTHROPIC_API_KEY=`.

Do not thread vendor checks through `jobs/`, `ingest/`, `tailoring/`, or `validation/`. The seam is `LlmModule` + `src/llm/interfaces`.

> Deferred: normalizing `OPENAI_MODEL` into a provider-neutral `LLM_MODEL` is intentionally postponed until the second provider adapter lands. Do not introduce `LLM_MODEL` in Phase 0.

---

## Phase 1 — LLM-first job classification

**Why:** `JobClassificationService` currently runs hand-rolled keyword heuristics *on top of* the LLM's output in `OpenAiJobAnalysisProvider.analyze()`. That heuristic is what causes the NYC public-sector-hijack bug. We flip it: the LLM owns classification, the heuristic is deleted.

### Step 1.1 — Extend `NormalizedJobPosting` with new fields

**File:** `src/common/types/resume-tailor.types.ts`

Add two string-literal types and three fields to `NormalizedJobPosting`. Keep the legacy `domainClassification` array for one release as a derived field so PR diffs elsewhere stay small.

**Find:**

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

**Replace with:**

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
```

### Step 1.2 — Update the extract prompt to emit the new fields

**File:** `prompts/extract_job.md`

**Replace the entire file with:**

```markdown
You are extracting a normalized job posting from fetched job-page content.

Rules:
- Use only the supplied page content.
- Do not infer technologies, domain expertise, or responsibilities that are not stated or strongly implied.
- Classify the *role* strictly from job title + listed technologies + responsibilities.
  Ignore employer identity when choosing `roleClassification`.
- Classify the *employer* separately. A public-sector employer hiring a Full Stack Developer has
  roleClassification="full-stack-engineering" and employerContext="public-sector" — never let the
  employer override the role.
- Return JSON only.

Required JSON shape:
{
  "jobTitle": "string",
  "employer": "string optional",
  "location": "string optional",
  "responsibilities": ["string"],
  "minimumQualifications": ["string"],
  "preferredQualifications": ["string"],
  "domainKeywords": ["string"],
  "atsKeywords": ["string"],
  "seniorityIndicators": ["string"],
  "roleClassification":
    "software-engineering" | "backend-engineering" | "frontend-engineering" |
    "full-stack-engineering" | "blockchain-engineering" | "data-engineering" |
    "devops-sre" | "non-technical" | "unknown",
  "employerContext":
    "public-sector" | "private-sector" | "non-profit" | "education" |
    "startup" | "enterprise" | "unknown",
  "confidence": 0.0
}
```

### Step 1.3 — Delete the heuristic classifier

**Delete files:**

- `src/jobs/job-classification.service.ts`
- `src/jobs/keyword-extraction.service.ts`

### Step 1.4 — Update `JobParseService` to consume the LLM output directly

**File:** `src/jobs/job-parse.service.ts`

**Replace the entire file with:**

```ts
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
```

### Step 1.5 — Update `JobsModule` bindings

**File:** `src/jobs/jobs.module.ts`

**Replace the entire file with:**

```ts
import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { JobFetchService } from './job-fetch.service';
import { JobParseService } from './job-parse.service';
import { JobSignalService } from './job-signal.service';

@Module({
  imports: [LlmModule],
  providers: [JobFetchService, JobParseService, JobSignalService],
  exports: [JobFetchService, JobParseService, JobSignalService],
})
export class JobsModule {}
```

### Step 1.6 — Update any tests that depended on the deleted services

Run `npm test` first and note which tests fail. Then:

- Delete `tests/parseJob.test.ts` if it exercised `JobClassificationService` directly (replace with a new test described below).
- Delete `tests/job-classification.test.ts` if it exists.

Add a new fixture-based test:

**File:** `tests/fixtures/public-sector-swe.html` (new)

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

**File:** `tests/jobParse.test.ts` (new or replaces old `parseJob.test.ts`)

Assert the LLM-returned structure flows through correctly. Use a stub `JobAnalysisProvider` so the test is deterministic — this is an integration test for `JobParseService`, not for the real LLM:

```ts
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { JobParseService } from '../src/jobs/job-parse.service';
import { JobFetchService } from '../src/jobs/job-fetch.service';
import { JobSignalService } from '../src/jobs/job-signal.service';
import { JobAnalysisProvider } from '../src/llm/interfaces';
import { NormalizedJobPosting } from '../src/common/types';

class FakeJobFetchService extends JobFetchService {
  constructor(private readonly html: string) {
    super();
  }
  async fetch(): Promise<string> {
    return this.html;
  }
}

const stubAnalyzed: NormalizedJobPosting = {
  sourceUrl: '',
  fetchedAt: '',
  jobTitle: 'Full Stack Developer',
  employer: 'City of New York',
  location: 'Brooklyn, NY',
  responsibilities: ['Build full-stack web applications'],
  minimumQualifications: ['TypeScript, React, Node.js'],
  preferredQualifications: ['Docker, Kubernetes'],
  domainKeywords: ['typescript', 'react', 'node', 'postgresql'],
  atsKeywords: ['full stack', 'rest api'],
  seniorityIndicators: [],
  roleClassification: 'full-stack-engineering',
  employerContext: 'public-sector',
  domainClassification: [],
  confidence: 0.88,
};

class FakeJobAnalysisProvider implements JobAnalysisProvider {
  async analyze(): Promise<NormalizedJobPosting> {
    return stubAnalyzed;
  }
}

describe('JobParseService — LLM-first classification', () => {
  it('preserves LLM role + employer classification for public-sector Full Stack role', async () => {
    const html = readFileSync(resolve(__dirname, 'fixtures/public-sector-swe.html'), 'utf-8');
    const service = new JobParseService(
      new FakeJobFetchService(html),
      new FakeJobAnalysisProvider(),
      new JobSignalService(),
    );

    const result = await service.fetchAndNormalize(
      'https://cityjobs.nyc.gov/job/full-stack-developer-in-brooklyn-jid-41824',
    );

    expect(result.roleClassification).toBe('full-stack-engineering');
    expect(result.employerContext).toBe('public-sector');
    expect(result.domainClassification).toContain('full-stack-engineering');
    expect(result.domainClassification).toContain('public-sector');
  });
});
```

### Step 1.7 — Update type defaults anywhere they're constructed

`NormalizedJobPosting` now has two required fields (`roleClassification`, `employerContext`). Search for construction sites and add defaults (`'unknown'`) where the compiler complains:

```bash
grep -rn "domainClassification:" src/ tests/
```

For any object literal that constructs a `NormalizedJobPosting` without going through the LLM, add:

```ts
roleClassification: 'unknown',
employerContext: 'unknown',
```

### Step 1.8 — Verify & commit

```bash
npm run build
npm test
# End-to-end smoke — requires the API key for the configured LLM_PROVIDER and a clean data/ dir with an ingested resume:
# node dist/src/main.js tailor --job-url 'https://cityjobs.nyc.gov/job/full-stack-developer-in-brooklyn-jid-41824' --profile general-swe --output md
```

If all three pass, commit:

```bash
git add src/common/types/resume-tailor.types.ts \
        src/jobs/job-parse.service.ts \
        src/jobs/jobs.module.ts \
        prompts/extract_job.md \
        tests/jobParse.test.ts \
        tests/fixtures/public-sector-swe.html

git rm src/jobs/job-classification.service.ts \
       src/jobs/keyword-extraction.service.ts \
       tests/parseJob.test.ts   # if it existed and was replaced
       tests/job-classification.test.ts   # if it existed

git commit -m "$(cat <<'EOF'
refactor(jobs): LLM-first job classification, delete heuristic layer

- JobAnalysisProvider now returns roleClassification + employerContext
  directly via structured output; the extract prompt is updated to require
  them and to separate role intent from employer identity.
- Delete JobClassificationService and KeywordExtractionService. The hand-
  rolled keyword + domain heuristics were a source of misclassification
  (e.g. NYC Full Stack Developer classified as public-service).
- domainClassification is derived from the two new fields as a deprecated
  legacy field, kept for one release so downstream consumers don't break.
- Legacy tests exercising the deleted services are replaced by a single
  fixture-driven JobParseService test.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

### Step 1.9 — Report & stop

Report back to user with:

- Files changed / added / deleted
- `npm test` results
- End-to-end run result against the NYC URL (role, employer, profileId from output)
- Any deviations from this guide with rationale

**Do not start Phase 2 without explicit user approval.**

---

## Phase 2 — Simplify `ProfileRecommendationService`

**Goal:** Remove the token-overlap scorer. The recommender becomes a thin mapper over `roleClassification` + `employerContext` + corpus support.

### Step 2.1 — Replace `ProfileRecommendationService`

**File:** `src/profiles/profile-recommendation.service.ts`

**Replace the entire class with:**

```ts
import { Injectable } from '@nestjs/common';
import {
  NormalizedJobPosting,
  ProfileDefaultsDocument,
  ProfileDefinition,
  ProfileRecommendation,
  ProfileRecommendationCandidate,
  RoleClassification,
  EmployerContext,
} from '../common/types';

const ROLE_PROFILE_MAP: Record<RoleClassification, ProfileDefinition['id'] | undefined> = {
  'backend-engineering': 'backend-engineer',
  'frontend-engineering': 'general-swe',
  'full-stack-engineering': 'general-swe',
  'software-engineering': 'general-swe',
  'blockchain-engineering': 'blockchain-engineer',
  'data-engineering': 'general-swe',
  'devops-sre': 'general-swe',
  'non-technical': 'public-service',
  unknown: undefined,
};

const EMPLOYER_BONUS: Partial<Record<EmployerContext, { profile: ProfileDefinition['id']; bonus: number }>> = {
  'public-sector': { profile: 'public-service', bonus: 0.08 },
};

@Injectable()
export class ProfileRecommendationService {
  recommend(
    profileDefaults: ProfileDefaultsDocument,
    job: NormalizedJobPosting,
  ): ProfileRecommendation {
    const visible = profileDefaults.profiles.filter(
      (p) => p.supported !== false || !p.hiddenIfUnsupported,
    );
    const profiles = visible.length > 0 ? visible : profileDefaults.profiles;

    const primary = ROLE_PROFILE_MAP[job.roleClassification];
    const employerModifier = EMPLOYER_BONUS[job.employerContext];

    const scored = profiles.map((profile) => {
      const reasons: string[] = [];
      let score = 0;

      if (primary === profile.id) {
        score += 0.6;
        reasons.push(`Role classification "${job.roleClassification}" maps to ${profile.label}.`);
      }

      if (employerModifier && employerModifier.profile === profile.id) {
        score += employerModifier.bonus;
        reasons.push(`Employer context "${job.employerContext}" favors ${profile.label}.`);
      }

      if (profile.supportScore !== undefined) {
        score += profile.supportScore * 0.12;
      }

      if (profile.supported === false) {
        score -= profile.hiddenIfUnsupported ? 0.25 : 0.08;
        reasons.push(`Current corpus support for ${profile.label} is limited.`);
      }

      return { profile, score: Number(score.toFixed(2)), reasons };
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored[0];
    const runnerUp = scored[1];
    const margin = top && runnerUp ? top.score - runnerUp.score : top?.score ?? 0;
    const signalBonus =
      job.signal?.level === 'strong' ? 0.12 : job.signal?.level === 'weak' ? 0.04 : 0;
    const confidence = Math.max(
      0.35,
      Math.min(0.97, Number((0.45 + (top?.score ?? 0) * 0.3 + margin * 0.35 + signalBonus).toFixed(2))),
    );

    const alternatives: ProfileRecommendationCandidate[] = scored
      .slice(0, 3)
      .map(({ profile, score }) => ({ profileId: profile.id, score }));

    return {
      profileId: top?.profile.id ?? 'general-swe',
      confidence,
      rationale:
        top && top.reasons.length > 0
          ? top.reasons
          : ['No strong profile-specific signals were found; defaulted to general-swe.'],
      shouldPrompt: confidence < 0.72 || margin < 0.12 || (top?.score ?? 0) < 0.5,
      alternatives,
    };
  }
}
```

### Step 2.2 — Add/replace the recommendation test

**File:** `tests/profile-recommendation.test.ts`

Existing tests may reference the old scorer. Replace the suite with:

```ts
it('recommends general-swe for public-sector Full Stack Developer role', () => {
  const service = new ProfileRecommendationService();
  const result = service.recommend(profileDefaultsFixture(), {
    ...baseJob(),
    roleClassification: 'full-stack-engineering',
    employerContext: 'public-sector',
  });
  expect(['general-swe', 'backend-engineer']).toContain(result.profileId);
  expect(result.profileId).not.toBe('public-service');
});

it('recommends public-service for explicitly non-technical public-sector role', () => {
  const service = new ProfileRecommendationService();
  const result = service.recommend(profileDefaultsFixture(), {
    ...baseJob(),
    jobTitle: 'Policy Analyst',
    roleClassification: 'non-technical',
    employerContext: 'public-sector',
  });
  expect(result.profileId).toBe('public-service');
});
```

Helpers (`profileDefaultsFixture`, `baseJob`) should already exist in the test file or be trivially authored from `src/common/constants/default-profiles.ts` and the `NormalizedJobPosting` shape.

### Step 2.3 — Verify & commit

```bash
npm run build
npm test
```

```bash
git add src/profiles/profile-recommendation.service.ts \
        tests/profile-recommendation.test.ts

git commit -m "refactor(profiles): replace overlap scorer with role→profile map"
```

Report and stop. Wait for user go-ahead.

---

## Phase 3 — Collapse `ExperienceMappingService`

**Goal:** Stop pre-filtering and pre-scoring bullets before the LLM rewrite. The LLM tailor call already receives the canonical resume + bullet bank + job + profile; it's fully equipped to pick the right bullets. Keep only the *user-facing* experience controls (explicit include/exclude) and pass the full bullet bank to the LLM.

This is the biggest deletion of the refactor. Expect to remove ~250 lines.

### Step 3.1 — Rewrite `ExperienceMappingService.prepareRewriteInput`

**File:** `src/tailoring/experience-mapping.service.ts`

Reduce the service to:

1. Apply user-explicit `experienceControls` (hard include/exclude only).
2. Pass the (optionally filtered) canonical resume, full bullet bank, profile, and job to the rewrite provider.
3. Drop all token scoring, `bulletJobScore`, `reorderSkills`, `safeRequirementMapping`, and priority maps.

Replace the entire file with:

```ts
import { Injectable } from '@nestjs/common';
import {
  BulletBankDocument,
  CanonicalResume,
  ExperienceControl,
  LengthTarget,
  NormalizedJobPosting,
  ProfileDefinition,
  ResumeRewriteInput,
} from '../common/types';

interface PreparedRewriteContext {
  rewriteInput: ResumeRewriteInput;
  selectedBlocks: string[];
  omittedBlocks: string[];
}

@Injectable()
export class ExperienceMappingService {
  async prepareRewriteInput(
    canonicalResume: CanonicalResume,
    bulletBank: BulletBankDocument,
    profile: ProfileDefinition,
    job: NormalizedJobPosting,
    experienceControls: ExperienceControl[],
    lengthTarget: LengthTarget,
  ): Promise<PreparedRewriteContext> {
    const controlMap = new Map(experienceControls.map((c) => [c.blockId, c]));
    const selectedBlocks: string[] = [];
    const omittedBlocks: string[] = [];

    for (const cluster of canonicalResume.roleClusters) {
      const control = controlMap.get(cluster.id);
      const explicitlyExcluded = control?.include === false;
      const selected = !explicitlyExcluded;
      (selected ? selectedBlocks : omittedBlocks).push(cluster.id);
    }

    const excludedExperienceIds = new Set(
      canonicalResume.roleClusters
        .filter((c) => controlMap.get(c.id)?.include === false)
        .flatMap((c) => c.experienceIds),
    );
    const experience = canonicalResume.experience.filter((e) => !excludedExperienceIds.has(e.id));
    const experienceIds = new Set(experience.map((e) => e.id));
    const filteredBulletBank: BulletBankDocument = {
      bullets: bulletBank.bullets.filter((b) => experienceIds.has(b.sourceRoleId)),
    };
    const filteredResume: CanonicalResume = {
      ...canonicalResume,
      experience,
      roleClusters: canonicalResume.roleClusters.filter((c) =>
        c.experienceIds.some((id) => experienceIds.has(id)),
      ),
      optionalSections: canonicalResume.optionalSections.filter((c) =>
        c.experienceIds.some((id) => experienceIds.has(id)),
      ),
    };

    return {
      rewriteInput: {
        canonicalResume: filteredResume,
        bulletBank: filteredBulletBank,
        profile,
        job,
        experienceControls,
        lengthTarget,
        requirementMappings: [],
      },
      selectedBlocks,
      omittedBlocks,
    };
  }
}
```

### Step 3.2 — Update `tailor_resume.md` prompt to do the selection work

**File:** `prompts/tailor_resume.md`

Add explicit guidance that the LLM is the one picking bullets and requirement mappings:

**Find:**

```
Expected output goals:
- tailored summary
- reordered skills
- selected experience entries with rewritten bullets
- source bullet ids for every generated bullet
- omitted block ids
```

**Replace with:**

```
Expected output goals:
- tailored summary driven by profile.summaryStyle and profile.toneGuidance
- skills ordered by relevance to the job, with profile.skillsOrdering as a hint
- experience entries ordered by relevance to the job, preserving chronology within each entry;
  select the highest-signal `maxBulletsForLength` bullets per entry based on the job posting
- every generated bullet has sourceBulletIds tracing to canonical bullet bank entries
- requirementMappings array: for each minimum/preferred qualification, the canonical bullet ids
  that support it, a rationale, and a confidence 0.0-1.0
- omittedBlocks: ids of roleClusters you deliberately left out

Length guidance:
- "concise" → 2 bullets per entry, 3 entries max
- "standard" → 3 bullets per entry, 4 entries max
- "expanded" → 4 bullets per entry, 5 entries max

Selection priority:
1. Bullets whose content matches responsibilities / minimumQualifications / preferredQualifications
2. Bullets whose tags align with profile.preferredBulletTags or profile.preferredDomainTags
3. Bullets from roleClusters the user explicitly included via experienceControls
```

Keep the JSON shape section as-is.

### Step 3.3 — Drop `ResumeRewriteProvider.mapRequirements` and the fallback

The LLM now returns `requirementMappings` as part of the tailor output. The separate `mapRequirements` call + heuristic fallback are redundant.

**File:** `src/llm/interfaces/resume-rewrite-provider.interface.ts`

Remove `mapRequirements` from the interface.

**File:** `src/llm/openai/openai-resume-rewrite.provider.ts`

Delete the `mapRequirements` method. Delete `prompts/map_requirements.md`.

### Step 3.4 — Simplify `TailoringModule` + `ResumeTailorService`

`ResumeTailorService.generate` can stay mostly as-is — just confirm it still compiles with the simplified `ExperienceMappingService`. Specifically, `prepared.rewriteInput.requirementMappings` is now always `[]` on input; the tailor output will populate it.

### Step 3.5 — Verify & commit

```bash
npm run build
npm test
# End-to-end against NYC URL — this is the one that actually exercises the tailor path
node dist/src/main.js tailor --job-url '<NYC URL>' --profile general-swe --output md
```

Manually inspect the output resume — it should still be factual, traceable, and reasonably tailored. If the LLM produces fabrications or loses traceability, **stop** — that means the prompt needs more scaffolding before we delete more scoring code.

```bash
git add src/tailoring/experience-mapping.service.ts \
        src/llm/interfaces/resume-rewrite-provider.interface.ts \
        src/llm/openai/openai-resume-rewrite.provider.ts \
        prompts/tailor_resume.md

git rm prompts/map_requirements.md

git commit -m "refactor(tailoring): let LLM pick bullets; delete token-overlap scorer"
```

Report with a sample of the tailored output and stop. Wait for user go-ahead.

---

## Phase 4 — Dead-code sweep

After Phases 1–3, several files / symbols are unused. Use the TypeScript compiler + grep to find and delete:

```bash
npm run build  # must still pass — if it does, nothing referenced is missing
grep -rn "KeywordExtractionService\|JobClassificationService\|bulletJobScore\|computeOverlap\|mapRequirements" src/ tests/
```

Common deletion targets:

- `countOverlap`, `tokenize` in `src/common/utils/text.util.ts` if no remaining caller
- Test utilities that constructed `JobClassificationService`
- Unused imports flagged by `tsc`

### Step 4.1 — Verify & commit

```bash
npm run build
npm test
```

```bash
git commit -am "chore: drop now-unreferenced helpers after LLM-first refactor"
```

Report and stop.

---

## Phase 5 — Validator is now the sole factuality gate

`claim-traceability` and `resume-validation` are the only deterministic guards remaining. Add missing checks if any, and make failure loud.

### Step 5.1 — Audit validator coverage

Read `src/validation/claim-traceability.service.ts` and `src/validation/resume-validation.service.ts`. Confirm they catch, at minimum:

- [ ] every tailored bullet's `sourceBulletIds` are non-empty
- [ ] every listed `sourceBulletId` exists in the bullet bank
- [ ] every `experienceId` exists in canonical resume
- [ ] company + roleTitle match canonical for each experience entry
- [ ] chronology is non-increasing (newest first)
- [ ] empty tailored output is rejected as `error`, not accepted
- [ ] summary is non-empty
- [ ] no bullet text references a company or role not in the canonical resume

Add any missing check as a new issue code. Each new check needs a test.

### Step 5.2 — Verify & commit

```bash
npm run build
npm test
```

```bash
git commit -am "test(validation): tighten LLM-output gates after heuristic deletion"
```

### Step 5.3 — Final end-to-end

```bash
node dist/src/main.js inspect corpus
node dist/src/main.js tailor --job-url '<NYC URL>' --profile general-swe --output md,docx
```

Verify:

- `roleClassification === 'full-stack-engineering'`, `employerContext === 'public-sector'`
- `profileId` in output is `general-swe` or `backend-engineer`
- Output artifacts exist and validation passes
- Change report narrates what changed

Report final result and **stop**. User opens the PR.

---

## Phase 6 — Clipping-as-Job-Input (additive extension)

**Goal:** Let `resume-tailor` accept Obsidian Web Clipper markdown
files as a job-posting input source alongside the existing URL fetch
path. The clipping is preferred when present; URL fetch remains the
fallback for un-clipped jobs and batch runs.

**Why this is Phase 6, not Phase 1.5:** Phases 0–5 establish the
LLM-first contract and the validator as the sole factuality gate. The
clipping path is a new *input source* on top of that contract — it
should ride on a stable pipeline, not chase one in flux. Source design
captured in
`session-handoff/2026-04-19T13-42 - clipping-as-job-input-design.md`.

**Pre-flight:** Phases 0–5 are merged. `npm run build` clean,
`npm test` green, validator gate in place. NYC URL end-to-end run
succeeded in Phase 5.3.

### Step 6.1 — Add `JobLoadService` upstream of `JobParseService`

**File (new):** `src/jobs/job-load.service.ts`

Defines the input-detection seam. `JobParseService` no longer fetches
or reads — it consumes a `LoadedJobInput` discriminated union.

```ts
import { Injectable } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { JobFetchService } from './job-fetch.service';

export type LoadedJobInput =
  | {
      kind: 'url';
      sourceUrl: string;
      html: string;
      fetchedAt: string;
    }
  | {
      kind: 'clipping';
      sourceUrl: string;       // resolved from frontmatter `source:`
      clippedAt: string;        // resolved from frontmatter `clipped:`
      domainHint: string | null; // resolved from frontmatter `domain:` (often null)
      bodyMarkdown: string;
      filePath: string;
      loadedAt: string;
    };

@Injectable()
export class JobLoadService {
  constructor(private readonly fetcher: JobFetchService) {}

  async load(input: { url?: string; clipPath?: string }): Promise<LoadedJobInput> {
    if (input.clipPath && input.url) {
      throw new Error('Provide either --job-url or --job-clip, not both.');
    }
    if (input.clipPath) return this.loadClipping(input.clipPath);
    if (input.url) return this.loadUrl(input.url);
    throw new Error('Provide --job-url or --job-clip.');
  }

  private async loadUrl(url: string): Promise<LoadedJobInput> {
    const { html, fetchedAt } = await this.fetcher.fetch(url);
    return { kind: 'url', sourceUrl: url, html, fetchedAt };
  }

  private async loadClipping(filePath: string): Promise<LoadedJobInput> {
    const raw = await fs.readFile(filePath, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(raw);
    const sourceUrl =
      typeof frontmatter.source === 'string' ? frontmatter.source : null;
    const clippedAt =
      typeof frontmatter.clipped === 'string' ? frontmatter.clipped : null;
    if (!sourceUrl) {
      throw new Error(
        `Clipping at ${filePath} is missing required frontmatter field 'source:'.`,
      );
    }
    if (!clippedAt) {
      throw new Error(
        `Clipping at ${filePath} is missing required frontmatter field 'clipped:'.`,
      );
    }
    const domainHint =
      typeof frontmatter.domain === 'string' && frontmatter.domain.length > 0
        ? frontmatter.domain
        : null;
    return {
      kind: 'clipping',
      sourceUrl,
      clippedAt,
      domainHint,
      bodyMarkdown: body,
      filePath,
      loadedAt: new Date().toISOString(),
    };
  }
}

// Minimal YAML-frontmatter splitter. Use a real YAML lib if one is
// already in the dep graph; otherwise this stays narrow on purpose.
function parseFrontmatter(raw: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: raw };
  // Lazy parse: split on top-level keys. Real impl should use `yaml` or
  // `gray-matter`. Keep ergonomics simple — clipping frontmatter is
  // shallow and string-valued.
  const fm: Record<string, unknown> = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (!m) continue;
    const [, key, valueRaw] = m;
    const value = valueRaw.trim().replace(/^"(.*)"$/, '$1');
    fm[key] = value === '' ? null : value;
  }
  return { frontmatter: fm, body: match[2] };
}
```

If `gray-matter` or the `yaml` package is already a transitive
dependency, swap the lazy parser for it — but **do not** add a new
runtime dep just for this. The clipping schema is shallow and
predictable per `AI-Workflow-Vault/raw/_convention.md`.

### Step 6.2 — Branch `JobParseService` on `LoadedJobInput.kind`

**File:** `src/jobs/job-parse.service.ts`

Change the entry point from `(url: string)` to `(input: LoadedJobInput)`.

- `kind: 'url'` branch: existing cheerio path, unchanged.
- `kind: 'clipping'` branch:
  1. Skip cheerio entirely.
  2. Build a `RawJobDocument`-shaped object from the markdown body
     (use `[#]+` for headings, `^- ` for list items, blank-line-split
     for paragraphs — straightforward markdown → structure mapping).
  3. Pre-fill `NormalizedJobPosting` fields the LLM would otherwise
     re-derive: `sourceUrl` ← `input.sourceUrl`, `fetchedAt` ←
     `input.loadedAt`, `clippedAt` (new optional field, see Step 6.3).
  4. Pass the markdown body to `jobAnalysisProvider.analyze` as the
     primary text; the LLM still produces `roleClassification`,
     `employerContext`, `responsibilities`, `qualifications`, etc.
  5. Use `domainHint` only as a tie-break input to the existing
     `domainClassification` derivation; never let it override the
     LLM's signal.

`NormalizedJobPosting` does not change shape (per the design handoff)
beyond adding two optional fields in Step 6.3.

### Step 6.3 — Extend `NormalizedJobPosting` minimally

**File:** `src/common/types/resume-tailor.types.ts`

Add two optional fields:

```ts
/**
 * Set when the input source was an Obsidian Web Clipper markdown file
 * rather than a live URL fetch. Carries through to run artifacts so
 * downstream consumers can distinguish clip-time provenance from
 * live-fetch provenance.
 */
clippedAt?: string;

/**
 * Set when the input source was a clipping. Absolute path to the
 * source markdown file on disk at the time of load. Useful for
 * troubleshooting and for re-runs that want to skip the URL fetch.
 */
clippingPath?: string;
```

Both are optional and absent on URL-loaded jobs. The validator does
not need to assert on them.

### Step 6.4 — CLI flag `--job-clip <path>`

**File:** wherever the `tailor` command is registered (likely
`src/cli/tailor.command.ts` or equivalent).

Add `--job-clip <path>` as a sibling to `--job-url`. Mutually
exclusive — emit a clear error if both are passed (the
`JobLoadService.load` guard already enforces this; the CLI layer
should emit the friendlier error).

Rejected alternative: scheme-detect on `--job-url` (i.e. `file://` or
`.md` extension routes to clipping). Explicit flag wins because:
- Documentation is unambiguous.
- Tab-completion works.
- The user's intent is visible at the call site.

### Step 6.5 — `JobSignalService` — accept weaker signals on clippings

**File:** `src/jobs/job-signal.service.ts`

`JobSignalService.assess` currently keys off `RawJobDocument` (cheerio
output). The MD branch produces a degraded `RawJobDocument` (see
6.2.2) so the existing assessment will still run, but signals will
typically be weaker.

Decision (per design handoff): **do not** write a markdown-aware
signal extractor. Instead:

- Pass the existing assessor a `kind: 'clipping'` hint (extend
  `assess`'s signature to take the input kind).
- When `kind === 'clipping'`, **floor the resulting `signal.level`
  at `'weak'`** (never return `'thin'` for a clipping — the user
  explicitly chose to clip, that's the strongest "this matters"
  signal possible).
- The LLM-first classification path (Phase 1) carries the load now;
  signals are no longer load-bearing for the recommender after Phase
  2's role→profile map.

### Step 6.6 — Test fixture + regression test

**Files:**
- `tests/fixtures/public-sector-swe-clipped.md` (new) — manually
  derived MD twin of `tests/fixtures/public-sector-swe.html`. Source:
  copy the body content of `wasQuiverNowVault/raw/web/Full Stack Developer.md`
  (or `Application Developer.md`), trim to a stable subset, set
  frontmatter explicitly:

  ```yaml
  ---
  type: raw
  source: https://cityjobs.nyc.gov/job/full-stack-developer-in-brooklyn-jid-41824
  clipped: 2026-04-19T00:07:37-04:00
  processed: false
  read-status: unread
  maintained-by: llm
  tags:
    - clipped
  domain:
  ---
  ```

- `tests/jobParse.test.ts` (extend) — add a case parallel to the
  existing URL-path test:

  ```ts
  it('parses a Web Clipper markdown file into NormalizedJobPosting via the LLM path', async () => {
    const input: LoadedJobInput = {
      kind: 'clipping',
      sourceUrl: 'https://cityjobs.nyc.gov/job/full-stack-developer-in-brooklyn-jid-41824',
      clippedAt: '2026-04-19T00:07:37-04:00',
      domainHint: null,
      bodyMarkdown: await fs.readFile(
        'tests/fixtures/public-sector-swe-clipped.md',
        'utf-8',
      ),
      filePath: 'tests/fixtures/public-sector-swe-clipped.md',
      loadedAt: new Date().toISOString(),
    };
    const result = await service.parseFromInput(input, stubLlmProvider);
    expect(result.roleClassification).toBe('full-stack-engineering');
    expect(result.employerContext).toBe('public-sector');
    expect(result.sourceUrl).toBe(input.sourceUrl);
    expect(result.clippedAt).toBe(input.clippedAt);
    expect(result.clippingPath).toBe(input.filePath);
    expect(result.signal?.level).not.toBe('thin');
  });
  ```

Use the same stubbed LLM provider as the existing URL-path test;
the goal is to prove the *plumbing* works, not to spend tokens on a
real call. A separate live-API smoke test can be added if the user
wants ongoing prompt-following assurance.

### Step 6.7 — Verify & commit

```bash
npm run build
npm test
node dist/src/main.js tailor \
  --job-clip 'tests/fixtures/public-sector-swe-clipped.md' \
  --profile general-swe --output md
```

Verify:
- `roleClassification === 'full-stack-engineering'`,
  `employerContext === 'public-sector'`
- The output run-artifact records `inputKind: 'clipping'` (or
  equivalent provenance field)
- The validator passes (Phase 5 gates apply unchanged)

```bash
git add src/jobs/job-load.service.ts \
        src/jobs/job-parse.service.ts \
        src/jobs/job-signal.service.ts \
        src/jobs/jobs.module.ts \
        src/common/types/resume-tailor.types.ts \
        src/cli/tailor.command.ts \
        tests/fixtures/public-sector-swe-clipped.md \
        tests/jobParse.test.ts

git commit -m "feat(jobs): accept Obsidian Web Clipper markdown as job input"
```

### Step 6.8 — Report & stop

Report:
- New files added (`job-load.service.ts`, MD fixture, etc.).
- `NormalizedJobPosting` field additions and confirmation that no
  existing consumer broke.
- `JobSignalService` signature change and how downstream callers were
  updated.
- Commit SHA and message.
- Smoke test result against the MD fixture (with stubbed LLM) and
  any live-API result if one was attempted.

### Out of scope for Phase 6 (deferred)

- **Auto-detect clipping for a given URL.** If a user passes
  `--job-url` and the clipping vault has a clip with a matching
  `source:`, do NOT auto-prefer the clip. That requires the CLI to
  know vault roots and to scan an arbitrary number of clippings on
  every URL run. Defer.
- **Vault-scoped batch processing.** "Tailor against every unread
  clipping in `raw/web/`" is a different command (`tailor-batch`),
  not a flag on `tailor`. Defer.
- **Preview-pass integration.** The vault's preview-pass produces a
  3-bullet TL;DR / Study Overview into `previews/` for human reading.
  Resume-tailor does not consume previews; it consumes raw clippings
  directly. Keep the boundaries clean.
- **Paper / non-job clippings.** Phase 6 is strictly for job
  postings. The classifier in `AI-Workflow-Vault` reroutes papers
  out of `raw/web/` before resume-tailor would ever see them.

### Phase 6 success criteria

- `tailor --job-clip <path>` succeeds end-to-end against the MD
  fixture and an arbitrary real Obsidian clipping in
  `wasQuiverNowVault/raw/web/`.
- `tailor --job-url <url>` continues to work unchanged.
- Both flags are mutually exclusive and produce a clear error if both
  are passed.
- `JobSignalService` never returns `'thin'` for a clipping input.
- Existing tests (Phase 5 baseline) all still pass; one new test
  covers the MD branch end-to-end with a stubbed LLM.
- Run-artifact provenance distinguishes URL vs clipping inputs.

---

## What NOT to Do

- Do not rename or remove `NestJS` modules beyond what each phase specifies. Framework removal is out of scope for this refactor.
- Do not delete the canonical corpus services (`resume-ingest`, `resume-merge`, `resume-master-builder`, `bullet_bank.yaml`, `resume_master.yaml`). Those are the factuality anchor.
- Do not touch `src/export/*` or `src/validation/*` beyond Phase 5.
- Do not roll phases together. Each phase is a separately reviewable PR.
- Do not continue past a failing `npm test` or `npm run build` — stop and report.
- Do not commit work from `feature/v1` that was in the tree at pre-flight. That work belongs to the user.
- Do not skip the human checkpoint between phases. "Stop and report" means stop.

## Open Questions for the User (optional)

These are not blockers for Phase 1 but are worth deciding before Phase 3:

- Do you still want the `skillsOrdering` profile field, or let the LLM order skills purely by job relevance?
- Do you still want to expose `--experience-config` explicit overrides in the CLI, or is the LLM's selection enough?
- Do you want to drop the 4-profile taxonomy entirely in a later phase and pass the profile intent as freeform text to the prompt?
