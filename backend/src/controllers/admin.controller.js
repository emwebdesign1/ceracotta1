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
