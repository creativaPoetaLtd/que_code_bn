// routes/auth.ts
import express from 'express';
import passport from '../auth/passport';
import jwt from 'jsonwebtoken';

const router = express.Router();
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get(
  '/google/callback',
  passport.authenticate('google', { scope: ['profile', 'email'] }),
  (req, res) => {
    const token = jwt.sign(
      { id: (req.user as any).id, email: (req.user as any).email },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '1h', algorithm: 'HS256' }
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
  }
);

export default router;
