// /js/pages/produit.page.js
import { getProductBySlug, getProducts, addToCart } from '/js/api.js';
import { showToast } from '/js/ui/toast.js';
import { addFavorite, removeFavorite } from '/js/state.js'; // ← sync favoris locaux

const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const CHF = cents => typeof cents === 'number' ? `CHF ${(cents/100).toFixed(2)}` : '';

function escapeHTML(str=''){ return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function renderMultilineToHTML(text){
  if (!text) return '';
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const bullets=[], paras=[];
  for (const l of lines) { if (/^[•\-]/.test(l)) bullets.push(escapeHTML(l.replace(/^[•\-]\s*/,''))); else paras.push(escapeHTML(l)); }
  return paras.map(p=>`<p>${p}</p>`).join('') + (bullets.length?`<ul>${bullets.map(li=>`<li>${li}</li>`).join('')}</ul>`:'');
}

// --- slug
const params = new URLSearchParams(location.search);
const slug = params.get('slug');
if (!slug) { document.body.innerHTML = '<p style="padding:2rem">Produit introuvable (slug manquant).</p>'; throw new Error('missing slug'); }

// --- hooks
const mainImg   = $('.product-gallery .main-image');
const thumbsWrap= $('.product-gallery .thumbnail-container');
const titleEl   = $('.product-details h1');
const priceEl   = $('.product-details .price');
const descEl    = $('.product-details .description');
const colorWrap = $('.product-details .color-options');
const sizeWrap  = $('.product-details .sizes');
const sizeOpts  = $('.product-details .size-options');
const addBtn    = $('.product-details .add-to-cart');
const favBtn    = $('.product-details .fav-toggle');
const favHeart  = $('.product-details .fav-toggle .heart');

const detailsP  = document.querySelector('.accordion-section details:nth-of-type(1) > p');
const careP     = document.querySelector('.accordion-section details:nth-of-type(2) > p');
const shippingP = document.querySelector('.accordion-section details:nth-of-type(3) > p');

let currentVariant = null;
let currentColor   = null;
let colorImageMap  = {};

// --------- Helpers galerie (taille + couleur) ---------
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
async function wishlistStatus(productId) {
  const r = await fetch(`/api/wishlist/status?productId=${encodeURIComponent(productId)}`, { credentials: 'include' });
  if (!r.ok) return { favored: false };
  return r.json();
}
async function wishlistToggle(productId) {
  const r = await fetch('/api/wishlist/toggle', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    credentials: 'include',
    body: JSON.stringify({ productId })
  });
  if (!r.ok) throw new Error('Wishlist toggle failed');
  return r.json();
}

async function init(){
  try{
    const p = await getProductBySlug(slug);
    if (!p) throw new Error('Produit introuvable');

    const productId = p.id;

    titleEl.textContent = p.title || '';
    priceEl.textContent = CHF(p.price);
    descEl.textContent  = p.description || '';

    if (detailsP)  detailsP.innerHTML  = renderMultilineToHTML(p.pieceDetail);
    if (careP)     careP.innerHTML     = renderMultilineToHTML(p.careAdvice);
    if (shippingP) shippingP.innerHTML = renderMultilineToHTML(p.shippingReturn);

    const colors = Array.isArray(p.colors) ? p.colors : [];
    colorImageMap = p.colorImageMap || {};
    if (colors.length) {
      colorWrap.innerHTML = colors.map(h => {
        const label = `Couleur ${h}`;
        return `<button class="color-dot" type="button" aria-label="${label}" aria-pressed="false" data-color="${h}" title="${h}" style="background:${h}"></button>`;
      }).join('');

      colorWrap.addEventListener('click', (e) => {
        const btn = e.target.closest('.color-dot');
        if (!btn) return;
        colorWrap.querySelectorAll('.color-dot').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');

        currentColor = (btn.dataset.color || '').toLowerCase();
        const gallery = getGallery({ product: p, variant: currentVariant, colorHex: currentColor });
        renderGallery(gallery, { title: p.title });
      });

      const first = colorWrap.querySelector('.color-dot');
      if (first) first.click();
    } else {
      colorWrap.innerHTML = '';
      currentColor = null;
    }

    if (p.variants && p.variants.length) {
      sizeWrap.style.display = 'block';
      sizeOpts.innerHTML = '';
      p.variants.forEach((v,i)=>{
        const btn = document.createElement('button');
        btn.className = 'size-option';
        btn.textContent = v.size || `Taille ${i+1}`;
        btn.addEventListener('click', ()=>{
          sizeOpts.querySelectorAll('.size-option').forEach(b=>b.classList.remove('selected'));
          btn.classList.add('selected');
          currentVariant = v;

          priceEl.textContent = CHF(v.price ?? p.price);

          const gallery = getGallery({ product: p, variant: currentVariant, colorHex: currentColor });
          renderGallery(gallery, { title: p.title });
        });
        sizeOpts.appendChild(btn);
      });
      sizeOpts.querySelector('.size-option')?.click();
    } else {
      sizeWrap.style.display = 'none';
      currentVariant = null;
    }

    // ---- Wishlist (serveur) + SYNC favoris locaux (pour le panneau)
    async function refreshFav() {
      try{
        const { favored } = await wishlistStatus(productId);
        favHeart.textContent = favored ? '❤' : '♡';
        favBtn.classList.toggle('active', !!favored);

        // sync localStorage favoris (alimentera le panneau)
        if (favored) addFavorite({ slug: p.slug });
        else removeFavorite({ slug: p.slug });
      }catch{
        favHeart.textContent = '♡';
        favBtn.classList.remove('active');
      }
    }
    await refreshFav();

    favBtn?.addEventListener('click', async ()=>{
      try{
        const { favored } = await wishlistToggle(productId);
        favHeart.textContent = favored ? '❤' : '♡';
        favBtn.classList.toggle('active', !!favored);

        // sync localStorage favoris pour le panneau
        if (favored) addFavorite({ slug: p.slug });
        else removeFavorite({ slug: p.slug });

        // Optionnel: tracer l'intérêt
        try {
          await fetch('/api/track', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            credentials:'include',
            body: JSON.stringify({
              type: favored ? 'FAVORITE_ADD' : 'FAVORITE_REMOVE',
              productId,
              path: location.pathname
            })
          });
        } catch {}
        showToast && showToast('Favoris mis à jour');
      }catch(e){
        console.error(e);
      }
    });

    // panier
    addBtn?.addEventListener('click', async () => {
      try {
        if (!productId) throw new Error('ID produit introuvable.');

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

        // tracer ATC
        try {
          await fetch('/api/track', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            credentials:'include',
            body: JSON.stringify({ type:'ADD_TO_CART', productId, path: location.pathname })
          });
        } catch {}
      } catch (e) {
        console.error(e);
        alert(e?.message || 'Impossible d’ajouter au panier.');
      }
    });

    // ---- Slider Caractéristiques (2 visibles, navigation dots) ----
    function setupCaracSlider() {
      const slider = document.querySelector('.icons-banner-slider');
      const dots   = Array.from(document.querySelectorAll('.dots .dot'));
      const items  = slider ? slider.querySelectorAll('.icon-item') : [];

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

    // ===== "Tu aimerais aussi" — charge les vases depuis la DB =====
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
            /vase/i.test(p?.slug || '')  ||
            /vase/i.test(p?.category || '')
          );
        } catch (e) {
        }
      }

      if (!items.length) { wrap.style.display = 'none'; return; }

      const CHF = cents => typeof cents === 'number' ? `CHF ${(cents/100).toFixed(2)}` : '';
      const firstImg = (p) => {
        const imgs = p?.images || [];
        if (!imgs?.length) return '/images/bols.png';
        const it = imgs[0];
        return typeof it === 'string' ? it : (it.url || '/images/bols.png');
        };

      rail.innerHTML = items.map(p => `
        <a class="produit-card" href="/produit.html?slug=${encodeURIComponent(p.slug || '')}">
          <img src="${firstImg(p)}" alt="${(p.title || '').replace(/"/g,'&quot;')}" loading="lazy">
          <div class="titre">${p.title || ''}</div>
          <div class="prix">${CHF(p.price)}</div>
        </a>
      `).join('');

      const step = () => {
        const card = rail.querySelector('.produit-card');
        const gap = parseFloat(getComputedStyle(rail).gap || '16');
        const w = card ? card.getBoundingClientRect().width + gap : 220;
        return w * 2;
      };

      btnL?.addEventListener('click', () => rail.scrollBy({ left: -step(), behavior: 'smooth' }));
      btnR?.addEventListener('click', () => rail.scrollBy({ left:  step(), behavior: 'smooth' }));
    }
    loadAlsoLike();

    // tracer la vue produit
    try {
      await fetch('/api/track', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials:'include',
        body: JSON.stringify({ type:'PRODUCT_VIEW', productId, path: location.pathname })
      });
    } catch {}

  }catch(err){
    console.error(err);
    document.querySelector('.product-page')?.insertAdjacentHTML('beforeend',
      `<p style="color:#b00020;margin-top:1rem">Erreur chargement produit.</p>`);
  }
}

init();
