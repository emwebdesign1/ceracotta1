// nom -> hex (fallback si jamais une couleur n’a pas d’hex en base)
export const NAME_TO_HEX = {
  bordeaux: '#7f0000',
  beige: '#c8b7a6',
  ivoire: '#f4f1ec',
  noir: '#2b2b2b',
  sable: '#b58f6f',
  gris: '#9e9e9e',
  bleu: '#1e4f8f',
  blanc: '#ffffff',
  vert: '#4a7c59',
  terracotta: '#e2725b',
};

export function toHex(maybe) {
  if (!maybe) return null;
  const s = String(maybe).trim();
  if (s.startsWith('#') && (s.length === 4 || s.length === 7)) return s;
  const key = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  return NAME_TO_HEX[key] || null;
}
