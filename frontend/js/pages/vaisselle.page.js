import { getProducts } from '../api.js';

// ---- Sondage Vaisselle (marketing participatif) ----
const SURVEY_API = '/api/survey/submit';

const hero    = document.getElementById('survey-hero');
const modalEl = document.getElementById('survey-modal');
const openBtn = document.getElementById('survey-open');
const closeBtn= document.getElementById('survey-close');
const cancelBtn = document.getElementById('survey-cancel');
const formEl  = document.getElementById('survey-form');
const msgEl   = document.getElementById('survey-msg');
const otherEl = document.getElementById('survey-other');

// cacher l'ancien listing (au cas où il est dans le DOM)
document.querySelector('.sort-filter-container')?.setAttribute('hidden','');
document.querySelector('#product-list')?.setAttribute('hidden','');
document.querySelector('.load-more-container')?.setAttribute('hidden','');

function openModal(){ modalEl?.classList.add('open'); modalEl?.setAttribute('aria-hidden','false'); }
function closeModal(){ modalEl?.classList.remove('open'); modalEl?.setAttribute('aria-hidden','true'); msgEl.textContent=''; formEl?.reset(); }
openBtn?.addEventListener('click', openModal);
closeBtn?.addEventListener('click', closeModal);
cancelBtn?.addEventListener('click', closeModal);
modalEl?.addEventListener('click', (e)=>{ if(e.target===modalEl) closeModal(); });

// activer/désactiver champ "autre"
formEl?.addEventListener('change', (e)=>{
  const val = new FormData(formEl).get('choice');
  otherEl.disabled = val !== 'OTHER';
  if (otherEl.disabled) otherEl.value = '';
});

// submit
formEl?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  msgEl.textContent = 'Envoi…';

  const fd = new FormData(formEl);
  // honeypot
  if ((fd.get('website')||'').trim() !== '') { msgEl.textContent = 'OK.'; closeModal(); return; }

  const payload = {
    choice: (fd.get('choice')||'').toString(),
    otherText: (fd.get('otherText')||'').toString().slice(0,240),
    email: (fd.get('email')||'').toString().slice(0,180)
  };

  try{
    const r = await fetch(SURVEY_API, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });
    if(!r.ok) throw new Error('Erreur lors de l’envoi du sondage.');
    msgEl.textContent = 'Merci ! Votre avis a été enregistré 🙌';
    setTimeout(closeModal, 900);
  }catch(err){
    msgEl.textContent = err.message || 'Impossible d’enregistrer votre avis.';
  }
});


const grid = document.getElementById("product-list");
const loadMoreButton = document.getElementById("load-more");
const sortSelect = document.getElementById("category-filter");

let page = 1, sort = '-createdAt', done = false, items = [];

function render(itemsToAdd) {
  itemsToAdd.forEach(product => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <a href="produit.html?slug=${product.slug}">
        <img src="${product.images?.[0] || '/images/bols.png'}" alt="${product.title}" class="product-image"/>
      </a>
      <h3 class="product-title">${product.title}</h3>
      <p class="product-price">CHF ${(product.price/100).toFixed(2)}</p>
      <div class="color-dots">
        ${(product.variants||[]).slice(0,3).map(v => `<span class="dot" style="background:${v.color||'#ccc'}"></span>`).join('')}
        ${product.variants?.length>3 ? `<span class="dot more-dot">+${product.variants.length-3}</span>`:''}
      </div>
    `;
    grid.appendChild(card);
  });
}

async function load() {
  if (done) return;
  const { items: batch, total } = await getProducts({ category: 'vaisselle', page, sort, limit: 12 });
  if (!batch.length || (items.length + batch.length) >= total) done = true;
  items = items.concat(batch);
  render(batch);
  loadMoreButton.style.display = done ? 'none' : 'block';
}

sortSelect?.addEventListener('change', async () => {
  sort = sortSelect.value === 'price-asc' ? 'price' : '-price';
  page = 1; done = false; items = []; grid.innerHTML = '';
  await load();
});

loadMoreButton?.addEventListener('click', async () => { page += 1; await load(); });

load();  // première charge
