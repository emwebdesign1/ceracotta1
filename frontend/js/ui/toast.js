// js/ui/toast.js
let wrap;
function ensureWrap() {
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  return wrap;
}

export function showToast(message, { sub = '', duration = 1600 } = {}) {
  const root = ensureWrap();
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 16.2l-3.5-3.6L4 14.1 9 19 20 8.9l-1.5-1.5z"/>
    </svg>
    <div class="txt">
      <div class="msg">${message}</div>
      ${sub ? `<div class="sm">${sub}</div>` : ``}
    </div>
    <button class="close" aria-label="Fermer">×</button>
  `;
  root.appendChild(el);

  const close = () => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    setTimeout(() => el.remove(), 180);
  };
  el.querySelector('.close')?.addEventListener('click', close);
  if (duration > 0) setTimeout(close, duration);
}
