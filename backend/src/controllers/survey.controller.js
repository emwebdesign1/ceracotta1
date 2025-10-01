// src/controllers/survey.controller.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const CHOICES = new Set(['MUGS_COLORFUL','PLATES_MINIMAL','BOWLS_GENEROUS','OTHER']);

export async function submitSurvey(req, res, next){
  try{
    const { choice, otherText = '', email = '', website = '' } = req.body || {};

    // honeypot
    if (typeof website === 'string' && website.trim() !== '') {
      return res.json({ ok:true }); // ignore silencieusement
    }

    if (!CHOICES.has(String(choice))) {
      return res.status(400).json({ ok:false, message:'Choix invalide' });
    }
    const emailOk = email && EMAIL_RE.test(String(email));
    const data = {
      choice,
      otherText: String(otherText || '').slice(0,255) || null,
      email: emailOk ? String(email).slice(0,190) : null
    };

    await prisma.surveyResponse.create({ data });
    return res.json({ ok:true });
  }catch(e){ next(e); }
}

// ==== ADMIN ====
export async function listSurveys(req, res, next){
  try{
    const rows = await prisma.surveyResponse.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(rows);
  }catch(e){ next(e); }
}

export async function surveyStats(req, res, next){
  try{
    const groups = await prisma.surveyResponse.groupBy({
      by: ['choice'],
      _count: { choice: true }
    });
    const total = groups.reduce((s,g)=> s + (g._count?.choice||0), 0);
    res.json({
      total,
      breakdown: Object.fromEntries(groups.map(g => [g.choice, g._count.choice]))
    });
  }catch(e){ next(e); }
}
