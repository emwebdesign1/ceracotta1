// /js/pages/account.page.js
import { me, logout } from '/js/api.js';
import { authHeaders } from '/js/state.js';

// ------- Guard minimal : si aucun token stocké, retour accueil
const hasAnyToken =
  !!localStorage.getItem('token.v1') ||
  !!localStorage.getItem('token') ||
  !!localStorage.getItem('accessToken');

if (!hasAnyToken) {
  location.href = 'index.html';
}

// ------- Sélecteurs
const views = {
  orders:   document.getElementById('view-orders'),
  settings: document.getElementById('view-settings'),
};
const menuItems = Array.from(document.querySelectorAll('.menu-item'));
const helloEl = document.getElementById('helloText');
const msgEl   = document.getElementById('meMsg');
const tb = document.querySelector('#ordersTable tbody');
const ordersEmpty = document.getElementById('ordersEmpty');

// ------- Helpers UI
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

  if (target === 'settings') loadProfile();
  if (target === 'orders')   loadOrders();
}

function fill(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = (v ?? '–');
}

function setHello(user) {
  const pseudo = user?.username || user?.firstName || 'cher client';
  if (helloEl) helloEl.textContent = `Bonjour, ${pseudo}`;
}

// ------- Data loaders
async function loadProfile() {
  try {
    const { user } = await me();
    if (!user) {
      location.href = 'index.html';
      return;
    }
    setHello(user);
    fill('username', user.username);
    fill('email', user.email);
    fill('firstName', user.firstName);
    fill('lastName', user.lastName);
    fill('phone', user.phone);
    fill('address', [user.addressLine1, user.addressLine2, user.zip].filter(Boolean).join(', ') || '–');
    fill('city', user.city);
    fill('country', user.country);
    if (msgEl) msgEl.textContent = '';
  } catch (e) {
    if (msgEl) msgEl.textContent = 'Impossible de charger vos informations.';
    console.error(e);
  }
}

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

// ------- Events
menuItems.forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    show(btn.dataset.view);
  });
});

document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  logout();
  location.href = 'index.html';
});

// ------- Boot
const initial = (location.hash || '#orders').slice(1);
show(initial);
loadProfile().catch(() => {});
