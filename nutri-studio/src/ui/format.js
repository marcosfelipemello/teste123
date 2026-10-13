// @ts-check

/**
 * Número no padrão brasileiro; "—" quando indisponível.
 * @param {number} v
 * @param {number} [casas]
 */
export function fmt(v, casas = 1) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** @param {number} v */
export const fmtInt = (v) => fmt(v, 0);

/** @param {string} iso yyyy-mm-dd */
export function fmtData(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Valor para preencher um input (vazio quando não há número). @param {unknown} v */
export function val(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v).replace('.', ',') : '';
  return String(v);
}
