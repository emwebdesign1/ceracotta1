// src/controllers/wishlist.controller.js
import prisma from '../lib/prisma.js';

/**
 * 📜 Liste des favoris d’un utilisateur
 */
export async function wishlistList(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const rows = await prisma.wishlistitem.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            productimage: { take: 1 },
            category: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

   const items = rows.map((r) => ({
  id: r.product.id,
  title: r.product.title,
  price: r.product.price,
  image: r.image || r.product.productimage?.[0]?.url || null, // 👈 priorité à l’image du favori
  category: r.product.category?.name || null,
  color: r.color || null,
  size: r.size || null,
  variantId: r.variantId || null,
}));


    return res.json(items);
  } catch (err) {
    console.error('[wishlistList]', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}

/**
 * ❤️ Ajoute ou retire un produit des favoris (toggle)
 * Gère : produit seul / couleur / taille / variante
 */
export async function wishlistToggle(req, res) {
  try {
    const userId = req.user?.id;
    const { productId, variantId = null, color = null, size = null, image = null } = req.body;

    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    if (!productId) return res.status(400).json({ error: 'productId manquant' });

    const where = { userId, productId };
    if (variantId) where.variantId = variantId;
    if (color) where.color = color;
    if (size) where.size = size;

    const existing = await prisma.wishlistitem.findFirst({ where });

    if (existing) {
      await prisma.wishlistitem.delete({ where: { id: existing.id } });
      return res.json({ favored: false });
    } else {
      await prisma.wishlistitem.create({
        data: { userId, productId, variantId, color, size, image },
      });
      return res.json({ favored: true });
    }
  } catch (err) {
    console.error('[wishlistToggle]', err);
    return res.status(500).json({ error: 'Erreur serveur toggle favoris' });
  }
}


/**
 * 🔍 Vérifie si une combinaison (produit + couleur + taille) est en favoris
 */
export async function wishlistStatus(req, res) {
  try {
    const userId = req.user?.id;
    const { productId, variantId = null, color = null, size = null } = req.query;

    if (!userId) return res.json({ favored: false });
    if (!productId) return res.status(400).json({ error: 'productId manquant' });

    const where = { userId, productId };
    if (variantId) where.variantId = variantId;
    if (color) where.color = color;
    if (size) where.size = size;

    const found = await prisma.wishlistitem.findFirst({ where });
    return res.json({ favored: !!found });
  } catch (err) {
    console.error('[wishlistStatus]', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
