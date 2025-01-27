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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_methods_1 = require("../utils/db_methods");
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
const login_user = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        // Validate input
        if (!email || !password) {
            res.status(400).json({ message: "Email and password are required" });
            return;
        }
        // Add rate limiting here if needed
        // Check both tables simultaneously
        const [user, organization] = yield Promise.all([
            (0, db_methods_1.read_function)("User", "findOne", {
                where: { email },
                attributes: {
                    exclude: ['createdAt', 'updatedAt'] // Exclude unnecessary fields
                }
            }),
            (0, db_methods_1.read_function)("Organization", "findOne", {
                where: { email },
                attributes: {
                    exclude: ['createdAt', 'updatedAt']
                }
            })
        ]);
        const account = user || organization;
        if (!account) {
            res.status(404).json({ message: "Account not found" });
            return;
        }
        if (user && user.approvalStatus) {
            res.status(403).json({ message: "Account pending approval" });
            return;
        }
        const isPasswordValid = yield bcrypt_1.default.compare(password, account.password);
        if (!isPasswordValid) {
            res.status(401).json({ message: "Invalid credentials" });
            return;
        }
        if (!user.isVerified) {
            res.status(403).json({ message: "Account not verified. Please verify your OTP before logging in." });
            return;
        }
        const token = jsonwebtoken_1.default.sign({
            id: account.id,
            email: account.email,
            accountType: user ? 'user' : 'organization',
            // Add any other necessary claims
        }, JWT_SECRET, {
            expiresIn: '1h',
            algorithm: 'HS256'
        });
        // Remove sensitive data
        const { password: _ } = account, accountWithoutPassword = __rest(account, ["password"]);
        res.status(200).json({
            message: "Login successful",
            token,
            accountType: user ? 'user' : 'organization',
            data: accountWithoutPassword,
            permissions: user ? 'user_permissions' : 'organization_permissions'
        });
    }
    catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "An error occurred during login" });
    }
});
exports.default = { login_user };
