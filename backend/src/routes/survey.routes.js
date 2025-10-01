// src/routes/survey.routes.js
import { Router } from 'express';
import { submitSurvey } from '../controllers/survey.controller.js';

const r = Router();
r.post('/submit', submitSurvey);

export default r;
