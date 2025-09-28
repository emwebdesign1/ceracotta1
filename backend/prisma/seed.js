// prisma/seed.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/* ---------------- Helpers ---------------- */
function toMultiline(arr) {
  return Array.isArray(arr) ? arr.join('\n') : null;
}
function normHex(v) {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  return s.startsWith('#') ? s : `#${s}`;
}

/* ---------------- Main ---------------- */
async function main() {
  const vasesCat = await prisma.category.upsert({
    where: { slug: 'vases' },
    update: {},
    create: { name: 'Vases', slug: 'vases' }
  });

  const vaisselleCat = await prisma.category.upsert({
    where: { slug: 'vaisselle' },
    update: {},
    create: { name: 'Vaisselle', slug: 'vaisselle' }
  });

  const products = [
    {
      slug: "vase-cosmo",
      title: "Vase Cosmo",
      description:
        "Le vase Nova ! Ses sphères organiques asymétriques transforment chaque espace en galerie d'art contemporain. Une pièce maîtresse qui sublime votre intérieur, avec ou sans bouquet.",
      price: 3500,
      colors: ["#ffffff"], // blanc
      images: [
        "/images/vase-cosmo1.jpg",
        "/images/vase-cosmo2.jpg",
        "/images/vase-cosmo3.jpg"
      ],
      pieceDetail: [
        "Pièce façonnée à la main",
        "Chaque exemplaire présente de légères variations naturelles, reflet de l’artisanat",
        "Fabriqué en grès naturel émaillé",
        "Cuit à haute température",
        "Sans plastique, sans production industrielle",
        "Dimensions : L14,5 cm | H17,3 cm",
        "Poids : ~600 g"
      ],
      care: [
        "Nettoyer avec un chiffon doux et sec",
        "Ne pas passer au lave-vaisselle ni immerger totalement",
        "Convient pour fleurs séchées ou fraîches (avec tube intérieur si besoin)"
      ],
      shipping: [
        "Livraison internationale 10–30 jours ouvrés",
        "Emballage protecteur éco-responsable 100% recyclable",
        "Retour accepté sous 14 jours (produit en parfait état)"
      ]
    },
    {
      slug: "vase-medusa",
      title: "Vase Medusa",
      description:
        "Un vase en céramique au design ondulé, disponible en blanc mat ou noir profond, qui apporte une touche élégante et contemporaine à tout intérieur.",
      price: 4000,
      variants: [
        { size: "Petit", price: 4000, pieceDetail: ["Calibre 2,3 cm – Largeur 14,4 cm – Hauteur 12,6 cm", "Poids ~500 g"] },
        { size: "Grand", price: 4500, pieceDetail: ["Calibre 4,2 cm – Largeur 17 cm – Hauteur 17 cm", "Poids ~800 g"] }
      ],
      colors: ["#ffffff", "#000000"],
      images: [
        "/images/vase-medusa-blanc.jpg",
        "/images/vase-medusa-noir.jpg",
      ],
      pieceDetail: [
        "Pièce façonnée à la main",
        "Chaque exemplaire présente de légères variations naturelles, reflet de l’artisanat",
        "Fabriqué en grès naturel émaillé",
        "Cuit à haute température",
        "Sans plastique, sans production industrielle"
      ],
      care: [
        "Nettoyer avec un chiffon doux et sec",
        "Ne pas passer au lave-vaisselle ni immerger totalement",
        "Convient pour fleurs séchées ou fraîches (avec tube intérieur si besoin)"
      ],
      shipping: [
        "Livraison internationale 10–30 jours ouvrés",
        "Emballage protecteur éco-responsable 100% recyclable",
        "Retour accepté sous 14 jours"
      ]
    },
    {
      slug: "vase-terralumiere",
      title: "Vase Terralumière asymétrique",
      description:
        "La définition de l’élégance de l’Imperfection Parfaite. Son blanc pur et intemporel s’accorde avec les styles scandinave, bohème chic ou contemporain. Modèle en deux pièces détachées.",
      price: 4500,
      colors: ["#ffffff"],
      images: [
        "/images/vase-terralumiere1.jpg",
      ],
      pieceDetail: [
        "Pièce façonnée à la main (2 pièces détachées)",
        "Chaque exemplaire présente de légères variations naturelles",
        "Fabriqué en grès naturel émaillé",
        "Cuit à haute température",
        "Sans plastique, sans production industrielle",
        "Dimensions : Hauteur 28 cm | Largeur max 20 cm | Ouverture 8 cm | Base 15×12 cm"
      ],
      care: [
        "Nettoyer avec un chiffon doux et sec",
        "Ne pas passer au lave-vaisselle ni immerger totalement",
        "Convient pour fleurs séchées ou fraîches (avec tube intérieur si besoin)"
      ],
      shipping: [
        "Livraison internationale 10–30 jours ouvrés",
        "Emballage protecteur éco-responsable 100% recyclable",
        "Retour accepté sous 14 jours"
      ]
    },
    {
      slug: "vase-abla",
      title: "Vase ABLA",
      description:
        "Vase en céramique rayée : élégance moderne et raffinement artisanal. Motifs rayés délicats qui captent la lumière avec subtilité. Trois coloris intemporels : blanc-gris, anthracite, tons terreux.",
      price: 5500,
      variants: [
        { size: "Petit", price: 5500 },
        { size: "Moyen", price: 6000 },
        { size: "Grand", price: 6500 }
      ],
      colors: ["#dcdcdc", "#333333", "#a0522d"],
      images: [
        "/images/abla-1.jpg",
        "/images/abla-2.jpg",
        "/images/abla-3.jpg"
      ],
      pieceDetail: [
        "Pièce façonnée à la main avec motifs rayés appliqués individuellement",
        "Variations naturelles dans les rayures, reflet de l’artisanat",
        "Grès naturel émaillé haute qualité",
        "Cuit à haute température",
        "Sans plastique, création artisanale authentique",
        "Dimensions de référence : Hauteur 28 cm | Largeur max 20 cm | Ouverture 8 cm | Base 15×12 cm"
      ],
      care: [
        "Nettoyer avec un chiffon doux et sec pour préserver les motifs",
        "Ne pas passer au lave-vaisselle ni immerger totalement",
        "Convient pour fleurs séchées ou fraîches (avec tube intérieur si besoin)"
      ],
      shipping: [
        "Livraison internationale 10–30 jours ouvrés",
        "Emballage protecteur éco-responsable 100% recyclable",
        "Retour accepté sous 14 jours"
      ]
    },
    {
      slug: "vase-blancheneige",
      title: "Vase Blancheneige",
      description:
        "Blanc pur mat et intemporel. Collection avec trois formes complémentaires pour des compositions harmonieuses.",
      price: 5500,
      variants: [
        { size: "Petit", price: 5500, pieceDetail: ["Hauteur 15 cm"] },
        { size: "Moyen", price: 6000, pieceDetail: ["Hauteur 20 cm"] },
        { size: "Grand", price: 6500, pieceDetail: ["Hauteur 28 cm"] }
      ],
      colors: ["#ffffff"],
      images: [
        "/images/blancheneige-1.jpg",
        "/images/blancheneige-2.jpg",
        "/images/blancheneige-3.jpg"
      ],
      pieceDetail: [
        "Pièce façonnée à la main avec texture naturelle unique",
        "Chaque exemplaire présente de légères variations dans la texture",
        "Grès naturel finition mate texturée",
        "Cuit à haute température",
        "Sans plastique, création artisanale authentique",
        "Largeur max 20 cm | Ouverture 8 cm | Base 15×12 cm"
      ],
      care: [
        "Nettoyer avec un chiffon doux et sec pour préserver la texture",
        "Ne pas passer au lave-vaisselle ni immerger totalement",
        "Convient pour fleurs séchées ou fraîches (avec tube intérieur si besoin)"
      ],
      shipping: [
        "Livraison internationale 10–15 jours ouvrés",
        "Emballage protecteur éco-responsable 100% recyclable",
        "Retour accepté sous 14 jours"
      ]
    }
  ];

  for (const p of products) {
    const variantExtraLines =
      (p.variants || [])
        .flatMap(v => v.pieceDetail || [])
        .map(line => `• ${line}`);
    const pieceDetailLines = [
      ...(p.pieceDetail || []),
      ...(variantExtraLines || [])
    ];

    // Upsert produit (images/couleurs/variants créés à la création)
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        title: p.title,
        description: p.description,
        price: p.price,
        category: { connect: { id: vasesCat.id } },
        pieceDetail: toMultiline(pieceDetailLines),
        careAdvice: toMultiline(p.care),
        shippingReturn: toMultiline(p.shipping),
        // ⚠️ on laisse images/couleurs/variants gérés à la création pour éviter les doublons
      },
      create: {
        title: p.title,
        slug: p.slug,
        description: p.description,
        price: p.price,
        category: { connect: { id: vasesCat.id } },
        pieceDetail: toMultiline(pieceDetailLines),
        careAdvice: toMultiline(p.care),
        shippingReturn: toMultiline(p.shipping),

        // IMAGES (galerie produit – ProductImage)
        images: {
          create: (p.images || []).map((url, idx) => ({
            url,
            position: idx
          }))
        },

        // COULEURS (ProductColor)
        colors: {
          create: (p.colors || []).map(hex => ({ hex: normHex(hex) }))
        },

        // VARIANTS (taille/prix de base)
        variants: {
          create: (p.variants || []).map(v => ({
            size: v.size || null,
            price: v.price ?? null,
            color: null, // on laisse la couleur au niveau ProductColor
            stock: 0,
            sku: null
          }))
        }
      }
    });

    /* ---------- Liaisons Image <-> Couleur / Variante selon les cas ---------- */

    const hasColors = Array.isArray(p.colors) && p.colors.length > 0;
    const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
    const hasImages = Array.isArray(p.images) && p.images.length > 0;

    const colors = (p.colors || []).map(normHex);
    const variants = hasVariants
      ? await prisma.variant.findMany({ where: { productId: product.id }, orderBy: { id: 'asc' } })
      : [];

    // 1) Cas: variantes ont leurs propres images (v.images)
    if (hasVariants) {
      for (const v of p.variants) {
        if (Array.isArray(v.images) && v.images.length) {
          const variantRow = await prisma.variant.findFirst({
            where: { productId: product.id, size: v.size || null }
          });
          if (variantRow) {
            // seed idempotent
            await prisma.image.deleteMany({ where: { variantId: variantRow.id } });
            await prisma.image.createMany({
              data: v.images.map((url, idx) => ({
                url,
                position: idx,
                variantId: variantRow.id
              }))
            });
          }
        }
      }
    }

    // 2) Cas: parité COULEURS <-> IMAGES => lier colorHex
    if (hasColors && hasImages && colors.length === p.images.length) {
      // purge images colorées existantes pour idempotence
      await prisma.image.deleteMany({
        where: { productId: product.id, colorHex: { not: null } }
      });

      // si parité TAILLES aussi, on liera à la fois colorHex + variantId (voir plus bas)
      // sinon, on crée déjà l'entrée colorée simple ici
      if (!(hasVariants && variants.length === p.images.length)) {
        await prisma.image.createMany({
          data: p.images.map((url, idx) => ({
            url,
            position: idx,
            productId: product.id,
            colorHex: colors[idx]
          }))
        });
      }
    }

    // 3) Cas: parité TAILLES <-> IMAGES et AUCUNE variante n’a v.images
    const noVariantHasOwnImages = hasVariants
      ? !(p.variants || []).some(v => Array.isArray(v.images) && v.images.length)
      : true;

    if (hasVariants && hasImages && variants.length === p.images.length && noVariantHasOwnImages) {
      // purge images de variantes existantes pour idempotence
      await prisma.image.deleteMany({
        where: { variantId: { in: variants.map(v => v.id) } }
      });

      // Si parité COULEURS aussi → on lie la même image à la fois à la couleur ET à la variante (une seule ligne, deux colonnes)
      if (hasColors && colors.length === p.images.length) {
        const data = p.images.map((url, idx) => ({
          url,
          position: idx,
          productId: product.id,
          variantId: variants[idx].id,
          colorHex: colors[idx]
        }));
        await prisma.image.createMany({ data });
      } else {
        // Sinon on lie juste aux variantes
        const data = p.images.map((url, idx) => ({
          url,
          position: idx,
          variantId: variants[idx].id
        }));
        await prisma.image.createMany({ data });
      }
    }

    // 4) Cas: ni parité couleurs, ni parité tailles → rien à faire ici,
    // le front utilisera la galerie produit en fallback.
  }
}

main()
  .then(() => console.log("Seed OK ✅"))
  .catch(e => {
    console.error("Seed error ❌", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
