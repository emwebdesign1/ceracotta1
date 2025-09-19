// src/middleware/auth.js
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';

const { JWT_SECRET = 'dev-secret' } = process.env;

export async function verifyJWT(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const [scheme, token] = auth.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Token manquant ou invalide' });
    }

    const payload = jwt.verify(token, JWT_SECRET);

    // On charge l’utilisateur pour avoir son rôle
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, role: true, email: true },
    });
    if (!user) return res.status(401).json({ error: 'Utilisateur inconnu' });

    req.user = user; // { id, role, email }
    req.userId = user.id;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Accès refusé : rôle insuffisant' });
  }
  next();
};

export const requireAuth = verifyJWT;
