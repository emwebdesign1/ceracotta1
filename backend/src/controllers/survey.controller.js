// src/controllers/survey.controller.js
import prisma from '../lib/prisma.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const CHOICES = new Set(['MUGS_COLORFUL', 'PLATES_MINIMAL', 'BOWLS_GENEROUS', 'OTHER']);

/**
 * Soumission du formulaire d'avis client
 */
export async function submitSurvey(req, res, next) {
  try {
    const { choice, otherText = '', email = '', website = '' } = req.body || {};

    // 🕵️‍♀️ Honeypot anti-bot
    if (typeof website === 'string' && website.trim() !== '') {
      return res.json({ ok: true }); // on ignore sans erreur
    }

    // 🔍 Vérif du choix
    if (!CHOICES.has(String(choice))) {
      return res.status(400).json({ ok: false, message: 'Choix invalide' });
    }

    // 📧 Email valide ou null
    const emailOk = email && EMAIL_RE.test(String(email));
    const data = {
      choice,
      otherText: String(otherText || '').slice(0, 255) || null,
      email: emailOk ? String(email).slice(0, 190) : null,
    };

    // ✅ Insertion en base
    await prisma.surveyresponse.create({ data });

    return res.json({ ok: true });
  } catch (e) {
    console.error('[submitSurvey]', e);
    next(e);
  }
}

/**
 * Liste complète des avis (admin)
 */
export async function listSurveys(req, res, next) {
  try {
    const rows = await prisma.surveyresponse.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows);
  } catch (e) {
    console.error('[listSurveys]', e);
    next(e);
  }
}

/**
 * Statistiques globales des avis (admin)
 */
export async function surveyStats(req, res, next) {
  try {
    const groups = await prisma.surveyresponse.groupBy({
      by: ['choice'],
      _count: { choice: true },
    });

    const total = groups.reduce((s, g) => s + (g._count?.choice || 0), 0);

    res.json({
      total,
      breakdown: Object.fromEntries(groups.map(g => [g.choice, g._count.choice])),
    });
  } catch (e) {
    console.error('[surveyStats]', e);
    next(e);
  }
}
