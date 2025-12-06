// /js/pages/checkout.js
import { me, getCart } from '/js/api.js';
import { authHeaders } from '/js/state.js';

const API_BASE = 'http://localhost:4000'; // change en prod

const $ = s => document.querySelector(s);
const CHF = v => `CHF ${(Number(v || 0) / 100).toFixed(2)}`;

let stripe, elements, cardNumberEl, cardExpiryEl, cardCvcEl, clientSecretCache = null;

/* ------------------- HELPERS ------------------- */
function replaceInputWithContainer(sel, id) {
  const input = document.querySelector(sel);
  if (!input) return null;
  const wrap = document.createElement('div');
  wrap.id = id;
  wrap.className = 'stripe-input';
  wrap.style.minHeight = '46px';
  wrap.style.border = '1px solid #e5e2db';
  wrap.style.borderRadius = '12px';
  wrap.style.background = '#fff';
  input.parentNode.replaceChild(wrap, input);
  return wrap;
}

function fitStripeIframes() {
  ['#card-number', '#card-exp', '#card-cvc'].forEach(sel => {
    const box = document.querySelector(sel);
    if (!box) return;
    box.style.position = 'relative';
    box.style.height = '46px';
    const ifr = box.querySelector('iframe');
    if (ifr) {
      ifr.style.width = '100%';
      ifr.style.height = '100%';
    }
  });
}

/* ------------------- ACCORDÉON ------------------- */
function openPanel(method) {
  const label = document.querySelector(`.pay-option[data-target="${method}"]`);
  const panel = document.querySelector(`.pay-panel[data-method="${method}"]`);

  document.querySelectorAll('.pay-option').forEach(l => l.classList.remove('active'));
  document.querySelectorAll('.pay-panel').forEach(p => {
    p.classList.remove('open');
    p.style.maxHeight = 0;
    p.hidden = true;
  });

  if (label && panel) {
    label.classList.add('active');
    panel.hidden = false;
    panel.classList.add('open');
    panel.style.maxHeight = panel.scrollHeight + 'px';
  }

  if (method === 'card') {
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      fitStripeIframes();
    }, 50);
  }
}

function bindPaymentAccordion() {
  document.querySelectorAll('.pay-option input[name="payMethod"]').forEach(r => {
    r.addEventListener('change', () => openPanel(r.value));
  });
  const active = document.querySelector('input[name="payMethod"]:checked')?.value || 'card';
  openPanel(active);
}

/* ------------------- LOAD STRIPE ------------------- */
async function loadStripeLibrary() {
  if (window.Stripe) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://js.stripe.com/v3';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* ------------------- USER & SUMMARY ------------------- */
async function loadMe() {
  try {
    const { user } = await me();
    if (!user) return;
    const f = $('#checkoutForm');
    if (!f) return;

    f.firstName.value = user.firstName ?? '';
    f.lastName.value = user.lastName ?? '';
    f.email.value = user.email ?? '';
    f.phone.value = user.phone ?? '';
    f.addressLine1.value = user.addressLine1 ?? '';
    f.addressLine2.value = user.addressLine2 ?? '';
    f.zip.value = user.zip ?? '';
    f.city.value = user.city ?? '';
    f.country.value = user.country ?? 'Suisse';
  } catch {}
}

async function loadSummary() {
  const wrap = $('#orderSummary');
  const cart = await getCart().catch(() => ({ items: [] }));
  const items = cart.items || [];
  const total = items.reduce((s, it) => s + (it.unitPrice * it.quantity), 0);

  wrap.innerHTML = `
    <div class="card">
      <h2>Votre commande</h2>
      <ul class="sum-list">
        ${items.map(it => `
          <li class="sum-item">
            <div class="sum-thumb">${it.image ? `<img src="${it.image}">` : ''}</div>
            <div class="sum-meta">
              <div class="sum-title">${it.title}</div>
              <div class="sum-line">
                <span class="sum-qty">×${it.quantity}</span>
                <span class="sum-price">${CHF(it.unitPrice)}</span>
              </div>
            </div>
          </li>
        `).join('')}
      </ul>
      <div class="sum-row"><span>Total estimé</span><strong>${CHF(total)}</strong></div>
    </div>
  `;
}

/* ------------------- CARD SETUP ------------------- */
async function setupStripeCardElements() {
  await loadStripeLibrary();

  const cfg = await fetch(`${API_BASE}/api/payments/config`, {
    headers: { ...authHeaders() }
  }).then(r => r.json());

  stripe = Stripe(cfg.publishableKey);

  if (!clientSecretCache) {
    const intent = await fetch(`${API_BASE}/api/payments/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({})
    }).then(r => r.json());
    clientSecretCache = intent.clientSecret;
  }

  elements = stripe.elements({ appearance: { theme: 'flat' }, locale: 'fr' });

  if (!document.getElementById('card-number'))
    replaceInputWithContainer('input[name="cardNumber"]', 'card-number');
  if (!document.getElementById('card-exp'))
    replaceInputWithContainer('input[name="cardExp"]', 'card-exp');
  if (!document.getElementById('card-cvc'))
    replaceInputWithContainer('input[name="cardCvc"]', 'card-cvc');

  if (!cardNumberEl) {
    cardNumberEl = elements.create('cardNumber');
    cardNumberEl.mount('#card-number');
  }
  if (!cardExpiryEl) {
    cardExpiryEl = elements.create('cardExpiry');
    cardExpiryEl.mount('#card-exp');
  }
  if (!cardCvcEl) {
    cardCvcEl = elements.create('cardCvc');
    cardCvcEl.mount('#card-cvc');
  }

  fitStripeIframes();
}

/* ------------------- PURCHASE TRACKING ------------------- */
async function trackPurchaseForEachProduct(totalAmount) {
  const cart = await getCart().catch(() => ({ items: [] }));
  const items = cart.items || [];

  for (const it of items) {
    if (window.CeraAnalytics) {
      window.CeraAnalytics.purchase(totalAmount, 'CHF', it.productId);
    }
  }
}

/* ------------------- SUBMIT CHECKOUT ------------------- */
async function submitCheckout(e) {
  e.preventDefault();

  const method = document.querySelector('input[name="payMethod"]:checked')?.value || 'card';
  const msg = $('#checkoutMsg');

  try {
    if (method === 'card') {
      await setupStripeCardElements();

      const result = await stripe.confirmCardPayment(clientSecretCache, {
        payment_method: { card: cardNumberEl }
      });

      if (result.error) {
        msg.textContent = result.error.message;
        return;
      }

      if (result.paymentIntent.status === 'succeeded') {

        // -------- TRACK PURCHASE PAR PRODUIT --------
        const cart = await getCart();
        const total = cart.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
        await trackPurchaseForEachProduct(total);

        // -------- CONFIRM ORDER BACKEND --------
        await fetch(`${API_BASE}/api/orders/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ paymentIntentId: result.paymentIntent.id })
        });

        location.href = '/merci.html';
        return;
      }
    }
  } catch (err) {
    msg.textContent = err.message || 'Erreur.';
  }
}

/* ------------------- BOOT ------------------- */
async function boot() {
  await loadMe();
  await loadSummary();
  bindPaymentAccordion();
  $('#checkoutForm')?.addEventListener('submit', submitCheckout);
}

boot();
