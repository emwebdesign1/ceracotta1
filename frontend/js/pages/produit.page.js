// /js/pages/produit.page.js
// /js/pages/produit.page.js
import { getProductBySlug, getProducts, addToCart } from '/js/api.js';
import { addFavorite, isFavorite } from '/js/state.js';
import { showToast } from '/js/ui/toast.js';


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
let currentColor   = null;  // couleur sélectionnée
let colorImageMap  = {};    // { hex -> imageURL }
let productCache   = null;  // stocke le produit pour pickBestImage

// --- helper: choisir la meilleure image
function pickBestImage({ product, variant, colorHex }) {
  const normalize = s => (s || '').toLowerCase();

  // 1) image du variant (taille)
  if (variant?.primaryImageUrl) return variant.primaryImageUrl;
  if (variant?.images?.length)  return variant.images[0];

  // 2) image liée à la couleur
  const key = normalize(colorHex);
  if (key && product?.colorImageMap && Array.isArray(product.colorImageMap[key]) && product.colorImageMap[key].length) {
    return product.colorImageMap[key][0];
  }

  // 3) fallback produit
  if (product?.images?.length) return product.images[0]?.url || product.images[0];
  return '/images/bols.png';
}

async function init(){
  try{
    const p = await getProductBySlug(slug);
    if (!p) throw new Error('Produit introuvable');
    productCache = p;

    titleEl.textContent = p.title || '';
    priceEl.textContent = CHF(p.price);
    descEl.textContent  = p.description || '';

    const imgs = (p.images || []);
    if (imgs.length){
      mainImg.src = imgs[0].url || imgs[0];
      mainImg.alt = p.title || '';
      thumbsWrap.innerHTML = imgs.map(it=>`<img class="thumbnail" src="${it.url||it}" alt="${p.title||''}">`).join('');
      thumbsWrap.addEventListener('click', e=>{
        const t = e.target;
        if (t && t.classList.contains('thumbnail')) {
          mainImg.src = t.getAttribute('src');
        }
      });
    } else {
      mainImg.src = '/images/bols.png';
      mainImg.alt = p.title || '';
    }

    // Détails / entretien / livraison
    if (detailsP)  detailsP.innerHTML  = renderMultilineToHTML(p.pieceDetail);
    if (careP)     careP.innerHTML     = renderMultilineToHTML(p.careAdvice);
    if (shippingP) shippingP.innerHTML = renderMultilineToHTML(p.shippingReturn);

    // --- couleurs ---
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
        const best = pickBestImage({ product: p, variant: currentVariant, colorHex: currentColor });
        if (best) mainImg.src = best;
      });

      const first = colorWrap.querySelector('.color-dot');
      if (first) first.click();
    } else {
      colorWrap.innerHTML = '';
      currentColor = null;
    }

    // --- variantes / tailles ---
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

          const best = pickBestImage({ product: p, variant: currentVariant, colorHex: currentColor });
          if (best) mainImg.src = best;
        });
        sizeOpts.appendChild(btn);
      });
      sizeOpts.querySelector('.size-option')?.click();
    } else {
      sizeWrap.style.display = 'none';
      currentVariant = null;
    }

// favoris
try{
  if (isFavorite && isFavorite(p.slug)) { 
    favHeart.textContent = '❤'; 
    favBtn?.classList.add('active'); 
  }
}catch{}

favBtn?.addEventListener('click', ()=>{
  try{
    addFavorite && addFavorite({
      slug: p.slug,
      color: currentColor || null,
      size: currentVariant?.size || null
    });
    // Met à jour l’UI localement (cœur plein si au moins une variante de ce slug est en favoris)
    if (isFavorite && isFavorite(p.slug)) {
      favHeart.textContent = '❤';
      favBtn.classList.add('active');
    } else {
      favHeart.textContent = '♡';
      favBtn.classList.remove('active');
    }
    showToast && showToast('Favoris mis à jour');
  }catch{}
});

    // panier
// produit.page.js
addBtn?.addEventListener('click', async () => {
  try {
    const productId = p?.id;
    if (!productId) throw new Error('ID produit introuvable.');

await addToCart({
  productId,
  quantity: 1,
  variantId: currentVariant?.id || null,
  title: p.title,
  unitPrice: currentVariant?.price ?? p.price,
  slug: p.slug,
  image: mainImg?.src || null,
  color: currentColor || null,
  size: currentVariant?.size || null
});

    showToast && showToast('Ajouté au panier');
  } catch (e) {
    console.error(e);
    alert(e?.message || 'Impossible d’ajouter au panier.');
  }
});


    // image initiale
    const bestAtStart = pickBestImage({ product: p, variant: currentVariant, colorHex: currentColor });
    if (bestAtStart) mainImg.src = bestAtStart;

  }catch(err){
    console.error(err);
    document.querySelector('.product-page')?.insertAdjacentHTML('beforeend',
      `<p style="color:#b00020;margin-top:1rem">Erreur chargement produit.</p>`);
  }

  // ---- Slider Caractéristiques (4 visibles, décalage de 2) ----
function setupCaracSlider() {
  const slider = document.querySelector('.icons-banner-slider');
  const dots   = Array.from(document.querySelectorAll('.dots .dot'));
  const items  = slider ? slider.querySelectorAll('.icon-item') : [];

  if (!slider || dots.length === 0) return;

  let index = 0;
  const visible = 2; // combien d’éléments visibles
  const step = 1;    // combien on décale
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

  // 1) Essayer par catégorie "vases"
  let items = [];
  try {
    const res = await getProducts({ category: 'vases', sort: '-createdAt', limit: 20 });
    items = res?.items || [];
  } catch (e) {
    console.warn('getProducts vases failed', e);
  }

  // 2) Fallback si vide → filtre local par nom/slug/catégorie
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
      console.warn('getProducts all failed', e);
    }
  }

  // 3) Rien trouvé → cacher la section
  if (!items.length) { wrap.style.display = 'none'; return; }

  // Helpers
  const CHF = cents => typeof cents === 'number' ? `CHF ${(cents/100).toFixed(2)}` : '';
  const firstImg = (p) => {
    const imgs = p?.images || [];
    if (!imgs?.length) return '/images/bols.png';
    const it = imgs[0];
    return typeof it === 'string' ? it : (it.url || '/images/bols.png');
  };

  // 4) Rendu des cartes
  rail.innerHTML = items.map(p => `
    <a class="produit-card" href="/produit.html?slug=${encodeURIComponent(p.slug || '')}">
      <img src="${firstImg(p)}" alt="${(p.title || '').replace(/"/g,'&quot;')}" loading="lazy">
      <div class="titre">${p.title || ''}</div>
      <div class="prix">${CHF(p.price)}</div>
    </a>
  `).join('');

  // 5) Scroll gauche/droite (2 cartes par clic)
  const step = () => {
    const card = rail.querySelector('.produit-card');
    const gap = parseFloat(getComputedStyle(rail).gap || '16');
    const w = card ? card.getBoundingClientRect().width + gap : 220;
    return w * 2;
  };

  btnL?.addEventListener('click', () => rail.scrollBy({ left: -step(), behavior: 'smooth' }));
  btnR?.addEventListener('click', () => rail.scrollBy({ left:  step(), behavior: 'smooth' }));
}

// ⚠️ lance le chargement des vases
loadAlsoLike();

}



init();
