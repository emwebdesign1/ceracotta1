// /js/pages/account.page.js
import { me, logout } from '/js/api.js';
import { authHeaders } from '/js/state.js';

/* ================== CONFIG ================== */
// Laisse vide ('') si ton front et ton API sont sur le même domaine.
// Mets 'http://localhost:4000' en dev si besoin.
const API_BASE = '';

const ACCOUNT_ME_API  = `${API_BASE}/api/account/me`;
const ACCOUNT_PWD_API = `${API_BASE}/api/account/me/password`;

/* ================== GUARD ================== */
const hasAnyToken =
  !!localStorage.getItem('token.v1') ||
  !!localStorage.getItem('token') ||
  !!localStorage.getItem('accessToken');

if (!hasAnyToken) {
  location.href = 'index.html';
}

/* ================== SELECTEURS ================== */
const views = {
  orders:   document.getElementById('view-orders'),
  settings: document.getElementById('view-settings'),
};
const menuItems    = Array.from(document.querySelectorAll('.menu-item'));
const helloEl      = document.getElementById('helloText');
const msgEl        = document.getElementById('meMsg');

const tb           = document.querySelector('#ordersTable tbody');
const ordersEmpty  = document.getElementById('ordersEmpty');

// Formulaires Paramètres (si présents)
const formProfile  = document.getElementById('formProfile');
const formPassword = document.getElementById('formPassword');

/* Champs non éditables (affichés seulement) */
const inpUsername  = document.getElementById('setUsername'); // disabled dans le HTML
const inpEmail     = document.getElementById('setEmail');    // disabled dans le HTML

/* Champs éditables */
const inpFirstName = document.getElementById('setFirstName');
const inpLastName  = document.getElementById('setLastName');
const inpPhone     = document.getElementById('setPhone');
const inpAddr1     = document.getElementById('setAddressLine1');
const inpAddr2     = document.getElementById('setAddressLine2');
const inpZip       = document.getElementById('setZip');
const inpCity      = document.getElementById('setCity');
const inpCountry   = document.getElementById('setCountry');

/* ================== HELPERS UI ================== */
function show(view) {
  const valid = ['orders', 'settings'];
  const target = valid.includes(view) ? view : 'orders';

  Object.entries(views).forEach(([k, el]) => {
    if (!el) return;
    el.hidden = (k !== target);
  });

  menuItems.forEach(btn => btn.classList.toggle('is-active', btn.dataset.view === target));

  if (location.hash !== `#${target}`) {
    history.replaceState({}, '', `#${target}`);
  }

  if (target === 'settings') loadProfileEditable();
  if (target === 'orders')   loadOrders();
}

function fillText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = (v ?? '–');
}

function setHello(user) {
  const pseudo = user?.username || user?.firstName || 'cher client';
  if (helloEl) helloEl.textContent = `Bonjour, ${pseudo}`;
}

function setValue(el, v) { if (el) el.value = v ?? ''; }

/* ================== DATA LOADERS (lecture seule) ================== */
async function loadProfileReadonly() {
  try {
    const { user } = await me();
    if (!user) {
      location.href = 'index.html';
      return;
    }
    setHello(user);
    fillText('username',  user.username);
    fillText('email',     user.email);
    fillText('firstName', user.firstName);
    fillText('lastName',  user.lastName);
    fillText('phone',     user.phone);
    fillText('address',   [user.addressLine1, user.addressLine2, user.zip].filter(Boolean).join(', ') || '–');
    fillText('city',      user.city);
    fillText('country',   user.country);
    if (msgEl) msgEl.textContent = '';
  } catch (e) {
    if (msgEl) msgEl.textContent = 'Impossible de charger vos informations.';
    console.error(e);
  }
}

/* ================== DATA LOADERS (édition) ================== */
async function fetchAccountMe() {
  const r = await fetch(ACCOUNT_ME_API, { headers: { ...authHeaders() } });
  if (!r.ok) throw new Error('Erreur chargement profil');
  return r.json(); // { user: {...} }
}

async function loadProfileEditable() {
  try {
    // Met à jour aussi le bloc lecture seule
    await loadProfileReadonly();

    if (!formProfile) return; // pas de formulaire -> on s'arrête
    const { user } = await fetchAccountMe();
    if (!user) return;

    // Champs non éditables : juste affichage
    setValue(inpUsername, user.username);
    setValue(inpEmail,    user.email);

    // Champs éditables
    setValue(inpFirstName, user.firstName);
    setValue(inpLastName,  user.lastName);
    setValue(inpPhone,     user.phone);
    setValue(inpAddr1,     user.addressLine1);
    setValue(inpAddr2,     user.addressLine2);
    setValue(inpZip,       user.zip);
    setValue(inpCity,      user.city);
    setValue(inpCountry,   user.country);

    if (msgEl) { msgEl.textContent = ''; msgEl.style.color = ''; }
  } catch (e) {
    console.error(e);
    if (msgEl) { msgEl.textContent = 'Erreur chargement paramètres.'; msgEl.style.color = '#b00020'; }
  }
}

/* ================== COMMANDES ================== */
async function fetchMyOrders() {
  try {
    const r = await fetch('/api/orders/my', { headers: { ...authHeaders() } });
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}

async function loadOrders() {
  if (!tb) return;
  try {
    const list = await fetchMyOrders();
    tb.innerHTML = '';
    if (!Array.isArray(list) || list.length === 0) {
      if (ordersEmpty) {
        ordersEmpty.hidden = false;
        ordersEmpty.textContent = 'Vous n’avez pas encore de commande.';
      }
      return;
    }
    if (ordersEmpty) ordersEmpty.hidden = true;

    list.forEach(o => {
      const created = new Date(o.createdAt);
      const amountCHF = `CHF ${(Number(o.amount || 0)/100).toFixed(2)}`;
      const statusLabel = ({
        PAID:'Payée',
        PENDING:'En attente',
        CANCELLED:'Annulée'
      })[o.status] || (o.status || '-');

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${created.toLocaleString('fr-CH')}</td>
        <td>${o.reference || o.id || '-'}</td>
        <td>${amountCHF}</td>
        <td>${statusLabel}</td>
        <td>${o.paymentMethod || '-'}</td>
      `;
      tb.appendChild(tr);
    });
  } catch (e) {
    if (ordersEmpty) {
      ordersEmpty.hidden = false;
      ordersEmpty.textContent = 'Erreur de chargement.';
    }
    console.error(e);
  }
}

/* ================== EVENTS ================== */
menuItems.forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    show(btn.dataset.view);
  });
});

// Déconnexion (gère plusieurs #logoutBtn s'il y en a)
document.querySelectorAll('#logoutBtn').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    logout();
    location.href = 'index.html';
  });
});

/* ---- Soumission profil (email & username exclus) ---- */
formProfile?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const payload = {
      // ⚠️ on n’envoie PAS email / username → non modifiables
      firstName:     inpFirstName?.value || null,
      lastName:      inpLastName?.value  || null,
      phone:         inpPhone?.value     || null,
      addressLine1:  inpAddr1?.value     || null,
      addressLine2:  inpAddr2?.value     || null,
      zip:           inpZip?.value       || null,
      city:          inpCity?.value      || null,
      country:       inpCountry?.value   || null,
    };

    const r = await fetch(ACCOUNT_ME_API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || 'Erreur mise à jour');

    if (msgEl) { msgEl.textContent = 'Profil mis à jour.'; msgEl.style.color = '#1b5e20'; }

    // Recharge proprement
    await loadProfileEditable();
  } catch (err) {
    console.error(err);
    if (msgEl) { msgEl.textContent = err.message || 'Erreur mise à jour profil.'; msgEl.style.color = '#b00020'; }
  }
});

/* ---- Changement de mot de passe ---- */
formPassword?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const cur = document.getElementById('pwdCurrent')?.value || '';
  const n1  = document.getElementById('pwdNew')?.value || '';
  const n2  = document.getElementById('pwdNew2')?.value || '';
  if (n1 !== n2) {
    if (msgEl) { msgEl.textContent = 'Les nouveaux mots de passe ne correspondent pas.'; msgEl.style.color = '#b00020'; }
    return;
  }
  try {
    const r = await fetch(ACCOUNT_PWD_API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ currentPassword: cur, newPassword: n1 }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || 'Erreur mot de passe');

    // Reset UI
    document.getElementById('pwdCurrent').value = '';
    document.getElementById('pwdNew').value = '';
    document.getElementById('pwdNew2').value = '';

    if (msgEl) { msgEl.textContent = 'Mot de passe mis à jour.'; msgEl.style.color = '#1b5e20'; }
  } catch (err) {
    console.error(err);
    if (msgEl) { msgEl.textContent = err.message || 'Erreur changement de mot de passe.'; msgEl.style.color = '#b00020'; }
  }
});

/* ================== BOOT ================== */
const initial = (location.hash || '#orders').slice(1);
show(initial);
loadProfileReadonly().catch(() => {});
