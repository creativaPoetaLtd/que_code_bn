import { config } from "dotenv";
import { Sequelize } from "sequelize";
import Models from "../models";

config();

let db_uri: string = "";
const APP_MODE: string = process.env.DEV_MODE || "development";
const DB_HOST_MODE: string = process.env.DB_HOSTED_MODE || "local";

switch (APP_MODE) {
	case "test":
		db_uri = process.env.DB_TEST_URL || "";
		break;
	case "production":
		db_uri = process.env.DB_PROD_URL || "";
		break;
	default:
		db_uri = process.env.DB_DEV_URL || "";
		break;
}

const isLocal = DB_HOST_MODE === "local";
const dialect_option = isLocal
	? {}
	: {
		ssl: {
			require: process.env.SSL,
			rejectUnauthorized: false,
		},
	};

const sequelizeConnection = new Sequelize(db_uri, {
	dialect: 'postgres',
	dialectOptions: {
		ssl: {
			require: true,
			rejectUnauthorized: false, // For self-signed certificates
		},
	},
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
		await sequelizeConnection.authenticate();
		await sequelizeConnection.sync();
		console.log("Database connected successfully.", db_uri);
	} catch (error) {
		console.log("Unable to connect to the database:", error);
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