import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// util: récup cookie cer_vid (déjà posé par /api/track)
function getVisitorId(req, res) {
  let vid = req.cookies?.cer_vid;
  return vid || null;
}

// POST /api/wishlist/toggle
export async function toggleWishlist(req, res) {
  try {
    const { productId } = req.body || {};
    if (!productId) return res.status(400).json({ error: 'productId required' });

    const userId = req.user?.id || null;  // si tu as auth JWT sur /admin et /api protégées
    const visitorId = getVisitorId(req, res);

    // prioriser user connecté
    if (userId) {
      const existing = await prisma.wishlistItem.findUnique({
        where: { userId_productId: { userId, productId } }
      });
      if (existing) {
        await prisma.wishlistItem.delete({ where: { id: existing.id } });
        // log event remove
        await prisma.event.create({ data: { type: 'FAVORITE_REMOVE', sessionId: (await ensureSession(req)).id, productId }});
        return res.json({ favored: false });
      } else {
        await prisma.wishlistItem.create({ data: { userId, productId } });
        // log event add
        await prisma.event.create({ data: { type: 'FAVORITE_ADD', sessionId: (await ensureSession(req)).id, productId }});
        return res.json({ favored: true });
      }
    }

    // anonyme : par visitorId
    if (!visitorId) return res.status(200).json({ favored: false }); // pas de cookie => pas grave
    const existing = await prisma.anonWishlistItem.findUnique({
      where: { visitorId_productId: { visitorId, productId } }
    });
    if (existing) {
      await prisma.anonWishlistItem.delete({ where: { id: existing.id } });
      await prisma.event.create({ data: { type: 'FAVORITE_REMOVE', sessionId: (await ensureSession(req)).id, productId }});
      return res.json({ favored: false });
    } else {
      await prisma.anonWishlistItem.create({ data: { visitorId, productId } });
      await prisma.event.create({ data: { type: 'FAVORITE_ADD', sessionId: (await ensureSession(req)).id, productId }});
      return res.json({ favored: true });
    }
  } catch (e) {
    console.error('[wishlist.toggle]', e);
    res.status(500).json({ error: 'Wishlist toggle failed' });
  }
}

// GET /api/wishlist/status?productId=...
export async function wishlistStatus(req, res) {
  const productId = req.query.productId;
  if (!productId) return res.json({ favored: false });

  const userId = req.user?.id || null;
  const visitorId = req.cookies?.cer_vid || null;

  if (userId) {
    const existing = await prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } }
    });
    return res.json({ favored: !!existing });
  }
  if (visitorId) {
    const existing = await prisma.anonWishlistItem.findUnique({
      where: { visitorId_productId: { visitorId, productId } }
    });
    return res.json({ favored: !!existing });
  }
  return res.json({ favored: false });
}

// util minimaliste pour obtenir/ouvrir une session analytics
async function ensureSession(req) {
  // réutilise la logique de /api/track si tu l’as factorisée,
  // ici on crée une mini session si besoin.
  const vid = req.cookies?.cer_vid || crypto.randomUUID();
  const visitor = await prisma.visitor.upsert({
    where: { id: vid }, update: {}, create: { id: vid }
  });
  const since = new Date(Date.now() - 30*60*1000);
  let session = await prisma.session.findFirst({ where: { visitorId: visitor.id, startedAt: { gte: since } }, orderBy: { startedAt: 'desc' }});
  if (!session) session = await prisma.session.create({ data: { visitorId: visitor.id }});
  return session;
}
