#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: ./skills/resume-tailoring/scripts/ingest.sh path/to/resume1.md [path/to/resume2.pdf ...]"
  exit 1
fi

npm run start -- ingest $(printf ' --resume %q' "$@")
