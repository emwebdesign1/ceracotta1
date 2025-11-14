// /js/i18n/translate.js
const supportedLangs = ["fr", "en", "de"];

export function getCurrentLang() {
  const saved = localStorage.getItem("lang");
  if (saved && supportedLangs.includes(saved)) return saved;
  const htmlLang = document.documentElement.lang?.slice(0, 2);
  if (supportedLangs.includes(htmlLang)) return htmlLang;
  localStorage.setItem("lang", "fr");
  return "fr";
}

export async function loadTranslations(lang) {
  try {
    const res = await fetch(`/locales/${lang}.json`);
    if (!res.ok) throw new Error(`Erreur chargement ${lang}.json`);
    return await res.json();
  } catch (err) {
    console.error("Erreur de chargement des traductions :", err);
    return {};
  }
}

function resolveKeyPath(obj, path) {
  return path.split('.').reduce((acc, key) => acc && acc[key], obj);
}

export async function applyTranslations(lang) {
  const dict = await loadTranslations(lang);

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    let text = resolveKeyPath(dict, key);
    if (!text && dict[key]) text = dict[key]; // ✅ supporte les clés plates ET imbriquées
    if (text) el.innerHTML = text;
  });
}

export async function initTranslations() {
  const lang = getCurrentLang();
  await applyTranslations(lang);

  document.querySelectorAll(".lang-switch a").forEach(a => {
    a.classList.toggle("active", a.dataset.lang === lang);
  });

  document.querySelectorAll(".lang-switch a").forEach(link => {
    link.addEventListener("click", async (e) => {
      e.preventDefault();
      const lang = link.dataset.lang;
      if (!lang) return;
      localStorage.setItem("lang", lang);
      await applyTranslations(lang);
      document.querySelectorAll(".lang-switch a").forEach(a => a.classList.remove("active"));
      link.classList.add("active");
    });
  });
}
