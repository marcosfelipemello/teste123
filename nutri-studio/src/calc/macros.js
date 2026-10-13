// @ts-check
import { ok } from './util.js';

/** Fatores de Atwater (kcal/g). */
export const KCAL_POR_G = { ptn: 4, cho: 4, lip: 9 };

/** @typedef {'ptn'|'cho'|'lip'} Macro */
/** @typedef {{ g: number, kcal: number, pct: number, gkg: number }} LinhaMacro */

/**
 * Distribui o VET em macronutrientes.
 *
 * Modo "percentual": cada macro recebe % do VET.
 * Modo "gkg": proteína e lipídio em g/kg de peso; o carboidrato completa o VET.
 *
 * @param {Object} p
 * @param {number} p.vet kcal/dia
 * @param {number} p.peso kg (base para g/kg)
 * @param {'percentual'|'gkg'} p.modo
 * @param {{ ptn: number, cho: number, lip: number }} p.valores % (modo percentual) ou g/kg (ptn e lip, modo gkg)
 * @returns {{ linhas: Record<Macro, LinhaMacro>, somaPct: number, alerta: string|null } | null}
 */
export function distribuirMacros({ vet, peso, modo, valores }) {
  if (!ok(vet) || vet <= 0) return null;
  /** @type {Record<Macro, number>} */
  const gramas = { ptn: 0, cho: 0, lip: 0 };
  let alerta = null;

  if (modo === 'percentual') {
    for (const k of /** @type {Macro[]} */ (['ptn', 'cho', 'lip'])) {
      gramas[k] = ((ok(valores[k]) ? valores[k] : 0) / 100) * vet / KCAL_POR_G[k];
    }
    const s = (valores.ptn || 0) + (valores.cho || 0) + (valores.lip || 0);
    if (Math.abs(s - 100) > 0.01) alerta = `A soma dos percentuais é ${s.toLocaleString('pt-BR')}% (deve ser 100%).`;
  } else {
    if (!ok(peso) || peso <= 0) return null;
    gramas.ptn = (valores.ptn || 0) * peso;
    gramas.lip = (valores.lip || 0) * peso;
    const resto = vet - gramas.ptn * KCAL_POR_G.ptn - gramas.lip * KCAL_POR_G.lip;
    gramas.cho = Math.max(0, resto) / KCAL_POR_G.cho;
    if (resto < 0) alerta = 'Proteína e lipídio já excedem o VET; o carboidrato foi zerado.';
  }

  /** @type {Record<Macro, LinhaMacro>} */
  const linhas = /** @type {any} */ ({});
  let somaPct = 0;
  for (const k of /** @type {Macro[]} */ (['ptn', 'cho', 'lip'])) {
    const kcal = gramas[k] * KCAL_POR_G[k];
    const pct = (kcal / vet) * 100;
    somaPct += pct;
    linhas[k] = { g: gramas[k], kcal, pct, gkg: ok(peso) && peso > 0 ? gramas[k] / peso : NaN };
  }
  return { linhas, somaPct, alerta };
}
