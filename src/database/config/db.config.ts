import { config } from "dotenv";
import { Sequelize } from "sequelize";
import Models from "../models";
import path from "path";

config({ path: path.resolve(process.cwd(), '.env') });

let db_uri: string = "";
const APP_MODE: string = (process.env.DEV_MODE || "development").trim();
const DB_HOST_MODE: string = (process.env.DB_HOSTED_MODE || "local").trim();


switch (APP_MODE) {
	case "test":
		db_uri = process.env.DB_TEST_URL || "";
		break;
	case "production":
		db_uri = process.env.DB_PROD_URL || "";
		break;
	default:
		db_uri = process.env.DB_DEV_URL || "";
		console.log("Using fallback DB_DEV_URL for development mode");
		break;
}

if (!db_uri) {
	console.error("❌ Database URI is empty!");
	console.error("Please check your .env file and ensure DB_DEV_URL is set correctly.");
	console.error("Expected format: postgres://username:password@host:port/database?sslmode=require");
	process.exit(1);
}

console.log("✅ Database URI loaded successfully");

const isLocal = DB_HOST_MODE === "local";


const dialectOptions = isLocal
	? {}
	: {
		ssl: {
			require: true,
			rejectUnauthorized: false,
		},
	};

export const sequelizeConnection = new Sequelize(db_uri, {
	dialect: 'postgres',
	dialectOptions,
	logging: false,
	pool: {
		max: 10,
		min: 0,
		acquire: 30000,
		idle: 10000,
	},
});

export const connectionToDatabase = async () => {
	try {
		console.log(`Attempting to connect to database in ${APP_MODE} mode...`);
		console.log(`Database host mode: ${DB_HOST_MODE}`);

		await sequelizeConnection.authenticate();
		console.log("Database authentication successful!");

		// Repair stale wallet->group references before Sequelize applies FK constraints.
		await sequelizeConnection.query(`
			DO $$
			BEGIN
				IF EXISTS (
					SELECT 1
					FROM information_schema.tables
					WHERE table_schema = 'public' AND table_name = 'Wallets'
				) AND EXISTS (
					SELECT 1
					FROM information_schema.columns
					WHERE table_schema = 'public' AND table_name = 'Wallets' AND column_name = 'groupId'
				) AND EXISTS (
					SELECT 1
					FROM information_schema.tables
					WHERE table_schema = 'public' AND table_name = 'Groups'
				) THEN
					UPDATE "Wallets" w
					SET "groupId" = NULL
					WHERE w."groupId" IS NOT NULL
						AND NOT EXISTS (
							SELECT 1
							FROM "Groups" g
							WHERE g."id" = w."groupId"
						);
				END IF;
			END
			$$;
		`);

		const shouldSkipSync = process.env.SKIP_DB_SYNC === "true";

		if (shouldSkipSync) {
			console.log("Skipping Sequelize sync because SKIP_DB_SYNC=true");
		} else {
			// Sync models with force: true in development to recreate tables
			const syncOptions = APP_MODE === 'development' 
				? { force: false, alter: false } 
				: { alter: false };
				
			await sequelizeConnection.sync(syncOptions);
			console.log("Database sync completed successfully.");
		}
		console.log(`Connected to: ${db_uri.split('@')[1]?.split('?')[0]}`);
	} catch (error) {
		console.error("Unable to connect to the database:");
		console.error(error);
		process.exit(1);
	}
};

const db_models = Models(sequelizeConnection);

Object.keys(db_models).forEach((key) => {
	// @ts-expect-error ignore expected errors
	if (db_models[key].associate) {
		// @ts-expect-error ignore expected errors
		db_models[key].associate(db_models);
	}
});

const database_models = { ...db_models };
export default database_models;
