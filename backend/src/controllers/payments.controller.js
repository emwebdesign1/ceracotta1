// src/controllers/payments.controller.js
import Stripe from 'stripe';
import express from 'express';
import prisma from '../lib/prisma.js';

const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
const stripe = stripeSecret && stripeSecret.startsWith('sk_') ? new Stripe(stripeSecret) : null;

/* ===========================================================
   Utils
   =========================================================== */

async function getCartForUser(userId) {
  const uid = String(userId);
  const cart = await prisma.cart.findFirst({
    where: { userId: uid },
    include: {
      cartitem: {
        include: {
          product: true,
          variant: true
        }
      }
    }
  });

  // 🪄 compatibilité front (renvoie items au lieu de cartitem)
  return cart ? { ...cart, items: cart.cartitem || [] } : { id: null, items: [] };
}

function amountFromCart(cart) {
  return (cart.items || []).reduce((s, it) => s + (it.unitPrice || 0) * (it.quantity || 1), 0);
}

/* ===========================================================
   A) FLOW INLINE (Stripe Elements)
   =========================================================== */

// expose la clé publique au front
export async function stripeConfig(_req, res) {
  return res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '' });
}

// crée un PaymentIntent basé sur le panier courant
export async function stripeCreateIntent(req, res) {
  try {
    if (!stripe)
      return res.status(500).json({ error: 'Stripe non configuré (clé secrète manquante).' });

    const userId = String(req.user?.id || '');
    if (!userId)
      return res.status(401).json({ error: 'Non authentifié.' });

    const { customer } = req.body || {};
    const cart = await getCartForUser(userId);
    if (!cart.items?.length)
      return res.status(400).json({ error: 'Panier vide' });

    const amount = amountFromCart(cart);

    const intent = await stripe.paymentIntents.create({
      amount,                     // en centimes CHF
      currency: 'chf',
      automatic_payment_methods: { enabled: true }, // gère 3DS & co
      receipt_email: customer?.email || undefined,
      metadata: {
        userId,
        cartId: String(cart.id ?? ''),
        paymentMethod: 'CARD',
      }
    });

    return res.json({ clientSecret: intent.client_secret });
  } catch (err) {
    console.error('stripeCreateIntent error:', err);
    return res.status(500).json({ error: 'Erreur création PaymentIntent' });
  }
}

/* ===========================================================
   B) FLOW REDIRECT (Stripe Checkout) — optionnel
   =========================================================== */

export async function stripeCheckout(req, res) {
  try {
    if (!stripe)
      return res.status(500).json({ error: 'Stripe non configuré (clé secrète manquante).' });

    const userId = String(req.user?.id || '');
    if (!userId)
      return res.status(401).json({ error: 'Non authentifié.' });

    const { customer } = req.body || {};
    const cart = await getCartForUser(userId);
    if (!cart.items?.length)
      return res.status(400).json({ error: 'Panier vide' });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      currency: 'chf',
      line_items: cart.items.map(it => ({
        price_data: {
          currency: 'chf',
          unit_amount: it.unitPrice,
          product_data: {
            name: it.product?.title || it.title || 'Article',
            images: it.product?.image?.length
              ? [it.product.image[0].url]
              : (it.image ? [it.image] : [])
          }
        },
        quantity: it.quantity || 1
      })),
      customer_email: customer?.email,
      success_url: `${process.env.CLIENT_URL || 'http://localhost:4000'}/merci.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:4000'}/checkout.html?cancelled=1`,
      billing_address_collection: 'auto',
      metadata: { userId }
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('stripeCheckout error:', err);
    return res.status(500).json({ error: 'Erreur Stripe' });
  }
}

/* ===========================================================
   C) Webhook Stripe — crée l’ordre & vide le panier
   =========================================================== */

/**
 * IMPORTANT :
 * - Cette route doit recevoir le *RAW body* (voir app.js)
 * - Déclare r.post('/webhook', stripeWebhook) dans payments.routes.js
 */
export const stripeWebhook = [
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    if (!stripe)
      return res.status(500).send('Stripe non configuré');

    const sig = req.headers['stripe-signature'];
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body, // Buffer brut
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      if (event.type === 'payment_intent.succeeded') {
        const pi = event.data.object;
        const userId = String(pi.metadata?.userId || '');
        if (!userId) return res.json({ received: true });

        // Transaction : créer Order + décrémenter stocks + vider panier
        await prisma.$transaction(async (tx) => {
          const cart = await tx.cart.findFirst({
            where: { userId },
            include: {
              cartitem: true
            }
          });
          if (!cart || !cart.cartitem.length) return;

          const amount = cart.cartitem.reduce((s, it) => s + (it.unitPrice || 0) * (it.quantity || 1), 0);

          // Crée la commande
          const order = await tx.order.create({
            data: {
              userId,
              amount,
              currency: 'CHF',
              status: 'PAID',
              paymentMethod: (pi.metadata?.paymentMethod === 'TWINT') ? 'TWINT' : 'CARD',
              paymentProvider: 'STRIPE',
              paymentIntentId: pi.id,
              paymentStatus: pi.status,
              orderitem: {
                create: cart.cartitem.map(it => ({
                  productId: it.productId,
                  variantId: it.variantId,
                  quantity: it.quantity,
                  unitPrice: it.unitPrice,
                })),
              },
            },
            include: { orderitem: true }
          });

          // décrémente stock si variantId
          // décrémente stock produit / variant
          for (const it of cart.cartitem) {
            if (it.variantId) {
              // produit AVEC variantes → on décrémente la variante
              await tx.variant.update({
                where: { id: it.variantId },
                data: { stock: { decrement: it.quantity } },
              });
            } else {
              // produit SANS variantes → on décrémente le stock du produit
              const prod = await tx.product.findUnique({ where: { id: it.productId } });
              const newStock = Math.max(0, prod.stock - it.quantity);

              await tx.product.update({
                where: { id: it.productId },
                data: { stock: newStock },
              });

            }
          }


          // vide le panier
          await tx.cartitem.deleteMany({ where: { cartId: cart.id } });

          return order;
        });
      }

      return res.json({ received: true });
    } catch (e) {
      console.error('Webhook handler error:', e);
      return res.status(500).send('Webhook handler error');
    }
  }
];

/* ===========================================================
   D) TWINT (mock)
   =========================================================== */

const memoryPay = (globalThis.memoryPay ||= new Map());

export async function twintInit(req, res) {
  try {
    const userId = String(req.user?.id || '');
    if (!userId) return res.status(401).json({ error: 'Non authentifié.' });

    const cart = await getCartForUser(userId);
    if (!cart.items?.length) return res.status(400).json({ error: 'Panier vide' });

    const total = amountFromCart(cart);

    const qrText = `TWINT|amount=${(total / 100).toFixed(2)}|order=${cart.id ?? 'n/a'}`;
    const qrDataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">
         <rect width="100%" height="100%" fill="#fff"/>
         <rect x="10" y="10" width="220" height="220" fill="#000" opacity=".06"/>
         <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="14" font-family="monospace">${qrText}</text>
       </svg>`
    );

    const paymentId = 'tw_' + Math.random().toString(36).slice(2);
    memoryPay.set(paymentId, { status: 'pending', total, userId, at: Date.now() });

    return res.json({ paymentId, qrDataUrl });
  } catch (err) {
    console.error('twintInit error:', err);
    return res.status(500).json({ error: 'Erreur TWINT (mock)' });
  }
}

export async function paymentStatus(req, res) {
  try {
    const { paymentId } = req.query;
    const p = memoryPay.get(paymentId);
    if (!p) return res.json({ status: 'not_found' });

    const elapsed = (Date.now() - p.at) / 1000;
    if (elapsed > 10 && p.status === 'pending') p.status = 'succeeded';

    return res.json({ status: p.status });
  } catch (e) {
    console.error('paymentStatus error:', e);
    return res.status(500).json({ status: 'error' });
  }
}
