// routes/auth.ts
import express from "express";
import passport from "../auth/passport";
import jwt from "jsonwebtoken";
import login from "../auth/login";
import resetPassword from "../auth/reset_password";

const router = express.Router();

// Login endpoint
router.post("/login", login.login_user);
router.post("/forgot-password", resetPassword.forgotPassword);
router.post("/reset-password", resetPassword.resetPassword);
router.post("/set-account-password", resetPassword.setAccountPassword);

// Google OAuth endpoints
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);
router.get(
  "/google/callback",
  passport.authenticate("google", { scope: ["profile", "email"] }),
  (req, res) => {
    const token = jwt.sign(
      { id: (req.user as any).id, email: (req.user as any).email },
      process.env.JWT_SECRET || "your_jwt_secret",
      { expiresIn: "1h", algorithm: "HS256" },
    );
    res.send(`
      <script>
        window.opener.postMessage(
          { token: "${token}" }, 
          "http://localhost:3000"  // Make sure this matches your frontend origin
        );
        window.close();
      </script>
    `);
  },
);

export default router;
