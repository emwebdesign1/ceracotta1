import { getProducts } from '../api.js';

const grid = document.getElementById("product-list");
const loadMoreButton = document.getElementById("load-more");
const sortSelect = document.getElementById("category-filter");

let page = 1, sort = '-createdAt', done = false, items = [];

function render(itemsToAdd) {
  itemsToAdd.forEach(product => {
    const card = document.createElement('div');
    card.className = 'product-card';
    
    // Calcule le stock total
    const totalStock =
      (product.stock ?? 0) +
      ((product.variants || []).reduce((sum, v) => sum + (v.stock ?? 0), 0));

    const isSoldOut = totalStock <= 0;

    card.innerHTML = `
      <div class="product-image-wrapper">
        <img src="${product.images?.[0] || '/images/bols.png'}"
             alt="${product.title}"
             class="product-image ${isSoldOut ? 'disabled' : ''}"/>
        ${isSoldOut ? `<span class="sold-out-badge">Sold out</span>` : ''}
      </div>
      <h3 class="product-title">${product.title}</h3>
      <p class="product-price">
        ${isSoldOut ? '<span class="sold-out-text">Épuisé</span>' : `CHF ${(product.price / 100).toFixed(2)}`}
      </p>
      <div class="color-dots">
        ${(product.colors || []).slice(0, 3).map(c => `
          <span class="dot" style="background:${c}"></span>
        `).join('')}
        ${product.colors?.length > 3 ? `<span class="dot more-dot">+${product.colors.length - 3}</span>` : ''}
      </div>
    `;

    // Interaction selon le stock
    if (!isSoldOut) {
      card.addEventListener('click', () => {
        window.location.href = `produit.html?slug=${product.slug}`;
      });
      card.style.cursor = 'pointer';
    } else {
      card.style.cursor = 'not-allowed';
    }

    grid.appendChild(card);
  });
}



async function load() {
  if (done) return;
  const { items: batch, total } = await getProducts({ category: 'vases', page, sort, limit: 12 });
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
