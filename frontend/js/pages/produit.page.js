// /js/pages/produit.page.js
import { getProductBySlug, getProducts, addToCart } from '/js/api.js';
import { showToast } from '/js/ui/toast.js';
import { updateFavCounter , addFavorite, removeFavorite, authHeaders } from '/js/state.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const CHF = cents => typeof cents === 'number' ? `CHF ${(cents / 100).toFixed(2)}` : '';

function escapeHTML(str = '') { return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
function renderMultilineToHTML(text) {
  if (!text) return '';
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const bullets = [], paras = [];
  for (const l of lines) {
    if (/^[•\-]/.test(l)) bullets.push(escapeHTML(l.replace(/^[•\-]\s*/, '')));
    else paras.push(escapeHTML(l));
  }
  return paras.map(p => `<p>${p}</p>`).join('') + (bullets.length ? `<ul>${bullets.map(li => `<li>${li}</li>`).join('')}</ul>` : '');
}

// --- slug
const params = new URLSearchParams(location.search);
const slug = params.get('slug');
if (!slug) { document.body.innerHTML = '<p style="padding:2rem">Produit introuvable (slug manquant).</p>'; throw new Error('missing slug'); }

// --- hooks
const mainImg = $('.product-gallery .main-image');
const thumbsWrap = $('.product-gallery .thumbnail-container');
const titleEl = $('.product-details h1');
const priceEl = $('.product-details .price');
const descEl = $('.product-details .description');
const colorWrap = $('.product-details .color-options');
const sizeWrap = $('.product-details .sizes');
const sizeOpts = $('.product-details .size-options');
const addBtn = $('.product-details .add-to-cart');
const favBtn = $('.product-details .fav-toggle');
const favHeart = $('.product-details .fav-toggle .heart');

const detailsP = document.querySelector('.accordion-section details:nth-of-type(1) > p');
const careP = document.querySelector('.accordion-section details:nth-of-type(2) > p');
const shippingP = document.querySelector('.accordion-section details:nth-of-type(3) > p');

let currentVariant = null;
let currentColor = null;
let colorImageMap = {};

// --------- Helpers galerie ---------
function asUrl(u) { return typeof u === 'string' ? u : (u?.url || ''); }

function getGallery({ product, variant, colorHex }) {
  const key = (colorHex || '').toLowerCase();
  const productImages = (product?.images || []).map(asUrl);

  if (variant?.colorImageMap && key && Array.isArray(variant.colorImageMap[key]) && variant.colorImageMap[key].length) {
    return variant.colorImageMap[key].map(asUrl);
  }
  if (variant?.images?.length) {
    return (variant.images || []).map(asUrl);
  }
  if (key && product?.colorImageMap && Array.isArray(product.colorImageMap[key]) && product.colorImageMap[key].length) {
    return product.colorImageMap[key].map(asUrl);
  }
  return productImages;
}

function renderGallery(urls, { title = '' } = {}) {
  const list = Array.isArray(urls) ? urls.filter(Boolean) : [];
  const first = list[0] || '/images/bols.png';

  if (mainImg) {
    mainImg.src = first;
    mainImg.alt = title || '';
  }

  if (thumbsWrap) {
    thumbsWrap.innerHTML = list.map(u => `<img class="thumbnail" src="${u}" alt="${title}">`).join('');
    thumbsWrap.onclick = (e) => {
      const t = e.target;
      if (t && t.classList.contains('thumbnail')) {
        mainImg.src = t.getAttribute('src');
      }
    };
  }
}

function pickBestImage({ product, variant, colorHex }) {
  const gallery = getGallery({ product, variant, colorHex });
  return gallery[0] || '/images/bols.png';
}

// ---- Wishlist helpers ----
async function wishlistStatus(productId, variantId = null, color = null, size = null) {
  const query = new URLSearchParams({ productId, variantId, color, size });
  const r = await fetch(`/api/wishlist/status?${query.toString()}`, {
    headers: authHeaders(),
  });
  if (!r.ok) return { favored: false };
  return r.json();
}

async function wishlistToggle({ productId, variantId = null, color = null, size = null }) {
  const r = await fetch('/api/wishlist/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ productId, variantId, color, size }),
  });
  if (!r.ok) throw new Error('Wishlist toggle failed');
  return r.json();
}

async function init() {
  try {
    const p = await getProductBySlug(slug);
    if (!p) throw new Error('Produit introuvable');
    const productId = p.id;

    titleEl.textContent = p.title || '';
    priceEl.textContent = CHF(p.price);
    descEl.textContent = p.description || '';

    if (detailsP) detailsP.innerHTML = renderMultilineToHTML(p.pieceDetail);
    if (careP) careP.innerHTML = renderMultilineToHTML(p.careAdvice);
    if (shippingP) shippingP.innerHTML = renderMultilineToHTML(p.shippingReturn);

    const colors = Array.isArray(p.colors) ? p.colors : [];
    colorImageMap = p.colorImageMap || {};
    if (colors.length) {
      colorWrap.innerHTML = colors.map(h => {
        const label = `Couleur ${h}`;
        return `<button class="color-dot" type="button" aria-label="${label}" data-color="${h}" title="${h}" style="background:${h}"></button>`;
      }).join('');
    } else {
      colorWrap.innerHTML = '';
      currentColor = null;
    }

    if (p.variants && p.variants.length) {
      sizeWrap.style.display = 'block';
      sizeOpts.innerHTML = '';
      p.variants.forEach((v, i) => {
        const btn = document.createElement('button');
        btn.className = 'size-option';
        btn.textContent = v.size || `Taille ${i + 1}`;
        sizeOpts.appendChild(btn);
      });
    } else {
      sizeWrap.style.display = 'none';
      currentVariant = null;
    }

    // ---- Wishlist (serveur) + SYNC favoris locaux
// ---- Wishlist (serveur) + SYNC favoris locaux
async function refreshFav() {
  try {
    if (!currentColor && p.colors?.length) {
      favHeart.textContent = '♡';
      favHeart.style.color = '#000';
      favBtn.classList.remove('active');
      return;
    }

    const { favored } = await wishlistStatus(
      productId,
      currentVariant?.id || null,
      currentColor,
      currentVariant?.size || null
    );

    favHeart.textContent = favored ? '❤' : '♡';
    favHeart.style.color = favored ? '#7f0000' : '#000';
    favBtn.classList.toggle('active', !!favored);

    updateFavCounter();
  } catch {
    favHeart.textContent = '♡';
    favHeart.style.color = '#000';
    favBtn.classList.remove('active');
  }
}

// Rafraîchit le cœur à chaque changement de sélection
function attachRefreshOnSelection() {
  // Clic couleur
  colorWrap.addEventListener('click', async (e) => {
    const btn = e.target.closest('.color-dot');
    if (!btn) return;
    colorWrap.querySelectorAll('.color-dot').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentColor = (btn.dataset.color || '').toLowerCase();

    const gallery = getGallery({ product: p, variant: currentVariant, colorHex: currentColor });
    renderGallery(gallery, { title: p.title });
    await refreshFav(); // ❤️ met à jour le cœur selon la couleur + taille actuelle
  });

  // Clic taille
  sizeOpts.querySelectorAll('.size-option').forEach((btn) => {
    btn.addEventListener('click', async () => {
      sizeOpts.querySelectorAll('.size-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const label = btn.textContent.trim();
      currentVariant = p.variants.find(v => v.size === label);
      priceEl.textContent = CHF(currentVariant?.price ?? p.price);

      const gallery = getGallery({ product: p, variant: currentVariant, colorHex: currentColor });
      renderGallery(gallery, { title: p.title });
      await refreshFav(); // ❤️ met à jour le cœur selon la taille + couleur actuelle
    });
  });
}


    attachRefreshOnSelection();

    // ---- Clic sur le cœur (toggle favoris)
// ---- Clic sur le cœur (toggle favoris)
favBtn?.addEventListener('click', async () => {
  if (!currentColor && p.colors?.length) return alert("Veuillez choisir une couleur.");
  if (p.variants?.length && !currentVariant) return alert("Veuillez choisir une taille.");

  try {
    const selectedImage = pickBestImage({ product: p, variant: currentVariant, colorHex: currentColor });

    // Toggle sur le serveur
    const { favored } = await wishlistToggle({
      productId,
      variantId: currentVariant?.id || null,
      color: currentColor,
      size: currentVariant?.size || null,
      image: selectedImage
    });

    // Mise à jour du cœur ❤️
    favHeart.textContent = favored ? '❤' : '♡';
    favHeart.style.color = favored ? '#7f0000' : '#000';
    favBtn.classList.toggle('active', !!favored);

    // Mise à jour locale
    if (favored) addFavorite({ slug: p.slug, color: currentColor, size: currentVariant?.size });
    else removeFavorite({ slug: p.slug, color: currentColor, size: currentVariant?.size });

    document.dispatchEvent(new CustomEvent('fav:changed'));
    showToast && showToast('Favoris mis à jour');

    // ✅ Tracking analytics FAVORITE_ADD ou FAVORITE_REMOVE
    await fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        type: favored ? 'FAVORITE_ADD' : 'FAVORITE_REMOVE',
        productId,
        path: location.pathname
      })
    }).catch(() => {});

  } catch (e) {
    console.error(e);
  }
});



    // ---- Ajouter au panier
    addBtn?.addEventListener('click', async () => {
      try {
        if (!currentColor && p.colors?.length) return alert("Veuillez choisir une couleur.");
        if (p.variants?.length && !currentVariant) return alert("Veuillez choisir une taille.");
        await addToCart({
          productId: p.id,
          quantity: 1,
          variantId: currentVariant?.id || null,
          title: p.title,
          unitPrice: currentVariant?.price ?? p.price,
          slug: p.slug,
          image: pickBestImage({ product: p, variant: currentVariant, colorHex: currentColor }),
          color: currentColor || null,
          size: currentVariant?.size || null
        });
        showToast && showToast('Ajouté au panier');
        await fetch('/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ type: 'ADD_TO_CART', productId, path: location.pathname })
        }).catch(() => { });
      } catch (e) {
        console.error(e);
        alert(e?.message || 'Impossible d’ajouter au panier.');
      }
    });

    // ---- Slider Caractéristiques
    function setupCaracSlider() {
      const slider = document.querySelector('.icons-banner-slider');
      const dots = Array.from(document.querySelectorAll('.dots .dot'));
      const items = slider ? slider.querySelectorAll('.icon-item') : [];
      if (!slider || dots.length === 0) return;
      let index = 0;
      const visible = 2;
      const step = 1;
      const totalPages = Math.ceil((items.length - visible) / step) + 1;
      const goTo = (i) => {
        index = Math.max(0, Math.min(i, totalPages - 1));
        const offset = -(index * step * (100 / visible));
        slider.style.transform = `translateX(${offset}%)`;
        dots.forEach((d, j) => d.classList.toggle('active', j === index));
      };
      dots.forEach((dot, i) => dot.addEventListener('click', () => goTo(i)));
      goTo(0);
    }
    setupCaracSlider();

// ---- Tu aimerais aussi
async function loadAlsoLike() {
  const wrap = document.querySelector('.aimerais-aussi');
  const rail = document.querySelector('.aimerais-aussi .carousel');
  const btnL = document.querySelector('.aimerais-aussi .carousel-btn.left');
  const btnR = document.querySelector('.aimerais-aussi .carousel-btn.right');
  if (!wrap || !rail) return;

  let items = [];
  try {
    const res = await getProducts({ category: 'vases', sort: '-createdAt', limit: 20 });
    items = res?.items || [];
  } catch (e) {
    console.warn('getProducts vases failed', e);
  }

  if (!items.length) {
    try {
      const res2 = await getProducts({ sort: '-createdAt', limit: 50 });
      const all = res2?.items || [];
      items = all.filter(p =>
        /vase/i.test(p?.title || '') ||
        /vase/i.test(p?.slug || '') ||
        /vase/i.test(p?.category || '')
      );
    } catch {}
  }

  if (!items.length) {
    wrap.style.display = 'none';
    return;
  }

  const CHF = cents => typeof cents === 'number' ? `CHF ${(cents / 100).toFixed(2)}` : '';
  const firstImg = (p) => {
    const imgs = p?.images || [];
    if (!imgs?.length) return '/images/bols.png';
    const it = imgs[0];
    return typeof it === 'string' ? it : (it.url || '/images/bols.png');
  };

  // 🧠 Construction des cartes produits avec vérification du stock
  rail.innerHTML = items.map(p => {
    const totalStock = (p.stock ?? 0) + ((p.variants || []).reduce((sum, v) => sum + (v.stock ?? 0), 0));
    const isSoldOut = totalStock <= 0;

    return `
      <div class="produit-card ${isSoldOut ? 'soldout' : ''}" 
           ${!isSoldOut ? `onclick="window.location.href='/produit.html?slug=${encodeURIComponent(p.slug)}'"` : ''}>
        <div class="img-wrap">
          <img src="${firstImg(p)}" alt="${(p.title || '').replace(/"/g, '&quot;')}" loading="lazy">
          ${isSoldOut ? `<span class="sold-out-badge">Sold out</span>` : ''}
        </div>
        <div class="titre">${p.title || ''}</div>
        <div class="prix">${isSoldOut ? '<span class="sold-out-text">Épuisé</span>' : CHF(p.price)}</div>
      </div>
    `;
  }).join('');

  // 🪄 Slider navigation
  const step = () => {
    const card = rail.querySelector('.produit-card');
    const gap = parseFloat(getComputedStyle(rail).gap || '16');
    const w = card ? card.getBoundingClientRect().width + gap : 220;
    return w * 2;
  };
  btnL?.addEventListener('click', () => rail.scrollBy({ left: -step(), behavior: 'smooth' }));
  btnR?.addEventListener('click', () => rail.scrollBy({ left: step(), behavior: 'smooth' }));
}

    loadAlsoLike();

    // --- affiche image par défaut
    if (p) {
      const defaultGallery = getGallery({
        product: p,
        variant: p.variants?.[0] || null,
        colorHex: p.colors?.[0] || null
      });
      renderGallery(defaultGallery, { title: p.title });
    }


    // ---- Tracking vue produit
    try {
      await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'PRODUCT_VIEW', productId, path: location.pathname })
      });
    } catch { }
  } catch (err) {
    console.error(err);
    document.querySelector('.product-page')?.insertAdjacentHTML('beforeend',
      `<p style="color:#b00020;margin-top:1rem">Erreur chargement produit.</p>`);
  }
}



init();
