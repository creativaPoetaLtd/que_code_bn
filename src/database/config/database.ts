import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

const POSTGRES_DB = process.env.POSTGRES_DB || "postgres";
const POSTGRES_USER = process.env.POSTGRES_USER || "postgres";
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || "postgres";
const POSTGRES_HOST = process.env.POSTGRES_HOST || "localhost";
const POSTGRES_PORT = parseInt(process.env.POSTGRES_PORT || "5432", 10);

// Initialize Sequelize instance directly
const sequelize = new Sequelize({
    database: POSTGRES_DB,
    username: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    host: POSTGRES_HOST,
    port: POSTGRES_PORT,
    dialect: "postgres",
});

// Test the connection
sequelize.authenticate()
    .then(() => {
        console.log("Connection to Postgres has been established successfully.");
    })
    .catch((error) => {
        console.error("Unable to connect to the database:", error);
    });

export default sequelize;
