"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectionToDatabase = exports.sequelizeConnection = void 0;
const dotenv_1 = require("dotenv");
const sequelize_1 = require("sequelize");
const models_1 = __importDefault(require("../models"));
(0, dotenv_1.config)();
let db_uri = "";
const APP_MODE = process.env.DEV_MODE || "development";
const DB_HOST_MODE = process.env.DB_HOSTED_MODE || "local";
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
            rejectUnauthorized: true,
        },
    };
exports.sequelizeConnection = new sequelize_1.Sequelize(db_uri, {
    dialect: "postgres",
    dialectOptions: dialect_option,
    logging: false,
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000,
    },
});
const connectionToDatabase = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield exports.sequelizeConnection.authenticate();
        yield exports.sequelizeConnection.sync();
        console.log("Database connected successfully.", db_uri);
    }
    catch (error) {
        console.log("Unable to connect to the database:", error);
        process.exit(1);
    }
});
exports.connectionToDatabase = connectionToDatabase;
const db_models = (0, models_1.default)(exports.sequelizeConnection);
Object.keys(db_models).forEach((key) => {
    // @ts-expect-error ignore expected errors
    if (db_models[key].associate) {
        // @ts-expect-error ignore expected errors
        db_models[key].associate(db_models);
    }
});
const database_models = Object.assign({}, db_models);
exports.default = database_models;
