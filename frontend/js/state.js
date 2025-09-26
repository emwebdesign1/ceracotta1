// === State global (cart, auth, favoris) ===
export const LS = {
  CART:  'cart.v1',
  USER:  'user.v1',
  TOKEN: 'token.v1'
  // (les favoris ont une clé dynamique par user -> voir favKey())
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
})();

// === Auth ===
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

// === Panier ===
export function saveCart() {
  localStorage.setItem(LS.CART, JSON.stringify(state.cart));
  document.dispatchEvent(new CustomEvent('cart:changed', { detail: state.cart }));
}

// === Favoris (personnels) ===

// helpers favoris
function normalizeFav(input) {
  if (!input) return null;
  if (typeof input === 'string') return { slug: input, color: null, size: null };
  const { slug, color = null, size = null } = input || {};
  if (!slug) return null;
  return { slug, color, size };
}
function favEquals(a, b) {
  if (!a || !b) return false;
  return a.slug === b.slug
    && (a.color || null) === (b.color || null)
    && (a.size  || null) === (b.size  || null);
}

// Clé dynamique selon l'utilisateur (ou guest)
function favKey() {
  const u = state.user;
  const uid = u?.id || u?._id || u?.email || u?.username || 'guest';
  return `favs.${uid}.v1`;
}

function migrateArray(raw) {
  // migration: strings -> objets {slug,color,size}
  if (!Array.isArray(raw)) return [];
  return raw.map(x => {
    if (typeof x === 'string') return { slug: x, color: null, size: null };
    const { slug, color = null, size = null } = x || {};
    return slug ? { slug, color, size } : null;
  }).filter(Boolean);
}

function loadFavsFromStorage() {
  try {
    const raw = JSON.parse(localStorage.getItem(favKey()) || '[]');
    return migrateArray(raw);
  } catch {
    return [];
  }
}

function saveFavsToStorage() {
  localStorage.setItem(favKey(), JSON.stringify(state.favs));
}

export function getFavorites() {
  if (!Array.isArray(state.favs)) state.favs = [];
  return state.favs;
}
export function favoritesCount() {
  return Array.isArray(state.favs) ? state.favs.length : 0;
}
export function isFavorite(entry) {
  const needle = normalizeFav(entry);
  if (!needle) return false;
  if (!Array.isArray(state.favs)) return false;

  // Si on passe juste un slug → "favori pour au moins une variante"
  if (needle.color === null && needle.size === null) {
    return state.favs.some(f => f.slug === needle.slug);
  }
  return state.favs.some(f => favEquals(f, needle));
}
export function addFavorite(entry) {
  const fav = normalizeFav(entry);
  if (!fav) return;

  if (!Array.isArray(state.favs)) state.favs = [];
  const idx = state.favs.findIndex(f => favEquals(f, fav));

  if (idx === -1) state.favs.push(fav);   // Ajout
  else state.favs.splice(idx, 1);         // Toggle (retrait)

  saveFavsToStorage();
  document.dispatchEvent(new CustomEvent('fav:changed', { detail: state.favs }));
}
export function removeFavorite(entry) {
  const fav = normalizeFav(entry);
  if (!fav) return;

  if (!Array.isArray(state.favs)) state.favs = [];
  const idx = state.favs.findIndex(f => favEquals(f, fav));
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
  guestFavs = migrateArray(guestFavs);

  if (!Array.isArray(guestFavs) || guestFavs.length === 0) return;

  const combined = [...(state.favs || [])];
  for (const g of guestFavs) {
    if (!combined.some(f => favEquals(f, g))) combined.push(g);
  }
  state.favs = combined;
  saveFavsToStorage();
  localStorage.removeItem(guestKey);
}

// Hooke le changement d’auth pour recharger/fusionner
document.addEventListener('auth:changed', () => {
  loadFavsForCurrentUser();
  migrateGuestFavsIntoUser();
  document.dispatchEvent(new CustomEvent('fav:changed', { detail: state.favs }));
});
