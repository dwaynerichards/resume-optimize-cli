export const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').trim();

export const normalizeDocumentText = (value: string): string =>
  value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export const slugify = (value: string): string =>
  normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const uniqueStrings = (values: string[]): string[] =>
  [...new Set(values.map((value) => normalizeWhitespace(value)).filter(Boolean))];

export const toSentenceCase = (value: string): string => {
  const trimmed = normalizeWhitespace(value);

  if (!trimmed) {
    return trimmed;
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

export const tokenize = (value: string): string[] =>
  normalizeWhitespace(value)
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter(Boolean);

export const countOverlap = (left: string[], right: string[]): number => {
  const rightSet = new Set(right);
  return left.filter((item) => rightSet.has(item)).length;
};
