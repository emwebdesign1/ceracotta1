// /js/api.js
import { state, authHeaders, saveCart, setAuth, clearAuth } from './state.js';

// Active les mocks uniquement si besoin
const MOCK = { products: false, cart: false, auth: false };

/* ===== Produits (laisse comme avant) ===== */
export async function getProducts({ category, q = '', sort='-createdAt', page=1, limit=12 } = {}) {
  if (MOCK.products) {
    const items = [
      { id:'p1', slug:'assiette-email-beige', title:'Assiette émail beige', price:2900, images:['/images/bols.png'], variants:[{id:'v1', color:'Beige', size:'20cm', price:2900, stock:20}] },
      { id:'p2', slug:'bol-texture-mat',     title:'Bol texturé mat',     price:3490, images:['/images/bols.png'], variants:[{id:'v2', color:'Noir',  size:'Standard', price:3490, stock:12}] },
    ];
    return { items, total: items.length };
  }
  const params = new URLSearchParams({ q, sort, page, limit, ...(category?{category}:{}) });
  const res = await fetch(`/api/products?${params.toString()}`);
  return res.json();
}

// /js/api.js (seulement cette fonction)
// /js/api.js
export async function getProductBySlug(slug) {
  async function pick(obj) {
    if (!obj) return null;
    // objet direct
    if (obj.id || obj._id) return obj;
    // wrappers possibles
    if (obj.product) return obj.product;
    if (obj.item) return obj.item;
    if (obj.data && (obj.data.id || obj.data._id)) return obj.data;
    if (Array.isArray(obj.items)) {
      const bySlug = obj.items.find(x => x?.slug === slug);
      return bySlug || obj.items[0] || null;
    }
    return null;
  }

  // 1) tentative classique /:slug
  try {
    const r1 = await fetch(`/api/products/${encodeURIComponent(slug)}`);
    const d1 = await r1.json().catch(() => null);
    let p = await pick(d1);

    // 2) fallback via /?slug=...
    if (!p) {
      const r2 = await fetch(`/api/products?slug=${encodeURIComponent(slug)}`);
      const d2 = await r2.json().catch(() => null);
      p = await pick(d2);
    }

    // normalisation id
    if (p && !p.id && p._id) p.id = p._id;
    if (p && typeof p.id === 'string' && /^\d+$/.test(p.id)) p.id = Number(p.id);

    return p || null;
  } catch {
    return null;
  }
}



/* ===== Auth ===== */
export async function register(payload) {
  if (MOCK.auth) {
    const data = { user:{ id:'u1', email:payload.email, role:'CUSTOMER', username: payload.username, firstName:payload.firstName, lastName:payload.lastName, phone:payload.phone }, token:'FAKE_TOKEN' };
    setAuth({ user:data.user, accessToken:data.token });
    return data;
  }
  const r = await fetch('/api/auth/register', {
    method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload)
  });
  const d = await r.json().catch(()=> ({}));
  if (r.ok) setAuth({ user:d.user, accessToken:d.token });
  return d;
}

export async function login({ email, password }) {
  if (MOCK.auth) {
    const data = { user:{ id:'u1', email, role:'CUSTOMER', username:'emma' }, token:'FAKE_TOKEN' };
    setAuth({ user:data.user, accessToken:data.token }); return data;
  }
  const r = await fetch('/api/auth/login', {
    method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ email, password })
  });
  const d = await r.json().catch(()=> ({}));
  if (r.ok) setAuth({ user:d.user, accessToken:d.token });
  return d;
}

export async function me() {
  const r = await fetch('/api/auth/me', { headers:{ ...authHeaders() }});
  return r.ok ? r.json() : { user:null };
}

export function logout(){ clearAuth(); }

/* ===== Panier – ALIGNÉ sur le backend =====
   Back: 
     GET    /api/carts/                     → getMyCart
     POST   /api/carts/items                → addToCart
     PATCH  /api/carts/items/:itemId        → updateCartItem
     DELETE /api/carts/items/:itemId        → removeCartItem
     DELETE /api/carts/                     → clearCart
   Toutes ces routes exigent Authorization: Bearer <token>
*/
const safeId = () => (crypto?.randomUUID?.() || ('it_' + Math.random().toString(36).slice(2)));

export async function getCart() {
  if (MOCK.cart) return state.cart;
  const r = await fetch('/api/carts/', { headers:{ ...authHeaders() } });
  // le contrôleur renvoie { cart: { items: [...] } }
  const data = await r.json();
  // On normalise vers state.cart (cart.items attendu côté UI)
  const cart = data?.cart || { items: [] };
  state.cart = cart; saveCart();
  return cart;
}

export async function addToCart({ productId, quantity = 1 }) {
  const r = await fetch('/api/carts/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ productId, quantity })
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    // remonte le message back si dispo (ex: "Produit introuvable")
    throw new Error(e?.message || e?.error || `Erreur panier (${r.status})`);
  }
  return await getCart();
}

export async function updateCartItem({ itemId, quantity }) {
  if (MOCK.cart) {
    const it = state.cart.items.find(i => i.id === itemId);
    if (it) it.quantity = Math.max(1, quantity);
    saveCart(); return structuredClone(state.cart);
  }
  const r = await fetch(`/api/carts/items/${itemId}`, {
    method:'PATCH',
    headers:{ 'Content-Type':'application/json', ...authHeaders() },
    body: JSON.stringify({ quantity })
  });
  if (!r.ok) {
    const e = await r.json().catch(()=> ({}));
    throw new Error(e?.error || `Erreur panier (${r.status})`);
  }
  return await getCart();
}

export async function removeCartItem(itemId) {
  if (MOCK.cart) {
    state.cart.items = state.cart.items.filter(i => i.id !== itemId);
    saveCart(); return structuredClone(state.cart);
  }
  const r = await fetch(`/api/carts/items/${itemId}`, {
    method:'DELETE',
    headers:{ ...authHeaders() }
  });
  if (!r.ok && r.status !== 204) {
    const e = await r.json().catch(()=> ({}));
    throw new Error(e?.error || `Erreur panier (${r.status})`);
  }
  return await getCart();
}

export async function clearCart() {
  if (MOCK.cart) { state.cart.items = []; saveCart(); return structuredClone(state.cart); }
  const r = await fetch('/api/carts/', {
    method:'DELETE',
    headers:{ ...authHeaders() }
  });
  if (!r.ok && r.status !== 204) {
    const e = await r.json().catch(()=> ({}));
    throw new Error(e?.error || `Erreur panier (${r.status})`);
  }
  return await getCart();
}
