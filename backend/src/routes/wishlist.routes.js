import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.js';
import {
  wishlistList,
  wishlistToggle,
  wishlistStatus,
} from '../controllers/wishlist.controller.js';

const r = Router();

// toutes les routes protégées par JWT
r.use(verifyJWT);

r.get('/', wishlistList);
r.get('/status', wishlistStatus);
r.post('/toggle', wishlistToggle);

export default r;
