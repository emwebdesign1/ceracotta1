import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Produits CRUD (admin)
export const adminCreateProduct = async (req, res, next) => {
  try {
    const { title, slug, description, characteristics, images, price, stock, categorySlug } = req.body;
    const category = categorySlug ? await prisma.category.findUnique({ where:{ slug: categorySlug }}) : null;
    const p = await prisma.product.create({
      data:{ title, slug, description, characteristics, images, price:Number(price), stock:Number(stock), categoryId: category?.id }
    });
    res.status(201).json(p);
  } catch (e) { next(e); }
};

export const adminUpdateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = req.body;
    if (data.categorySlug) {
      const c = await prisma.category.findUnique({ where:{ slug: data.categorySlug }});
      data.categoryId = c?.id ?? null;
      delete data.categorySlug;
    }
    if (data.price) data.price = Number(data.price);
    if (data.stock) data.stock = Number(data.stock);
    const p = await prisma.product.update({ where:{ id }, data });
    res.json(p);
  } catch (e) { next(e); }
};

export const adminDeleteProduct = async (req, res, next) => {
  try { await prisma.product.delete({ where:{ id: req.params.id }}); res.json({ ok:true }); }
  catch (e) { next(e); }
};

// Listes admin
export const adminListOrders = async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy:{ createdAt:'desc' }, include:{ items:true, user:true }
    });
    res.json(orders);
  } catch (e) { next(e); }
};

// controllers/admin.controller.js
export const adminListUsers = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({ orderBy:{ createdAt:'desc' }});
    res.json(users);
  } catch (e) { next(e); }
};

