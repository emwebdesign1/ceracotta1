import prisma from '../lib/prisma.js';

// 🧩 Helper : garantit l'existence du panier utilisateur
async function ensureCart(userId) {
  let cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) {
    cart = await prisma.cart.create({ data: { userId } });
  }
  return cart;
}

// 🧩 Helper : extrait la 1ʳᵉ image d’un produit ou d’une variante
function firstImageOf(value) {
  try {
    if (Array.isArray(value) && value.length) return value[0];
    if (typeof value === 'string') {
      const arr = JSON.parse(value);
      if (Array.isArray(arr) && arr.length) return arr[0];
    }
  } catch { }
  return null;
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
        cartitem: {
          include: {
            product: true,
            variant: true
          }
        }
      }
    });

    // 🪄 Renomme cartitem → items pour compatibilité front
    const result = {
      ...full,
      items: full.cartitem || []
    };

    return res.json({ cart: result });
  } catch (err) {
    console.error('getMyCart error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}

/**
 * POST /api/carts/items
 * body: { productId, quantity?, variantId?, color?, size?, image? }
 */
export async function addToCart(req, res) {
  try {
    const userId = req.user.id;
    let {
      productId,
      quantity = 1,
      variantId = null,
      color = null,
      size = null,
      image = null
    } = req.body;

    if (!productId) return res.status(400).json({ error: 'productId manquant' });
    if (quantity < 1) return res.status(400).json({ error: 'quantity invalide' });

    const cart = await ensureCart(userId);

    // Produit
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ error: 'Produit introuvable' });

    // Variante (optionnelle)
    let unitPrice = product.price;
    let variant = null;
    if (variantId) {
      variant = await prisma.variant.findUnique({ where: { id: variantId } });
      if (!variant || variant.productId !== product.id) {
        return res.status(400).json({ error: 'Variante invalide pour ce produit' });
      }
      if (variant.price != null) unitPrice = variant.price;
      if (!image) image = firstImageOf(variant.images);
      if (!color && variant.color) color = variant.color;
      if (!size && variant.size) size = variant.size;
    }
    if (!image) image = firstImageOf(product.images);

    // Normalisation
    color = color || null;
    size = size || null;
    variantId = variantId || null;

    // 🔍 Chercher un item identique
    const existing = await prisma.cartitem.findFirst({
      where: { cartId: cart.id, productId: product.id, variantId, color, size },
    });

    let item;
    if (existing) {
      item = await prisma.cartitem.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + quantity,
          ...(existing.unitPrice == null && unitPrice != null ? { unitPrice } : {}),
          ...(existing.image == null && image ? { image } : {}),
        },
      });
    } else {
      item = await prisma.cartitem.create({
        data: {
          cartId: cart.id,
          productId: product.id,
          title: product.title,
          unitPrice,
          image,
          variantId,
          color,
          size,
          quantity,
        },
      });
    }

    // Renvoyer le panier complet mis à jour
    const full = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: {
        cartitem: {
          include: {
            product: true,
            variant: true
          }
        }
      }
    });

    const result = { ...full, items: full.cartitem || [] };

    return res.status(201).json({ cart: result, item });
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

    const item = await prisma.cartitem.findUnique({ where: { id: itemId } });
    if (!item) return res.status(404).json({ error: 'Item introuvable' });

    const cart = await prisma.cart.findUnique({ where: { id: item.cartId } });
    if (!cart || cart.userId !== userId) return res.status(403).json({ error: 'Accès refusé' });

    const updated = await prisma.cartitem.update({
      where: { id: itemId },
      data: { quantity },
    });

    // Renvoyer le panier à jour
    const full = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: {
        cartitem: {
          include: {
            product: true,
            variant: true
          }
        }
      }
    });

    const result = { ...full, items: full.cartitem || [] };

    return res.json({ cart: result });
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

    const item = await prisma.cartitem.findUnique({ where: { id: itemId } });
    if (!item) return res.status(404).json({ error: 'Item introuvable' });

    const cart = await prisma.cart.findUnique({ where: { id: item.cartId } });
    if (!cart || cart.userId !== userId) return res.status(403).json({ error: 'Accès refusé' });

    await prisma.cartitem.delete({ where: { id: itemId } });

    const full = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: {
        cartitem: {
          include: {
            product: true,
            variant: true
          }
        }
      }
    });

    const result = { ...full, items: full.cartitem || [] };

    return res.status(200).json({ cart: result });
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

    await prisma.cartitem.deleteMany({ where: { cartId: cart.id } });

    const emptyCart = { ...cart, items: [] };
    return res.status(200).json({ cart: emptyCart });
  } catch (err) {
    console.error('clearCart error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
