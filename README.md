# resume-tailor

`resume-tailor` is a reusable local NestJS CLI that ingests one or more resume files into a structured canonical source, parses a job posting URL, and generates a tailored Markdown resume, DOCX resume, and Markdown change report with validation guards.

## What it does

- ingests multiple resume files and merges them into `data/resume_master.yaml`
- builds `data/bullet_bank.yaml` with bullet-level traceability, tags, safe reframes, and allowed profiles
- infers profile support into `data/profile_defaults.yaml`
- fetches and normalizes job postings from URLs
- applies a predefined global profile plus local experience controls
- generates validated Markdown and DOCX resume artifacts
- produces a Markdown change report describing what changed and why

## Setup

1. `cd resume-tailor`
2. `cp .env.example .env`
3. Set `OPENAI_API_KEY` in `.env`
4. `npm install`
5. `npm run build`

## Ingest multiple resumes

Use the ingest command whenever you add or update source resumes:

```bash
npm run start -- ingest --resume ./resumes/resume-a.md --resume ./resumes/resume-b.pdf
```

This produces:

- `data/resume_master.yaml`
- `data/bullet_bank.yaml`
- `data/profile_defaults.yaml`

The canonical builder supports multiple source resumes, deduplicates overlapping content conservatively, preserves chronology, and discovers reusable experience blocks such as organization clusters, domain clusters, leadership work, or public-sector work.

## Regenerate the canonical master source

Run the same ingest command again with the full resume set whenever the source corpus changes. The builder is designed to be rerun and replace the canonical YAML outputs.

## Interactive tailoring

Running with no arguments launches the guided CLI flow:

```bash
npm run start
```

If no canonical source exists yet, the CLI first asks for resume files and runs ingest. It then prompts for:

- job posting URL
- global profile
- include or exclude plus emphasis for each discovered experience block
- optional ordering priorities
- target length
- output format

## Non-interactive tailoring

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

`--output md,docx` resolves to both formats. `--skip-validation` is available for debugging, but the default path is to validate every generated resume.

## Global profiles vs local experience controls

Profiles are stable strategy templates. v1 includes:

- `public-service`
- `backend-engineer`
- `general-swe`
- `blockchain-engineer`

Profiles control summary framing, skills ordering, tone, and preferred or disfavored tags.

Experience controls are discovered from the canonical resume corpus. They are generic blocks, not hard-coded employers. The CLI exposes include or exclude, emphasis, and optional ordering for the discovered organizations, domain clusters, and focus areas in the resume corpus.

## Profile support inference

`profile_defaults.yaml` stores predefined profile definitions plus inferred support metadata from the ingested resume corpus. That metadata is based on domain-tag overlap, bullet-tag overlap, and merge-time support signals. Profiles with weak support can be flagged or hidden, especially the more specialized ones such as `blockchain-engineer`.

## Output artifacts

Successful tailoring runs write to a timestamped folder under `output/`:

- `tailored_resume.md`
- `tailored_resume.docx`
- `change_report.md`

Markdown is treated as the canonical export surface. DOCX is generated from the structured resume document, not from PDF conversion.

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

## Extending profiles

Add or modify base profile definitions in [src/common/constants/default-profiles.ts](/Users/dwaynerichards/Developer/Job-Hunt/resume-optimize-cli/resume-tailor/src/common/constants/default-profiles.ts). Profile defaults are generated into `data/profile_defaults.yaml` during ingest, so rerun ingest after updating the base definitions.

## Swapping LLM providers later

The LLM integration is isolated behind injectable interfaces in [src/llm/interfaces](/Users/dwaynerichards/Developer/Job-Hunt/resume-optimize-cli/resume-tailor/src/llm/interfaces). The v1 OpenAI implementation lives under [src/llm/openai](/Users/dwaynerichards/Developer/Job-Hunt/resume-optimize-cli/resume-tailor/src/llm/openai). To add another provider, implement the same interfaces and change the bindings in [src/llm/llm.module.ts](/Users/dwaynerichards/Developer/Job-Hunt/resume-optimize-cli/resume-tailor/src/llm/llm.module.ts).

## Included Codex skill

The repository includes a reusable skill at [skills/resume-tailoring/SKILL.md](/Users/dwaynerichards/Developer/Job-Hunt/resume-optimize-cli/resume-tailor/skills/resume-tailoring/SKILL.md). Use it when working on resume ingestion, profile handling, tailoring rules, validation, or output generation inside this repository.
