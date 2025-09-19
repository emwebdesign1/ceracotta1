import { getProducts } from '../api.js';

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
      <p class="product-price">CHF ${(product.price / 100).toFixed(2)}</p>
      <div class="color-dots">
        ${(product.variants || []).slice(0, 3).map(v => `<span class="dot" style="background:${v.color || '#ccc'}"></span>`).join('')}
        ${product.variants?.length > 3 ? `<span class="dot more-dot">+${product.variants.length - 3}</span>` : ''}
      </div>
    `;
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
