import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.js';
import {
  stripeConfig,
  stripeCreateIntent,
  stripeCheckout,
  stripeWebhook,
  twintInit,
  paymentStatus,
} from '../controllers/payments.controller.js';

const r = Router();

// config + intents nécessitent login (on calcule sur le panier du user)
r.get('/config', verifyJWT, stripeConfig);
r.post('/intent', verifyJWT, stripeCreateIntent);

// (optionnel) Checkout
r.post('/checkout', verifyJWT, stripeCheckout);

// TWINT mock
r.post('/twint-init', verifyJWT, twintInit);
r.get('/status', paymentStatus);

// ⚠️ Webhook Stripe : pas d’auth et surtout RAW body (déjà géré dans app.js)
r.post('/webhook', stripeWebhook);

export default r;
