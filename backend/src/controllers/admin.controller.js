import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();



// CREATE
export const adminCreateProduct = async (req, res, next) => {
  try {
    const {
      title, slug, description,
      pieceDetail, careAdvice, shippingReturn,
      price, stock, categorySlug,
      colors = [] // ← NEW
    } = req.body;

    const category = categorySlug
      ? await prisma.category.findUnique({ where: { slug: categorySlug } })
      : null;

    const p = await prisma.product.create({
      data: {
        title,
        slug,
        description,
        pieceDetail: pieceDetail || null,
        careAdvice: careAdvice || null,
        shippingReturn: shippingReturn || null,
        price: Number(price),
        stock: Number(stock),
        ...(category ? { category: { connect: { id: category.id } } } : {}),
        // ← NEW: créer les couleurs si fournies
        colors: Array.isArray(colors) && colors.length
          ? { create: colors.map((hex) => ({ hex })) }
          : undefined
      },
      include: { colors: true } // utile pour le retour immédiat
    });

    res.status(201).json(p);
  } catch (e) { next(e); }
};

// UPDATE (id = string CUID)
export const adminUpdateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      categorySlug, price, stock,
      colors,               // ← NEW
      ...data
    } = req.body;

    if (categorySlug) {
      const c = await prisma.category.findUnique({ where: { slug: categorySlug } });
      data.categoryId = c?.id ?? null;
    }
    if (price != null) data.price = Number(price);
    if (stock != null) data.stock = Number(stock);

    // 1) Update des champs simples
    const base = await prisma.product.update({ where: { id }, data });

    // 2) Si colors fourni : on remplace l’ensemble
    if (Array.isArray(colors)) {
      await prisma.productColor.deleteMany({ where: { productId: id } });
      if (colors.length) {
        await prisma.productColor.createMany({
          data: colors.map((hex) => ({ productId: id, hex }))
        });
      }
    }

    // 3) Retour complet (avec couleurs)
    const p = await prisma.product.findUnique({
      where: { id },
      include: { colors: true }
    });
    res.json(p);
  } catch (e) { next(e); }
};


// DELETE (id = string CUID)
export const adminDeleteProduct = async (req, res, next) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
};

// ORDERS
export const adminListOrders = async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: { items: true, user: true }
    });
    res.json(orders);
  } catch (e) { next(e); }
};

// USERS
export const adminListUsers = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(users);
  } catch (e) { next(e); }
};

// PRODUCTS (list)
export const adminListProducts = async (req, res, next) => {
  try {
    const { q = '' } = req.query;

    const where = q
      ? {
        OR: [
          { title: { contains: String(q), mode: 'insensitive' } },
          { slug: { contains: String(q), mode: 'insensitive' } },
          { description: { contains: String(q), mode: 'insensitive' } },
        ]
      }
      : {};

    const rows = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        images: true,
        variants: true,
        colors: true
      }
    });

    const list = rows.map(p => {
      const images = (p.images || [])
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map(i => ({ id: i.id, url: i.url }));


      const colors = (p.colors || []).map(c => c.hex).filter(Boolean);

      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        description: p.description,
        pieceDetail: p.pieceDetail,
        careAdvice: p.careAdvice,
        shippingReturn: p.shippingReturn,
        price: p.price,
        stock: p.stock ?? 0,
        category: p.category?.slug ?? null,
        images,
        colors,
        variants: (p.variants || []).map(v => ({
          id: v.id,
          size: v.size,
          color: v.color,
          price: v.price ?? null,
          stock: v.stock ?? 0
        }))
      };
    });

    res.json(list);
  } catch (e) { next(e); }
};

// ============ ANALYTICS ============

// Résumé global
export const analyticsSummary = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const whereDate = (tbl) => (from || to)
      ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to + 'T23:59:59') } : {}) } }
      : {};

    // visiteurs/sessions (si pas encore d'événements => 0)
    const [visitors, sessions] = await Promise.all([
      prisma.visitor.count(),
      prisma.session.count(),
    ]);

    // achats & CA (basé sur Order)
    const orders = await prisma.order.findMany({
      where: whereDate('order'),
      select: { id: true, amount: true }
    });
    const purchases = orders.length;
    const revenue = orders.reduce((s, o) => s + (o.amount || 0), 0);

    // product views approximatives via Event
    const productViews = await prisma.event.count({
      where: { type: 'PRODUCT_VIEW', ...(from || to ? { createdAt: whereDate().createdAt } : {}) }
    });

    const conversionRate = productViews ? purchases / productViews : null;

    res.json({ visitors, sessions, purchases, revenue, productViews, conversionRate });
  } catch (e) { next(e); }
};

// Funnel simple
export const analyticsFunnel = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const createdAt = (from || to)
      ? { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to + 'T23:59:59') } : {}) }
      : undefined;

    const whereEv = (type) => ({ type, ...(createdAt ? { createdAt } : {}) });

    const [productViews, addToCarts, beginCheckouts] = await Promise.all([
      prisma.event.count({ where: whereEv('PRODUCT_VIEW') }),
      prisma.event.count({ where: whereEv('ADD_TO_CART') }),
      prisma.event.count({ where: whereEv('BEGIN_CHECKOUT') }),
    ]);

    const purchases = await prisma.order.count({
      where: (from || to) ? { createdAt } : {}
    });

    res.json({ productViews, addToCarts, beginCheckouts, purchases });
  } catch (e) { next(e); }
};

// Top produits (vues/ATC/achats/revenu)
export const analyticsTopProducts = async (req, res, next) => {
  try {
    const { from, to, limit = 10 } = req.query;
    const createdAt = (from || to)
      ? { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to + 'T23:59:59') } : {}) }
      : undefined;

    // 1) agrégats journaliers si existants
    const daily = await prisma.dailyProductStat.groupBy({
      by: ['productId'],
      _sum: { views: true, addToCarts: true, purchases: true, revenue: true, favorites: true },
      where: (from || to) ? { date: { gte: new Date(from), lte: new Date(to || from) } } : undefined
    });


    // 2) fallback achats/revenu depuis OrderItem si jamais daily vide
    let map = new Map(daily.map(d => [d.productId, {
      views: d._sum.views || 0,
      addToCarts: d._sum.addToCarts || 0,
      purchases: d._sum.purchases || 0,
      revenue: d._sum.revenue || 0,
      favorites: d._sum.favorites || 0
    }]));

    if (!daily.length) {
      const items = await prisma.orderItem.findMany({
        where: (from || to) ? { order: { createdAt } } : {},
        select: { productId: true, quantity: true, unitPrice: true }
      });
      map = new Map();
      for (const it of items) {
        const e = map.get(it.productId) || { views: 0, addToCarts: 0, purchases: 0, revenue: 0 };
        e.purchases += it.quantity || 0;
        e.revenue += (it.unitPrice || 0) * (it.quantity || 0);
        map.set(it.productId, e);
      }
    }

    const products = await prisma.product.findMany({
      where: { id: { in: Array.from(map.keys()) } },
      select: { id: true, title: true }
    });

    const result = products.map(p => ({
      productId: p.id,
      title: p.title,
      ...(map.get(p.id) || { views: 0, addToCarts: 0, purchases: 0, revenue: 0 })
    }))
      .sort((a, b) => (b.revenue - a.revenue) || (b.purchases - a.purchases))
      .slice(0, Number(limit));

    res.json(result);
  } catch (e) { next(e); }
};
