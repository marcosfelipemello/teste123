// @ts-check

/**
 * Converte entrada do usuário (aceita vírgula decimal) em número.
 * Retorna NaN para vazio/ inválido.
 * @param {unknown} v
 * @returns {number}
 */
export function num(v) {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined) return NaN;
  const s = String(v).trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return NaN;
  return Number(s);
}

/** @param {number} v */
export function ok(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Idade em anos completos na data de referência.
 * @param {string} nascimentoISO yyyy-mm-dd
 * @param {string} [refISO] yyyy-mm-dd (padrão: hoje)
 */
export function idadeEmAnos(nascimentoISO, refISO) {
  if (!nascimentoISO) return NaN;
  const [ny, nm, nd] = nascimentoISO.split('-').map(Number);
  const ref = refISO ? refISO.split('-').map(Number) : hojeISO().split('-').map(Number);
  const [ry, rm, rd] = ref;
  let idade = ry - ny;
  if (rm < nm || (rm === nm && rd < nd)) idade -= 1;
  return idade;
}

export function hojeISO() {
  const d = new Date();
  const z = (/** @type {number} */ n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

/**
 * @param {number} v
 * @param {number} [casas]
 */
export function arred(v, casas = 1) {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
}
