// /js/pages/admin.page.js
import { authHeaders } from '/js/state.js';
import { logout } from '/js/api.js'; // pour reprendre le même bouton que sur "compte"

const API_BASE = 'http://localhost:4000'; // adapte si besoin
const CHF = (v) => `CHF ${(Number(v || 0)/100).toFixed(2)}`;

const msg = document.getElementById('msg');

// ===== Guard minimal : si pas de token → retour accueil
const hasAnyToken =
  !!localStorage.getItem('token.v1') ||
  !!localStorage.getItem('token') ||
  !!localStorage.getItem('accessToken');

if (!hasAnyToken) {
  location.href = 'index.html';
}

// ====== NAV
const tabs = Array.from(document.querySelectorAll('.ad-tab'));
const views = {
  orders:   document.getElementById('view-orders'),
  products: document.getElementById('view-products'),
  users:    document.getElementById('view-users'),
  settings: document.getElementById('view-settings'),
};
function show(view) {
  const valid = Object.keys(views);
  const target = valid.includes(view) ? view : 'orders';
  Object.entries(views).forEach(([k, el]) => el.hidden = (k !== target));
  tabs.forEach(b => b.classList.toggle('is-active', b.dataset.view === target));
  if (location.hash !== `#${target}`) history.replaceState({}, '', `#${target}`);
  // charge la vue
  if (target === 'orders')   loadOrders().catch(()=>{});
  if (target === 'products') loadProducts().catch(()=>{});
  if (target === 'users')    loadUsers().catch(()=>{});
}
tabs.forEach(btn => btn.addEventListener('click', (e)=>{
  e.preventDefault();
  show(btn.dataset.view);
}));

// ====== Déconnexion (même pattern que la page compte)
document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  logout(); // efface tokens côté /js/api.js
  location.href = 'index.html';
});

// ====== -------- Commandes --------
const ordersTbody = document.querySelector('#ordersTable tbody');

async function fetchAllOrders() {
  const r = await fetch(`${API_BASE}/api/admin/orders`, {
    headers: { ...authHeaders() }
  });
  if (r.status === 401) throw new Error('Non authentifié');
  if (r.status === 403) throw new Error('Accès réservé aux administrateurs');
  if (!r.ok) throw new Error('Erreur chargement');
  return r.json();
}
function fmtAddr(u) {
  if (!u) return '—';
  const parts = [
    u.addressLine1,
    u.addressLine2,
    [u.zip, u.city].filter(Boolean).join(' '),
    u.country
  ].filter(Boolean);
  return parts.join(', ');
}
function renderOrders(list=[]) {
  ordersTbody.innerHTML = '';
  if (!list.length) { msg.textContent = 'Aucune commande.'; return; }
  msg.textContent = '';
  list.forEach(o => {
    const d = new Date(o.createdAt);
    const items = (o.items || []).map(it =>
      `${it.quantity}× ${it.title || 'Article'} (${CHF(it.unitPrice)})`
    ).join('<br/>');
    const user = o.user || {};
    const pay = `${o.paymentMethod || '-'} / ${o.paymentStatus || '-'}`;
    const status = o.status === 'PAID' ? '<span class="tag payee">Payée</span>' : (o.status || '-');
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
      <td><strong>${CHF(o.amount)}</strong><br/>${status}</td>
      <td>${pay}</td>
    `;
    ordersTbody.appendChild(tr);
  });
}
async function loadOrders() {
  try {
    const orders = await fetchAllOrders();
    renderOrders(orders);
  } catch (e) {
    console.error(e);
    msg.textContent = e.message || 'Erreur.';
  }
}

// ====== -------- Produits (CRUD) --------
const prodTbody = document.querySelector('#productsTable tbody');
const prodSearch = document.getElementById('prodSearch');
document.getElementById('prodRefresh')?.addEventListener('click', ()=>loadProducts());

async function fetchProducts(q='') {
  const url = new URL(`${API_BASE}/api/admin/products`);
  if (q) url.searchParams.set('q', q);
  const r = await fetch(url, { headers: { ...authHeaders() } });
  if (!r.ok) throw new Error('Erreur chargement produits');
  return r.json();
}
function renderProducts(list=[]) {
  prodTbody.innerHTML = '';
  if (!list.length) {
    prodTbody.innerHTML = `<tr><td colspan="6" class="muted">Aucun produit.</td></tr>`;
    return;
  }
  list.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${p.title || '—'}</strong></td>
      <td>${p.slug || '—'}</td>
      <td>${CHF(p.price)}</td>
      <td>${p.stock ?? 0}</td>
      <td>${p.category || '—'}</td>
      <td style="white-space:nowrap">
        <button class="btn ghost" data-edit="${p.id}">Modifier</button>
        <button class="btn danger" data-del="${p.id}">Supprimer</button>
      </td>
    `;
    prodTbody.appendChild(tr);
  });
}
async function loadProducts() {
  const q = (prodSearch?.value || '').trim();
  const list = await fetchProducts(q);
  renderProducts(list);
}

// form create/update
const prodForm = document.getElementById('productForm');
const prodId   = document.getElementById('prodId');
const prodTitle= document.getElementById('prodTitle');
const prodSlug = document.getElementById('prodSlug');
const prodPrice= document.getElementById('prodPrice');
const prodStock= document.getElementById('prodStock');
const prodCat  = document.getElementById('prodCategory');
const prodDesc = document.getElementById('prodDesc');
document.getElementById('prodReset')?.addEventListener('click', (e)=>{
  e.preventDefault();
  prodForm.reset();
  prodId.value = '';
});

async function createProduct(payload){
  const r = await fetch(`${API_BASE}/api/admin/products`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', ...authHeaders() },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error('Erreur création produit');
  return r.json();
}
async function updateProduct(id, payload){
  const r = await fetch(`${API_BASE}/api/admin/products/${id}`, {
    method:'PUT',
    headers:{ 'Content-Type':'application/json', ...authHeaders() },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error('Erreur mise à jour produit');
  return r.json();
}
async function deleteProduct(id){
  const r = await fetch(`${API_BASE}/api/admin/products/${id}`, {
    method:'DELETE',
    headers:{ ...authHeaders() }
  });
  if (!r.ok) throw new Error('Erreur suppression produit');
  return true;
}

prodForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const payload = {
    title: (prodTitle.value||'').trim(),
    slug:  (prodSlug.value||'').trim(),
    price: Number(prodPrice.value||0),
    stock: Number(prodStock.value||0),
    category: (prodCat.value||'').trim(),
    description: (prodDesc.value||'').trim()
  };
  try{
    if (prodId.value) await updateProduct(prodId.value, payload);
    else await createProduct(payload);
    prodForm.reset(); prodId.value='';
    await loadProducts();
    msg.textContent = 'Produit enregistré.'; msg.style.color = '#1b5e20';
  }catch(err){
    console.error(err);
    msg.textContent = err.message || 'Erreur produit.'; msg.style.color = '#b00020';
  }
});

// actions table (edit/delete)
prodTbody?.addEventListener('click', async (e)=>{
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  const editId = t.getAttribute('data-edit');
  const delId  = t.getAttribute('data-del');

  if (editId){
    // récup simple en mémoire depuis la ligne
    const tr = t.closest('tr');
    prodId.value    = editId;
    prodTitle.value = tr.children[0].innerText.trim();
    prodSlug.value  = tr.children[1].innerText.trim();
    prodPrice.value = (Number((tr.children[2].innerText||'').replace(/[^\d]/g,''))||0);
    prodStock.value = Number(tr.children[3].innerText||0);
    prodCat.value   = tr.children[4].innerText.trim() || 'vaisselle';
    prodDesc.value  = '';
    prodTitle.focus();
  }

  if (delId){
    if (!confirm('Supprimer ce produit ?')) return;
    try{
      await deleteProduct(delId);
      await loadProducts();
      msg.textContent = 'Produit supprimé.'; msg.style.color = '#1b5e20';
    }catch(err){
      console.error(err);
      msg.textContent = err.message || 'Erreur suppression.'; msg.style.color = '#b00020';
    }
  }
});

prodSearch?.addEventListener('keydown', (e)=>{
  if (e.key === 'Enter') loadProducts();
});

// ====== -------- Utilisateurs (CRUD léger) --------
const usersTbody  = document.querySelector('#usersTable tbody');
const userSearch  = document.getElementById('userSearch');
document.getElementById('userRefresh')?.addEventListener('click', ()=>loadUsers());

async function fetchUsers(q=''){
  const url = new URL(`${API_BASE}/api/admin/users`);
  if (q) url.searchParams.set('q', q);
  const r = await fetch(url, { headers: { ...authHeaders() } });
  if (!r.ok) throw new Error('Erreur chargement utilisateurs');
  return r.json();
}
function renderUsers(list=[]){
  usersTbody.innerHTML = '';
  if (!list.length){
    usersTbody.innerHTML = `<tr><td colspan="6" class="muted">Aucun utilisateur.</td></tr>`;
    return;
  }
  list.forEach(u=>{
    const addr = [u.addressLine1, u.addressLine2, [u.zip,u.city].filter(Boolean).join(' '), u.country].filter(Boolean).join(', ');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${[u.firstName,u.lastName].filter(Boolean).join(' ') || '—'}</strong></td>
      <td>${u.email || '—'}</td>
      <td>${u.phone || '—'}</td>
      <td>
        <select data-role="${u.id}">
          <option value="user" ${u.role==='user'?'selected':''}>user</option>
          <option value="admin" ${u.role==='admin'?'selected':''}>admin</option>
        </select>
      </td>
      <td>${addr || '—'}</td>
      <td style="white-space:nowrap">
        <button class="btn ghost" data-save="${u.id}">Enregistrer</button>
        <button class="btn danger" data-del-user="${u.id}">Supprimer</button>
      </td>
    `;
    usersTbody.appendChild(tr);
  });
}
async function loadUsers(){
  const q = (userSearch?.value||'').trim();
  const list = await fetchUsers(q);
  renderUsers(list);
}

// update & delete user
async function updateUser(id, payload){
  const r = await fetch(`${API_BASE}/api/admin/users/${id}`, {
    method:'PUT',
    headers:{ 'Content-Type':'application/json', ...authHeaders() },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error('Erreur mise à jour utilisateur');
  return r.json();
}
async function deleteUser(id){
  const r = await fetch(`${API_BASE}/api/admin/users/${id}`, {
    method:'DELETE',
    headers:{ ...authHeaders() }
  });
  if (!r.ok) throw new Error('Erreur suppression utilisateur');
  return true;
}

usersTbody?.addEventListener('click', async (e)=>{
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;

  const saveId = t.getAttribute('data-save');
  const delId  = t.getAttribute('data-del-user');

  if (saveId){
    const roleSel = usersTbody.querySelector(`select[data-role="${saveId}"]`);
    const role = roleSel?.value || 'user';
    try{
      await updateUser(saveId, { role });
      msg.textContent = 'Utilisateur mis à jour.'; msg.style.color = '#1b5e20';
    }catch(err){
      console.error(err);
      msg.textContent = err.message || 'Erreur utilisateur.'; msg.style.color = '#b00020';
    }
  }

  if (delId){
    if (!confirm('Supprimer cet utilisateur ?')) return;
    try{
      await deleteUser(delId);
      await loadUsers();
      msg.textContent = 'Utilisateur supprimé.'; msg.style.color = '#1b5e20';
    }catch(err){
      console.error(err);
      msg.textContent = err.message || 'Erreur suppression utilisateur.'; msg.style.color = '#b00020';
    }
  }
});

userSearch?.addEventListener('keydown', (e)=>{
  if (e.key === 'Enter') loadUsers();
});

// ===== Boot
const initial = (location.hash || '#orders').slice(1);
show(initial);
