"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const organization_routes_1 = __importDefault(require("./organization.routes"));
const user_routes_1 = __importDefault(require("./user.routes"));
const login_routes_1 = __importDefault(require("./login.routes"));
const reset_routes_1 = __importDefault(require("./reset.routes"));
const router = express_1.default.Router();
router.use("/organizations", organization_routes_1.default);
router.use("/users", user_routes_1.default);
router.use("/auth", login_routes_1.default);
router.use("/auth", reset_routes_1.default);
exports.default = router;
