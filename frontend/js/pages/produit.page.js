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
const addBtn    = $('.product-details .add-to-cart');
const favBtn    = $('.product-details .fav-toggle');
const favHeart  = $('.product-details .fav-toggle .heart');

const detailsP  = document.querySelector('.accordion-section details:nth-of-type(1) > p');
const careP     = document.querySelector('.accordion-section details:nth-of-type(2) > p');
const shippingP = document.querySelector('.accordion-section details:nth-of-type(3) > p');

async function init(){
  try{
    // 1) produit
    const p = await getProductBySlug(slug); // grâce à l’API corrigée, p est l’objet produit direct
    if (!p) throw new Error('Produit introuvable');

    // 2) texte
    titleEl.textContent = p.title || '';
    priceEl.textContent = CHF(p.price);
    descEl.textContent  = p.description || '';

    // 3) couleurs
    colorWrap.innerHTML = renderColorDots(p.colors || []);

    // 4) images
    const imgs = Array.isArray(p.images) ? p.images.slice().sort((a,b)=>{
      const pa = typeof a==='string'?0:(a.position??0);
      const pb = typeof b==='string'?0:(b.position??0);
      return pa-pb;
    }) : [];
    const getUrl = (item) => typeof item==='string' ? item : item.url;

    if (imgs.length){
      mainImg.src = getUrl(imgs[0]);
      mainImg.alt = p.title || '';
      thumbsWrap.innerHTML = imgs.map(it=>`<img class="thumbnail" src="${getUrl(it)}" alt="${p.title||''}">`).join('');
      thumbsWrap.addEventListener('click', e=>{
        const t = e.target;
        if (t && t.classList.contains('thumbnail')) mainImg.src = t.getAttribute('src');
      });
    } else {
      // ⚠️ pas de placeholder inexistant -> on met une image présente
      mainImg.src = '/images/bols.png';
      mainImg.alt = p.title || '';
      thumbsWrap.innerHTML = '';
    }

    // 5) accordéons
    if (detailsP)  detailsP.innerHTML  = renderMultilineToHTML(p.pieceDetail);
    if (careP)     careP.innerHTML     = renderMultilineToHTML(p.careAdvice);
    if (shippingP) shippingP.innerHTML = renderMultilineToHTML(p.shippingReturn);

    // 6) favoris (ton state attend un slug, pas un objet)
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

    // 7) panier
// ...
addBtn?.addEventListener('click', async () => {
  try {
    // n'essaie plus de caster en Number
    const productId = p?.id ?? p?._id ?? p?.productId;
    if (!productId) {
      console.error('Produit reçu:', p);
      throw new Error('ID produit introuvable dans la réponse du serveur.');
    }

    await addToCart({
      productId: p.id,          // <-- string OU number, on l’envoie tel quel
      quantity: 1,
      // facultatif pour l’UI :
      title: p.title,
      unitPrice: p.price,
      id: p.id ?? p._id,
      slug: p.slug,
      image: (Array.isArray(p.images) && p.images[0]) 
               ? (typeof p.images[0] === 'string' ? p.images[0] : p.images[0].url)
               : null
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
