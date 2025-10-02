import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// GET /api/account/me
export async function accountMe(req, res) {
  const id = req.user?.id;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, email: true, username: true,
      firstName: true, lastName: true, phone: true,
      addressLine1: true, addressLine2: true, zip: true, city: true, country: true,
      role: true
    }
  });
  res.json({ user });
}

// PUT /api/account/me
export async function accountUpdate(req, res) {
  const id = req.user?.id;
  const { firstName, lastName, phone, addressLine1, addressLine2, zip, city, country } = req.body;

  const updated = await prisma.user.update({
    where: { id },
    data: { firstName, lastName, phone, addressLine1, addressLine2, zip, city, country }
  });
  res.json({ user: updated });
}


// PUT /api/account/password
export async function accountChangePassword(req, res) {
  const id = req.user?.id;
  const { currentPassword, newPassword } = req.body;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return res.status(400).json({ error: 'Mot de passe actuel incorrect' });

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash: hash } });

  res.json({ ok: true });
}
