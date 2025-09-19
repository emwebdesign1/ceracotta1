// src/routes/index.routes.js
import { Router } from 'express';
import authRoutes from './auth.routes.js';
import productsRoutes from './products.routes.js';
import categoriesRoutes from './categories.routes.js';
import cartsRoutes from './carts.routes.js';
import ordersRoutes from './orders.routes.js';
import adminRoutes from './admin.routes.js';
import payments from './payments.routes.js';


const r = Router();
r.get('/', (_req, res) => res.json({ ok: true, name: 'Céracotta API', version: '1.0' }));
r.get('/health', (_req, res) => res.json({ status: 'up' }));

r.use('/auth', authRoutes);
r.use('/products', productsRoutes);
r.use('/categories', categoriesRoutes);
r.use('/carts', cartsRoutes);
r.use('/orders', ordersRoutes);
r.use('/admin', adminRoutes);
r.use('/payments', payments);

export default r;
