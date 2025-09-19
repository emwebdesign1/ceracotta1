import { register } from '/js/api.js';

const form = document.getElementById('register-form');
const msgEl = document.getElementById('reg-msg');

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(form);

  const firstName = (fd.get('firstName') || '').trim();
  const lastName  = (fd.get('lastName')  || '').trim();
  const username  = (fd.get('username')  || '').trim();
  const phone     = (fd.get('phone')     || '').trim();
  const email     = (fd.get('email')     || '').trim();
  const password  = (fd.get('password')  || '').trim();
  const confirm   = (fd.get('passwordConfirm') || '').trim();

  // Validations front
  if (!firstName || !lastName) return msg('Prénom et nom requis.');
  if (!username || username.length < 3) return msg('Nom d’utilisateur ≥ 3 caractères.');
  if (!phone || phone.length < 6) return msg('Téléphone invalide.');
  if (!email) return msg('Email requis.');
  if (password.length < 8) return msg('Mot de passe trop court (≥ 8).');
  if (password !== confirm) return msg('Les mots de passe ne correspondent pas.');

  const payload = { firstName, lastName, username, phone, email, password };

  try {
    msg('Création du compte…');
    const res = await register(payload); // { user, token }
    if (res?.user && res?.token) {
      // setAuth est déjà appelé dans api.register ; ici on redirige juste
      msg('Compte créé ✓');
      location.href = '/account.html';
    } else {
      msg(res?.message || 'Erreur inconnue.');
    }
  } catch (e) {
    msg(e.message || 'Erreur à la création.');
  }

  function msg(t) { msgEl.textContent = t; }
});
