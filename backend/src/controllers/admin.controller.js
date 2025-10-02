// src/controllers/admin.controller.js
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/* ================== HELPERS ================== */
function toIntOrUndef(v, round = true) {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v);
  if (Number.isNaN(n)) return undefined;
  return round ? Math.round(n) : n | 0;
}

function normalizeHex(s) {
  if (!s) return undefined;
  const t = String(s).trim();
  if (!t) return undefined;
  return t.startsWith('#') ? t : `#${t}`;
}

function sanitizeVariants(input) {
  const list = Array.isArray(input) ? input : [];
  return list
    .filter(v => {
      const any =
        (v.size && String(v.size).trim()) ||
        (v.color || v.colorHex || v.hex) ||
        (v.sku && String(v.sku).trim()) ||
        v.price !== '' && v.price !== null && v.price !== undefined ||
        Number(v.stock) > 0;
      return !!any;
    })
    .map(v => {
      const colorRaw = v.color ?? v.colorHex ?? v.hex ?? '';
      return {
        size: (v.size && String(v.size).trim()) || undefined,
        color: normalizeHex(colorRaw) || undefined,
        price: toIntOrUndef(v.price),
        stock: toIntOrUndef(v.stock) ?? 0,
        sku: (v.sku && String(v.sku).trim()) || undefined,
      };
    });
}

function sanitizeColors(colors) {
  const arr = Array.isArray(colors) ? colors : [];
  const uniq = [...new Set(arr.map(normalizeHex).filter(Boolean))];
  return uniq.map(hex => ({ hex, name: null }));
}

/* ================== COMMANDES ================== */
export async function adminListOrders(req, res) {
  try {
    const orders = await prisma.order.findMany({
      include: {
        user: true,
        items: {
          include: {
            variant: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    // Ajout : pour chaque item, si item.color existe, on le garde, sinon on prend variant.color
    for (const order of orders) {
      for (const item of order.items) {
        item.color = item.color || item.variant?.color || null;
        item.size  = item.size  || item.variant?.size  || null;
      }
    }
    res.json(orders);
  } catch (e) {
    console.error('[adminListOrders]', e);
    res.status(500).json({ error: 'Erreur récupération commandes' });
  }
}

/* ================== UTILISATEURS ================== */
export async function adminListUsers(req, res) {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (e) {
    console.error('[adminListUsers]', e);
    res.status(500).json({ error: 'Erreur récupération utilisateurs' });
  }
}

/* ================== PRODUITS ================== */
export async function adminListProducts(req, res) {
  try {
    const q = req.query.q || '';
    const products = await prisma.product.findMany({
      where: q ? { title: { contains: q, mode: 'insensitive' } } : {},
      include: { images: true, variants: true, category: true, colors: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(products);
  } catch (e) {
    console.error('[adminListProducts]', e);
    res.status(500).json({ error: 'Erreur récupération produits' });
  }
}

export async function adminGetProduct(req, res) {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: { images: true, variants: true, category: true, colors: true },
    });
    if (!product) return res.status(404).json({ error: 'Produit introuvable' });
    res.json(product);
  } catch (e) {
    console.error('[adminGetProduct]', e);
    res.status(500).json({ error: 'Erreur récupération produit' });
  }
}

export async function adminCreateProduct(req, res) {
  try {
    const {
      title, slug, price, stock,
      categorySlug, description, pieceDetail,
      careAdvice, shippingReturn, colors, variants
    } = req.body;

    let categoryId = null;
    if (categorySlug) {
      const cat = await prisma.category.findUnique({ where: { slug: categorySlug } });
      if (!cat) return res.status(400).json({ error: 'Catégorie invalide' });
      categoryId = cat.id;
    }

    const cleanVariants = sanitizeVariants(variants);
    const colorRows = sanitizeColors(colors);

    const created = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          title,
          slug,
          price: toIntOrUndef(price) ?? 0,
          stock: toIntOrUndef(stock) ?? 0,
          description: description || null,
          pieceDetail: pieceDetail || null,
          careAdvice: careAdvice || null,
          shippingReturn: shippingReturn || null,
          categoryId,
        }
      });

      if (colorRows.length) {
        await tx.productColor.createMany({
          data: colorRows.map(c => ({ ...c, productId: product.id }))
        });
      }

      if (cleanVariants.length) {
        await tx.variant.createMany({
          data: cleanVariants.map(v => ({ ...v, productId: product.id }))
        });
      }

      return tx.product.findUnique({
        where: { id: product.id },
        include: { images: true, variants: true, category: true, colors: true }
      });
    });

    res.json(created);
  } catch (e) {
    console.error('[adminCreateProduct]', e);
    res.status(500).json({ error: e?.message || 'Erreur création produit' });
  }
}

export async function adminUpdateProduct(req, res) {
  try {
    const { id } = req.params;
    const {
      title, slug, price, stock,
      categorySlug, description, pieceDetail,
      careAdvice, shippingReturn, colors, variants
    } = req.body;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Produit introuvable' });

    let categoryId = null;
    if (categorySlug) {
      const cat = await prisma.category.findUnique({ where: { slug: categorySlug } });
      if (!cat) return res.status(400).json({ error: 'Catégorie invalide' });
      categoryId = cat.id;
    }

    const cleanVariants = sanitizeVariants(variants);
    const colorRows = sanitizeColors(colors);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          title,
          slug,
          price: toIntOrUndef(price) ?? 0,
          stock: toIntOrUndef(stock) ?? 0,
          description: description || null,
          pieceDetail: pieceDetail || null,
          careAdvice: careAdvice || null,
          shippingReturn: shippingReturn || null,
          categoryId,
        }
      });

      await tx.productColor.deleteMany({ where: { productId: id } });
      if (colorRows.length) {
        await tx.productColor.createMany({
          data: colorRows.map(c => ({ ...c, productId: id }))
        });
      }

      await tx.variant.deleteMany({ where: { productId: id } });
      if (cleanVariants.length) {
        await tx.variant.createMany({
          data: cleanVariants.map(v => ({ ...v, productId: id }))
        });
      }

      return tx.product.findUnique({
        where: { id },
        include: { images: true, variants: true, category: true, colors: true }
      });
    });

    res.json(updated);
  } catch (e) {
    console.error('[adminUpdateProduct]', e);
    res.status(500).json({ error: e?.message || 'Erreur mise à jour produit' });
  }
}

export async function adminDeleteProduct(req, res) {
  try {
    const { id } = req.params;
    await prisma.product.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error('[adminDeleteProduct]', e);
    res.status(500).json({ error: 'Erreur suppression produit' });
  }
}

/* ================== ANALYTICS ================== */
export async function analyticsSummary(req, res) {
  try {
    const visitors = await prisma.visitor.count();
    const sessions = await prisma.session.count();
    const revenue = await prisma.order.aggregate({ _sum: { amount: true } });
    const purchases = await prisma.order.count();
    const conversionRate = sessions ? purchases / sessions : 0;

    res.json({
      visitors,
      sessions,
      revenue: revenue._sum.amount || 0,
      conversionRate,
    });
  } catch (e) {
    console.error('[analyticsSummary]', e);
    res.status(500).json({ error: 'Erreur stats summary' });
  }
}

export async function analyticsFunnel(req, res) {
  try {
    const views = await prisma.event.count({ where: { type: 'PRODUCT_VIEW' } });
    const atc = await prisma.event.count({ where: { type: 'ADD_TO_CART' } });
    const checkout = await prisma.event.count({ where: { type: 'BEGIN_CHECKOUT' } });
    const purchase = await prisma.event.count({ where: { type: 'PURCHASE' } });

    res.json({
      productViews: views,
      addToCarts: atc,
      beginCheckouts: checkout,
      purchases: purchase,
    });
  } catch (e) {
    console.error('[analyticsFunnel]', e);
    res.status(500).json({ error: 'Erreur stats funnel' });
  }
}

export async function analyticsTopProducts(req, res) {
  try {
    const stats = await prisma.dailyProductStat.groupBy({
      by: ['productId'],
      _sum: { views: true, addToCarts: true, favorites: true, revenue: true },
    });

    const enriched = await Promise.all(stats.map(async s => {
      const product = await prisma.product.findUnique({ where: { id: s.productId } });
      return {
        id: s.productId,
        title: product?.title || '—',
        views: s._sum.views || 0,
        addToCarts: s._sum.addToCarts || 0,
        favorites: s._sum.favorites || 0,
        revenue: s._sum.revenue || 0,
        purchases: await prisma.event.count({ where: { productId: s.productId, type: 'PURCHASE' } }),
      };
    }));

    res.json(enriched);
  } catch (e) {
    console.error('[analyticsTopProducts]', e);
    res.status(500).json({ error: 'Erreur stats top produits' });
  }
}

export async function adminMe(req, res) {
  try {
    const id = req.user?.id; // fourni par verifyJWT
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, firstName: true, lastName: true, phone: true, role: true,
        // ajoute ici d’autres champs si tu en as besoin (adresse, etc.)
      }
    });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(user);
  } catch (e) {
    console.error('[adminMe]', e);
    res.status(500).json({ error: 'Erreur chargement profil' });
  }
}

export async function adminUpdateMe(req, res) {
  try {
    const id = req.user?.id;
    const { firstName, lastName, phone, email } = req.body;

    // (Optionnel) s’assurer que l’email n’est pas déjà pris par quelqu’un d’autre
    if (email) {
      const clash = await prisma.user.findFirst({ where: { email, NOT: { id } } });
      if (clash) return res.status(400).json({ error: 'Cet email est déjà utilisé.' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        firstName: (firstName ?? '').trim() || null,
        lastName: (lastName ?? '').trim() || null,
        phone: (phone ?? '').trim() || null,
        email: (email ?? '').trim() || undefined, // undefined = ne pas toucher
      },
      select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true }
    });

    res.json(updated);
  } catch (e) {
    console.error('[adminUpdateMe]', e);
    res.status(500).json({ error: 'Erreur mise à jour profil' });
  }
}

export async function adminChangePassword(req, res) {
  try {
    const id = req.user?.id;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mot de passe actuel et nouveau requis.' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user?.passwordHash) return res.status(400).json({ error: 'Impossible de vérifier le mot de passe.' });

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return res.status(400).json({ error: 'Mot de passe actuel incorrect.' });

    const hash = await bcrypt.hash(String(newPassword), 10);
    await prisma.user.update({ where: { id }, data: { passwordHash: hash } });

    res.json({ ok: true });
  } catch (e) {
    console.error('[adminChangePassword]', e);
    res.status(500).json({ error: 'Erreur changement de mot de passe' });
  }
}