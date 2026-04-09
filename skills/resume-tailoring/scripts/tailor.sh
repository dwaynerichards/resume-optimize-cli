#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: ./skills/resume-tailoring/scripts/tailor.sh --job-url <url> --profile <profile> [other flags]"
  exit 1
fi

npm run start -- tailor "$@"
