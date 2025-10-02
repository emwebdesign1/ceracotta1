import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.js';
import { accountMe, accountUpdate, accountChangePassword } from '../controllers/account.controller.js';

const r = Router();
r.use(verifyJWT);

r.get('/me', accountMe);
r.put('/me', accountUpdate);
r.put('/me/password', accountChangePassword);

export default r;
