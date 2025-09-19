// /js/ui/cartPanel.js
import { updateCartItem, removeCartItem, clearCart, getCart } from '../api.js';
import { state } from '../state.js';

const panel = () => document.getElementById('panel-panier');

function CHF(cents) { return `CHF ${(Number(cents || 0) / 100).toFixed(2)}`; }

export async function openCartPanel() {
  const root = panel();
  if (!root) return;
  const cart = await getCart().catch(() => state.cart || { items: [] });
  renderCartPanel(cart);
  root.classList.add('active');
  document.getElementById('overlay')?.classList.add('active');
}

export function renderCartPanel(cart) {
  const root = panel();
  if (!root) return;

  const items = Array.isArray(cart?.items) ? cart.items : [];
  const total = items.reduce((s, it) => s + (it.unitPrice || 0) * (it.quantity || 1), 0);

  root.innerHTML = `
    <button class="close-btn" aria-label="Fermer">×</button>

    <div class="cart-header">
      <h2>Votre panier</h2>
      <span class="cart-count">${items.length} article${items.length>1?'s':''}</span>
    </div>

    <div class="cart-body">
      ${items.length === 0 ? `
        <div class="cart-empty">
          <p>Votre panier est vide.</p>
        </div>
      ` : `
        <ul class="cart-list">
          ${items.map(it => `
            <li class="cart-item" data-id="${it.id}">
              <div class="thumb">
                ${it.image ? `<img src="${it.image}" alt="${(it.title||'Produit')}" />` : `<div class="ph"></div>`}
              </div>
              <div class="meta">
                <div class="title">${it.title || 'Produit'}</div>
                <div class="price">${CHF(it.unitPrice)}</div>
                <div class="qty-controls" role="group" aria-label="Quantité">
                  <button class="qty dec" aria-label="Diminuer">−</button>
                  <span class="qty-val" aria-live="polite">${it.quantity || 1}</span>
                  <button class="qty inc" aria-label="Augmenter">+</button>
                </div>
              </div>
              <button class="rm" aria-label="Retirer">×</button>
            </li>
          `).join('')}
        </ul>
      `}
    </div>

    <div class="cart-summary">
      <div class="row">
        <span>Sous-total</span>
        <strong>${CHF(total)}</strong>
      </div>
      <p class="hint">La livraison sera calculée à l’étape suivante.</p>
      <div class="actions">
        <button class="btn ghost clear">Vider</button>
        <button class="btn primary checkout">Commander</button>
      </div>
    </div>
  `;

  // fermer le panel
  root.querySelector('.close-btn')?.addEventListener('click', () => {
    root.classList.remove('active');
    document.getElementById('overlay')?.classList.remove('active');
  });

  // wires par item
  root.querySelectorAll('.cart-item').forEach(li => {
    const id = li.dataset.id;
    li.querySelector('.inc')?.addEventListener('click', async () => {
      const q = Number(li.querySelector('.qty-val').textContent) + 1;
      const c = await updateCartItem({ itemId: id, quantity: q });
      renderCartPanel(c);
    });
    li.querySelector('.dec')?.addEventListener('click', async () => {
      const current = Number(li.querySelector('.qty-val').textContent);
      const q = Math.max(1, current - 1);
      const c = await updateCartItem({ itemId: id, quantity: q });
      renderCartPanel(c);
    });
    li.querySelector('.rm')?.addEventListener('click', async () => {
      const c = await removeCartItem(id);
      renderCartPanel(c);
    });
  });

  // vider + commander
  root.querySelector('.clear')?.addEventListener('click', async () => {
    const c = await clearCart();
    renderCartPanel(c);
  });
  root.querySelector('.checkout')?.addEventListener('click', () => {
    location.href = '/checkout.html';
  });
}
