import { Router } from 'express';
import { requireAuth as auth } from '../middleware/auth.js';
import {
  getMyCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart
} from '../controllers/carts.controller.js';

const r = Router();

// Toutes les routes du panier nécessitent l’auth
r.use(auth);

// Récupérer le panier courant de l'utilisateur
r.get('/', getMyCart);

// Ajouter un produit au panier
r.post('/items', addToCart);

// Modifier la quantité d’un item
r.patch('/items/:itemId', updateCartItem);

// Supprimer un item
r.delete('/items/:itemId', removeCartItem);

// Vider le panier
r.delete('/', clearCart);

export default r;
