// /js/boot.js
import { mountAuthPanel } from './auth.js';
 import { mountShell } from './ui/shell.js';
 import { mountFavoritesPanel } from './ui/favoritesPanel.js';
 import { renderCartPanel } from './ui/cartPanel.js';
import { getCart } from './api.js';
import { favoritesCount, addFavorite, isFavorite } from './state.js';

import { me } from '/js/api.js';

function applyHeader(user) {
  const headerRight = document.querySelector('.header-right');
  const compteIcon = document.getElementById('open-compte');
  if (!headerRight || !compteIcon) return;

  // Détermine le libellé & la cible
  const name = user?.username || user?.firstName || localStorage.getItem('user.displayName') || 'Mon compte';
  const role = (user?.role || localStorage.getItem('user.role') || 'user').toLowerCase();
  const linkHref = role === 'admin' ? '/admin.html' : '/account.html';

  // Remplace l’icône par un lien texte + garde les autres icônes
  const span = document.createElement('a');
  span.href = linkHref;
  span.className = 'user-link';
  span.style.marginRight = '8px';
  span.textContent = name;

  // insère avant l’icône compte existante
  headerRight.insertBefore(span, compteIcon);
  // l’icône "compte" ouvre le panel si non connecté, sinon redirige aussi
  compteIcon.addEventListener('click', (e) => {
    if (user) {
      e.preventDefault();
      location.href = linkHref;
    }
  }, { once: true });
}

(async function boot() {
  // Essaye de récupérer le user (si token présent)
  try {
    const res = await me(); // { user }
    if (res?.user) applyHeader(res.user);
    else {
      // pas connecté → enlève les caches si restés
      localStorage.removeItem('user.displayName');
      localStorage.removeItem('user.role');
    }
  } catch {
    // silent
  }
})();


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
