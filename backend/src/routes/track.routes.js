// src/routes/track.routes.js
import { Router } from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

function hashIp(ip, salt) {
  if (!ip) return null;
  return crypto.createHash('sha256').update((salt || 's') + ip).digest('hex');
}

router.post('/', async (req, res) => {
  try {
    // ✅ toutes les variables sont déclarées dans le handler
    const { type, path, productId, value, currency, utm } = req.body || {};

    // 1) Visitor (cookie 1st-party)
    let vid = req.cookies?.cer_vid;
    if (!vid) {
      vid = crypto.randomUUID();
      res.cookie('cer_vid', vid, { httpOnly: false, sameSite: 'Lax', maxAge: 31536000000 });
    }
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

    const visitor = await prisma.visitor.upsert({
      where: { id: vid },
      update: { ipHash: hashIp(ip, process.env.IP_HASH_SALT), userAgent: req.get('user-agent') || undefined },
      create: { id: vid, ipHash: hashIp(ip, process.env.IP_HASH_SALT), userAgent: req.get('user-agent') || undefined },
    });

    // 2) Session (30 min rolling)
    const since = new Date(Date.now() - 30 * 60 * 1000);
    let session = await prisma.session.findFirst({
      where: { visitorId: visitor.id, startedAt: { gte: since } },
      orderBy: { startedAt: 'desc' }
    });
    if (!session) {
      session = await prisma.session.create({
        data: {
          visitorId: visitor.id,
          referrer: req.get('referer') || undefined,
          utmSource: utm?.source,
          utmMedium: utm?.medium,
          utmCampaign: utm?.campaign,
        }
      });
    }

    // 3) Event
    await prisma.event.create({
      data: {
        type,
        sessionId: session.id,
        path,
        productId: productId || null,
        value: typeof value === 'number' ? value : null, // montant en centimes pour PURCHASE
        currency: currency || null,
      }
    });

      // 4) Agrégats journaliers (si produit)
    if (productId && type === 'PRODUCT_VIEW') {
      const day = new Date(); day.setHours(0, 0, 0, 0);
      await prisma.dailyProductStat.upsert({
        where: { date_productId: { date: day, productId } },
        update: { views: { increment: 1 } },
        create: { date: day, productId, views: 1 }
      });
    }

    if (productId && type === 'ADD_TO_CART') {
      const day = new Date(); day.setHours(0, 0, 0, 0);
      await prisma.dailyProductStat.upsert({
        where: { date_productId: { date: day, productId } },
        update: { addToCarts: { increment: 1 } },
        create: { date: day, productId, addToCarts: 1 }
      });
    }

    if (productId && type === 'FAVORITE_ADD') {
      const day = new Date(); day.setHours(0, 0, 0, 0);
      await prisma.dailyProductStat.upsert({
        where: { date_productId: { date: day, productId } },
        update: { favorites: { increment: 1 } },
        create: { date: day, productId, favorites: 1 }
      });
    }

    // 🟣 Nouveau : suivi global du checkout / achat
    if (type === 'BEGIN_CHECKOUT') {
      const day = new Date(); day.setHours(0, 0, 0, 0);
      await prisma.event.create({
        data: {
          type: 'BEGIN_CHECKOUT',
          sessionId: session.id,
          path,
          value: null,
          currency: null,
        },
      });
    }

    if (type === 'PURCHASE') {
      const day = new Date(); day.setHours(0, 0, 0, 0);
      await prisma.event.create({
        data: {
          type: 'PURCHASE',
          sessionId: session.id,
          path,
          value: typeof value === 'number' ? value : null,
          currency: currency || 'CHF',
        },
      });
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('[track] error', e);
    res.json({ ok: true });
  }
});


export default router;

