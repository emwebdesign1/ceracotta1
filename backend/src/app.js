// src/app.js
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import routes from './routes/index.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* ---------------- Helmet avec CSP compatible Stripe ---------------- */
app.use(
  helmet({
    crossOriginEmbedderPolicy: false, // nécessaire pour les iframes Stripe
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "https://js.stripe.com"],
        "script-src-elem": ["'self'", "https://js.stripe.com"],
        "frame-src": ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
        "connect-src": ["'self'", "https://api.stripe.com"],
        "img-src": ["'self'", "data:", "https://*.stripe.com"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "font-src": ["'self'", "data:"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"]
      }
    }
  })
);

/* ---------------- CORS / middlewares globaux ---------------- */
app.use(
  cors({
    origin: process.env.CLIENT_URL || true,
    credentials: true
  })
);
app.use(cookieParser());
app.use(morgan('dev'));

/**
 * ⚠️ Stripe Webhook doit recevoir le BODY RAW.
 * On scope le raw UNIQUEMENT pour /api/payments/webhook,
 * puis on déclare express.json() pour le reste.
 */
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '1mb' }));

/* ---------------- Servir le frontend ---------------- */
const FRONT_DIR = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(FRONT_DIR));
app.get('/', (_req, res) => res.sendFile(path.join(FRONT_DIR, 'index.html')));

/* ---------------- API ---------------- */
app.use('/api', routes);

/* ---------------- 404 JSON ---------------- */
app.use((req, res, next) => next({ status: 404, message: 'Not Found' }));

/* ---------------- Gestion d'erreurs ---------------- */
app.use(errorHandler);

export default app;
