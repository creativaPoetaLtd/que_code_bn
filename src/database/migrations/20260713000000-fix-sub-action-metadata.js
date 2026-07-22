"use strict";

/**
 * Repairs SubActions.metadata rows damaged by two earlier bugs:
 *   1. metadata written as a JSON string (multipart bodies were stored verbatim),
 *      leaving a JSONB value of type "string" instead of "object".
 *   2. character-spread artifacts ({"0": "{", "1": "}"}) produced by clients that
 *      spread such a string into an object before saving.
 * Data-only; there is no schema change to reverse.
 */

const unwrap = (value) => {
  let current = value;
  for (let i = 0; i < 3 && typeof current === "string"; i++) {
    try {
      current = JSON.parse(current);
    } catch {
      return {};
    }
  }
  if (!current || typeof current !== "object" || Array.isArray(current)) return {};
  return current;
};

const stripSpreadArtifacts = (metadata) => {
  const cleaned = { ...metadata };
  Object.keys(cleaned).forEach((key) => {
    if (/^\d+$/.test(key) && typeof cleaned[key] === "string" && cleaned[key].length <= 1) {
      delete cleaned[key];
    }
  });
  return cleaned;
};

module.exports = {
  up: async (queryInterface) => {
    const [rows] = await queryInterface.sequelize.query(
      'SELECT id, metadata FROM "SubActions"'
    );

    for (const row of rows) {
      const repaired = stripSpreadArtifacts(unwrap(row.metadata));
      if (JSON.stringify(repaired) === JSON.stringify(row.metadata)) continue;

      await queryInterface.sequelize.query(
        'UPDATE "SubActions" SET metadata = :metadata::jsonb WHERE id = :id',
        { replacements: { metadata: JSON.stringify(repaired), id: row.id } }
      );
    }
  },

  down: async () => {
    // Data repair — restoring the corrupted values would serve no purpose.
  },
};
