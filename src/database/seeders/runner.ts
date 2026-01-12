import { Sequelize } from "sequelize";
import fs from "fs";
import path from "path";

interface SeederRecord {
  name: string;
  executedAt: Date;
}

/**
 * Runs all seed files that haven't been executed yet
 * Tracks executed seeds in the SequelizeMetaSeeder table
 */
export async function runPendingSeeds(sequelize: Sequelize): Promise<void> {
  const seedersPath = path.join(__dirname);

  try {
    // Ensure SequelizeMetaSeeder table exists
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "SequelizeMetaSeeder" (
        "name" VARCHAR(255) PRIMARY KEY,
        "executedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get all seeder files
    const seederFiles = fs
      .readdirSync(seedersPath)
      .filter(
        (file) =>
          file.endsWith(".js") && !file.includes("runner") && !file.includes("cli") && file[0] !== "."
      )
      .sort();

    if (seederFiles.length === 0) {
      console.log("✓ No seed files found");
      return;
    }

    // Get already executed seeders
    const [executedSeeders] = await sequelize.query(
      `SELECT "name" FROM "SequelizeMetaSeeder"`
    );
    const executedNames = new Set(
      (executedSeeders as SeederRecord[]).map((r) => r.name)
    );

    // Filter pending seeders
    const pendingSeeders = seederFiles.filter(
      (file) => !executedNames.has(file)
    );

    if (pendingSeeders.length === 0) {
      console.log("✓ All seeds already executed");
      return;
    }

    console.log(`\n📋 Running ${pendingSeeders.length} pending seeds...\n`);

    // Execute pending seeders
    for (const file of pendingSeeders) {
      try {
        const seederModule = require(path.join(seedersPath, file));

        if (seederModule.up) {
          console.log(`  ⏳ Executing: ${file}`);
          await seederModule.up(
            sequelize.getQueryInterface(),
            sequelize.Sequelize
          );

          // Record the executed seeder
          await sequelize.query(
            `INSERT INTO "SequelizeMetaSeeder" ("name", "executedAt") 
             VALUES (:name, NOW())`,
            {
              replacements: { name: file },
            }
          );

          console.log(`  ✓ Completed: ${file}`);
        }
      } catch (error) {
        console.error(`  ✗ Failed: ${file}`);
        throw error;
      }
    }

    console.log(`\n✓ All ${pendingSeeders.length} seeds executed successfully!\n`);
  } catch (error) {
    console.error("Error running seeds:", error);
    throw error;
  }
}

/**
 * Undo all executed seeds in reverse order
 */
export async function undoAllSeeds(sequelize: Sequelize): Promise<void> {
  const seedersPath = path.join(__dirname);

  try {
    // Get all seeder files
    const seederFiles = fs
      .readdirSync(seedersPath)
      .filter(
        (file) =>
          file.endsWith(".js") && !file.includes("runner") && !file.includes("cli") && file[0] !== "."
      )
      .sort()
      .reverse();

    // Get already executed seeders
    const [executedSeeders] = await sequelize.query(
      `SELECT "name" FROM "SequelizeMetaSeeder"`
    );
    const executedNames = new Set(
      (executedSeeders as SeederRecord[]).map((r) => r.name)
    );

    // Filter executed seeders to undo
    const seedersToDrop = seederFiles.filter((file) =>
      executedNames.has(file)
    );

    if (seedersToDrop.length === 0) {
      console.log("✓ No seeds to undo");
      return;
    }

    console.log(`\n📋 Undoing ${seedersToDrop.length} seeds...\n`);

    // Undo seeders in reverse order
    for (const file of seedersToDrop) {
      try {
        const seederModule = require(path.join(seedersPath, file));

        if (seederModule.down) {
          console.log(`  ⏳ Undoing: ${file}`);
          await seederModule.down(
            sequelize.getQueryInterface(),
            sequelize.Sequelize
          );

          // Remove from executed seeders
          await sequelize.query(
            `DELETE FROM "SequelizeMetaSeeder" WHERE "name" = :name`,
            {
              replacements: { name: file },
            }
          );

          console.log(`  ✓ Undone: ${file}`);
        }
      } catch (error) {
        console.error(`  ✗ Failed to undo: ${file}`);
        throw error;
      }
    }

    console.log(`\n✓ All ${seedersToDrop.length} seeds undone successfully!\n`);
  } catch (error) {
    console.error("Error undoing seeds:", error);
    throw error;
  }
}
