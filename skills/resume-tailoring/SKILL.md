---
name: resume-tailoring
description: Use when building, updating, or operating this repository's resume tailoring workflow that ingests multiple resumes into a canonical source, applies global profiles plus local experience controls, and generates validated Markdown and DOCX resume outputs from a job posting URL.
---

# Resume Tailoring

Use this skill when the task is to ingest resume files, refresh the canonical resume source, tailor a resume to a job posting, or extend the repository's resume-tailoring pipeline.

## Workflow

1. Build or refresh the canonical source from one or more resume files.
2. Keep global profiles and local experience controls separate.
3. Parse and normalize the job posting.
4. Map job requirements to supported resume evidence.
5. Generate Markdown and DOCX output plus a Markdown change report.
6. Run deterministic validation before treating the output as ready.

## Inputs

- one or more resume files, currently Markdown or PDF
- a job posting URL
- a global profile:
  `public-service`, `backend-engineer`, `general-swe`, or `blockchain-engineer`
- local experience controls for discovered blocks such as organizations, domain clusters, volunteer work, or leadership work

## Constraints

- Never fabricate employers, titles, dates, years, technologies, certifications, or unsupported domain expertise.
- Preserve chronology unless the repository is explicitly changed to allow otherwise.
- Use Markdown as the canonical export surface and generate DOCX from structured content.
- Treat profile selection as global framing and experience controls as local weighting of actual source material.

## Resources

- Read [resources/canonical_schema.yaml](resources/canonical_schema.yaml) for the canonical data shape.
- Read [resources/profile_examples.yaml](resources/profile_examples.yaml) for profile defaults and example support cues.
- Read [resources/prompting_rules.md](resources/prompting_rules.md) when editing prompts or rewriting logic.

## Helper scripts

- `scripts/ingest.sh` rebuilds the canonical source from resume inputs.
- `scripts/tailor.sh` runs the tailoring workflow with CLI arguments passed through.

## Output artifacts

- `data/resume_master.yaml`
- `data/bullet_bank.yaml`
- `data/profile_defaults.yaml`
- `output/<timestamp-profile>/tailored_resume.md`
- `output/<timestamp-profile>/tailored_resume.docx`
- `output/<timestamp-profile>/change_report.md`

## Validation rules

- Every generated bullet must trace back to source bullet ids.
- Unsupported tools, dates, certifications, or domain claims must be rejected or flagged.
- Profiles should be hidden or deprioritized when the canonical resume corpus does not support them strongly enough.
