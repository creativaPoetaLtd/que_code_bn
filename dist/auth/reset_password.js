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
const crypto_1 = __importDefault(require("crypto"));
const db_methods_1 = require("../utils/db_methods");
const email_1 = __importDefault(require("../helpers/email"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const forgotPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email } = req.body;
        const user = yield (0, db_methods_1.read_function)("User", "findOne", {
            where: { email },
        });
        if (!user) {
            res.status(404).json({ message: "User not found" });
        }
        else {
            const resetToken = crypto_1.default.randomBytes(32).toString("hex");
            const resetTokenExpires = new Date(Date.now() + 3600000);
            yield (0, db_methods_1.update_function)("User", "update", { resetToken, resetTokenExpires }, { where: { email } });
            const resetUrl = `http://localhost:3000/auth/reset-password/${resetToken}`;
            const message = `You are receiving this because you requested a password reset. Please click on the following link, or paste this into your browser to complete the process:\n\n${resetUrl}`;
            yield (0, email_1.default)({
                to: user.email,
                subject: "Password Reset",
                type: 'notification',
                data: { message },
            });
            res.status(200).json({ message: "Reset email sent" });
        }
    }
    catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({ message: "An error occurred while requesting password reset" });
    }
});
const resetPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { token, newPassword } = req.body;
        const user = yield (0, db_methods_1.read_function)("User", "findOne", {
            where: {
                resetToken: token,
            },
        });
        if (!user) {
            res.status(400).json({ message: "Invalid or expired reset token" });
        }
        else {
            const hashedPassword = yield bcrypt_1.default.hash(newPassword, 10);
            yield (0, db_methods_1.update_function)("User", "update", {
                password: hashedPassword,
                resetToken: null,
                resetTokenExpires: null,
            }, { where: { id: user.id } });
            res.status(200).json({ message: "Password reset successful" });
        }
    }
    catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({ message: "An error occurred while resetting password" });
    }
});
exports.default = { forgotPassword, resetPassword };
