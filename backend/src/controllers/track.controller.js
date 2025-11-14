// controllers/track.controller.js
import prisma from '../lib/prisma.js';

export async function recordEvent(req, res) {
  try {
    const { type, productId, value, currency, path, utm } = req.body || {};

    // Crée un visitorId anonyme basé sur cookie / IP
    const visitorId = req.cookies?.visitorId || crypto.randomUUID();

    // (Optionnel : crée cookie si inexistant)
    if (!req.cookies?.visitorId) {
      res.cookie('visitorId', visitorId, { maxAge: 1000 * 60 * 60 * 24 * 365, httpOnly: true });
    }

    // Sauvegarde l’événement
    await prisma.event.create({
      data: {
        type,
        productId: productId || null,
        value: value || 0,
        currency: currency || 'CHF',
        path: path || req.originalUrl,
        visitorId,
        utmSource: utm?.source || null,
        utmMedium: utm?.medium || null,
        utmCampaign: utm?.campaign || null,
      },
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error('❌ track error', e);
    res.status(500).json({ error: 'Erreur tracking' });
  }
}
