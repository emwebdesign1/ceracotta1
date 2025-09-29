import { PrismaClient } from '@prisma/client';
import { toHex } from '../utils/colors.js';
const prisma = new PrismaClient();

function normHex(v) {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  return s ? (s.startsWith('#') ? s : `#${s}`) : null;
}

function mapProduct(p) {
  // 1) images générales (ProductImage[])
  const images = (p.images || [])
    .sort((a, b) => a.position - b.position)
    .map(i => i.url);

  // 2) couleurs disponibles (depuis ProductColor + éventuelle couleur de variant)
  const colorHexesFromColors = (p.colors || [])
    .map(c => normHex(c.hex) || toHex(c.name))
    .filter(Boolean);

  const colorHexesFromVariants = (p.variants || [])
    .map(v => normHex(v.color) || toHex(v.color))
    .filter(Boolean);

  const colors = Array.from(new Set([...colorHexesFromColors, ...colorHexesFromVariants]));

  // 3) colorImageMap produit (depuis Image.colorHex SANS variantId)
  const colorImageMap = {};
  for (const img of (p.imagesLinked || [])) {
    if (img.colorHex && !img.variantId) {
      const key = normHex(img.colorHex);
      if (!key) continue;
      if (!colorImageMap[key]) colorImageMap[key] = [];
      colorImageMap[key].push(img.url);
    }
  }

  // 4) variantes enrichies (images génériques + images par couleur)
  const variants = (p.variants || []).map(v => {
    const imgs = (v.images || []).sort((a, b) => a.position - b.position);

    const generic = imgs
      .filter(i => !i.colorHex)        // uniquement les images sans couleur
      .map(i => i.url);

    const colorMap = {};
    for (const i of imgs) {
      if (i.colorHex) {
        const key = normHex(i.colorHex);
        if (!key) continue;
        if (!colorMap[key]) colorMap[key] = [];
        colorMap[key].push(i.url);
      }
    }

    const firstColorImg = Object.values(colorMap)[0]?.[0] || null;

    return {
      id: v.id,
      sku: v.sku,
      color: normHex(v.color) || toHex(v.color),
      size: v.size,
      price: v.price ?? p.price,
      stock: v.stock,
      images: generic,                         // images génériques de la variante
      colorImageMap: colorMap,                 // images de la variante par couleur
      primaryImageUrl: generic[0] || firstColorImg || null
    };
  });

  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    description: p.description,
    price: p.price,
    category: p.category ? { slug: p.category.slug, name: p.category.name } : null,
    images,                 // galerie "produit"
    colors,                 // pastilles HEX
    colorImageMap,          // 🔥 clé: "#hex" → [urls] (niveau produit)
    pieceDetail: p.pieceDetail ?? null,
    careAdvice: p.careAdvice ?? null,
    shippingReturn: p.shippingReturn ?? null,
    variants,               // avec images génériques + colorImageMap + primaryImageUrl
  };
}

export async function listProducts(req, res) {
  const { q = '', category, sort = '-createdAt', page = '1', limit = '12' } = req.query;
  const take = Math.max(1, parseInt(String(limit)));
  const skip = (Math.max(1, parseInt(String(page))) - 1) * take;

  const where = {};
  if (category) where.category = { slug: String(category) };
  if (q) {
    where.OR = [
      { title: { contains: String(q), mode: 'insensitive' } },
      { description: { contains: String(q), mode: 'insensitive' } },
    ];
  }

  const orderBy = sort.startsWith('-')
    ? { [sort.slice(1)]: 'desc' }
    : { [sort]: 'asc' };

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      skip,
      take,
      include: {
        images: true,              // ProductImage[]
        imagesLinked: true,        // Image[] (back-relation pour colorHex / variantId)
        colors: true,
        variants: { include: { images: true } }, // 🔥 images de variantes (avec colorHex possible)
        category: true
      }
    })
  ]);

  res.json({ items: rows.map(mapProduct), total });
}

export async function getProduct(req, res) {
  const { slug } = req.params;
  const p = await prisma.product.findUnique({
    where: { slug },
    include: {
      images: true,               // ProductImage[]
      imagesLinked: true,         // Image[] (colorHex / variantId potentiellement présents)
      colors: true,
      variants: { include: { images: true } }, // 🔥
      category: true
    }
  });
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(mapProduct(p));
}
