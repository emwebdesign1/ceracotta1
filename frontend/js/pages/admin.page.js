// /js/pages/admin.page.js
import { authHeaders } from '/js/state.js';
import { logout, me } from '/js/api.js';

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

const API_BASE = 'http://localhost:4000';

// ===== Helpers UI
const $ = (s) => document.querySelector(s);
const CHF = (v) => `CHF ${(Number(v || 0) / 100).toFixed(2)}`;
function fmtAddr(u = {}) {
  const parts = [
    [u.addressLine1, u.addressLine2].filter(Boolean).join(' '),
    [u.postalCode, u.city].filter(Boolean).join(' '),
    u.country,
  ].filter(Boolean);
  return parts.join(', ');
}

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
    img.src = url;
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


// ===== Views
const views = {
  products: document.getElementById('view-products'),
  users: document.getElementById('view-users'),
  orders: document.getElementById('view-orders'),
  settings: document.getElementById('view-settings'),
  stats: document.getElementById('view-stats'),
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
  });
});
const initial = (location.hash || '#products').slice(1);
show(initial);

// ===== Logout
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  try {
    await logout();
  } finally {
    location.href = '/index.html';
  }
});

// ===== Message global
const msg = document.getElementById('msg');

// ------------------------------------------------------
// =============== PRODUITS ==============================
// ------------------------------------------------------
const prodTableBody = document.querySelector('#productsTable tbody');
const prodSearch = document.getElementById('prodSearch');
document.getElementById('prodRefresh')?.addEventListener('click', loadProducts);
prodSearch?.addEventListener('input', () => loadProducts());

function productThumbHTML(p) {
  const imgs = Array.isArray(p.images) ? p.images : [];
  const firstRaw = imgs[0];
  const first = typeof firstRaw === 'string' ? firstRaw : (firstRaw?.url || '/images/placeholder.png');
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
  if (!prodTableBody) return;
  prodTableBody.innerHTML = '';
  if (!list.length) {
    prodTableBody.innerHTML = `<tr><td colspan="6" class="muted">Aucun produit.</td></tr>`;
    return;
  }
  list.forEach((p) => {
    const tr = document.createElement('tr');
    tr.dataset.description = p.description || '';
    tr.dataset.pieceDetail = p.pieceDetail || '';
    tr.dataset.careAdvice = p.careAdvice || '';
    tr.dataset.shippingReturn = p.shippingReturn || '';
    tr.dataset.images = JSON.stringify(p.images || []);

    tr.dataset.colors = JSON.stringify((p.colors || []).map(c => c?.hex ?? c).filter(Boolean));

    tr.innerHTML = `
      <td>${productThumbHTML(p)}</td>
      <td>${p.slug || '—'}</td>
      <td>${CHF(p.price)}</td>
      <td>${p.stock ?? 0}</td>
      <td>${p.category || '—'}</td>
      <td style="white-space:nowrap">
        <button class="btn ghost" data-edit="${p.id}">Modifier</button>
        <button class="btn danger" data-del="${p.id}">Supprimer</button>
      </td>
    `;
    prodTableBody.appendChild(tr);
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
  if (!r.ok) throw new Error('Erreur mise à jour produit');
  return r.json();
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

// form create/update
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
const prodColorsDots  = document.getElementById('prodColorsDots');

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
function parseColors(inputValue) {
  if (!inputValue) return [];
  return inputValue
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => (s.startsWith('#') ? s : '#' + s))
    .filter(hex => HEX_RE.test(hex));
}
function renderColorDotsFromInput() {
  if (!prodColorsDots) return;
  const colors = parseColors(prodColorsInput?.value || '');
  prodColorsDots.innerHTML = '';
  colors.forEach(hex => {
    const dot = document.createElement('span');
    dot.title = hex;
    dot.style.cssText = 'width:20px;height:20px;border-radius:50%;border:1px solid #ddd;display:inline-block;margin-right:6px;background:'+hex;
    prodColorsDots.appendChild(dot);
  });
}
prodColorsInput?.addEventListener('input', renderColorDotsFromInput);

document.getElementById('prodReset')?.addEventListener('click', (e) => {
  e.preventDefault();
  prodForm.reset();
  prodId.value = '';
  renderImagePreview([]);
  if (prodColorsInput) prodColorsInput.value = '';
  renderColorDotsFromInput();
});

prodForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    title: prodTitle.value.trim(),
    slug: prodSlug.value.trim(),
    price: Number(prodPrice.value || 0),
    stock: Number(prodStock.value || 0),
    categorySlug: prodCat.value.trim(),
    description: prodDesc.value.trim(),
    pieceDetail: (prodPiece?.value || '').trim(),
    careAdvice: (prodCare?.value || '').trim(),
    shippingReturn: (prodShip?.value || '').trim(),
    colors: parseColors(prodColorsInput?.value || ''),
  };

  try {
    let product;
    if (prodId.value) product = await updateProduct(prodId.value, payload);
    else product = await createProduct(payload);

    const filesInput = document.getElementById('prodFiles');
    const fileList = filesInput?.files || [];
    if (fileList.length) {
      const fd = new FormData();
      for (const f of fileList) fd.append('files', f);
      const up = await fetch(`${API_BASE}/api/admin/products/${product.id}/files`, {
        method: 'POST',
        headers: { ...authHeaders() },
        body: fd,
      });
      if (!up.ok) throw new Error('Erreur upload images');
      filesInput.value = '';
    }

    prodForm.reset();
    prodId.value = '';
    renderImagePreview([]);
    if (prodColorsInput) prodColorsInput.value = '';
    renderColorDotsFromInput();

    await loadProducts();
    if (msg) {
      msg.textContent = 'Produit enregistré avec images.';
      msg.style.color = '#1b5e20';
    }
  } catch (err) {
    console.error(err);
    if (msg) {
      msg.textContent = err.message || 'Erreur produit.';
      msg.style.color = '#b00020';
    }
  }
});

prodTableBody?.addEventListener('click', async (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  const editId = t.getAttribute('data-edit');
  const delId = t.getAttribute('data-del');

  if (editId) {
    const tr = t.closest('tr');
    prodId.value = editId;
    const titleStrong = tr.children[0].querySelector('strong');
    prodTitle.value = titleStrong
      ? titleStrong.textContent.trim()
      : tr.children[0].innerText.trim();
    prodSlug.value = tr.children[1].innerText.trim();
    prodPrice.value = Number((tr.children[2].innerText || '').replace(/[^\d]/g, '')) || 0;
    prodStock.value = Number(tr.children[3].innerText || 0);
    prodCat.value = tr.children[4].innerText.trim() || 'vaisselle';
    prodDesc.value = tr.dataset.description || '';
    if (prodPiece) prodPiece.value = tr.dataset.pieceDetail || '';
    if (prodCare) prodCare.value = tr.dataset.careAdvice || '';
    if (prodShip) prodShip.value = tr.dataset.shippingReturn || '';
    const imgs = JSON.parse(tr.dataset.images || '[]');
    renderImagePreview(imgs, prodId.value);

    try {
      const cols = JSON.parse(tr.dataset.colors || '[]');
      const value = (Array.isArray(cols) ? cols : []).join(',');
      if (prodColorsInput) prodColorsInput.value = value;
      renderColorDotsFromInput();
    } catch {
      if (prodColorsInput) prodColorsInput.value = '';
      renderColorDotsFromInput();
    }

    prodTitle.focus();
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

// ------------------------------------------------------
// =============== COMMANDES ============================
// ------------------------------------------------------
const ordersTableBody = document.querySelector('#ordersTable tbody');
function renderOrders(list = []) {
  if (!ordersTableBody) return;
  ordersTableBody.innerHTML = '';
  if (!list.length) {
    if (msg) msg.textContent = 'Aucune commande.';
    return;
  }
  if (msg) msg.textContent = '';
  list.forEach((o) => {
    const d = new Date(o.createdAt);
    const items = (o.items || [])
      .map((it) => `${it.quantity}× ${it.title || 'Article'} (${CHF(it.unitPrice)})`)
      .join('<br/>');
    const user = o.user || {};
    const pay = `${o.paymentMethod || '-'} / ${o.paymentStatus || '-'}`;
    const status =
      o.status === 'PAID' ? '<span class="tag payee">Payée</span>' : (o.status || '-');
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
  const r = await fetch(`${API_BASE}/api/admin/orders`, {
    headers: { ...authHeaders() },
  });
  if (!r.ok) throw new Error('Erreur chargement commandes');
  return r.json();
}
async function loadOrders() {
  const list = await fetchOrders();
  renderOrders(list);
}

// ------------------------------------------------------
// =============== UTILISATEURS =========================
// ------------------------------------------------------
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
    {
      headers: { ...authHeaders() },
    }
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

// ------------------------------------------------------
// =============== STATISTIQUES ==========================
// ------------------------------------------------------
const statsFrom = document.getElementById('statsFrom');
const statsTo   = document.getElementById('statsTo');
document.getElementById('statsRefresh')?.addEventListener('click', () => loadStats());

async function fetchJSON(url) {
  const r = await fetch(url, { headers: { ...authHeaders() } });
  if (!r.ok) throw new Error('Erreur chargement stats');
  return r.json();
}

function dateParam() {
  const from = statsFrom?.value;
  const to   = statsTo?.value;
  const qs = new URLSearchParams();
  if (from) qs.set('from', from);
  if (to)   qs.set('to', to);
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
    document.getElementById('kpiRevenue').textContent  = `CHF ${(Number(summary.revenue||0)/100).toFixed(2)}`;
    document.getElementById('kpiCVR').textContent      = summary.conversionRate != null
      ? (summary.conversionRate * 100).toFixed(2) + '%'
      : '—';

    document.getElementById('fvViews').textContent    = funnel.productViews ?? '—';
    document.getElementById('fvATC').textContent      = funnel.addToCarts ?? '—';
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
      <td>CHF ${(Number(p.revenue||0)/100).toFixed(2)}</td>
    `;
    tb.appendChild(tr);
  }
}

// ===== Responsive table labels =====
(function responsiveTableLabels(){
  const tables = document.querySelectorAll('table');
  tables.forEach(table => {
    const heads = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
    table.querySelectorAll('tbody tr').forEach(row => {
      Array.from(row.children).forEach((td, i) => {
        const label = heads[i] || '';
        if (label) td.setAttribute('data-th', label);
      });
    });
  });
})();
  

// ===== Boot
const startView = (location.hash || '#products').slice(1);
show(startView);
if (startView === 'products') loadProducts();
if (startView === 'users') loadUsers();
if (startView === 'orders') loadOrders();
if (startView === 'stats') loadStats();
