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
exports.update_function = exports.insert_function = exports.read_function = void 0;
const db_config_1 = __importDefault(require("../database/config/db.config"));
const read_function = (model, method, condition // Accept a string for findByPk
) => __awaiter(void 0, void 0, void 0, function* () {
    if (!db_config_1.default[model] || !db_config_1.default[model][method]) {
        throw new Error(`Invalid ${!db_config_1.default[model] ? "modelName" : ""} ${!db_config_1.default[model] && !db_config_1.default[model][method] ? "and" : ""} ${!db_config_1.default[model][method] ? "method" : ""}`);
    }
    const result = method === "findByPk"
        ? yield db_config_1.default[model][method](condition)
        : yield db_config_1.default[model][method](condition);
    return result;
});
exports.read_function = read_function;
const insert_function = (model, method, data, condition) => __awaiter(void 0, void 0, void 0, function* () {
    if (!db_config_1.default[model] || !db_config_1.default[model][method]) {
        throw new Error(`Invalid ${!db_config_1.default[model] ? "modelName" : ""} ${!db_config_1.default[model] && !db_config_1.default[model][method] ? "and" : ""} ${!db_config_1.default[model][method] ? "method" : ""}`);
    }
    if (method === "create") {
        const result = yield db_config_1.default[model][method](data, condition);
        return result;
    }
    else if (method === "update") {
        if (!condition) {
            throw new Error("Condition is required for update operation");
        }
        const result = yield db_config_1.default[model][method](data, condition);
        return result;
    }
    else {
        throw new Error("Invalid method type");
    }
});
exports.insert_function = insert_function;
const update_function = (model, method, values, // Data to update
condition // Condition for updating
) => __awaiter(void 0, void 0, void 0, function* () {
    // Validate model and method
    if (!db_config_1.default[model] || !db_config_1.default[model][method]) {
        throw new Error(`Invalid ${!db_config_1.default[model] ? "modelName" : ""} ${!db_config_1.default[model] && !db_config_1.default[model][method] ? "and" : ""} ${!db_config_1.default[model][method] ? "method" : ""}`);
    }
    // Perform the update operation
    if (method === "update") {
        const result = yield db_config_1.default[model][method](values, condition);
        return result;
    }
    else {
        throw new Error("Invalid method type for update operation");
    }
});
exports.update_function = update_function;
