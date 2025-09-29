import { Router } from 'express';
import { toggleWishlist, wishlistStatus } from '../controllers/wishlist.controller.js';
const r = Router();

r.post('/toggle', toggleWishlist);
r.get('/status', wishlistStatus);

export default r;
