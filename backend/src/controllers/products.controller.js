// controllers/products.controller.js
import prisma from '../lib/prisma.js';


import { toHex } from '../utils/colors.js';





/* -------------------- UTILITAIRES -------------------- */
function normHex(v) {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  return s.startsWith('#') ? s : `#${s}`;
}

function toMultiline(arr) {
  return Array.isArray(arr) ? arr.join('\n') : null;
}

/* -------------------- MAPPING PRODUIT -------------------- */
function mapProduct(p) {
  // Galerie principale du produit
  const images = (p.image || [])
    .sort((a, b) => a.position - b.position)
    .map(i => i.url);

  // Couleurs disponibles
  const colorHexes = (p.productcolor || [])
    .map(c => normHex(c.hex) || toHex(c.name))
    .filter(Boolean);

  // Map d’images associées à chaque couleur
  const colorImageMap = {};
  for (const img of p.image || []) {
    if (img.colorHex) {
      const key = normHex(img.colorHex);
      if (!colorImageMap[key]) colorImageMap[key] = [];
      colorImageMap[key].push(img.url);
    }
  }

  // Variantes enrichies
  const variants = (p.variant || []).map(v => {
    const imgs = (v.image || []).sort((a, b) => a.position - b.position);
    const colorMap = {};
    for (const i of imgs) {
      if (i.colorHex) {
        const key = normHex(i.colorHex);
        if (!colorMap[key]) colorMap[key] = [];
        colorMap[key].push(i.url);
      }
    }
    const primary = imgs.find(i => !i.colorHex)?.url || Object.values(colorMap)[0]?.[0] || null;
   
    return {
      id: v.id,
      sku: v.sku,
      size: v.size,
      price: v.price ?? p.price,
      stock: v.stock,
      color: normHex(v.color),
      images: imgs.map(i => i.url),
      colorImageMap: colorMap,
      primaryImageUrl: primary
    };
  });

  
      const totalStock =
    (p.stock ?? 0) +
    variants.reduce((sum, v) => sum + (v.stock ?? 0), 0);

  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    description: p.description,
    price: p.price,
    category: p.category ? { slug: p.category.slug, name: p.category.name } : null,
    images,
    colors: colorHexes,
    colorImageMap,
    pieceDetail: p.pieceDetail ?? null,
    careAdvice: p.careAdvice ?? null,
    shippingReturn: p.shippingReturn ?? null,
    variants,
        stock: p.stock ?? 0,        // ← ajoute cette ligne
    totalStock, 
    createdAt: p.createdAt,
  };
}

/* -------------------- LISTE PRODUITS -------------------- */
export async function listProducts(req, res) {
  try {
    const { q = '', category, color, minPrice, maxPrice, sort = '-createdAt', page = '1', limit = '12' } = req.query;

    const take = Math.max(1, parseInt(String(limit)));
    const skip = (Math.max(1, parseInt(String(page))) - 1) * take;

    // Construction dynamique du WHERE
    const where = {};
    if (category) where.category = { slug: String(category) };
    if (q) {
      where.OR = [
        { title: { contains: String(q), mode: 'insensitive' } },
        { description: { contains: String(q), mode: 'insensitive' } },
      ];
    }
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseInt(minPrice);
      if (maxPrice) where.price.lte = parseInt(maxPrice);
    }
    if (color) {
      where.productcolor = { some: { hex: { equals: normHex(color) } } };
    }

    // Tri dynamique
    const orderBy = sort.startsWith('-')
      ? { [sort.slice(1)]: 'desc' }
      : { [sort]: 'asc' };

    // Requête principale
    const [total, rows] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          image: true,
          productcolor: true,
          variant: { include: { image: true } },
          category: true,
        }
      })
    ]);

    // Transformation finale
    const items = rows.map(mapProduct);
    res.json({
      items,
      total,
      page: Number(page),
      pages: Math.ceil(total / take),
      count: items.length,
    });
  } catch (error) {
    console.error('❌ listProducts error:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

/* -------------------- PRODUIT UNIQUE -------------------- */
export async function getProduct(req, res) {
  try {
    const { slug } = req.params;
    const p = await prisma.product.findUnique({
      where: { slug },
      include: {
        image: true,
        productcolor: true,
        variant: { include: { image: true } },
        category: true
      }
    });
    if (!p) return res.status(404).json({ error: 'Produit non trouvé' });
    res.json(mapProduct(p));
  } catch (error) {
    console.error('❌ getProduct error:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}
