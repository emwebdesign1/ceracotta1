import { state, authHeaders, saveCart, clearAuth } from '/js/state.js';

/* -------------------------------------------------------------------------- */
/*                               CONFIG BACKEND                               */
/* -------------------------------------------------------------------------- */

const API_BASE = "http://localhost:4000";


/**
 * CONFIG
 * - Si ton backend expose un panier invité, laisse USE_GUEST_SERVER = true.
 *   Endpoints attendus (à adapter si besoin) :
 *     GET    /api/carts/guest
 *     POST   /api/carts/guest/items
 *     PATCH  /api/carts/guest/items/:itemId
 *     DELETE /api/carts/guest/items/:itemId
 *     DELETE /api/carts/guest
 * - Sinon, on retombe automatiquement en LOCAL STORAGE (fallback).
 */
const USE_GUEST_SERVER = true;

/* ---------------------------------- Utils ---------------------------------- */

async function fetchJson(url, opts = {}) {
  const r = await fetch(url, opts);
  let body = null;
  try { body = await r.json(); } catch { /* no body */ }
  if (!r.ok) {
    const msg = body?.message || body?.error || `${r.status} ${r.statusText}`;
    const e = new Error(msg);
    e.status = r.status;
    e.body = body;
    throw e;
  }
  return body ?? {};
}

function withJson(method, body, extraHeaders = {}) {
  return {
    method,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body ?? {})
  };
}

function hasToken() {
  return !!(state?.accessToken);
}

function safeMatch(a, b) {
  return String(a ?? '') === String(b ?? '');
}

/* ------------------------------ Produits (OK) ------------------------------ */

export async function getProducts({ category, q = '', sort = '-createdAt', page = 1, limit = 12 } = {}) {
  const params = new URLSearchParams({ q, sort, page, limit, ...(category ? { category } : {}) });
  return fetchJson(`${API_BASE}/api/products?${params.toString()}`);
}

export async function getProductBySlug(slug) {
  // Essai direct /:slug
  try {
    return await fetchJson(`${API_BASE}/api/products/${encodeURIComponent(slug)}`);
  } catch {
    // Fallback /?slug=
    const d = await fetchJson(`${API_BASE}/api/products?slug=${encodeURIComponent(slug)}`);
    if (d?.product) return d.product;
    if (Array.isArray(d?.items)) return d.items.find(p => p.slug === slug) ?? d.items[0] ?? null;
    return null;
  }
}

/* ----------------------------------- Auth ---------------------------------- */
/** IMPORTANT: Pas de setAuth/clearAuth ici (géré dans /js/auth.js) */

export async function register(payload) {
  const r = await fetch(`${API_BASE}/api/auth/register`, withJson('POST', payload));
  try { return await r.json(); } catch { return {}; }
}

export async function login({ email, password }) {
  const r = await fetch(`${API_BASE}/api/auth/login`, withJson('POST', { email, password }));
  try { return await r.json(); } catch { return {}; }
}

export async function me() {
  try { return await fetchJson(`${API_BASE}/api/auth/me`, { headers: { ...authHeaders() } }); }
  catch { return { user: null }; }
}

export async function logout() {
  try {
    // Appel au backend
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: { ...authHeaders() },
      credentials: 'include',
    });
  } catch (e) {
    console.warn('Erreur logout:', e);
  }

  // 🔥 Efface tout ce qui concerne l’auth
  localStorage.removeItem('accessToken');
  sessionStorage.removeItem('accessToken');
  localStorage.removeItem('user.displayName');
  localStorage.removeItem('user.role');

  // ✅ Vide le panier local
  state.cart = { items: [] };
  localStorage.setItem('cart.v1', JSON.stringify(state.cart));
  document.dispatchEvent(new CustomEvent('cart:changed', { detail: state.cart }));

  // 🔥 Réinitialise complètement l’état global
  if (window.state) {
    window.state.accessToken = null;
    window.state.user = null;
  }

  // 🔥 Déclenche un événement global (pour les favoris etc.)
  document.dispatchEvent(new CustomEvent('auth:changed', { detail: { user: null } }));

  // 🔥 Supprime l’en-tête Authorization mis en cache
  if (typeof window.authHeaders === 'function') {
    const headers = authHeaders();
    delete headers['Authorization'];
  }

  clearAuth();
}

/* ---------------------------------- Panier --------------------------------- */
/**
 * MODE HYBRIDE
 * - Invité : on tente d'utiliser le serveur guest si dispo (USE_GUEST_SERVER), sinon localStorage
 * - Connecté : serveur = source de vérité
 * - Après login : fusion locale -> serveur
 */

function localCartGet() {
  return state.cart || { items: [] };
}
function localCartSet(cart) {
  state.cart = cart || { items: [] };
  saveCart();
  return state.cart;
}
function localCartAdd({ productId, quantity = 1, variantId = null, title = null, unitPrice = null, slug = null, image = null, color = null, size = null }) {
  const cart = localCartGet();
  const key = (i) =>
    `${i.productId || ''}|${i.variantId || ''}|${i.color || ''}|${i.size || ''}`;

  const incoming = { productId, quantity, variantId, title, unitPrice, slug, image, color, size };
  const existing = cart.items.find(i => key(i) === key(incoming));

  if (existing) {
    existing.quantity = Math.max(1, (existing.quantity || 0) + quantity);
  } else {
    cart.items.push({ id: `local_${Math.random().toString(36).slice(2)}`, ...incoming });
  }
  return localCartSet(cart);
}
function localCartPatch(itemId, quantity) {
  const cart = localCartGet();
  const it = cart.items.find(i => safeMatch(i.id, itemId));
  if (it) it.quantity = Math.max(1, quantity);
  return localCartSet(cart);
}
function localCartRemove(itemId) {
  const cart = localCartGet();
  cart.items = cart.items.filter(i => !safeMatch(i.id, itemId));
  return localCartSet(cart);
}
function localCartClear() {
  return localCartSet({ items: [] });
}

/* ------------------- Guest (invité) serveur ------------------- */

async function guestGetCartServer() {
  return fetchJson(`${API_BASE}/api/carts/guest`);
}
async function guestAddItemServer(payload) {
  return fetchJson(`${API_BASE}/api/carts/guest/items`, withJson('POST', payload));
}
async function guestUpdateItemServer(itemId, body) {
  return fetchJson(`${API_BASE}/api/carts/guest/items/${encodeURIComponent(itemId)}`, withJson('PATCH', body));
}
async function guestRemoveItemServer(itemId) {
  return fetchJson(`${API_BASE}/api/carts/guest/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
}
async function guestClearServer() {
  return fetchJson(`${API_BASE}/api/carts/guest`, { method: 'DELETE' });
}

/* -------------------- User (connecté) serveur -------------------- */

async function userGetCartServer() {
  return fetchJson(`${API_BASE}/api/carts/`, { headers: { ...authHeaders() } });
}
async function userAddItemServer(body) {
  return fetchJson(`${API_BASE}/api/carts/items`, withJson('POST', body, authHeaders()));
}
async function userUpdateItemServer(itemId, body) {
  return fetchJson(`${API_BASE}/api/carts/items/${encodeURIComponent(itemId)}`, withJson('PATCH', body, authHeaders()));
}
async function userRemoveItemServer(itemId) {
  return fetchJson(`${API_BASE}/api/carts/items/${encodeURIComponent(itemId)}`, { method: 'DELETE', headers: { ...authHeaders() } });
}
async function userClearServer() {
  return fetchJson(`${API_BASE}/api/carts/`, { method: 'DELETE', headers: { ...authHeaders() } });
}

/* ---------------------- API publique Panier ---------------------- */

export async function getCart() {
  if (hasToken()) {
    try {
      const d = await userGetCartServer();
      const cart = d?.cart || d || { items: Array.isArray(d?.items) ? d.items : [] };
      return localCartSet(cart);
    } catch (e) {
      if (e?.status === 401) { /* fallback invité */ }
    }
  }

  if (USE_GUEST_SERVER) {
    try {
      const d = await guestGetCartServer();
      const cart = d?.cart || d || { items: Array.isArray(d?.items) ? d.items : [] };
      return localCartSet(cart);
    } catch { /* fallback */ }
  }

  return localCartGet();
}

export async function addToCart({ productId, quantity = 1, variantId = null, title = null, unitPrice = null, slug = null, image = null, color = null, size = null }) {
  const payload = { productId, quantity, variantId, title, unitPrice, slug, image, color, size };

  if (hasToken()) {
    await userAddItemServer(payload);
    return getCart();
  }

  if (USE_GUEST_SERVER) {
    try {
      await guestAddItemServer(payload);
      return getCart();
    } catch {}
  }

  localCartAdd(payload);
  return localCartGet();
}

export async function updateCartItem({ itemId, quantity }) {
  if (hasToken()) {
    await userUpdateItemServer(itemId, { quantity });
    return getCart();
  }

  if (USE_GUEST_SERVER) {
    try {
      await guestUpdateItemServer(itemId, { quantity });
      return getCart();
    } catch {}
  }

  localCartPatch(itemId, quantity);
  return localCartGet();
}

export async function removeCartItem(itemId) {
  if (hasToken()) {
    await userRemoveItemServer(itemId);
    return getCart();
  }
  if (USE_GUEST_SERVER) {
    try {
      await guestRemoveItemServer(itemId);
      return getCart();
    } catch {}
  }
  localCartRemove(itemId);
  return localCartGet();
}

export async function clearCart() {
  if (hasToken()) {
    await userClearServer();
    return getCart();
  }
  if (USE_GUEST_SERVER) {
    try {
      await guestClearServer();
      return getCart();
    } catch {}
  }
  localCartClear();
  return localCartGet();
}

/* ----------------- Fusion après authentification ----------------- */

async function mergeLocalIntoUserCart() {
  const local = localCartGet();
  if (!Array.isArray(local?.items) || local.items.length === 0) return;

  for (const it of local.items) {
    try {
      await userAddItemServer({
        productId: it.productId,
        quantity: it.quantity ?? 1,
        variantId: it.variantId ?? null,
        title: it.title ?? null,
        unitPrice: it.unitPrice ?? null,
        slug: it.slug ?? null,
        image: it.image ?? null,
        color: it.color ?? null,
        size: it.size ?? null
      });
    } catch {}
  }

  localCartClear();
  await getCart();
}

document.addEventListener('auth:changed', async (ev) => {
  const user = ev?.detail?.user || null;
  if (user) {
    try { await mergeLocalIntoUserCart(); } catch {}
  } else {
    try { await getCart(); } catch {}
  }
});
