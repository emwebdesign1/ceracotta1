// === State global (cart, auth, favoris) ===
export const LS = {
  CART:  'cart.v1',
  USER:  'user.v1',
  TOKEN: 'token.v1',
  FAVS:  'favs.v1'
};

export const state = {
  accessToken: null,
  user: null,
  cart: { items: [] },
  favs: []
};

// Boot depuis localStorage
(function boot() {
  try { state.cart = JSON.parse(localStorage.getItem(LS.CART) || '{"items":[]}'); } catch {}
  try { state.user = JSON.parse(localStorage.getItem(LS.USER) || 'null'); } catch {}
  state.accessToken = localStorage.getItem(LS.TOKEN) || null;
  try { state.favs = JSON.parse(localStorage.getItem(LS.FAVS) || '[]'); } catch {}
})();

// === Auth
export const authHeaders = () =>
  state.accessToken ? { Authorization: `Bearer ${state.accessToken}` } : {};

export function setAuth({ user = null, accessToken = null } = {}) {
  state.user = user;
  state.accessToken = accessToken;

  if (user) localStorage.setItem(LS.USER, JSON.stringify(user));
  else localStorage.removeItem(LS.USER);

  if (accessToken) localStorage.setItem(LS.TOKEN, accessToken);
  else localStorage.removeItem(LS.TOKEN);

  // nettoyage d’anciennes clés si jamais
  localStorage.removeItem('token');
  localStorage.removeItem('accessToken');

  document.dispatchEvent(new CustomEvent('auth:changed', { detail: { user: state.user } }));
}

export function clearAuth() {
  setAuth({ user: null, accessToken: null });
}

// === Panier
export function saveCart() {
  localStorage.setItem(LS.CART, JSON.stringify(state.cart));
  document.dispatchEvent(new CustomEvent('cart:changed', { detail: state.cart }));
}

// === Favoris (personnels) ===

// Clé dynamique selon l'utilisateur (ou guest)
function favKey() {
  // id prioritaire, sinon email/username pour fallback
  const u = state.user;
  const uid = u?.id || u?._id || u?.email || u?.username || 'guest';
  return `favs.${uid}.v1`;
}

function loadFavsFromStorage() {
  try { return JSON.parse(localStorage.getItem(favKey()) || '[]'); }
  catch { return []; }
}

function saveFavsToStorage() {
  localStorage.setItem(favKey(), JSON.stringify(state.favs));
}

export function getFavorites() {
  // garantit la bonne liste en mémoire
  if (!Array.isArray(state.favs)) state.favs = [];
  return state.favs;
}
export function favoritesCount() {
  return Array.isArray(state.favs) ? state.favs.length : 0;
}
export function isFavorite(slug) {
  return Array.isArray(state.favs) && state.favs.includes(slug);
}
export function addFavorite(slug) {
  if (!slug) return;
  if (!Array.isArray(state.favs)) state.favs = [];
  const i = state.favs.indexOf(slug);
  if (i === -1) state.favs.push(slug);
  else state.favs.splice(i, 1); // toggle
  saveFavsToStorage();
  document.dispatchEvent(new CustomEvent('fav:changed', { detail: state.favs }));
}
export function removeFavorite(slug) {
  if (!Array.isArray(state.favs)) state.favs = [];
  const idx = state.favs.indexOf(slug);
  if (idx !== -1) {
    state.favs.splice(idx, 1);
    saveFavsToStorage();
    document.dispatchEvent(new CustomEvent('fav:changed', { detail: state.favs }));
  }
}

// Charge la bonne liste au boot / au changement d'auth
function loadFavsForCurrentUser() {
  state.favs = loadFavsFromStorage();
}
loadFavsForCurrentUser();

// Fusionne les favoris "invité" dans ceux de l'utilisateur après login
function migrateGuestFavsIntoUser() {
  const guestKey = 'favs.guest.v1';
  let guestFavs = [];
  try { guestFavs = JSON.parse(localStorage.getItem(guestKey) || '[]'); } catch {}
  if (!Array.isArray(guestFavs) || guestFavs.length === 0) return;

  const set = new Set([...(state.favs || []), ...guestFavs]);
  state.favs = Array.from(set);
  saveFavsToStorage();
  localStorage.removeItem(guestKey);
}

// Hooke le changement d’auth pour recharger/fusionner
document.addEventListener('auth:changed', () => {
  // recharger les favoris propres à l'utilisateur
  loadFavsForCurrentUser();
  // puis fusionner ceux d'invité si nécessaire
  migrateGuestFavsIntoUser();
  document.dispatchEvent(new CustomEvent('fav:changed', { detail: state.favs }));
});
