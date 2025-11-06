// src/controllers/orders.controller.js
import { prisma } from '../config/db.js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Crée un PaymentIntent Stripe à partir du panier courant
 * (utile si tu utilises /api/orders/intent ; sinon ton front utilise déjà /api/payments/intent)
 */
export const createIntent = async (req, res, next) => {
  try {
    const { paymentMethod } = req.body; // "CARD" | "TWINT"
    if (!['CARD', 'TWINT'].includes(paymentMethod)) {
      return next({ status: 400, message: 'Méthode de paiement invalide' });
    }

    const cart = await prisma.cart.findUnique({
      where: { userId: String(req.user.id) },
      include: { items: true },
    });
    if (!cart || !cart.items.length) {
      return next({ status: 400, message: 'Panier vide' });
    }

    const amount = cart.items.reduce(
      (sum, it) => sum + (it.unitPrice || 0) * (it.quantity || 1),
      0
    );

    const pi = await stripe.paymentIntents.create({
      amount,
      currency: 'chf',
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: String(req.user.id),
        paymentMethod,
      },
    });

    res.json({ clientSecret: pi.client_secret, amount });
  } catch (err) {
    next(err);
  }
};

/**
 * Confirme la commande après succès du paiement (Stripe Elements)
 * - Vérifie le PaymentIntent
 * - Crée l'Order + OrderItems (avec title / image)
 * - Décrémente les stocks (variant si présent sinon produit)
 * - Vide le panier
 */
export const confirmOrder = async (req, res, next) => {
  try {
    const { paymentIntentId, shipping } = req.body;
    if (!paymentIntentId) {
      return next({ status: 400, message: 'paymentIntentId requis' });
    }

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (!pi) return next({ status: 400, message: 'PaymentIntent introuvable' });
    if (!['succeeded', 'processing', 'requires_capture'].includes(pi.status)) {
      return next({ status: 400, message: 'Paiement non confirmé' });
    }

    const method = pi.metadata?.paymentMethod === 'TWINT' ? 'TWINT' : 'CARD';

    const order = await prisma.$transaction(async (tx) => {
      // Récupère le panier complet (avec produit/variant si dispo)
      const cart = await tx.cart.findUnique({
        where: { userId: String(req.user.id) },
        include: {
          items: {
            include: { product: true, variant: true },
          },
        },
      });
      if (!cart || !cart.items.length) {
        throw { status: 400, message: 'Panier vide' };
      }

      const amount = cart.items.reduce(
        (sum, it) => sum + (it.unitPrice || 0) * (it.quantity || 1),
        0
      );

      // Crée la commande + items (⚠️ on fournit title et image)
      const newOrder = await tx.order.create({
        data: {
          userId: String(req.user.id),
          amount,
          currency: 'CHF',
          status: pi.status === 'succeeded' ? 'PAID' : 'PENDING',
          paymentMethod: method,
          paymentProvider: 'STRIPE',
          paymentIntentId,
          paymentStatus: pi.status,
          // si ta colonne est Json -> Prisma acceptera l'objet ; si c'est String, on stringify.
          shippingAddress:
            shipping && typeof shipping === 'object'
              ? JSON.stringify(shipping)
              : shipping ?? null,
          items: {
            create: cart.items.map((it) => ({
              productId: it.productId,
              variantId: it.variantId ?? null,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              title: it.title || it.product?.title || 'Produit',
              image:
                it.image ||
                (Array.isArray(it.product?.images) ? it.product.images[0] ?? null : null),
              // 🆕 Ajout couleur et taille si présentes
              color:
                it.color ||
                it.variant?.color ||
                it.variantColor ||
                it.options?.color ||
                it.meta?.color ||
                it.attributes?.colorHex ||
                it.attributes?.color ||
                null,
              size:
                it.size ||
                it.variant?.size ||
                it.variantSize ||
                it.options?.size ||
                it.meta?.size ||
                it.attributes?.size ||
                it.sizeLabel ||
                null,
            })),
          },

        },
        include: { items: true },
      });

      // Décrémenter les stocks
      for (const it of cart.items) {
        // Si on a des variantes avec stock
        if (it.variantId) {
          try {
            await tx.variant.update({
              where: { id: it.variantId },
              data: { stock: { decrement: it.quantity } },
            });
          } catch {
            // Si le modèle Variant n'a pas de stock, on ignore
          }
        } else {
          // Sinon on tente sur le produit
          try {
            await tx.product.update({
              where: { id: it.productId },
              data: { stock: { decrement: it.quantity } },
            });
          } catch {
            // Si le modèle Product n'a pas de stock, on ignore
          }
        }
      }

      // Vider le panier
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return newOrder;
    });

    res.status(201).json(order);
  } catch (err) {
    // Si c'est une erreur custom jetée plus haut
    if (err?.status) return next(err);
    next(err);
  }
};

/**
 * Liste des commandes de l'utilisateur
 */
export const myOrders = async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: String(req.user.id) },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    res.json(orders);
  } catch (err) {
    next(err);
  }
};
