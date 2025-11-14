import prisma from '../lib/prisma.js';


export const list = async (req, res, next) => {
  try { res.json(await prisma.category.findMany({ orderBy:{ name:'asc' }})); }
  catch (e) { next(e); }
};
