import { getCart } from '../api.js';
import { state } from '../state.js';
import { renderCartPanel } from './cartPanel.js';

function injectPanelsIfMissing() {
  // overlay
  if (!document.getElementById('overlay')) {
    const o = document.createElement('div');
    o.id = 'overlay';
    o.className = 'overlay';
    document.body.appendChild(o);
  }
  // panels
  const panels = [
    { id: 'panel-compte',  title: 'Mon compte',  content: '<p>Connectez-vous pour voir votre compte.</p>' },
    { id: 'panel-favoris', title: 'Mes favoris', content: '<p>Vos favoris apparaîtront ici.</p>' },
    { id: 'panel-panier',  title: 'Votre panier', content: '<p>Votre panier est vide.</p>' }
  ];
  panels.forEach(p => {
    if (!document.getElementById(p.id)) {
      const el = document.createElement('aside');
      el.id = p.id;
      el.className = 'side-panel';
      el.innerHTML = `<button class="close-btn" aria-label="Fermer">×</button><h2>${p.title}</h2>${p.content}`;
      document.body.appendChild(el);
    }
  });
}

function mountShell() {
  injectPanelsIfMissing();

  const hamburger = document.getElementById("hamburger");
  const nav = document.getElementById("side-menu");
  const overlay = document.getElementById("overlay");
  const dropdown = document.querySelector(".dropdown");
  const link = document.getElementById("collections-link");

  const panels = {
    compte: document.getElementById("panel-compte"),
    favoris: document.getElementById("panel-favoris"),
    panier:  document.getElementById("panel-panier"),
  };

  const closeAllPanels = () => {
    Object.values(panels).forEach(p => p?.classList.remove("active"));
    overlay?.classList.remove("active");
    document.body.classList.remove("menu-open");
    hamburger?.classList.remove("open");
  };

  const openPanel = async (name) => {
    closeAllPanels();
    const p = panels[name];
    if (!p) return;
    p.classList.add("active");
    overlay?.classList.add("active");
    document.body.classList.add("menu-open");
    if (name === 'panier') {
      const cart = await getCart();
      renderCartPanel(cart); // remplit le contenu dynamique
    }
  };

  // Burger
  hamburger?.addEventListener("click", () => {
    nav?.classList.toggle("active");
    overlay?.classList.toggle("active");
    document.body.classList.toggle("menu-open");
    hamburger?.classList.toggle("open");
  });

  // Overlay
  overlay?.addEventListener("click", () => {
    nav?.classList.remove("active");
    overlay?.classList.remove("active");
    document.body.classList.remove("menu-open");
    hamburger?.classList.remove("open");
    closeAllPanels();
  });

  // Boutons d’ouverture
  document.getElementById("open-compte")?.addEventListener("click", e => { e.preventDefault(); openPanel("compte"); });
  document.getElementById("open-favoris")?.addEventListener("click", e => { e.preventDefault(); openPanel("favoris"); });
  document.getElementById("open-panier")?.addEventListener("click",  e => { e.preventDefault(); openPanel("panier"); });

  // Boutons de fermeture
  document.querySelectorAll(".close-btn").forEach(btn => btn.addEventListener("click", closeAllPanels));

  // Menu Collections
  link?.addEventListener("click", (e) => { e.preventDefault(); dropdown?.classList.toggle("open"); });
}


export { mountShell };
