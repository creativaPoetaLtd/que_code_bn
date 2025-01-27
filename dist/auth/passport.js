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
// auth/passport.ts
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const keys_1 = require("../utils/keys");
const db_methods_1 = require("../utils/db_methods");
passport_1.default.use(new passport_google_oauth20_1.Strategy({
    clientID: keys_1.GOOGLE_CLIENT_ID,
    clientSecret: keys_1.GOOGLE_SECRET_ID,
    callbackURL: '/api/v1/auth/google/callback',
}, (accessToken, refreshToken, profile, done) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    try {
        // Check if user exists in the database
        console.log("profile============================", (_a = profile === null || profile === void 0 ? void 0 : profile.emails) === null || _a === void 0 ? void 0 : _a[0].value);
        const existingUser = yield (0, db_methods_1.read_function)('User', 'findOne', { where: { email: (_b = profile === null || profile === void 0 ? void 0 : profile.emails) === null || _b === void 0 ? void 0 : _b[0].value } });
        if (existingUser) {
            return done(null, existingUser);
        }
        // If user doesn't exist, create a new one
        const newUser = yield (0, db_methods_1.insert_function)('User', 'create', {
            googleId: profile.id,
            email: ((_c = profile.emails) === null || _c === void 0 ? void 0 : _c[0].value) || '',
            firstName: ((_d = profile.name) === null || _d === void 0 ? void 0 : _d.givenName) || '',
            lastName: ((_e = profile.name) === null || _e === void 0 ? void 0 : _e.familyName) || '',
            gender: 'Not specified',
            phone: 'Not specified',
            address: 'Not specified',
            password: 'P@ssword',
        });
        done(null, newUser);
    }
    catch (error) {
        done(error);
    }
})));
passport_1.default.serializeUser((user, done) => {
    done(null, user.id);
});
passport_1.default.deserializeUser((id, done) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield (0, db_methods_1.read_function)('User', 'findByPk', id);
        done(null, user);
    }
    catch (error) {
        done(error);
    }
}));
exports.default = passport_1.default;
