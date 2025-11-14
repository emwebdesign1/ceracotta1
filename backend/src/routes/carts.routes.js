// src/routes/carts.routes.js
import express from 'express';
import {
  getMyCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart
} from '../controllers/carts.controller.js';
import { verifyJWT } from '../middleware/auth.js'; // ✅ Import du middleware d’authentification

const router = express.Router();

/* ---------------------------------------------------
   ROUTES PANIER UTILISATEUR (protégées par JWT)
--------------------------------------------------- */

// ✅ Applique le middleware à toutes les routes ci-dessous
router.use(verifyJWT);

// Récupère le panier de l'utilisateur connecté
router.get('/', getMyCart);

// Ajoute un produit au panier
router.post('/items', addToCart);

// Met à jour la quantité d’un article du panier
router.patch('/items/:itemId', updateCartItem);

// Supprime un article du panier
router.delete('/items/:itemId', removeCartItem);

// Vide complètement le panier
router.delete('/', clearCart);

export default router;
