/**
 * SubActions.metadata is a free-form JSONB column. Legacy rows hold a JSON *string*
 * (sometimes double-encoded) instead of an object, and spreading such a value would
 * spread its characters into keys like {"0": "{", "1": "}"}. Always normalize before
 * reading, merging, or spreading metadata.
 */
export const normalizeMetadata = (value: any): Record<string, any> => {
  let current = value;

  for (let i = 0; i < 3 && typeof current === "string"; i++) {
    try {
      current = JSON.parse(current);
    } catch {
      return {};
    }
  }

  if (!current || typeof current !== "object" || Array.isArray(current)) return {};

  // Drop character-spread artifacts left behind by clients that spread a string
  const cleaned: Record<string, any> = { ...current };
  Object.keys(cleaned).forEach((key) => {
    if (/^\d+$/.test(key) && typeof cleaned[key] === "string" && cleaned[key].length <= 1) {
      delete cleaned[key];
    }
  });

  return cleaned;
};

/** Return a sub-action row as a plain object whose metadata is guaranteed to be an object. */
export const withNormalizedMetadata = (row: any) => {
  if (!row) return row;
  const plain = row.toJSON ? row.toJSON() : row;
  return { ...plain, metadata: normalizeMetadata(plain.metadata) };
};
