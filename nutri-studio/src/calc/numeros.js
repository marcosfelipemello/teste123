// Convenções numéricas e de datas (relatório §3). Todos os módulos de cálculo usam estas funções.

/**
 * Lê um número como o WebDiet: vazio, NaN ou não finito vira 0. Aceita vírgula decimal.
 * @param {unknown} v
 * @returns {number}
 */
export function check(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Arredonda com `Number.prototype.toFixed`, como o WebDiet (meio-para-cima sobre o valor binário:
 * (1.005).toFixed(2) = "1.00"). Devolve texto, como na tela.
 * @param {number} valor
 * @param {number} casas
 * @returns {string}
 */
export function fx(valor, casas) {
  return Number(valor).toFixed(casas);
}

/**
 * Igual a `fx`, mas devolve número (equivale a `parseFloat(v.toFixed(casas))`).
 * Use quando o valor arredondado alimenta o passo seguinte (TMB → GET, IMC → classificação…).
 * @param {number} valor
 * @param {number} casas
 * @returns {number}
 */
export function fxn(valor, casas) {
  return parseFloat(Number(valor).toFixed(casas));
}

/**
 * Converte "dd/mm/aaaa" (ou Date) em {d, m, a}. Devolve null se inválida.
 * @param {string|Date} data
 * @returns {{d:number,m:number,a:number}|null}
 */
export function partesData(data) {
  if (data instanceof Date) {
    if (Number.isNaN(data.getTime())) return null;
    return { d: data.getDate(), m: data.getMonth() + 1, a: data.getFullYear() };
  }
  const r = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(data || '').trim());
  if (!r) return null;
  const d = +r[1], m = +r[2], a = +r[3];
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { d, m, a };
}

/**
 * Idade em anos completos na data de referência (data da avaliação; §3 e §5.1):
 * ano2 − ano1, menos 1 se o mês ou o dia do aniversário ainda não chegou.
 * @param {string|Date} nascimento
 * @param {string|Date} referencia
 * @returns {number}
 */
export function idadeAnos(nascimento, referencia) {
  const n = partesData(nascimento), r = partesData(referencia);
  if (!n || !r) return 0;
  let anos = r.a - n.a;
  if (r.m < n.m || (r.m === n.m && r.d < n.d)) anos -= 1;
  return anos;
}

/**
 * Idade em meses completos: anos×12 + meses, menos 1 se o dia ainda não chegou (§3).
 * @param {string|Date} nascimento
 * @param {string|Date} referencia
 * @returns {number}
 */
export function idadeMeses(nascimento, referencia) {
  const n = partesData(nascimento), r = partesData(referencia);
  if (!n || !r) return 0;
  let meses = (r.a - n.a) * 12 + (r.m - n.m);
  if (r.d < n.d) meses -= 1;
  return meses;
}

/** Data de hoje em "dd/mm/aaaa" (o WebDiet usa a data do servidor; aqui, a do aparelho). */
export function hojeTexto(agora = new Date()) {
  const p = (x) => String(x).padStart(2, '0');
  return `${p(agora.getDate())}/${p(agora.getMonth() + 1)}/${agora.getFullYear()}`;
}
