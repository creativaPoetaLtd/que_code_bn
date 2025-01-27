"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// app.ts
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const express_session_1 = __importDefault(require("express-session"));
const passport_1 = __importDefault(require("./auth/passport"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const routes_1 = __importDefault(require("./routes"));
const keys_1 = require("./utils/keys");
const app = (0, express_1.default)();
app.use((0, express_session_1.default)({
    secret: keys_1.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
}));
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
app.use(express_1.default.json());
app.use((0, cors_1.default)());
app.use(express_1.default.urlencoded({ extended: true }));
app.use("/api/v1", routes_1.default);
app.use("/api/v1/auth", auth_routes_1.default);
app.get("/api/v1", (_req, res) => {
    res.status(200).json({
        message: "Welcome to qew code backend!",
    });
});
exports.default = app;
