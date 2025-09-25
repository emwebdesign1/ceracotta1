// /js/auth.js
// Monte le side panel "compte" sur la structure HTML existante (form simple).
import { login } from '/js/api.js';

export function mountAuthPanel() {
  const root = document.getElementById('panel-compte');
  if (!root) return;

  const form = root.querySelector('form');
  if (!form) return;

  let msgEl = form.querySelector('.msg');
  if (!msgEl) {
    msgEl = document.createElement('div');
    msgEl.className = 'msg';
    form.appendChild(msgEl);
  }

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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (emailEl?.value || '').trim();
    const password = (passEl?.value || '').trim();
    if (!email || !password) return setMsg('Email et mot de passe requis.');

    disable(true);
    setMsg('Connexion…', true);

    try {
      const res = await login({ email, password }); // { user, token }
      const user = res?.user;
      if (user && res?.token) {
        // Enregistre un displayName pour le header
        const displayName = user.username || user.firstName || user.email || 'Mon compte';
        localStorage.setItem('user.displayName', displayName);
        localStorage.setItem('user.role', user.role || 'user');

        setMsg('Connecté ✔', true);

        // Redirection selon le rôle
        if ((user.role || '').toLowerCase() === 'admin') {
          location.href = '/admin.html';
        } else {
          location.href = '/account.html';
        }
      } else {
        const m = res?.message || 'Identifiants incorrects';
        if (/incorrect|invalid|mot de passe/i.test(m)) setMsg('Mot de passe incorrect.');
        else setMsg(m);
      }
    } catch (err) {
      const m = err?.message || 'Erreur de connexion.';
      if (/incorrect|invalid|mot de passe/i.test(m)) setMsg('Mot de passe incorrect.');
      else setMsg(m);
    } finally {
      disable(false);
    }
  });
}
