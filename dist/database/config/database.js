"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const POSTGRES_DB = process.env.POSTGRES_DB || "postgres";
const POSTGRES_USER = process.env.POSTGRES_USER || "postgres";
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || "postgres";
const POSTGRES_HOST = process.env.POSTGRES_HOST || "localhost";
const POSTGRES_PORT = parseInt(process.env.POSTGRES_PORT || "5432", 10);
// Initialize Sequelize instance directly
const sequelize = new sequelize_1.Sequelize({
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
exports.default = sequelize;
