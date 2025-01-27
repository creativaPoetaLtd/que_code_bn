"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/auth.ts
const express_1 = __importDefault(require("express"));
const passport_1 = __importDefault(require("../auth/passport"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = express_1.default.Router();
router.get('/google', passport_1.default.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport_1.default.authenticate('google', { scope: ['profile', 'email'] }), (req, res) => {
    const token = jsonwebtoken_1.default.sign({ id: req.user.id, email: req.user.email }, process.env.JWT_SECRET || 'your_jwt_secret', { expiresIn: '1h', algorithm: 'HS256' });
    res.send(`
      <script>
        window.opener.postMessage(
          { token: "${token}" }, 
          "http://localhost:3000"  // Make sure this matches your frontend origin
        );
        window.close();
      </script>
    `);
});
exports.default = router;
