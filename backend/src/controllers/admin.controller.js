import prisma from '../lib/prisma.js';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import multer from 'multer';

function dateParam(req) {
  const { from, to } = req.query || {};

  const start = from ? new Date(from) : null;
  const end = to ? new Date(to) : null;

  return {
    from: isNaN(start?.getTime()) ? null : start,
    to: isNaN(end?.getTime()) ? null : end,
  };
}


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
        (v.price !== '' && v.price !== null && v.price !== undefined) ||
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

/* ================== MAPPING POUR FRONT ================== */
function mapProductOutput(p) {
  return {
    ...p,
    images: (p.productimage || []).map(i => ({
      id: i.id,
      url: i.url,
      position: i.position,
    })),
    variants: p.variant || [],
    colors: (p.productcolor || []).map(c => c.hex),
  };
}

/* ================== COMMANDES ================== */
export async function adminListOrders(req, res) {
  try {
    const orders = await prisma.order.findMany({
      include: {
        user: true,
        orderitem: { include: { variant: true, product: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    for (const order of orders) {
      order.items = order.orderitem;
      for (const item of order.items) {
        item.color = item.color || item.variant?.color || null;
        item.size = item.size || item.variant?.size || null;
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
      include: {
        productimage: true,
        variant: true,
        category: true,
        productcolor: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(products.map(mapProductOutput));
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
      include: {
        productimage: true,
        variant: true,
        category: true,
        productcolor: true,
      },
    });
    if (!product) return res.status(404).json({ error: 'Produit introuvable' });
    res.json(mapProductOutput(product));
  } catch (e) {
    console.error('[adminGetProduct]', e);
    res.status(500).json({ error: 'Erreur récupération produit' });
  }
}

export async function adminCreateProduct(req, res) {
  try {
    const {
      title,
      slug,
      price,
      stock,
      categorySlug,
      description,
      pieceDetail,
      careAdvice,
      shippingReturn,
      colors,
      variants,
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
        },
      });

      if (colorRows.length) {
        await tx.productcolor.createMany({
          data: colorRows.map((c) => ({ ...c, productId: product.id })),
        });
      }

      if (cleanVariants.length) {
        await tx.variant.createMany({
          data: cleanVariants.map((v) => ({ ...v, productId: product.id })),
        });
      }

      return tx.product.findUnique({
        where: { id: product.id },
        include: { productimage: true, variant: true, category: true, productcolor: true },
      });
    });

    res.json(mapProductOutput(created));
  } catch (e) {
    console.error('[adminCreateProduct]', e);
    res.status(500).json({ error: e?.message || 'Erreur création produit' });
  }
}

export async function adminUpdateProduct(req, res) {
  try {
    const { id } = req.params;
    const {
      title,
      slug,
      price,
      stock,
      categorySlug,
      description,
      pieceDetail,
      careAdvice,
      shippingReturn,
      colors,
      variants,
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
        },
      });

      await tx.productcolor.deleteMany({ where: { productId: id } });
      if (colorRows.length) {
        await tx.productcolor.createMany({
          data: colorRows.map((c) => ({ ...c, productId: id })),
        });
      }

      await tx.variant.deleteMany({ where: { productId: id } });
      if (cleanVariants.length) {
        await tx.variant.createMany({
          data: cleanVariants.map((v) => ({ ...v, productId: id })),
        });
      }

      return tx.product.findUnique({
        where: { id },
        include: { productimage: true, variant: true, category: true, productcolor: true },
      });
    });

    res.json(mapProductOutput(updated));
  } catch (e) {
    console.error('[adminUpdateProduct]', e);
    res.status(500).json({ error: e?.message || 'Erreur mise à jour produit' });
  }
}

/* ================== UPLOAD / DELETE IMAGES PRODUITS ================== */
const uploadDir = path.resolve('public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${Date.now()}${ext}`);
  },
});

export const upload = multer({ storage });

export async function adminUploadProductFiles(req, res) {
  try {
    const { id } = req.params;
    const files = req.files || [];

    if (!files.length) return res.status(400).json({ error: 'Aucun fichier reçu' });

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: 'Produit introuvable' });

    const data = files.map((f, i) => ({
      url: `/uploads/${f.filename}`,
      position: i,
      productId: id,
    }));

    await prisma.productimage.createMany({ data });
    res.json({ ok: true, count: data.length });
  } catch (e) {
    console.error('[adminUploadProductFiles]', e);
    res.status(500).json({ error: 'Erreur upload fichiers' });
  }
}

export async function adminDeleteProductImage(req, res) {
  try {
    const { id, imageId } = req.params;
    const image = await prisma.productimage.findUnique({ where: { id: imageId } });
    if (!image) return res.status(404).json({ error: 'Image introuvable' });

    if (image.url?.startsWith('/uploads/')) {
      const abs = path.resolve('public', image.url.replace(/^\/+/, ''));
      try {
        await fs.promises.unlink(abs);
      } catch {}
    }

    await prisma.productimage.delete({ where: { id: imageId } });
    res.json({ ok: true });
  } catch (e) {
    console.error('[adminDeleteProductImage]', e);
    res.status(500).json({ error: 'Erreur suppression image' });
  }
}
export async function adminChangePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'Champs requis manquants' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) return res.status(400).json({ error: 'Ancien mot de passe incorrect' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    res.json({ ok: true, message: 'Mot de passe mis à jour' });
  } catch (e) {
    console.error('[adminChangePassword]', e);
    res.status(500).json({ error: 'Erreur changement mot de passe' });
  }
}
/* ================== SUPPRESSION PRODUIT ================== */
export async function adminDeleteProduct(req, res) {
  try {
    const { id } = req.params;

    const existing = await prisma.product.findUnique({
      where: { id },
      include: { productimage: true },
    });
    if (!existing) return res.status(404).json({ error: 'Produit introuvable' });

    // 🔥 Supprime les fichiers physiques s’ils existent
    for (const img of existing.productimage) {
      if (img.url?.startsWith('/uploads/')) {
        const abs = path.resolve('public', img.url.replace(/^\/+/, ''));
        try {
          await fs.promises.unlink(abs);
        } catch {
          /* ignorer les erreurs de suppression */
        }
      }
    }

    // 🔥 Supprime le produit dans la BDD
    await prisma.product.delete({ where: { id } });
    res.json({ ok: true, message: 'Produit supprimé avec succès' });
  } catch (e) {
    console.error('[adminDeleteProduct]', e);
    res.status(500).json({ error: 'Erreur suppression produit' });
  }
}
/* ================== PROFIL ADMIN ================== */
export async function adminMe(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true
      },
    });

    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    res.json(user);
  } catch (e) {
    console.error('[adminMe]', e);
    res.status(500).json({ error: 'Erreur chargement profil admin' });
  }
}
/* ================== MISE À JOUR PROFIL ADMIN ================== */
export async function adminUpdateMe(req, res) {
  try {
    const { firstName, lastName, email, phone } = req.body;

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        firstName: firstName || null,
        lastName: lastName || null,
        email: email || null,
        phone: phone || null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        updatedAt: true,
      },
    });

    res.json(updated);
  } catch (e) {
    console.error('[adminUpdateMe]', e);
    res.status(500).json({ error: 'Erreur mise à jour profil admin' });
  }
}
/* ================== ANALYTICS FUNNEL ================== */
export async function analyticsFunnel(req, res) {
  try {
    const productViews = await prisma.event.count({ where: { type: 'PRODUCT_VIEW' } });
    const addToCarts = await prisma.event.count({ where: { type: 'ADD_TO_CART' } });
    const favorites = await prisma.event.count({ where: { type: 'FAVORITE_ADD' } });
    const beginCheckouts = await prisma.event.count({ where: { type: 'BEGIN_CHECKOUT' } });
    const purchases = await prisma.event.count({ where: { type: 'PURCHASE' } });

    res.json({
      productViews,
      addToCarts,
      favorites,
      beginCheckouts,
      purchases,
    });
  } catch (e) {
    console.error('[analyticsFunnel]', e);
    res.status(500).json({ error: 'Erreur récupération analytics funnel' });
  }
}

/* ================== ANALYTICS SUMMARY ================== */
export async function analyticsSummary(req, res) {
  try {
    // Nombre total de visiteurs (sessions uniques)
    const visitors = await prisma.visitor.count();
    // Nombre total de sessions
    const sessions = await prisma.session.count();
    // Somme du chiffre d’affaires total
    const revenueAgg = await prisma.order.aggregate({
      _sum: { amount: true },
      where: { status: 'PAID' },
    });
    const revenue = revenueAgg._sum.amount || 0;

    // Taux de conversion (sessions ayant mené à un achat)
    const totalPurchases = await prisma.event.count({ where: { type: 'PURCHASE' } });
    const conversionRate =
      sessions > 0 ? totalPurchases / sessions : 0;

    res.json({
      visitors,
      sessions,
      revenue,
      conversionRate,
    });
  } catch (e) {
    console.error('[analyticsSummary]', e);
    res.status(500).json({ error: 'Erreur chargement résumé analytics' });
  }
}
/* ================== ANALYTICS TOP PRODUCTS ================== */
// en haut du fichier tu as déjà : import prisma from '../lib/prisma.js';
// et la fonction dateParam utilisée par les autres analytics

export async function analyticsTopProducts(req, res) {
  try {
    const { from, to } = dateParam(req);

    const where = {};

    if (from || to) {
      where.date = {};
      if (from) where.date.gte = from;
      if (to)   where.date.lte = to;
    }

    // 1) Récupération des stats agrégées
    const stats = await prisma.dailyproductstat.groupBy({
      by: ['productId'],
      where,
      _sum: {
        views: true,
        addToCarts: true,
        favorites: true,
        purchases: true,
        revenue: true,
      }
    });

    if (!stats.length) {
      return res.json({ items: [] });
    }

    // 👉 2) Tri manuel correct (Prisma ne peut pas trier)
    stats.sort((a, b) => (b._sum.views || 0) - (a._sum.views || 0));

    // 3) Fetch produits
    const ids = stats.map(s => s.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, slug: true },
    });
    const byId = Object.fromEntries(products.map(p => [p.id, p]));

    // 4) Formatage
    const items = stats.map(s => {
      const p = byId[s.productId] || {};
      const views = s._sum.views || 0;
      const atc = s._sum.addToCarts || 0;
      const fav = s._sum.favorites || 0;
      const purchases = s._sum.purchases || 0;
      const revenue = s._sum.revenue || 0;

      return {
        productId: s.productId,
        title: p.title || 'Produit',
        slug: p.slug,
        views,
        addToCarts: atc,
        favorites: fav,
        purchases,
        revenue,
        conversionRate: views ? purchases / views : 0,
      };
    });

    return res.json({ items });

  } catch (e) {
    console.error('[admin] analyticsTopProducts error', e);
    res.status(500).json({ error: 'Erreur analytics top produits' });
  }
}

