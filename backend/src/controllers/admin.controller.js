// controllers/admin.controller.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/* =========================================
   Helpers
   ========================================= */
function fileToUrl(file) {
  // Adapte selon ton storage: file.location (S3), file.path (local), etc.
  return file?.url || file?.location || (file?.path ? file.path.replace(/^public\//, '/') : `/uploads/${file?.filename}`);
}
function normalizeVariantForCreate(v, productId) {
  return {
    productId,
    size: v.size || null,
    colorHex: v.colorHex || v.hex || v.color || null,
    price: v.price != null ? Number(v.price) : null, // si ta colonne n'est pas nullable -> remplace par 0
    stock: v.stock != null ? Number(v.stock) : 0,
    sku: v.sku || null,
    active: v.active == null ? true : !!v.active,
  };
}
function mapProductOut(p) {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    price: p.price,
    stock: p.stock,
    category: p.category?.slug || null,
    description: p.description || null,
    pieceDetail: p.pieceDetail || null,
    careAdvice: p.careAdvice ?? p.care ?? null,
    shippingReturn: p.shippingReturn ?? p.shipping ?? null,
    colors: (p.colors || []).map(c => c.hex).filter(Boolean),
    images: (p.images || []).sort((a,b)=>(a.position ?? 0)-(b.position ?? 0)),
    variants: (p.variants || []).map(v => ({
      id: v.id,
      size: v.size,
      colorHex: v.colorHex || null,
      price: v.price ?? null,
      stock: v.stock ?? 0,
      sku: v.sku || null,
      active: v.active ?? true,
    })),
  };
}

/* =========================================
   PRODUITS
   ========================================= */
export const adminListProducts = async (req, res, next) => {
  try {
    const { q = '' } = req.query;
    const where = q
      ? {
          OR: [
            { title: { contains: String(q), mode: 'insensitive' } },
            { slug: { contains: String(q), mode: 'insensitive' } },
            { description: { contains: String(q), mode: 'insensitive' } },
          ],
        }
      : {};
    const rows = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { category: true, images: true, colors: true, variants: true },
    });
    res.json(rows.map(mapProductOut));
  } catch (e) { next(e); }
};

export const adminGetProduct = async (req, res, next) => {
  try {
    const p = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { category: true, images: true, colors: true, variants: true },
    });
    if (!p) return res.status(404).json({ message: 'Not found' });
    res.json(mapProductOut(p));
  } catch (e) { next(e); }
};

export const adminCreateProduct = async (req, res, next) => {
  try {
    const {
      title, slug, description, pieceDetail,
      careAdvice, shippingReturn,
      price, stock, categorySlug,
      colors = [], variants = []
    } = req.body;

    const category = categorySlug
      ? await prisma.category.findUnique({ where: { slug: categorySlug } })
      : null;

    const p = await prisma.product.create({
      data: {
        title, slug,
        description: description || null,
        pieceDetail: pieceDetail || null,
        // DB legacy: si tu as care/shipping ou careAdvice/shippingReturn dans le modèle, les deux sont remplis
        care: careAdvice ?? null,
        careAdvice: careAdvice ?? null,
        shipping: shippingReturn ?? null,
        shippingReturn: shippingReturn ?? null,
        price: Number(price),
        stock: Number(stock),
        ...(category ? { category: { connect: { id: category.id } } } : {}),
        colors: colors.length ? { create: colors.map(hex => ({ hex })) } : undefined,
        variants: variants.length ? {
          create: variants.map(v => normalizeVariantForCreate(v, undefined))
        } : undefined
      },
      include: { category: true, images: true, colors: true, variants: true },
    });

    res.status(201).json(mapProductOut(p));
  } catch (e) { next(e); }
};

export const adminUpdateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { categorySlug, price, stock, colors, variants, ...raw } = req.body;

    // Mapper alias front -> colonnes DB (ET supprimer les clés d'origine pour éviter l'erreur Prisma)
    const data = { ...raw };
    if ('careAdvice' in data) {
      data.care = data.careAdvice;
      delete data.careAdvice; // <- important
    }
    if ('shippingReturn' in data) {
      data.shipping = data.shippingReturn;
      delete data.shippingReturn; // <- important
    }

    // Catégorie : si slug fourni mais invalide → 400 explicite
    if (typeof categorySlug === 'string') {
      const c = await prisma.category.findUnique({ where: { slug: categorySlug } });
      if (!c) return res.status(400).json({ message: `Catégorie introuvable: ${categorySlug}` });
      data.categoryId = c.id;
    }

    if (price != null) data.price = Number(price);
    if (stock != null) data.stock = Number(stock);

    // 1) champs simples
    await prisma.product.update({ where: { id }, data });

    // 2) colors (full replace)
    if (Array.isArray(colors)) {
      await prisma.productColor.deleteMany({ where: { productId: id } });
      if (colors.length) {
        await prisma.productColor.createMany({
          data: colors.map(hex => ({ productId: id, hex }))
        });
      }
    }

    // 3) variants (full replace)
    if (Array.isArray(variants)) {
      await prisma.productVariant.deleteMany({ where: { productId: id } });
      const rows = variants
        .map(v => normalizeVariantForCreate(v, id))
        .filter(v => v.size || v.colorHex || v.price != null || v.stock > 0 || v.sku);
      if (rows.length) await prisma.productVariant.createMany({ data: rows });
    }

    // 4) retour complet
    const p = await prisma.product.findUnique({
      where: { id },
      include: { category: true, images: true, colors: true, variants: true },
    });
    res.json(mapProductOut(p));
  } catch (e) { next(e); }
};

export const adminDeleteProduct = async (req, res, next) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
  } catch (e) { return next(e); }
  res.json({ ok: true });
};

/* ====== Images produit (UI admin) ======
   - POST   /api/admin/products/:id/files  (FormData "files")
   - DELETE /api/admin/products/:productId/images/:imageId
*/
export const adminUploadProductFiles = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) return res.status(400).json({ message: 'Aucun fichier' });

    // Position actuelle (append en fin)
    const last = await prisma.productImage.findFirst({
      where: { productId }, orderBy: { position: 'desc' }
    });
    let pos = (last?.position ?? 0) + 1;

    const created = [];
    for (const f of files) {
      const url = fileToUrl(f);
      const img = await prisma.productImage.create({
        data: { productId, url, position: pos++ }
      });
      created.push(img);
    }
    res.status(201).json({ images: created });
  } catch (e) { next(e); }
};

export const adminDeleteProductImage = async (req, res, next) => {
  try {
    const { productId, imageId } = req.params;
    const img = await prisma.productImage.findUnique({ where: { id: imageId } });
    if (!img || img.productId !== productId) return res.status(404).json({ message: 'Image introuvable' });
    await prisma.productImage.delete({ where: { id: imageId } });
    res.json({ ok: true });
  } catch (e) { next(e); }
};

/* =========================================
   UTILISATEURS
   ========================================= */
export const adminListUsers = async (req, res, next) => {
  try {
    const { q = '' } = req.query;
    const where = q
      ? {
          OR: [
            { email: { contains: String(q), mode: 'insensitive' } },
            { firstName: { contains: String(q), mode: 'insensitive' } },
            { lastName: { contains: String(q), mode: 'insensitive' } },
          ],
        }
      : {};
    const users = await prisma.user.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json(users);
  } catch (e) { next(e); }
};

/* =========================================
   COMMANDES
   ========================================= */
export const adminListOrders = async (req, res, next) => {
  try {
    const rows = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
        items: {
          include: {
            variant: true,
            product: { select: { title: true } },
          },
        },
      },
    });

    const orders = rows.map((o) => ({
      ...o,
      items: o.items.map((it) => {
        const title = it.title || it.product?.title || 'Produit';
        const color =
          it.colorHex ??
          it.hex ??
          it.color ??
          it.variant?.colorHex ??
          it.variant?.hex ??
          it.variant?.color ??
          null;
        const size = it.size ?? it.variant?.size ?? null;

        return {
          id: it.id,
          title,
          quantity: it.quantity ?? 1,
          unitPrice: it.unitPrice ?? null,
          variant: [color, size].filter(Boolean).join(' · ') || null,
        };
      }),
    }));

    res.json(orders);
  } catch (e) { next(e); }
};

/* =========================================
   SONDAGES (admin)
   ========================================= */
export const adminListSurveys = async (req, res, next) => {
  try {
    const rows = await prisma.surveyResponse.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(rows);
  } catch (e) { next(e); }
};
export const adminSurveyStats = async (req, res, next) => {
  try {
    const total = await prisma.surveyResponse.count();
    const keys = ['MUGS_COLORFUL','PLATES_MINIMAL','BOWLS_GENEROUS'];
    const breakdown = {};
    for (const k of keys) {
      breakdown[k] = await prisma.surveyResponse.count({ where: { choice: k } });
    }
    res.json({ total, breakdown });
  } catch (e) { next(e); }
};

/* =========================================
   ANALYTICS (admin)
   - GET /api/admin/analytics/summary
   - GET /api/admin/analytics/funnel
   - GET /api/admin/analytics/top-products
   (Events front: /api/track → PAGE_VIEW, PRODUCT_VIEW, ADD_TO_CART, BEGIN_CHECKOUT, PURCHASE)
   ========================================= */
export const adminAnalyticsSummary = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const where = {};
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to)   where.createdAt.lte = new Date(to);
    }

    // Sessions = nb de sessionId distincts
    const sessions = await prisma.trackingEvent.groupBy({
      by: ['sessionId'],
      where,
      _count: { sessionId: true }
    });

    // Visitors = nb de userId distincts (si tu logges userId)
    const visitors = await prisma.trackingEvent.groupBy({
      by: ['userId'],
      where: { ...where, userId: { not: null } },
      _count: { userId: true }
    });

    // CA (centimes) = somme des PURCHASE.value
    const purchasesAgg = await prisma.trackingEvent.aggregate({
      _sum: { value: true },
      where: { ...where, type: 'PURCHASE' }
    });

    const purchasesCount = await prisma.trackingEvent.count({
      where: { ...where, type: 'PURCHASE' }
    });

    const sessionsCount = sessions.length;
    const conversionRate = sessionsCount ? purchasesCount / sessionsCount : 0;

    res.json({
      visitors: visitors.length,
      sessions: sessionsCount,
      revenue: Number(purchasesAgg._sum.value || 0),
      conversionRate
    });
  } catch (e) { next(e); }
};

export const adminAnalyticsFunnel = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const where = {};
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to)   where.createdAt.lte = new Date(to);
    }

    const productViews   = await prisma.trackingEvent.count({ where: { ...where, type: 'PRODUCT_VIEW' } });
    const addToCarts     = await prisma.trackingEvent.count({ where: { ...where, type: 'ADD_TO_CART' } });
    const beginCheckouts = await prisma.trackingEvent.count({ where: { ...where, type: 'BEGIN_CHECKOUT' } });
    const purchases      = await prisma.trackingEvent.count({ where: { ...where, type: 'PURCHASE' } });

    res.json({ productViews, addToCarts, beginCheckouts, purchases });
  } catch (e) { next(e); }
};

export const adminAnalyticsTopProducts = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const where = {};
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to)   where.createdAt.lte = new Date(to);
    }

    // Vues
    const views = await prisma.trackingEvent.groupBy({
      by: ['productId'],
      where: { ...where, type: 'PRODUCT_VIEW', productId: { not: null } },
      _count: { productId: true }
    });

    // Add to cart
    const atc = await prisma.trackingEvent.groupBy({
      by: ['productId'],
      where: { ...where, type: 'ADD_TO_CART', productId: { not: null } },
      _count: { productId: true }
    });

    // Achats + revenue
    const buys = await prisma.trackingEvent.groupBy({
      by: ['productId'],
      where: { ...where, type: 'PURCHASE', productId: { not: null } },
      _count: { productId: true },
      _sum: { value: true }
    });

    // Favoris (si tu logges 'FAVORITE', sinon on renvoie 0 sans casser)
    const favs = await prisma.trackingEvent.groupBy({
      by: ['productId'],
      where: { ...where, type: 'FAVORITE', productId: { not: null } },
      _count: { productId: true }
    }).catch(() => []);

    // Agrégation
    const idx = new Map();
    const ensure = (id) => {
      id = String(id);
      if (!idx.has(id)) idx.set(id, { productId: id, views:0, addToCarts:0, purchases:0, favorites:0, revenue:0 });
      return idx.get(id);
    };

    for (const r of views) ensure(r.productId).views = r._count.productId || 0;
    for (const r of atc) ensure(r.productId).addToCarts = r._count.productId || 0;
    for (const r of buys) {
      const row = ensure(r.productId);
      row.purchases = r._count.productId || 0;
      row.revenue   = Number(r._sum.value || 0);
    }
    for (const r of favs) ensure(r.productId).favorites = r._count.productId || 0;

    const list = Array.from(idx.values()).sort((a,b)=> b.revenue - a.revenue).slice(0, 50);

    // Joindre le titre pour affichage
    const ids = list.map(x => x.productId);
    const products = ids.length
      ? await prisma.product.findMany({ where: { id: { in: ids } }, select: { id:true, title:true } })
      : [];
    const titleById = Object.fromEntries(products.map(p => [String(p.id), p.title]));
    res.json(list.map(x => ({ ...x, title: titleById[String(x.productId)] || x.productId })));
  } catch (e) { next(e); }
};
