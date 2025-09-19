// src/controllers/auth.controller.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { z } from 'zod';

const registerSchema = z.object({
  firstName: z.string().min(1, 'Prénom requis'),
  lastName:  z.string().min(1, 'Nom requis'),
  username:  z.string().min(3, 'Nom d’utilisateur trop court').max(32),
  phone:     z.string().min(6, 'Téléphone invalide').max(32),
  email:     z.string().email('Email invalide'),
  password:  z.string().min(8, 'Mot de passe trop court (≥ 8)'),
});

const loginSchema = z.object({
  email:    z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

// On retire le hash avant de renvoyer l'utilisateur
function sanitizeUser(u) {
  if (!u) return null;
  const { passwordHash, password, ...safe } = u;
  return safe;
}

export async function register(req, res) {
  try {
    const data = registerSchema.parse(req.body);

    const [byEmail, byUsername] = await Promise.all([
      prisma.user.findUnique({ where: { email: data.email } }),
      prisma.user.findUnique({ where: { username: data.username } }),
    ]);
    if (byEmail)    return res.status(400).json({ message: 'Email déjà utilisé' });
    if (byUsername) return res.status(400).json({ message: 'Nom d’utilisateur déjà pris' });

    const hash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        email:       data.email,
        passwordHash: hash,                  // ← stocke dans passwordHash
        firstName:   data.firstName,
        lastName:    data.lastName,
        username:    data.username,
        phone:       data.phone,
        role:        'CUSTOMER',
      },
    });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.json({ user: sanitizeUser(user), token });
  } catch (err) {
    return res.status(400).json({ message: err?.message || 'Requête invalide' });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ message: 'Identifiants incorrects' });

    // ⚠️ corrige: compare avec user.passwordHash
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(400).json({ message: 'Identifiants incorrects' });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.json({ user: sanitizeUser(user), token });
  } catch (err) {
    return res.status(400).json({ message: err?.message || 'Requête invalide' });
  }
}

export async function me(req, res) {
  // recharge l’utilisateur depuis l’ID contenu dans le JWT (mis par le middleware)
  const userId = req.user?.id || req.userId;
  if (!userId) return res.status(401).json({ message: 'Non authentifié' });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  return res.json({ user: sanitizeUser(user) });
}
