// src/routes/track.routes.js
import { Router } from "express";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

function hashIp(ip, salt) {
  if (!ip) return null;
  return crypto.createHash("sha256").update((salt || "salt") + ip).digest("hex");
}

router.post("/", async (req, res) => {
  try {
    const { type, productId, value, currency, path, utm } = req.body || {};

    /* -------------------- VISITEUR -------------------- */
    let visitorId = req.cookies?.cer_vid;
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      res.cookie("cer_vid", visitorId, {
        httpOnly: false,
        sameSite: "Lax",
        maxAge: 1000 * 60 * 60 * 24 * 365,
      });
    }

    const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
      .split(",")[0]
      .trim();

    const visitor = await prisma.visitor.upsert({
      where: { id: visitorId },
      update: {
        ipHash: hashIp(ip, process.env.IP_HASH_SALT),
        userAgent: req.get("user-agent"),
        lastSeenAt: new Date(),
      },
      create: {
        id: visitorId,
        ipHash: hashIp(ip, process.env.IP_HASH_SALT),
        userAgent: req.get("user-agent"),
        lastSeenAt: new Date(),
      },
    });

    /* -------------------- SESSION -------------------- */
    const since30min = new Date(Date.now() - 30 * 60 * 1000);

    let session = await prisma.session.findFirst({
      where: { visitorId: visitor.id, startedAt: { gte: since30min } },
      orderBy: { startedAt: "desc" },
    });

    if (!session) {
      session = await prisma.session.create({
        data: {
          visitorId: visitor.id,
          referrer: req.get("referer") || null,
          utmSource: utm?.source,
          utmMedium: utm?.medium,
          utmCampaign: utm?.campaign,
        },
      });
    } else {
      await prisma.session.update({
        where: { id: session.id },
        data: { updatedAt: new Date() },
      });
    }

    /* -------------------- JOUR (pour stats) -------------------- */
    const day = new Date();
    day.setHours(0, 0, 0, 0);

    /* -------------------- EVENT BRUT -------------------- */
    await prisma.event.create({
      data: {
        type,
        sessionId: session.id,
        productId: productId || null,
        value: value || null,
        currency: currency || null,
        path: path || req.originalUrl,
      },
    });

    /* -------------------- STATS PRODUITS -------------------- */

    if (productId) {
      if (type === "PRODUCT_VIEW") {
        await prisma.dailyproductstat.upsert({
          where: { date_productId: { date: day, productId } },
          update: { views: { increment: 1 } },
          create: { date: day, productId, views: 1 },
        });
      }

      if (type === "ADD_TO_CART") {
        await prisma.dailyproductstat.upsert({
          where: { date_productId: { date: day, productId } },
          update: { addToCarts: { increment: 1 } },
          create: { date: day, productId, addToCarts: 1 },
        });
      }

      if (type === "FAVORITE_ADD") {
        await prisma.dailyproductstat.upsert({
          where: { date_productId: { date: day, productId } },
          update: { favorites: { increment: 1 } },
          create: { date: day, productId, favorites: 1 },
        });
      }

      if (type === "PURCHASE") {
        await prisma.dailyproductstat.upsert({
          where: { date_productId: { date: day, productId } },
          update: {
            purchases: { increment: 1 },
            revenue: { increment: value || 0 },
          },
          create: {
            date: day,
            productId,
            purchases: 1,
            revenue: value || 0,
          },
        });
      }
    }

    return res.json({ ok: true });

  } catch (e) {
    console.error("❌ [track] error", e);
    return res.json({ ok: true });
  }
});

export default router;
