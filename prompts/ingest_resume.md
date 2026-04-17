You are extracting a structured resume document from raw resume text.

Rules:
- Preserve factual accuracy.
- Never invent employers, dates, titles, technologies, certifications, or years of experience.
- Prefer omission over speculation.
- Normalize messy text into consistent JSON fields.
- Generate tags and safe reframes only when directly supported by the source.
- Keep alternate phrasings conservative and close to the original claim.
- Treat section headings, bullet lists, and markdown structure as meaningful.
- Do not drop work history when a resume clearly contains job entries, even if some fields are partial.
- If the resume has professional experience, return it in `experience` with the strongest available company, role title, date range, and bullet text.
- Return JSON only.

Expected output goals:
- capture identity and contact details when present
- structure education, certifications, summaries, skills, and experience entries
- attach bullet-level tags, domain tags, safe reframes, allowed profiles, and risk levels
- include notes for ambiguities that should be reviewed later

Required JSON shape:
{
  "identity": {
    "fullName": "string",
    "headline": "string optional",
    "location": "string optional"
  },
  "contact": {
    "email": "string optional",
    "phone": "string optional",
    "website": "string optional",
    "linkedin": "string optional",
    "github": "string optional",
    "location": "string optional"
  },
  "education": [
    {
      "institution": "string",
      "degree": "string optional",
      "fieldOfStudy": "string optional",
      "location": "string optional",
      "graduationDate": "string optional",
      "honors": ["string"]
    }
  ],
  "certifications": [
    {
      "name": "string",
      "issuer": "string optional",
      "issueDate": "string optional",
      "expirationDate": "string optional",
      "credentialId": "string optional"
    }
  ],
  "summaryVariants": [
    {
      "label": "string",
      "text": "string",
      "tags": ["string"]
    }
  ],
  "skills": [
    {
      "category": "string",
      "items": ["string"],
      "evidence": ["string"]
    }
  ],
  "experience": [
    {
      "company": "string",
      "roleTitle": "string",
      "dateRange": {
        "start": "string",
        "end": "string optional",
        "current": "boolean optional"
      },
      "location": "string optional",
      "bullets": [
        {
          "original": "string",
          "alternates": ["string"],
          "tags": ["string"],
          "domainTags": ["string"],
          "safeReframes": ["string"],
          "allowedProfiles": ["public-service" | "backend-engineer" | "general-swe" | "blockchain-engineer"],
          "riskLevel": "low" | "medium" | "high",
          "confidence": 0.0
        }
      ],
      "tags": ["string"],
      "domainTags": ["string"],
      "alternatePhrasings": ["string"],
      "safeReframingCategories": ["string"],
      "confidence": 0.0
    }
  ],
  "domainTags": ["string"],
  "notes": ["string"],
  "sourceReference": {
    "sourceType": "markdown" | "pdf" | "text" | "json" | "html",
    "snippets": ["string"]
  }
}

Extraction priority:
1. Identity and contact
2. Professional summary
3. Professional experience, including project bullets nested under the relevant role
4. Skills
5. Education and certifications

If the input contains a clearly labeled professional experience section, `experience` must not be empty.
