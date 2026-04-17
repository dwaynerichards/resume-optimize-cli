# resume-tailor

`resume-tailor` is a local NestJS CLI for ingesting one or more source resumes or resume folders into a canonical dataset, analyzing a job posting URL, and generating a tailored Markdown resume, DOCX resume, and Markdown change report with validation guards.

## What it does

- ingests multiple resume files or top-level resume folders into `data/resume_master.yaml`
- builds `data/bullet_bank.yaml` with bullet-level traceability metadata
- infers profile support into `data/profile_defaults.yaml`
- fetches and normalizes job postings from URLs
- applies a predefined profile plus discovered experience controls
- generates validated Markdown and DOCX resume artifacts
- produces a Markdown change report describing what changed and why

## Setup

Run everything from the repository root:

```bash
cp .env.example .env
```

Set the active LLM provider and its credentials in `.env`:

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.2
```

`LLM_PROVIDER` defaults to `openai`. Only `openai` is implemented today, so
only the OpenAI key and settings are active in this phase. The provider
selector exists to let future Anthropic, Gemini, or other adapters plug in
behind `src/llm/interfaces` and `src/llm/llm.module.ts` without threading
vendor checks through the jobs, ingest, tailoring, or validation layers.

Then install and build:

```bash
npm install
npm run build
```

## Useful commands

Show CLI help:

```bash
npm run start -- help
```

Run the interactive flow:

```bash
npm run start
```

Long-running commands now print step-by-step terminal progress so ingest and tailoring do not look stalled while network and file work are running.

Logs are separate from progress: user-facing progress and summaries stay on stdout, while run logs go to stderr.

Set the log level with `RESUME_TAILOR_LOG_LEVEL`:

```env
RESUME_TAILOR_LOG_LEVEL=info
```

Supported values are `debug`, `info`, `warn`, and `error`. The default is `info`, and `debug` only turns on when you opt in.

If you prefer a generic override, `LOG_LEVEL` is also accepted as a fallback.

Run the CLI directly from TypeScript during development:

```bash
npm run start:dev -- help
```

Rebuild after code changes:

```bash
npm run build
```

Run tests:

```bash
npm test
```

Remove compiled output:

```bash
npm run clean
```

## Ingest resumes

Use the ingest command whenever you add or update source resumes:

```bash
npm run start -- ingest \
  --resume ./resumes/resume-a.md \
  --resume ./resumes/resume-b.pdf
```

Repeated `--resume` flags are the clearest and safest way to pass multiple files. If you use a single comma-separated `--resume` value, make sure each item includes its full relative or absolute path.

This also works:

```bash
npm run start -- ingest \
  --resume ./resumes/resume-a.md,./resumes/resume-b.pdf
```

You can also point at a folder of source resumes:

```bash
npm run start -- ingest \
  --resume-dir ./resumes/team-a
```

Files and folders can be mixed. Folder ingest scans only the top level and picks up `.md`, `.markdown`, `.txt`, and `.pdf` files. Duplicate paths are removed before ingest.

If you have supplemental metadata:

```bash
npm run start -- ingest \
  --resume ./resumes/resume-a.md \
  --metadata ./resumes/resume-metadata.yaml
```

If you changed TypeScript source files first, rebuild before using `npm run start` so `dist/` is current:

```bash
npm run build
npm run start -- ingest --resume-dir ./resumes/team-a
```

This produces:

- `data/resume_master.yaml`
- `data/bullet_bank.yaml`
- `data/profile_defaults.yaml`

Rerun ingest with the full resume set whenever your source corpus changes.

## Inspect the corpus

After ingest, print a concise summary of the canonical corpus:

```bash
npm run start -- inspect corpus
```

This reports the data directory, source files, experience count, bullet count, discovered block counts, and profile support scores.

## Tailor a resume

### Interactive mode

Running with no arguments launches the guided CLI flow:

```bash
npm run start
```

If no canonical source exists yet, the CLI first asks for resume files and optional resume folders before it runs ingest.

### Non-interactive mode

Direct flags:

```bash
npm run start -- tailor \
  --job-url https://example.com/jobs/backend \
  --profile backend-engineer \
  --experience-config ./examples/experience-config.example.yaml \
  --max-length standard \
  --output md,docx
```

Config-file driven:

```bash
npm run start -- tailor --config ./examples/tailor-config.example.yaml
```

Validation can be skipped for debugging only:

```bash
npm run start -- tailor \
  --job-url https://example.com/jobs/backend \
  --profile general-swe \
  --skip-validation
```

`--output md,docx` resolves to both formats.

If a job page is reachable but looks too thin to trust, the CLI can:

- `--job-signal warn` to log the low-signal page and continue
- `--job-signal confirm` to prompt before continuing
- `--job-signal abort` to stop the run before tailoring starts

The interactive flow defaults to asking for confirmation when the signal is low.

## Profiles and experience controls

Profiles are stable strategy templates. The built-in profile ids are:

- `public-service`
- `backend-engineer`
- `general-swe`
- `blockchain-engineer`

Profiles control summary framing, skills ordering, tone, and preferred or disfavored tags.

Experience controls are discovered from the canonical resume corpus. They are generic blocks, not hard-coded employers. The CLI exposes include or exclude, emphasis, and optional ordering for those discovered organizations, domain clusters, and focus areas.

## Profile support inference

`data/profile_defaults.yaml` stores the built-in profile definitions plus inferred support metadata from the ingested resume corpus. After changing `src/common/constants/default-profiles.ts`, rerun ingest so the generated defaults stay in sync.

## Output artifacts

Successful tailoring runs write to a timestamped folder under `output/`:

- `tailored_resume.md`
- `tailored_resume.docx`
- `change_report.md`

Markdown is treated as the canonical export surface. DOCX is generated from the structured resume document rather than PDF conversion.

## Validation and factuality

The validation layer checks:

- missing or invalid bullet traceability ids
- unsupported year claims
- unsupported technologies or tools
- chronology drift
- role or employer mismatches
- domain overreach watch terms
- seniority inflation watch terms

The system is designed to preserve factual accuracy and reject or flag unsupported claims rather than embellish them.

## Relevant files

- `src/cli/cli.service.ts` for help text and command output
- `src/cli/command-runner.service.ts` for CLI parsing behavior
- `src/common/constants/default-profiles.ts` for built-in profiles
- `src/llm/interfaces` for provider interfaces
- `src/llm/openai` for the current OpenAI-backed adapter implementation
- `src/llm/llm.module.ts` for active-provider selection and DI bindings
- `examples/experience-config.example.yaml` for experience-control overrides
- `examples/tailor-config.example.yaml` for config-driven tailoring

## Included Codex skill

The repository includes a reusable skill at `skills/resume-tailoring/SKILL.md`. Use it when working on resume ingestion, profile handling, tailoring rules, validation, or output generation inside this repository.
