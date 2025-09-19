// src/routes/orders.routes.js
import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.js';
import {
  createIntent,
  confirmOrder,
  myOrders,
} from '../controllers/orders.controller.js';

const r = Router();

// Toutes les routes “orders” nécessitent un utilisateur authentifié
r.use(verifyJWT);

// 1) Crée un PaymentIntent Stripe à partir du panier courant
r.post('/intent', createIntent);

// 2) Confirme la commande après succès du paiement (création Order + décrément stock + vide panier)
r.post('/confirm', confirmOrder);

// 3) Liste des commandes de l’utilisateur connecté
r.get('/my', myOrders);

export default r;
