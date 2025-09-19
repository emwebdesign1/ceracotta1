// /js/pages/merci.page.js
import { authHeaders } from '/js/state.js';

const CHF = (v) => `CHF ${(Number(v || 0) / 100).toFixed(2)}`;

async function fetchMyOrders() {
  try {
    const r = await fetch('/api/orders/my', { headers: { ...authHeaders() } });
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}

async function showLastOrder() {
  const orders = await fetchMyOrders();
  const last = orders?.[0];
  if (!last) return;

  const d = new Date(last.createdAt);
  document.getElementById('o-id').textContent     = last.id || last.number || '—';
  document.getElementById('o-date').textContent   = d.toLocaleDateString('fr-CH');
  document.getElementById('o-amount').textContent = CHF(last.amount);
  document.getElementById('o-status').textContent = ({
    PAID:'Payée', PENDING:'En attente', CANCELLED:'Annulée'
  })[last.status] || last.status || '—';
}

document.addEventListener('DOMContentLoaded', showLastOrder);
