import { authHeaders } from '/js/state.js';
import { logout, me } from '/js/api.js';

const API_BASE = 'http://localhost:4000';

/* ================== GUARDE ADMIN ================== */
(async () => {
  try {
    const { user } = await me();
    if (!user) return (location.href = 'index.html');
    const isAdmin = (user.role || '').toLowerCase() === 'admin';
    if (!isAdmin) return (location.href = '/account.html');
  } catch {
    location.href = 'index.html';
  }
})();

/* ================== CONFIG ================== */
const SETTINGS_ME_API = `${API_BASE}/api/admin/me`;
const SETTINGS_PWD_API = `${API_BASE}/api/admin/me/password`;
const SURVEY_API = `${API_BASE}/api/admin/surveys`;
const SURVEY_STATS_API = `${API_BASE}/api/admin/surveys/stats`;

/* ================== HELPERS ================== */
const $ = (s) => document.querySelector(s);
const msg = $('#msg');
const CHF = (v) => `CHF ${(Number(v || 0) / 100).toFixed(2)}`;

function fmtAddr(u = {}) {
  const parts = [
    [u.addressLine1, u.addressLine2].filter(Boolean).join(' '),
    [u.postalCode, u.city].filter(Boolean).join(' '),
    u.country,
  ].filter(Boolean);
  return parts.join(', ');
}

function fullImageUrl(url) {
  if (!url) return '/images/placeholder.png';
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
}

/* ================== IMAGES PRODUITS ================== */
function renderImagePreview(images = [], productId = null) {
  const box = document.getElementById('prodImagesPreview');
  if (!box) return;
  box.innerHTML = '';

  images.forEach((it) => {
    const url = typeof it === 'string' ? it : it.url;
    const imageId = typeof it === 'object' && it ? it.id : null;

    const wrap = document.createElement('div');
    wrap.className = 'img-wrapper';

    const img = document.createElement('img');
    img.src = fullImageUrl(url);
    img.alt = '';
    wrap.appendChild(img);

    if (productId && imageId) {
      const delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.type = 'button';
      delBtn.textContent = '✖';
      delBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!confirm('Supprimer cette image ?')) return;

        try {
          const res = await fetch(`${API_BASE}/api/admin/products/${productId}/images/${imageId}`, {
            method: 'DELETE',
            headers: { ...authHeaders() },
          });
          if (!res.ok) throw new Error('Erreur suppression image');
          wrap.remove();
        } catch (err) {
          alert('Impossible de supprimer : ' + (err?.message || 'Erreur'));
        }
      });
      wrap.appendChild(delBtn);
    }

    box.appendChild(wrap);
  });
}

/* ================== PROFIL ================== */
async function fetchMe() {
  const r = await fetch(SETTINGS_ME_API, { headers: { ...authHeaders() } });
  if (!r.ok) throw new Error('Erreur chargement profil');
  return r.json();
}

function fillProfileForm(me) {
  $('#setFirstName').value = me.firstName || '';
  $('#setLastName').value = me.lastName || '';
  $('#setPhone').value = me.phone || '';
  $('#setEmail').value = me.email || '';
}

async function loadSettings() {
  try {
    const me = await fetchMe();
    fillProfileForm(me);
  } catch (e) {
    console.error(e);
    if (msg) {
      msg.textContent = e.message || 'Erreur chargement paramètres.';
      msg.style.color = '#b00020';
    }
  }
}

$('#formProfile')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const payload = {
      firstName: $('#setFirstName')?.value || null,
      lastName: $('#setLastName')?.value || null,
      phone: $('#setPhone')?.value || null,
      email: $('#setEmail')?.value || null,
    };

    const r = await fetch(SETTINGS_ME_API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(await r.text());
    const meUpdated = await r.json();
    fillProfileForm(meUpdated);
    if (msg) {
      msg.textContent = 'Profil mis à jour.';
      msg.style.color = '#1b5e20';
    }
  } catch (err) {
    console.error(err);
    if (msg) {
      msg.textContent = 'Erreur mise à jour profil.';
      msg.style.color = '#b00020';
    }
  }
});

$('#formPassword')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const cur = $('#pwdCurrent')?.value || '';
  const n1 = $('#pwdNew')?.value || '';
  const n2 = $('#pwdNew2')?.value || '';
  if (n1 !== n2) {
    if (msg) {
      msg.textContent = 'Les nouveaux mots de passe ne correspondent pas.';
      msg.style.color = '#b00020';
    }
    return;
  }
  try {
    const r = await fetch(SETTINGS_PWD_API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ currentPassword: cur, newPassword: n1 }),
    });
    const t = await r.text();
    if (!r.ok) throw new Error(t || 'Erreur');
    $('#pwdCurrent').value = '';
    $('#pwdNew').value = '';
    $('#pwdNew2').value = '';
    if (msg) {
      msg.textContent = 'Mot de passe mis à jour.';
      msg.style.color = '#1b5e20';
    }
  } catch (err) {
    console.error(err);
    if (msg) {
      msg.textContent = 'Erreur changement de mot de passe.';
      msg.style.color = '#b00020';
    }
  }
});

/* ================== VARIANTES (UI) ================== */
const variantsList = document.getElementById('variantsList');
const variantAddBtn = document.getElementById('variantAddBtn');
const variantRowTpl = document.getElementById('variantRowTpl');

function normHex(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.startsWith('#') ? s : `#${s}`;
}

function addVariantRow(v = {}) {
  if (!variantsList || !variantRowTpl) return;
  const node = variantRowTpl.content.firstElementChild.cloneNode(true);

  node.querySelector('.v-color').value = v.hex ?? v.colorHex ?? v.color ?? '';
  node.querySelector('.v-size').value = v.size ?? '';
  node.querySelector('.v-price').value = v.price ?? '';
  node.querySelector('.v-stock').value = v.stock ?? 0;
  node.querySelector('.v-sku').value = v.sku ?? '';
  node.querySelector('.v-active').checked = v.active != null ? !!v.active : true;

  node.querySelector('.v-del').addEventListener('click', () => node.remove());
  variantsList.appendChild(node);
}

function renderVariants(list = []) {
  if (!variantsList) return;
  variantsList.innerHTML = '';
  if (!Array.isArray(list) || !list.length) {
    addVariantRow();
    return;
  }
  list.forEach(addVariantRow);
}

function readVariantsFromUI() {
  if (!variantsList) return [];
  const rows = Array.from(variantsList.querySelectorAll('.variant-row'));
  return rows.map(row => {
    const hex = normHex(row.querySelector('.v-color')?.value || null);
    const size = (row.querySelector('.v-size')?.value || '').trim() || null;
    const price = row.querySelector('.v-price')?.value;
    const stock = row.querySelector('.v-stock')?.value;
    const sku = (row.querySelector('.v-sku')?.value || '').trim() || null;
    const active = !!row.querySelector('.v-active')?.checked;
    return {
      hex,
      size,
      price: price === '' ? null : Number(price),
      stock: stock === '' ? 0 : Number(stock),
      sku,
      active,
      colorHex: hex,
    };
  }).filter(v => v.hex || v.size || v.price != null || v.stock > 0 || v.sku);
}
variantAddBtn?.addEventListener('click', () => addVariantRow());

/* ================== VUES / NAVIGATION ================== */
const views = {
  products: document.getElementById('view-products'),
  users: document.getElementById('view-users'),
  orders: document.getElementById('view-orders'),
  settings: document.getElementById('view-settings'),
  stats: document.getElementById('view-stats'),
  surveys: document.getElementById('view-surveys'),
};

function show(name) {
  Object.entries(views).forEach(([k, el]) => {
    if (!el) return;
    el.hidden = k !== name;
    const link = document.querySelector(`[data-view="${k}"]`);
    if (link) link.classList.toggle('is-active', k === name);
  });
}

document.querySelectorAll('[data-view]').forEach((el) => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    const v = el.dataset.view;
    history.replaceState(null, '', `#${v}`);
    show(v);
    if (v === 'products') loadProducts();
    if (v === 'users') loadUsers();
    if (v === 'orders') loadOrders();
    if (v === 'stats') loadStats();
    if (v === 'surveys') loadSurveys();
    if (v === 'settings') loadSettings();
  });
});

const initial = (location.hash || '#orders').slice(1);
show(initial);

/* ================== LOGOUT ================== */
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  try {
    await logout();
  } finally {
    location.href = '/index.html';
  }
});



/* ================== UTILS PRODUITS ================== */
function pick(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && v !== '') return v;
  return null;
}

function readColor(it) {
  const v = it.variant || {};
  console.log('item:', it);
  return pick(
    v.color, v.colorHex, v.hex,
    it.color, it.variantColor,
    it.options?.color, it.meta?.color,
    it.attributes?.colorHex, it.attributes?.color
  );
}

function readSize(it) {
  const v = it.variant || {};
  return pick(
    it.size, it.variantSize, v.size, v.labelSize,
    it.options?.size, it.meta?.size,
    it.attributes?.size, it.sizeLabel
  );
}

/* ================== COMMANDES ================== */
const ordersTableBody = document.querySelector('#ordersTable tbody');

function renderOrders(list = []) {
  if (!ordersTableBody) return;
  ordersTableBody.innerHTML = '';
  if (!list.length) {
    ordersTableBody.innerHTML = `<tr><td colspan="7" class="muted">Aucune commande.</td></tr>`;
    return;
  }

  list.forEach((o) => {
    const user = o.user || {};
    const d = new Date(o.createdAt || Date.now());
    const items = (o.items || [])
      .map(it => {
        const color = it.color || it.variant?.color || null;
        const size = it.size || it.variant?.size || null;
        const colorHtml = color
          ? `<span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${color};border:1px solid #ccc;margin-right:4px;vertical-align:middle"></span><span>${color}</span>`
          : null;
        const variantTxt = [
          colorHtml ? `Couleur : ${colorHtml}` : null,
          size ? `Taille : ${size}` : null,
        ].filter(Boolean).join(' | ');
        return `${it.quantity}× ${it.title}${variantTxt ? ` <span class="muted">(${variantTxt})</span>` : ''}`;
      })
      .join('<br/>');

    const pay = o.paymentMethod ? `<span class="tag">${o.paymentMethod}</span>` : '-';
    const status = o.isPaid ? '<span class="tag payee">Payée</span>' : (o.status || '-');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.toLocaleString('fr-CH')}</td>
      <td>${o.reference || o.id}</td>
      <td>
        <strong>${[user.firstName, user.lastName].filter(Boolean).join(' ') || '—'}</strong><br/>
        <span class="muted">${user.email || ''}${user.phone ? ' · ' + user.phone : ''}</span>
      </td>
      <td>${fmtAddr(user)}</td>
      <td>${items || '—'}</td>
      <td>${CHF(o.amount || 0)}</td>
      <td>${pay}<br/>${status}</td>
    `;
    ordersTableBody.appendChild(tr);
  });
}

async function fetchOrders() {
  const r = await fetch(`${API_BASE}/api/admin/orders`, { headers: { ...authHeaders() } });
  if (!r.ok) throw new Error('Erreur chargement commandes');
  return r.json();
}

async function loadOrders() {
  const list = await fetchOrders();
  renderOrders(list);
}

/* ================== PRODUITS ================== */
const productsTableBody = document.querySelector('#productsTable tbody');
const prodSearch = document.getElementById('prodSearch');
document.getElementById('prodRefresh')?.addEventListener('click', loadProducts);
prodSearch?.addEventListener('input', () => loadProducts());

function productThumbHTML(p) {
  const imgs = Array.isArray(p.images) ? p.images : [];
  const firstRaw = imgs[0];
  const first = typeof firstRaw === 'string'
    ? fullImageUrl(firstRaw)
    : fullImageUrl(firstRaw?.url || '/images/placeholder.png');
  const pic = `<img src="${first}" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:8px;margin-right:10px;border:1px solid #e9e6e0" />`;
  const meta = [
    p.category ? `<span class="tag">${p.category}</span>` : null,
    p.variants?.length ? `<span class="muted">${p.variants.length} variantes</span>` : null,
  ].filter(Boolean);
  const metaTxt = meta.length ? ` <span class="muted">· ${meta.join(' · ')}</span>` : '';
  return `
    <div style="display:flex;align-items:center">
      ${pic}
      <div><strong>${p.title || '—'}</strong>${metaTxt}</div>
    </div>
  `;
}

function renderProducts(list = []) {
  if (!productsTableBody) return;
  productsTableBody.innerHTML = '';
  if (!list.length) {
    productsTableBody.innerHTML = `<tr><td colspan="6" class="muted">Aucun produit.</td></tr>`;
    return;
  }

  list.forEach((p) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${productThumbHTML(p)}</td>
      <td>${p.slug || '—'}</td>
      <td>${CHF(p.price || 0)}</td>
      <td>${p.stock ?? 0}</td>
      <td>${p.category?.name || p.category || '—'}</td>
      <td style="white-space:nowrap">
        <button class="btn ghost" data-edit="${p.id}">Modifier</button>
        <button class="btn danger" data-del="${p.id}">Supprimer</button>
      </td>
    `;
    productsTableBody.appendChild(tr);
  });
}

async function fetchProducts(q = '') {
  const r = await fetch(
    `${API_BASE}/api/admin/products${q ? `?q=${encodeURIComponent(q)}` : ''}`,
    { headers: { ...authHeaders() } }
  );
  if (!r.ok) throw new Error('Erreur chargement produits');
  return r.json();
}

async function createProduct(payload) {
  const r = await fetch(`${API_BASE}/api/admin/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error('Erreur création produit');
  return r.json();
}

async function updateProduct(id, payload) {
  const r = await fetch(`${API_BASE}/api/admin/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const msg = await r.text().catch(() => '');
    throw new Error(msg || 'Erreur mise à jour produit');
  }
  if (r.status === 204) return { ok: true };
  const text = await r.text();
  return text ? JSON.parse(text) : { ok: true };
}

async function deleteProduct(id) {
  const r = await fetch(`${API_BASE}/api/admin/products/${id}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  });
  if (!r.ok) throw new Error('Erreur suppression produit');
  return r.json();
}

async function loadProducts() {
  const q = (prodSearch?.value || '').trim();
  const list = await fetchProducts(q);
  renderProducts(list);
}

/* ================== FORM PRODUIT ================== */
const prodForm = document.getElementById('productForm');
const prodId = document.getElementById('prodId');
const prodTitle = document.getElementById('prodTitle');
const prodSlug = document.getElementById('prodSlug');
const prodPrice = document.getElementById('prodPrice');
const prodStock = document.getElementById('prodStock');
const prodCat = document.getElementById('prodCategory');
const prodDesc = document.getElementById('prodDesc');
const prodPiece = document.getElementById('prodPieceDetail');
const prodCare = document.getElementById('prodCare');
const prodShip = document.getElementById('prodShipping');
const prodColorsInput = document.getElementById('prodColors');
const prodColorsDots = document.getElementById('prodColorsDots');

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

function parseColors(inputValue) {
  if (!inputValue) return [];
  return inputValue
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith('#') ? s : '#' + s))
    .filter((hex) => HEX_RE.test(hex));
}

function renderColorDotsFromInput() {
  if (!prodColorsDots) return;
  const colors = parseColors(prodColorsInput?.value || '');
  prodColorsDots.innerHTML = '';
  colors.forEach((hex) => {
    const dot = document.createElement('span');
    dot.title = hex;
    dot.style.cssText =
      'width:20px;height:20px;border-radius:50%;border:1px solid #ddd;display:inline-block;margin-right:6px;background:' +
      hex;
    prodColorsDots.appendChild(dot);
  });
}
prodColorsInput?.addEventListener('input', renderColorDotsFromInput);

document.getElementById('prodReset')?.addEventListener('click', (e) => {
  e.preventDefault();
  prodForm?.reset();
  if (prodId) prodId.value = '';
  renderImagePreview([]);
  if (prodColorsInput) prodColorsInput.value = '';
  renderColorDotsFromInput();
  renderVariants([]);
});

prodForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const payload = {
      title: prodTitle?.value || '',
      slug: prodSlug?.value || '',
      price: Math.round(Number(prodPrice?.value || 0)),
      stock: Number(prodStock?.value || 0),
      categorySlug: prodCat?.value || null,
      description: (prodDesc?.value || '').trim() || null,
      pieceDetail: (prodPiece?.value || '').trim() || null,
      careAdvice: (prodCare?.value || '').trim() || null,
      shippingReturn: (prodShip?.value || '').trim() || null,
      colors: parseColors(prodColorsInput?.value || ''),
    };

    payload.variants = readVariantsFromUI();
    const id = prodId?.value || '';
    const res = id ? await updateProduct(id, payload) : await createProduct(payload);

    if (msg) {
      msg.textContent = id ? 'Produit mis à jour.' : 'Produit créé.';
      msg.style.color = '#1b5e20';
    }

    await loadProducts();

    const filesInput = document.getElementById('prodFiles');
    const files = filesInput?.files || [];
    if (files.length) {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append('files', f, f.name));
      const up = await fetch(`${API_BASE}/api/admin/products/${res.id}/files`, {
        method: 'POST',
        headers: { ...authHeaders() },
        body: fd,
      });
      if (!up.ok) throw new Error('Upload fichiers échoué');

      try {
        const r = await fetch(`${API_BASE}/api/admin/products/${res.id}`, {
          headers: { ...authHeaders() },
        });
        if (r.ok) {
          const p2 = await r.json();
          renderImagePreview(p2.images || [], p2.id);
        }
      } catch {}
    }
  } catch (err) {
    console.error(err);
    if (msg) {
      msg.textContent = err.message || 'Erreur enregistrement produit.';
      msg.style.color = '#b00020';
    }
  }
});

/* ================== EDIT / DELETE PRODUIT ================== */
productsTableBody?.addEventListener('click', async (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  const editId = t.getAttribute('data-edit');
  const delId = t.getAttribute('data-del');

  if (editId) {
    const r = await fetch(`${API_BASE}/api/admin/products/${editId}`, {
      headers: { ...authHeaders() },
    });
    if (!r.ok) return alert('Erreur chargement produit');
    const p = await r.json();

    if (prodId) prodId.value = p.id;
    if (prodTitle) prodTitle.value = p.title || '';
    if (prodSlug) prodSlug.value = p.slug || '';
    if (prodPrice) prodPrice.value = String(Number(p.price || 0));
    if (prodStock) prodStock.value = p.stock ?? 0;
    if (prodCat) prodCat.value = p.category?.slug || p.category || '';
    if (prodDesc) prodDesc.value = p.description || '';
    if (prodPiece) prodPiece.value = p.pieceDetail || '';
    if (prodCare) prodCare.value = p.careAdvice || '';
    if (prodShip) prodShip.value = p.shippingReturn || '';

    if (prodColorsInput) prodColorsInput.value = (p.colors || []).join(', ');
    renderColorDotsFromInput();
    renderImagePreview(p.images || [], p.id);
    renderVariants(p.variants || []);
  }

  if (delId) {
    if (!confirm('Supprimer ce produit ?')) return;
    try {
      await deleteProduct(delId);
      await loadProducts();
      if (msg) {
        msg.textContent = 'Produit supprimé.';
        msg.style.color = '#1b5e20';
      }
    } catch (err) {
      console.error(err);
      if (msg) {
        msg.textContent = err.message || 'Erreur suppression produit.';
        msg.style.color = '#b00020';
      }
    }
  }
});

/* ================== UTILISATEURS ================== */
const usersTableBody = document.querySelector('#usersTable tbody');
const userSearch = document.getElementById('userSearch');
document.getElementById('userRefresh')?.addEventListener('click', loadUsers);
userSearch?.addEventListener('input', () => loadUsers());

function renderUsers(list = []) {
  if (!usersTableBody) return;
  usersTableBody.innerHTML = '';
  if (!list.length) {
    usersTableBody.innerHTML = `<tr><td colspan="6" class="muted">Aucun utilisateur.</td></tr>`;
    return;
  }
  list.forEach((u) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}</strong></td>
      <td>${u.email || '—'}</td>
      <td>${u.phone || '—'}</td>
      <td>${(u.role || '').toUpperCase() || 'USER'}</td>
      <td>${fmtAddr(u)}</td>
      <td style="white-space:nowrap">
        <button class="btn ghost" data-edit-user="${u.id}">Modifier</button>
        <button class="btn danger" data-del-user="${u.id}">Supprimer</button>
      </td>
    `;
    usersTableBody.appendChild(tr);
  });
}

async function fetchUsers(q = '') {
  const r = await fetch(
    `${API_BASE}/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`,
    { headers: { ...authHeaders() } }
  );
  if (!r.ok) throw new Error('Erreur chargement utilisateurs');
  return r.json();
}

async function loadUsers() {
  const q = (userSearch?.value || '').trim();
  const list = await fetchUsers(q);
  renderUsers(list);
}

async function updateUser(id, payload) {
  const r = await fetch(`${API_BASE}/api/admin/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error('Erreur mise à jour utilisateur');
  return r.json();
}

async function deleteUser(id) {
  const r = await fetch(`${API_BASE}/api/admin/users/${id}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  });
  if (!r.ok) throw new Error('Erreur suppression utilisateur');
  return r.json();
}

usersTableBody?.addEventListener('click', async (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  const delId = t.getAttribute('data-del-user');
  if (delId) {
    if (!confirm('Supprimer cet utilisateur ?')) return;
    try {
      await deleteUser(delId);
      await loadUsers();
      if (msg) {
        msg.textContent = 'Utilisateur supprimé.';
        msg.style.color = '#1b5e20';
      }
    } catch (err) {
      console.error(err);
      if (msg) {
        msg.textContent = err.message || 'Erreur suppression utilisateur.';
        msg.style.color = '#b00020';
      }
    }
  }
});

/* ================== STATISTIQUES ================== */
const statsFrom = document.getElementById('statsFrom');
const statsTo = document.getElementById('statsTo');
document.getElementById('statsRefresh')?.addEventListener('click', () => loadStats());

async function fetchJSON(url) {
  const r = await fetch(url, { headers: { ...authHeaders() } });
  if (!r.ok) throw new Error('Erreur chargement stats');
  return r.json();
}

function dateParam() {
  const from = statsFrom?.value;
  const to = statsTo?.value;
  const qs = new URLSearchParams();
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  const q = qs.toString();
  return q ? `?${q}` : '';
}

async function loadStats() {
  try {
    const [summary, funnel, top] = await Promise.all([
      fetchJSON(`${API_BASE}/api/admin/analytics/summary${dateParam()}`),
      fetchJSON(`${API_BASE}/api/admin/analytics/funnel${dateParam()}`),
      fetchJSON(`${API_BASE}/api/admin/analytics/top-products${dateParam()}`),
    ]);

    document.getElementById('kpiVisitors').textContent = summary.visitors ?? '—';
    document.getElementById('kpiSessions').textContent = summary.sessions ?? '—';
    document.getElementById('kpiRevenue').textContent = `CHF ${(Number(summary.revenue || 0) / 100).toFixed(2)}`;
    document.getElementById('kpiCVR').textContent =
      summary.conversionRate != null ? (summary.conversionRate * 100).toFixed(2) + '%' : '—';

    document.getElementById('fvViews').textContent = funnel.productViews ?? '—';
    document.getElementById('fvATC').textContent = funnel.addToCarts ?? '—';
    document.getElementById('fvCheckout').textContent = funnel.beginCheckouts ?? '—';
    document.getElementById('fvPurchase').textContent = funnel.purchases ?? '—';

    renderTopProducts(top || []);
  } catch (e) {
    console.error(e);
    if (msg) {
      msg.textContent = e.message || 'Erreur chargement statistiques.';
      msg.style.color = '#b00020';
    }
  }
}

function renderTopProducts(list = []) {
  const tb = document.querySelector('#topProductsTable tbody');
  if (!tb) return;
  tb.innerHTML = '';
  if (!list.length) {
    tb.innerHTML = `<tr><td colspan="6" class="muted">Aucune donnée.</td></tr>`;
    return;
  }
  for (const p of list) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${p.title || '—'}</strong></td>
      <td>${p.views ?? 0}</td>
      <td>${p.addToCarts ?? 0}</td>
      <td>${p.purchases ?? 0}</td>
      <td>${p.favorites ?? 0}</td>
      <td>CHF ${(Number(p.revenue || 0) / 100).toFixed(2)}</td>
    `;
    tb.appendChild(tr);
  }
}

/* ================== SONDAGES (ADMIN) ================== */
const survTb = document.querySelector('#surveysTable tbody');
document.getElementById('survRefresh')?.addEventListener('click', loadSurveys);

async function fetchSurveys() {
  const r = await fetch(SURVEY_API, { headers: { ...authHeaders() } });
  if (!r.ok) throw new Error('Erreur chargement sondages');
  return r.json();
}

async function fetchSurveyStats() {
  const r = await fetch(SURVEY_STATS_API, { headers: { ...authHeaders() } });
  if (!r.ok) throw new Error('Erreur chargement stats sondage');
  return r.json();
}

function renderSurveyStats(s) {
  document.getElementById('svTotal').textContent = s.total ?? 0;
  document.getElementById('svMugs').textContent = s.breakdown?.MUGS_COLORFUL ?? 0;
  document.getElementById('svPlates').textContent = s.breakdown?.PLATES_MINIMAL ?? 0;
  document.getElementById('svBowls').textContent = s.breakdown?.BOWLS_GENEROUS ?? 0;
}

function renderSurveys(rows = []) {
  if (!survTb) return;
  survTb.innerHTML = '';
  if (!rows.length) {
    survTb.innerHTML = `<tr><td colspan="4" class="muted">Aucune réponse pour le moment.</td></tr>`;
    return;
  }
  for (const r of rows) {
    const d = new Date(r.createdAt);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.toLocaleString('fr-CH')}</td>
      <td>${r.choice}</td>
      <td>${r.otherText || '—'}</td>
      <td>${r.email || '—'}</td>
    `;
    survTb.appendChild(tr);
  }
}

async function loadSurveys() {
  try {
    const [rows, stats] = await Promise.all([fetchSurveys(), fetchSurveyStats()]);
    renderSurveys(rows);
    renderSurveyStats(stats);
  } catch (e) {
    console.error(e);
    if (msg) {
      msg.textContent = e.message || 'Erreur chargement sondages.';
      msg.style.color = '#b00020';
    }
  }
}

/* ================== Responsive table labels ================== */
(function responsiveTableLabels() {
  const tables = document.querySelectorAll('table');
  tables.forEach((table) => {
    const heads = Array.from(table.querySelectorAll('thead th')).map((th) =>
      th.textContent.trim()
    );
    table.querySelectorAll('tbody tr').forEach((row) => {
      Array.from(row.children).forEach((td, i) => {
        const label = heads[i] || '';
        if (label) td.setAttribute('data-th', label);
      });
    });
  });
})();

/* ================== BOOT (charger vues initiales) ================== */
if (initial === 'products') loadProducts();
if (initial === 'users') loadUsers();
if (initial === 'orders') loadOrders();
if (initial === 'stats') loadStats();
if (initial === 'surveys') loadSurveys();
if (initial === 'settings') loadSettings();
