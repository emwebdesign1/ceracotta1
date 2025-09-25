// /js/pages/produit.page.js
import { getProductBySlug, addToCart } from '/js/api.js';
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
function renderColorDots(colors=[]){
  return colors.map(c=>{
    const hex = typeof c==='string'? c : (c.hex||'#ccc');
    const title = typeof c==='string'? c : (c.name||hex);
    return `<span class="dot" title="${title}" style="background:${hex};"></span>`;
  }).join('');
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

async function init(){
  try{
    const p = await getProductBySlug(slug);
    if (!p) throw new Error('Produit introuvable');

    titleEl.textContent = p.title || '';
    priceEl.textContent = CHF(p.price);
    descEl.textContent  = p.description || '';
    colorWrap.innerHTML = renderColorDots(p.colors || []);

    const imgs = (p.images || []);
    if (imgs.length){
      mainImg.src = imgs[0];
      mainImg.alt = p.title || '';
      thumbsWrap.innerHTML = imgs.map(it=>`<img class="thumbnail" src="${it}" alt="${p.title||''}">`).join('');
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

    if (detailsP)  detailsP.innerHTML  = renderMultilineToHTML(p.pieceDetail);
    if (careP)     careP.innerHTML     = renderMultilineToHTML(p.careAdvice);
    if (shippingP) shippingP.innerHTML = renderMultilineToHTML(p.shippingReturn);

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
          if (imgs[i]) mainImg.src = imgs[i];
        });
        sizeOpts.appendChild(btn);
      });
      sizeOpts.querySelector('.size-option')?.click();
    } else {
      sizeWrap.style.display = 'none';
    }

    // favoris
    try{
      if (isFavorite && isFavorite(p.slug)) { favHeart.textContent = '❤'; favBtn?.classList.add('active'); }
    }catch{}
    favBtn?.addEventListener('click', ()=>{
      try{
        addFavorite && addFavorite(p.slug);
        favHeart.textContent = '❤';
        favBtn.classList.add('active');
        showToast && showToast('Ajouté aux favoris');
      }catch{}
    });

    // panier
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
          image: imgs[0] || null
        });

        showToast && showToast('Ajouté au panier');
      } catch (e) {
        console.error(e);
        alert(e?.message || 'Impossible d’ajouter au panier.');
      }
    });

  }catch(err){
    console.error(err);
    document.querySelector('.product-page')?.insertAdjacentHTML('beforeend',
      `<p style="color:#b00020;margin-top:1rem">Erreur chargement produit.</p>`);
  }
}

init();
