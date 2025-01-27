"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePhone = exports.validatePassword = exports.validateEmail = void 0;
const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};
exports.validateEmail = validateEmail;
const validatePassword = (password) => {
    return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@#$%^&*()!]{8,}$/.test(password);
};
exports.validatePassword = validatePassword;
const validatePhone = (phone) => {
    // Adjust regex based on your phone format requirements
    return /^\+?[\d\s-]{10,}$/.test(phone);
};
exports.validatePhone = validatePhone;
