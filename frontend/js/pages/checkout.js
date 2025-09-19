// /js/pages/checkout.js
import { me, getCart } from '/js/api.js';
import { authHeaders } from '/js/state.js';

const API_BASE = 'http://localhost:4000'; // ton backend écoute sur 4000

const $ = s => document.querySelector(s);
const CHF = v => `CHF ${(Number(v || 0) / 100).toFixed(2)}`;

let stripe, elements, cardNumberEl, cardExpiryEl, cardCvcEl, clientSecretCache = null;

/* ---------- helpers ---------- */
function replaceInputWithContainer(sel, id) {
  const input = document.querySelector(sel);
  if (!input) return null;
  const wrapper = document.createElement('div');
  wrapper.id = id;
  wrapper.className = 'stripe-input';
  // pas de padding ici -> l’iframe couvrira 100%
  wrapper.style.minHeight = '46px';
  wrapper.style.border = '1px solid #e5e2db';
  wrapper.style.borderRadius = '12px';
  wrapper.style.background = '#fff';
  wrapper.style.display = 'block';
  input.parentNode.replaceChild(wrapper, input);
  return wrapper;
}

function ensureOverlayDoesNotBlock() {
  const overlay = document.getElementById('overlay');
  if (overlay && !overlay.classList.contains('active')) {
    overlay.style.pointerEvents = 'none';
    overlay.style.display = 'none';
  }
}

function fitStripeIframes() {
  ['#card-number', '#card-exp', '#card-cvc'].forEach(sel => {
    const box = document.querySelector(sel);
    if (!box) return;
    box.style.position = 'relative';
    box.style.zIndex = '50';
    box.style.pointerEvents = 'auto';
    box.style.height = '46px';
    box.style.padding = '0'; // clé: pas de padding autour de l’iframe
    const ifr = box.querySelector('iframe');
    if (ifr) {
      ifr.style.display = 'block';
      ifr.style.width = '100%';
      ifr.style.height = '100%';
      ifr.style.pointerEvents = 'auto';
      ifr.style.border = '0';
    }
  });
}

/* ---------- accordéon paiement ---------- */
function openPanel(method) {
  const label = document.querySelector(`.pay-option[data-target="${method}"]`);
  const panel = document.querySelector(`.pay-panel[data-method="${method}"]`);

  document.querySelectorAll('.pay-option').forEach(l => l.classList.remove('active'));
  document.querySelectorAll('.pay-panel[data-accordion]').forEach(p => {
    p.classList.remove('open');
    p.style.maxHeight = 0;
    p.hidden = true;
    p.style.overflow = 'hidden';
  });

  if (label && panel) {
    label.classList.add('active');
    panel.hidden = false;
    panel.classList.add('open');
    panel.style.maxHeight = panel.scrollHeight + 'px';
    panel.style.overflow = 'visible';
    panel.style.position = 'relative';
    panel.style.zIndex = '20';
  }

  // pas de pointer-events:none sur le label actif
  document.querySelectorAll('.pay-option').forEach(l => (l.style.pointerEvents = 'auto'));

  if (method === 'card') {
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      fitStripeIframes();
    }, 50);
  }
  ensureOverlayDoesNotBlock();
}

function bindPaymentAccordion() {
  document.querySelectorAll('.pay-option input[name="payMethod"]').forEach(r => {
    r.addEventListener('change', () => openPanel(r.value));
  });
  const active = document.querySelector('input[name="payMethod"]:checked')?.value || 'card';
  openPanel(active);
}

/* ---------- charge Stripe.js si besoin ---------- */
async function loadStripeLibrary() {
  if (window.Stripe) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://js.stripe.com/v3';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Impossible de charger Stripe.js'));
    document.head.appendChild(s);
  });
}

/* ---------- données utilisateur & récap ---------- */
async function loadMe() {
  try {
    const { user } = await me();
    if (!user) return;
    const f = $('#checkoutForm'); if (!f) return;
    f.firstName.value    = user.firstName ?? '';
    f.lastName.value     = user.lastName ?? '';
    f.email.value        = user.email ?? '';
    f.phone.value        = user.phone ?? '';
    f.addressLine1.value = user.addressLine1 ?? '';
    f.addressLine2.value = user.addressLine2 ?? '';
    f.zip.value          = user.zip ?? '';
    f.city.value         = user.city ?? '';
    f.country.value      = user.country ?? 'Suisse';
  } catch {}
}

async function loadSummary() {
  const wrap = $('#orderSummary');
  const cart = await getCart().catch(() => ({ items: [] }));
  const items = cart.items || [];
  const total = items.reduce((s, it) => s + (it.unitPrice || 0) * (it.quantity || 1), 0);

  wrap.innerHTML = `
    <div class="card">
      <h2>Votre commande</h2>
      <ul class="sum-list">
        ${items.map(it => `
          <li class="sum-item">
            <div class="sum-thumb">${it.image ? `<img src="${it.image}" alt="${it.title||'Produit'}">` : ''}</div>
            <div class="sum-meta">
              <div class="sum-title">${it.title || 'Produit'}</div>
              <div class="sum-line">
                <span class="sum-qty">×${it.quantity || 1}</span>
                <span class="sum-price">${CHF(it.unitPrice)}</span>
              </div>
            </div>
          </li>
        `).join('')}
      </ul>
      <div class="sum-row"><span>Sous-total</span><strong>${CHF(total)}</strong></div>
      <div class="sum-row"><span>Livraison</span><em>Calculée à l’étape suivante</em></div>
      <div class="sum-row total"><span>Total estimé</span><strong>${CHF(total)}</strong></div>
    </div>
  `;
}

/* ---------- collecte adresse ---------- */
function collectAddress() {
  const f = $('#checkoutForm');
  return {
    firstName: f.firstName.value.trim(),
    lastName:  f.lastName.value.trim(),
    email:     f.email.value.trim(),
    phone:     f.phone.value.trim(),
    address: {
      line1: f.addressLine1.value.trim(),
      line2: f.addressLine2.value.trim(),
      postal_code: f.cardZip?.value?.trim() || f.zip.value.trim(),
      city: f.city.value.trim(),
      country: f.country.value.trim() || 'CH',
    }
  };
}

/* ---------- Stripe Card Elements (création unique + appearance) ---------- */
async function setupStripeCardElements() {
  await loadStripeLibrary();

  // 1) clé publique
  const cfg = await fetch(`${API_BASE}/api/payments/config`, { headers: { ...authHeaders() } }).then(r => r.json());
  if (!cfg.publishableKey) throw new Error('Clé Stripe publique manquante');
  if (!stripe) stripe = Stripe(cfg.publishableKey);

  // 2) PaymentIntent (une seule fois tant que panier idem)
  if (!clientSecretCache) {
    const customer = collectAddress();
    const intent = await fetch(`${API_BASE}/api/payments/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ customer })
    }).then(r => r.json());
    if (!intent.clientSecret) throw new Error(intent.error || 'Impossible de créer le paiement');
    clientSecretCache = intent.clientSecret;
  }

  // 3) Elements : créer UNE fois, avec thème FR + apparence harmonisée
  if (!elements) {
    elements = stripe.elements({
      locale: 'fr',
      appearance: {
        theme: 'flat',
        variables: {
          colorPrimary: '#7f0000',
          colorText: '#3b3a39',
          colorTextSecondary: '#7b756f',
          colorDanger: '#b00020',
          colorBackground: '#ffffff',
          fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
          spacingUnit: '10px',
          borderRadius: '12px'
        },
        rules: {
          '.Input': { padding: '12px 14px', backgroundColor: '#fff' },
          '.Input::placeholder': { color: '#9a9086' },
          '.Input:focus': { boxShadow: '0 0 0 3px rgba(127,0,0,.12)' },
          '.Error': { color: '#b00020' },
          '.Label': { color: '#5a554f', fontWeight: '600' }
        }
      }
    });
  }

  // 4) Si tes <input> HTML existent, on les remplace une fois par des conteneurs
  if (!document.getElementById('card-number')) replaceInputWithContainer('input[name="cardNumber"]', 'card-number');
  if (!document.getElementById('card-exp'))    replaceInputWithContainer('input[name="cardExp"]', 'card-exp');
  if (!document.getElementById('card-cvc'))    replaceInputWithContainer('input[name="cardCvc"]', 'card-cvc');

  // 5) Monter les Card Elements s’ils n’existent pas encore
  if (!cardNumberEl) {
    cardNumberEl = elements.create('cardNumber', { placeholder: '1234 5678 9012 3456' });
    cardNumberEl.mount('#card-number');
  }
  if (!cardExpiryEl) {
    cardExpiryEl = elements.create('cardExpiry', { placeholder: 'MM / AA' });
    cardExpiryEl.mount('#card-exp');
  }
  if (!cardCvcEl) {
    cardCvcEl = elements.create('cardCvc', { placeholder: 'CVC' });
    cardCvcEl.mount('#card-cvc');
  }

  // erreurs live
  const errBox = $('#cardErrors');
  [cardNumberEl, cardExpiryEl, cardCvcEl].forEach(el => {
    el.on?.('change', ev => { if (errBox) errBox.textContent = ev.error?.message || ''; });
  });

  fitStripeIframes();
}

/* ---------- submit ---------- */
async function submitCheckout(e) {
  e.preventDefault();
  const msg = $('#checkoutMsg'); msg.textContent = '';
  const errBox = $('#cardErrors'); if (errBox) errBox.textContent = '';

  const method = document.querySelector('input[name="payMethod"]:checked')?.value || 'card';
  const customer = collectAddress();
  const f = $('#checkoutForm');

  try {
    if (method === 'card') {
      await setupStripeCardElements(); // s’assurer que c’est prêt

      const billing_details = {
        name: f.cardName?.value?.trim() || `${customer.firstName} ${customer.lastName}`.trim(),
        email: customer.email || undefined,
        address: {
          postal_code: customer.address.postal_code || undefined,
          country: (customer.address.country || 'CH').toUpperCase()
        }
      };

      const result = await stripe.confirmCardPayment(clientSecretCache, {
        payment_method: { card: cardNumberEl, billing_details }
      });

      if (result.error) {
        if (errBox) errBox.textContent = result.error.message || 'Paiement refusé.';
        throw result.error;
      }

      const pi = result.paymentIntent;

      // ✅ confirme l’ordre côté backend (création + vidage panier) AVANT de rediriger
      if (pi?.status === 'succeeded') {
        try {
          const shipping = {
            line1:  customer.address.line1 || null,
            line2:  customer.address.line2 || null,
            zip:    customer.address.postal_code || null,
            city:   customer.address.city || null,
            country:(customer.address.country || 'CH').toUpperCase()
          };

          const resp = await fetch(`${API_BASE}/api/orders/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ paymentIntentId: pi.id, shipping })
          });

          if (!resp.ok) {
            const data = await resp.json().catch(() => ({}));
            throw new Error(data?.message || 'Erreur confirmation commande');
          }

          msg.textContent = 'Paiement confirmé ✅';
          location.href = '/merci.html';
          return;
        } catch (e2) {
          console.error('confirm order error:', e2);
          msg.textContent = e2?.message || 'Commande non confirmée côté serveur.';
          return;
        }
      }

      msg.textContent = `Statut de paiement: ${pi?.status || 'inconnu'}`;
      return;
    }

    if (method === 'twint') {
      const res = await fetch(`${API_BASE}/api/payments/twint-init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ customer })
      });
      let data = {}; try { data = await res.json(); } catch {}
      if (!res.ok) throw new Error(data?.error || 'Erreur TWINT');

      const { paymentId, qrDataUrl } = data;
      const img = $('#twintQR'); if (qrDataUrl) img.src = qrDataUrl;
      $('#twintHint').textContent = 'Scannez le code avec TWINT pour valider.';
      openPanel('twint');

      let tries = 0;
      const iv = setInterval(async () => {
        tries++;
        const s = await fetch(`${API_BASE}/api/payments/status?paymentId=${encodeURIComponent(paymentId)}`)
          .then(r => r.json()).catch(() => ({}));
        if (s.status === 'succeeded') {
          clearInterval(iv);
          msg.textContent = 'Paiement confirmé ✅';
          location.href = '/merci.html';
        } else if (s.status === 'failed' || tries > 90) {
          clearInterval(iv);
          msg.textContent = 'Paiement non confirmé. Réessayez.';
        }
      }, 2000);
      return;
    }
  } catch (err) {
    console.error(err);
    msg.textContent = err?.message || 'Une erreur est survenue. Merci de réessayer.';
  }
}

/* ---------- boot ---------- */
async function boot() {
  await loadMe();
  await loadSummary();
  bindPaymentAccordion();

  // crée et monte les Card Elements UNE SEULE FOIS
  try { await setupStripeCardElements(); } catch (e) { console.warn('Stripe inline init:', e?.message); }

  window.addEventListener('resize', fitStripeIframes);
  $('#checkoutForm')?.addEventListener('submit', submitCheckout);
}
boot();
