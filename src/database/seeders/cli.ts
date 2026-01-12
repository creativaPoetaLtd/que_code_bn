#!/usr/bin/env ts-node
require("dotenv").config();

import { Sequelize } from "sequelize";
import { runPendingSeeds, undoAllSeeds } from "./runner";

const sequelize = new Sequelize(process.env.DATABASE_URL || process.env.DB_DEV_URL || "", {
  dialect: "postgres",
  logging: false,
});

async function main() {
  const command = process.argv[2];

  try {
    await sequelize.authenticate();
    console.log("✓ Database connection successful\n");

    if (command === "undo") {
      await undoAllSeeds(sequelize);
    } else {
      await runPendingSeeds(sequelize);
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();
