import { prisma } from '../config/db.js';

// Helper: garantit l'existence du panier utilisateur
async function ensureCart(userId) {
  let cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) {
    cart = await prisma.cart.create({ data: { userId } });
  }
  return cart;
}

// en haut du fichier (helper robuste pour extraire la 1re image produit/variant)
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
// .../controllers/carts.controller.js
export async function getMyCart(req, res) {
  try {
    const userId = req.user.id;
    const cart = await ensureCart(userId);
    const full = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: {
        items: { include: { variant: true } } // ⬅️ important
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
    if (!product || (Object.hasOwn(product, 'active') && !product.active)) {
      return res.status(404).json({ error: 'Produit introuvable' });
    }

    // Variante (optionnelle) + check d’appartenance au produit
    let unitPrice = product.price;
    let variant = null;
    if (variantId) {
      variant = await prisma.variant.findUnique({ where: { id: variantId } });
      if (!variant || variant.productId !== product.id) {
        return res.status(400).json({ error: 'Variante invalide pour ce produit' });
      }
      if (variant.price != null) unitPrice = variant.price;
      if (!image) image = firstImageOf(variant.images);
      // Normaliser color/size depuis la variante si non fournis
      if (!color && variant.color) color = variant.color;
      if (!size  && variant.size)  size  = variant.size;
    }
    if (!image) image = firstImageOf(product.images);

    // Normalisation (évite les faux négatifs au matching)
    color = (color || null);
    size  = (size  || null);
    variantId = variantId || null;

    // Chercher un item identique
    const existing = await prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId: product.id, variantId, color, size }
    });

    let item;
    if (existing) {
      item = await prisma.cartItem.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + quantity,
          ...(existing.unitPrice == null && unitPrice != null ? { unitPrice } : {}),
          ...(existing.image == null && image ? { image } : {}),
          // garde color/size telles quelles si déjà présentes
        }
      });
    } else {
      // ⚠️ Selon ton schema, soit tu as `variantId` (Int?) + relation, soit une relation nommée `variant`.
      // Variante 1 (la plus simple/robuste si tu as un champ variantId):
      item = await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: product.id,
          title: product.title,
          unitPrice,
          image,
          variantId,     // ⬅️ si ton modèle a bien `variantId`
          color,         // ⬅️ on PERSISTE
          size,          // ⬅️ on PERSISTE
          quantity
        }
      });

      // Variante 2 (si ta relation s’appelle `variant` sans `variantId` brut) :
      // item = await prisma.cartItem.create({
      //   data: {
      //     cartId: cart.id,
      //     productId: product.id,
      //     title: product.title,
      //     unitPrice,
      //     image,
      //     ...(variantId ? { variant: { connect: { id: variantId } } } : {}),
      //     color,
      //     size,
      //     quantity,
      //   },
      // });
    }

    // renvoyer le panier à jour (souvent plus pratique côté front)
    const full = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: { items: { include: { variant: true } } }
    });

    return res.status(201).json({ cart: full, item });
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
