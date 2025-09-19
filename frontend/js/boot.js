// /js/boot.js
import { mountAuthPanel } from './auth.js';
 import { mountShell } from './ui/shell.js';
 import { mountFavoritesPanel } from './ui/favoritesPanel.js';
 import { renderCartPanel } from './ui/cartPanel.js';
import { getCart } from './api.js';
import { favoritesCount, addFavorite, isFavorite } from './state.js';

window.addEventListener('DOMContentLoaded', () => {
  mountShell();
  mountAuthPanel();
  mountFavoritesPanel();

  // Badge favoris
  function updateFavBadge(){
    const link = document.getElementById('open-favoris');
    if (!link) return;
    let badge = link.querySelector('.fav-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'fav-badge';
      link.appendChild(badge);
    }
    badge.textContent = String(favoritesCount());
    badge.style.display = favoritesCount() > 0 ? 'inline-block' : 'none';
  }
  updateFavBadge();
  document.addEventListener('fav:changed', updateFavBadge);

  // Panier panel
  document.getElementById('open-panier')?.addEventListener('click', async e => {
    e.preventDefault();
    const cart = await getCart();
    renderCartPanel(cart);
  });
});
