// /js/userMenu.js
import { state } from './state.js';
import { logout } from './api.js';

export function mountUserMenu() {
  const el = document.getElementById('user-menu');
  if (!el) return;

  function render() {
    el.innerHTML = '';
    if (state.user) {
      el.innerHTML = `
        <span>Bonjour ${state.user.username || state.user.email}</span>
        <button id="btn-logout">Déconnexion</button>
      `;
      el.querySelector('#btn-logout').addEventListener('click', () => {
        logout();
      });
    } else {
      el.innerHTML = `<a href="#" id="btn-login">Connexion</a>`;
    }
  }

  document.addEventListener('auth:changed', render);
  render();
}
