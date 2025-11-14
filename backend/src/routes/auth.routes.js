// src/routes/auth.routes.js
import { Router } from 'express';
import { register, login, me } from '../controllers/auth.controller.js';
import { verifyJWT as requireAuth } from '../middleware/auth.js';

const router = Router();

// --- Auth standard ---
router.post('/register', register);
router.post('/login', login);
router.get('/me', requireAuth, me);

// --- ✅ Déconnexion ---
router.post('/logout', (req, res) => {
  res.clearCookie('authToken');
  res.json({ ok: true });
});

export default router;
