// routes/auth.ts
import express from "express";
import passport from "../auth/passport";
import login from "../auth/login";
import resetPassword from "../auth/reset_password";
import Models from "../database/models";
import {
  buildAccessToken,
  createDeviceSession,
} from "../services/authSession.service";

const router = express.Router();

// Login endpoint
router.post("/login", login.login_user);
router.post("/refresh", login.refresh_session);
router.post("/unlock", login.unlock_session);
router.post("/logout", login.logout_session);
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
  async (req, res) => {
    try {
      const user = req.user as any;
      const accountData = user?.get ? user.get({ plain: true }) : user;
      const models = req.app.get("models") as ReturnType<typeof Models>;
      const token = buildAccessToken(accountData, "user");
      const { refreshToken, expiresAt: refreshExpiresAt } =
        await createDeviceSession(models, {
          accountId: accountData.id,
          accountType: "user",
          userAgent: req.header("user-agent") || null,
          ipAddress: req.ip || null,
        });
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const payload = JSON.stringify({
        token,
        refreshToken,
        refreshExpiresAt,
      });

      res.send(`
      <script>
        window.opener.postMessage(
          ${payload},
          ${JSON.stringify(frontendUrl)}
        );
        window.close();
      </script>
    `);
    } catch (error: any) {
      res.status(500).json({
        message: "Google login failed",
        error: error.message,
      });
    }
  },
);

export default router;
