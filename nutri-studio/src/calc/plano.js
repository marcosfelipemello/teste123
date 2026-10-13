// @ts-check
import { KCAL_POR_G } from './macros.js';

/**
 * @typedef {Object} Alimento valores por 100 g da parte comestível
 * @property {string} id
 * @property {string} nome
 * @property {string} grupo
 * @property {number} kcal
 * @property {number} ptn
 * @property {number} cho
 * @property {number} lip
 * @property {number} fibra
 * @property {number} [sodio] mg
 * @property {string} [fonte]
 */

/** @typedef {{ kcal: number, ptn: number, cho: number, lip: number, fibra: number, sodio: number }} Nutrientes */

/** @returns {Nutrientes} */
export const zero = () => ({ kcal: 0, ptn: 0, cho: 0, lip: 0, fibra: 0, sodio: 0 });

/**
 * Nutrientes de uma porção: valor por 100 g × gramas / 100.
 * @param {Alimento} alimento
 * @param {number} gramas
 * @returns {Nutrientes}
 */
export function nutrientesDaPorcao(alimento, gramas) {
  const f = (Number.isFinite(gramas) ? gramas : 0) / 100;
  return {
    kcal: (alimento.kcal || 0) * f,
    ptn: (alimento.ptn || 0) * f,
    cho: (alimento.cho || 0) * f,
    lip: (alimento.lip || 0) * f,
    fibra: (alimento.fibra || 0) * f,
    sodio: (alimento.sodio || 0) * f,
  };
}

/**
 * @param {Nutrientes} a
 * @param {Nutrientes} b
 */
export function somar(a, b) {
  return {
    kcal: a.kcal + b.kcal,
    ptn: a.ptn + b.ptn,
    cho: a.cho + b.cho,
    lip: a.lip + b.lip,
    fibra: a.fibra + b.fibra,
    sodio: a.sodio + b.sodio,
  };
}

/**
 * @typedef {{ alimentoId: string, gramas: number, medida?: string }} Item
 * @typedef {{ id: string, nome: string, horario?: string, itens: Item[] }} Refeicao
 */

/**
 * Totais por refeição e do dia.
 * @param {Refeicao[]} refeicoes
 * @param {(id: string) => Alimento | undefined} buscar
 */
export function totaisDoPlano(refeicoes, buscar) {
  let dia = zero();
  const porRefeicao = refeicoes.map((r) => {
    let t = zero();
    for (const it of r.itens) {
      const al = buscar(it.alimentoId);
      if (al) t = somar(t, nutrientesDaPorcao(al, it.gramas));
    }
    dia = somar(dia, t);
    return { id: r.id, total: t };
  });
  return { porRefeicao, dia };
}

/**
 * Distribuição energética dos macronutrientes (Atwater 4/4/9) sobre a energia dos macros.
 * @param {Nutrientes} n
 */
export function distribuicaoPercentual(n) {
  const kP = n.ptn * KCAL_POR_G.ptn;
  const kC = n.cho * KCAL_POR_G.cho;
  const kL = n.lip * KCAL_POR_G.lip;
  const total = kP + kC + kL;
  if (total <= 0) return { ptn: 0, cho: 0, lip: 0 };
  return { ptn: (kP / total) * 100, cho: (kC / total) * 100, lip: (kL / total) * 100 };
}

/**
 * Adequação percentual (consumido/ meta × 100).
 * @param {number} valor
 * @param {number} meta
 */
export function adequacao(valor, meta) {
  if (!Number.isFinite(meta) || meta <= 0) return NaN;
  return (valor / meta) * 100;
}
