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
