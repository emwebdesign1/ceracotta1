// /js/ui/favoritesPanel.js
import { getFavorites, addFavorite } from '/js/state.js';
import { getProductBySlug, addToCart } from '/js/api.js';
import { openCartPanel } from '/js/ui/cartPanel.js';

function CHF(cents){ return `CHF ${(Number(cents||0)/100).toFixed(2)}`; }
function firstImage(p) {
  const imgs = Array.isArray(p?.images) ? p.images : [];
  if (!imgs.length) return '/images/bols.png';
  const it = imgs[0];
  return typeof it === 'string' ? it : (it?.url || '/images/bols.png');
}

// Appel serveur: toggle wishlist (utilisé au retrait depuis le panneau)
async function wishlistToggleServer(productId){
  const r = await fetch('/api/wishlist/toggle', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    credentials: 'include',
    body: JSON.stringify({ productId })
  });
  if (!r.ok) {
    const e = await r.json().catch(()=> ({}));
    throw new Error(e?.error || 'Wishlist toggle failed');
  }
  return r.json(); // { favored: boolean }
}

export async function mountFavoritesPanel(){
  const root = document.getElementById('panel-favoris');
  if (!root) return;
  if (root.dataset.mounted === 'true') return;
  root.dataset.mounted = 'true';

  if (!root.querySelector('.content')) {
    root.insertAdjacentHTML('beforeend', `<div class="content"></div>`);
  }

  async function render(){
    const content = root.querySelector('.content');

    // Les favoris sont des objets { slug, color, size } fournis par state.js
    const favs = getFavorites() || [];
    const slugs = Array.from(new Set(favs.map(f => f?.slug).filter(Boolean)));

    if (!slugs.length) {
      content.innerHTML = `<div class="fav-empty"><p>Aucun favori.</p></div>`;
      return;
    }

    // Récupère les produits par slug
    const prods = (await Promise.all(
      slugs.map(async (s) => {
        try { return await getProductBySlug(s); }
        catch { return null; }
      })
    )).filter(Boolean);

    if (!prods.length) {
      content.innerHTML = `<div class="fav-empty"><p>Aucun favori valide.</p></div>`;
      return;
    }

    content.innerHTML = `
      <div class="fav-header">
        <h2>Mes favoris</h2>
        <span class="fav-count">${prods.length} article${prods.length>1?'s':''}</span>
      </div>
      <ul class="fav-list">
        ${prods.map(p => `
          <li class="fav-item" data-slug="${p.slug}">
            <a class="thumb" href="/produit.html?slug=${encodeURIComponent(p.slug)}" title="${p.title || 'Produit'}">
              <img src="${firstImage(p)}" alt="${p.title || 'Produit'}">
            </a>
            <div class="meta">
              <a class="title" href="/produit.html?slug=${encodeURIComponent(p.slug)}">${p.title || 'Produit'}</a>
              <div class="price">${CHF(p.price)}</div>
              <div class="row">
                <button class="btn ghost add" data-slug="${p.slug}">Ajouter au panier</button>
                <button class="btn danger rm" aria-label="Retirer des favoris">♥ Retirer</button>
              </div>
            </div>
          </li>
        `).join('')}
      </ul>
    `;

    // Ajouter au panier (même signature que la page produit → pas de doublons)
    content.querySelectorAll('.add').forEach(btn => {
      btn.addEventListener('click', async () => {
        const slug = btn.getAttribute('data-slug');
        const p = prods.find(x => x?.slug === slug);
        if (!p?.id) return alert("Produit introuvable.");
        try {
          await addToCart({
            productId: p.id,
            quantity: 1,
            variantId: null,
            title: p.title,
            unitPrice: p.price,
            slug: p.slug,
            image: firstImage(p),
            color: null,
            size: null
          });
          document.dispatchEvent(new CustomEvent('cart:changed'));
          await openCartPanel();
        } catch (err) {
          alert(err?.message || 'Erreur ajout panier');
        }
      });
    });

    // Retirer un favori → toggle serveur + toggle local
    content.querySelectorAll('.rm').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const li = e.currentTarget.closest('.fav-item');
        const slug = li?.getAttribute('data-slug');
        if (!slug) return;

        const prod = prods.find(x => x.slug === slug);
        try {
          if (prod?.id) {
            // on toggle côté serveur pour rester cohérent avec le cœur sur produit.html
            await wishlistToggleServer(prod.id);
          }
        } catch (err) {
          // on ne bloque pas l'UX pour une erreur serveur; on log au besoin
          console.warn('wishlist toggle server failed', err);
        }

        // toggle local (state.js) afin de mettre à jour tout de suite l’UI
        addFavorite({ slug });
        document.dispatchEvent(new CustomEvent('fav:changed'));
      });
    });
  }

  document.addEventListener('fav:changed', render);
  render();
}
