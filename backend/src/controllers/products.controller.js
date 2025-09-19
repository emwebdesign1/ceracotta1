import { PrismaClient } from '@prisma/client';
import { toHex } from '../utils/colors.js';
const prisma = new PrismaClient();

function mapProduct(p) {
  const images = (p.images || [])
    .sort((a, b) => a.position - b.position)
    .map(i => i.url);

  const colorHexesFromColors = (p.colors || [])
    .map(c => c.hex || toHex(c.name))
    .filter(Boolean);

  const colorHexesFromVariants = (p.variants || [])
    .map(v => toHex(v.color))
    .filter(Boolean);

  const colors = Array.from(new Set([...colorHexesFromColors, ...colorHexesFromVariants]));

  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    description: p.description,
    price: p.price,
    category: p.category ? { slug: p.category.slug, name: p.category.name } : null,
    images,
    colors, // <— HEX pour tes pastilles
    pieceDetail: p.pieceDetail ?? null,
    careAdvice: p.careAdvice ?? null,
    shippingReturn: p.shippingReturn ?? null,
    variants: (p.variants || []).map(v => ({
      id: v.id, sku: v.sku, color: toHex(v.color), size: v.size,
      price: v.price ?? p.price, stock: v.stock
    })),
  };
}

export async function listProducts(req, res) {
  const { q = '', category, sort = '-createdAt', page = '1', limit = '12' } = req.query;
  const take = Math.max(1, parseInt(String(limit)));
  const skip = (Math.max(1, parseInt(String(page))) - 1) * take;

  const where = {};
  if (category) where.category = { slug: String(category) }; // filtre par slug de catégorie
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
      where, orderBy, skip, take,
      include: { images: true, colors: true, variants: true, category: true }
    })
  ]);

  res.json({ items: rows.map(mapProduct), total });
}

export async function getProduct(req, res) {
  const { slug } = req.params;
  const p = await prisma.product.findUnique({
    where: { slug },
    include: { images: true, colors: true, variants: true, category: true }
  });
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(mapProduct(p));
}
