// /js/ui/favoritesPanel.js
import { getFavorites, addFavorite, authHeaders } from '/js/state.js';
import { getProductBySlug, addToCart } from '/js/api.js';
import { openCartPanel } from '/js/ui/cartPanel.js';

/* ---------- Utils ---------- */
function CHF(cents) {
  return `CHF ${(Number(cents || 0) / 100).toFixed(2)}`;
}
function firstImage(p) {
  const imgs = Array.isArray(p?.images) ? p.images : [];
  if (!imgs.length) return '/images/bols.png';
  const it = imgs[0];
  return typeof it === 'string' ? it : (it?.url || '/images/bols.png');
}

/* ---------- API serveur ---------- */
async function wishlistToggleServer({ productId, variantId = null, color = null, size = null }) {
  const r = await fetch('/api/wishlist/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ productId, variantId, color, size }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e?.error || 'Wishlist toggle failed');
  }
  return r.json(); // { favored: boolean }
}

/* ---------- Mount panel ---------- */
export async function mountFavoritesPanel() {
  const root = document.getElementById('panel-favoris');
  if (!root) return;
  if (root.dataset.mounted === 'true') return;
  root.dataset.mounted = 'true';

  if (!root.querySelector('.content')) {
    root.insertAdjacentHTML('beforeend', `<div class="content"></div>`);
  }

  async function render() {
    const content = root.querySelector('.content');

    // favoris = [{ slug, color, size }]
    const favs = getFavorites() || [];
    const slugs = Array.from(new Set(favs.map(f => f?.slug).filter(Boolean)));

    if (!slugs.length) {
      content.innerHTML = `<div class="fav-empty"><p>Aucun favori.</p></div>`;
      return;
    }

    // Récupération produits complets
    const prods = (await Promise.all(
      slugs.map(async s => {
        try { return await getProductBySlug(s); }
        catch { return null; }
      })
    )).filter(Boolean);

    if (!prods.length) {
      content.innerHTML = `<div class="fav-empty"><p>Aucun favori valide.</p></div>`;
      return;
    }

    // Mapping des favoris avec leur config (couleur, taille)
    const favDetails = favs.map(f => {
      const prod = prods.find(p => p.slug === f.slug);
      return prod ? { ...f, product: prod } : null;
    }).filter(Boolean);

    content.innerHTML = `
      <div class="fav-header">
        <h2>Mes favoris</h2>
        <span class="fav-count">${favDetails.length} article${favDetails.length > 1 ? 's' : ''}</span>
      </div>
      <ul class="fav-list">
        ${favDetails.map(f => {
          const p = f.product;
          const img = firstImage(p);
          const colorDot = f.color
            ? `<span class="color-dot" style="background:${f.color};border:1px solid #aaa;"></span>`
            : '';
          const sizeTag = f.size
            ? `<span class="size-tag">${f.size}</span>`
            : '';
          return `
          <li class="fav-item" data-slug="${p.slug}" data-color="${f.color || ''}" data-size="${f.size || ''}">
            <a class="thumb" href="/produit.html?slug=${encodeURIComponent(p.slug)}" title="${p.title || 'Produit'}">
              <img src="${img}" alt="${p.title || 'Produit'}">
            </a>
            <div class="meta">
              <a class="title" href="/produit.html?slug=${encodeURIComponent(p.slug)}">${p.title || 'Produit'}</a>
              <div class="price">${CHF(p.price)}</div>
              <div class="variant-info">
                ${colorDot}
                ${sizeTag}
              </div>
              <div class="row">
                <button class="btn ghost add" data-slug="${p.slug}">Ajouter au panier</button>
                <button class="btn danger rm" aria-label="Retirer des favoris">♥ Retirer</button>
              </div>
            </div>
          </li>`;
        }).join('')}
      </ul>
    `;

    // ---- Ajouter au panier
    content.querySelectorAll('.add').forEach(btn => {
      btn.addEventListener('click', async () => {
        const li = btn.closest('.fav-item');
        const slug = li?.dataset.slug;
        const color = li?.dataset.color || null;
        const size = li?.dataset.size || null;
        const f = favDetails.find(x => x.product.slug === slug);
        if (!f?.product?.id) return alert('Produit introuvable.');

        try {
          await addToCart({
            productId: f.product.id,
            quantity: 1,
            variantId: f.product.variants?.find(v => v.size === size)?.id || null,
            title: f.product.title,
            unitPrice: f.product.price,
            slug: f.product.slug,
            image: firstImage(f.product),
            color,
            size
          });
          document.dispatchEvent(new CustomEvent('cart:changed'));
          await openCartPanel();
        } catch (err) {
          alert(err?.message || 'Erreur ajout panier');
        }
      });
    });

    // ---- Retirer un favori
    content.querySelectorAll('.rm').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const li = e.currentTarget.closest('.fav-item');
        const slug = li?.dataset.slug;
        const color = li?.dataset.color || null;
        const size = li?.dataset.size || null;
        const fav = favDetails.find(x => x.product.slug === slug);
        if (!fav) return;

        try {
          if (fav.product?.id) {
            await wishlistToggleServer({
              productId: fav.product.id,
              variantId: fav.product.variants?.find(v => v.size === size)?.id || null,
              color,
              size
            });
          }
        } catch (err) {
          console.warn('wishlist toggle server failed', err);
        }

        // toggle local (mise à jour immédiate)
        addFavorite({ slug, color, size });
        document.dispatchEvent(new CustomEvent('fav:changed'));
      });
    });
  }
  

  document.addEventListener('fav:changed', render);
  render();
}
