import { Router } from 'express';
import { list } from '../controllers/categories.controller.js';
const r = Router();
r.get('/', list);
export default r;
