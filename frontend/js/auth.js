// /js/auth.js
// Monte le side panel "compte" sur la structure HTML existante (form simple).
import { login } from '/js/api.js';

export function mountAuthPanel() {
  const root = document.getElementById('panel-compte');
  if (!root) return;

  // On cible le <form> déjà présent dans index.html
  const form = root.querySelector('form');
  if (!form) return;

  // On ajoute une zone de message si elle n'existe pas
  let msgEl = form.querySelector('.msg');
  if (!msgEl) {
    msgEl = document.createElement('div');
    msgEl.className = 'msg';
    form.appendChild(msgEl);
  }

  // Récupère les inputs
  const emailEl = form.querySelector('input[type="email"], input[name="email"]');
  const passEl  = form.querySelector('input[type="password"], input[name="password"]');
  const submit  = form.querySelector('button[type="submit"], button');

  const setMsg = (t, ok = false) => {
    msgEl.textContent = t || '';
    msgEl.style.color = ok ? '#1b5e20' : '#b00020';
  };
  const disable = (v) => {
    if (submit) {
      submit.disabled = !!v;
      submit.style.opacity = v ? 0.7 : 1;
    }
  };

  // Handler login
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (emailEl?.value || '').trim();
    const password = (passEl?.value || '').trim();

    if (!email || !password) {
      setMsg('Email et mot de passe requis.');
      return;
    }

    disable(true);
    setMsg('Connexion…', true);

    try {
      const res = await login({ email, password }); // passe par api.js → setAuth(token.v1)
      if (res?.user && res?.token) {
        setMsg('Connecté ✔', true);
        // ferme le panel et rafraîchit l’UI
        const overlay = document.getElementById('overlay');
        root.classList.remove('active');
        overlay?.classList.remove('active');
        location.reload();
      } else {
        // Message backend si fourni, sinon fallback
        const m = res?.message || 'Identifiants incorrects';
        if (/incorrect/i.test(m) || /invalid/i.test(m) || /mot de passe/i.test(m)) {
          setMsg('Mot de passe incorrect.');
        } else {
          setMsg(m);
        }
      }
    } catch (err) {
      const m = err?.message || 'Erreur de connexion.';
      if (/incorrect/i.test(m) || /invalid/i.test(m) || /mot de passe/i.test(m)) {
        setMsg('Mot de passe incorrect.');
      } else {
        setMsg(m);
      }
    } finally {
      disable(false);
    }
  });
}
