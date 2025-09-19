// /js/ui/favoritesPanel.js
import { getFavorites, addFavorite } from '/js/state.js';
import { getProductBySlug, addToCart } from '/js/api.js';
import { openCartPanel } from '/js/ui/cartPanel.js';

function CHF(cents){ return `CHF ${(Number(cents||0)/100).toFixed(2)}`; }

export async function mountFavoritesPanel(){
  const root = document.getElementById('panel-favoris');
  if (!root) return;

  // squelette minimal si vide
  if (!root.querySelector('.content')) {
    root.insertAdjacentHTML('beforeend', `<div class="content"></div>`);
  }

  async function render(){
    const content = root.querySelector('.content');
    const slugs = getFavorites();

    if (!slugs.length) {
      content.innerHTML = `
        <div class="fav-empty"><p>Aucun favori.</p></div>
      `;
      return;
    }

    // fetch des produits par slug
    const prods = (await Promise.all(slugs.map(getProductBySlug))).filter(Boolean);

    content.innerHTML = `
      <div class="fav-header">
        <h2>Mes favoris</h2>
        <span class="fav-count">${prods.length} article${prods.length>1?'s':''}</span>
      </div>
      <ul class="fav-list">
        ${prods.map(p => `
          <li class="fav-item" data-slug="${p.slug}">
            <a class="thumb" href="/produit.html?slug=${encodeURIComponent(p.slug)}" title="${p.title}">
              ${Array.isArray(p.images) && p.images[0]
                ? `<img src="${p.images[0]}" alt="${p.title}">`
                : `<div class="ph"></div>`}
            </a>
            <div class="meta">
              <a class="title" href="/produit.html?slug=${encodeURIComponent(p.slug)}">${p.title || 'Produit'}</a>
              <div class="price">${CHF(p.price)}</div>
              <div class="row">
                <button class="btn ghost add" data-id="${p.id}">Ajouter au panier</button>
                <button class="btn danger rm" aria-label="Retirer des favoris">♥ Retirer</button>
              </div>
            </div>
          </li>
        `).join('')}
      </ul>
    `;

    // Ajouter au panier (signature back actuelle)
    content.querySelectorAll('.add').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        try{
          await addToCart({ productId: id, quantity: 1 }); // ← conforme à api.js
          document.dispatchEvent(new CustomEvent('cart:changed'));
          await openCartPanel(); // ouvre le panier pour feedback immédiat
        }catch(err){
          alert(err?.message || 'Erreur ajout panier');
        }
      });
    });

    // Retirer un favori (toggle)
    content.querySelectorAll('.rm').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const li = e.currentTarget.closest('.fav-item');
        const slug = li?.getAttribute('data-slug');
        if (slug) {
          addFavorite(slug); // toggle
          document.dispatchEvent(new CustomEvent('fav:changed'));
        }
      });
    });
  }

  document.addEventListener('fav:changed', render);
  render();
}
