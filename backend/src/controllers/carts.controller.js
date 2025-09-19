import { prisma } from '../config/db.js';

// Helper: garantit l'existence du panier utilisateur
async function ensureCart(userId) {
  let cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) {
    cart = await prisma.cart.create({ data: { userId } });
  }
  return cart;
}

/**
 * GET /api/carts/
 */
export async function getMyCart(req, res) {
  try {
    const userId = req.user.id;
    const cart = await ensureCart(userId);
    const full = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: {
        items: true
      }
    });
    return res.json({ cart: full });
  } catch (err) {
    console.error('getMyCart error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}

/**
 * POST /api/carts/items
 * body: { productId, quantity? }
 */
// ...
export async function addToCart(req, res) {
  try {
    const userId = req.user.id;
    let { productId, quantity = 1 } = req.body;

    if (!productId) return res.status(400).json({ error: 'productId manquant' });
    if (quantity < 1) return res.status(400).json({ error: 'quantity invalide' });

    const cart = await ensureCart(userId);

    // ✅ Accepter id string ou number
    //    - si "123" => 123
    //    - sinon garder tel quel (UUID/cuid)
    if (typeof productId === 'string' && /^\d+$/.test(productId)) {
      productId = parseInt(productId, 10);
    }

    // ✅ findUnique tolérant au type
    const product = await prisma.product.findUnique({ where: { id: productId } });

    // ✅ Ne pas bloquer si le schéma n'a pas "active"
    const hasActive = product && Object.prototype.hasOwnProperty.call(product, 'active');
    if (!product || (hasActive && !product.active)) {
      return res.status(404).json({ error: 'Produit introuvable' });
    }

    // Cherche si l’item existe déjà
    const existing = await prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId: product.id }
    });

    let item;
    if (existing) {
      item = await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity }
      });
    } else {
      item = await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: product.id,
          title: product.title,
          unitPrice: product.price,
          image: Array.isArray(product.images) ? product.images[0] ?? null : null,
          quantity
        }
      });
    }

    return res.status(201).json({ item });
  } catch (err) {
    console.error('addToCart error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}

/**
 * PATCH /api/carts/items/:itemId
 * body: { quantity }
 */
export async function updateCartItem(req, res) {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) return res.status(400).json({ error: 'quantity invalide' });

    // Vérifie que l’item appartient bien au panier de l’utilisateur
    const item = await prisma.cartItem.findUnique({ where: { id: itemId } });
    if (!item) return res.status(404).json({ error: 'Item introuvable' });

    const cart = await prisma.cart.findUnique({ where: { id: item.cartId } });
    if (!cart || cart.userId !== userId) return res.status(403).json({ error: 'Accès refusé' });

    const updated = await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity }
    });

    return res.json({ item: updated });
  } catch (err) {
    console.error('updateCartItem error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}

/**
 * DELETE /api/carts/items/:itemId
 */
export async function removeCartItem(req, res) {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;

    const item = await prisma.cartItem.findUnique({ where: { id: itemId } });
    if (!item) return res.status(404).json({ error: 'Item introuvable' });

    const cart = await prisma.cart.findUnique({ where: { id: item.cartId } });
    if (!cart || cart.userId !== userId) return res.status(403).json({ error: 'Accès refusé' });

    await prisma.cartItem.delete({ where: { id: itemId } });
    return res.status(204).send();
  } catch (err) {
    console.error('removeCartItem error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}

/**
 * DELETE /api/carts/
 */
export async function clearCart(req, res) {
  try {
    const userId = req.user.id;
    const cart = await ensureCart(userId);

    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return res.status(204).send();
  } catch (err) {
    console.error('clearCart error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
