// @ts-check
import { ok } from './util.js';

/**
 * Recomendações de ganho de peso gestacional — IOM/NRC (2009), gestação única.
 * Ganho semanal aplicado no 2º e 3º trimestres; no 1º trimestre, 0,5–2 kg no total.
 */
export const IOM_2009 = [
  { ate: 18.5, faixa: 'Baixo peso (< 18,5)', totalMin: 12.5, totalMax: 18, semanal: 0.51, semanalMin: 0.44, semanalMax: 0.58 },
  { ate: 25, faixa: 'Eutrofia (18,5–24,9)', totalMin: 11.5, totalMax: 16, semanal: 0.42, semanalMin: 0.35, semanalMax: 0.5 },
  { ate: 30, faixa: 'Sobrepeso (25,0–29,9)', totalMin: 7, totalMax: 11.5, semanal: 0.28, semanalMin: 0.23, semanalMax: 0.33 },
  { ate: Infinity, faixa: 'Obesidade (≥ 30,0)', totalMin: 5, totalMax: 9, semanal: 0.22, semanalMin: 0.17, semanalMax: 0.27 },
];

/**
 * @param {number} imcPreGestacional
 */
export function recomendacaoGestacional(imcPreGestacional) {
  if (!ok(imcPreGestacional)) return null;
  return IOM_2009.find((l) => imcPreGestacional < l.ate) ?? IOM_2009[IOM_2009.length - 1];
}

/**
 * Faixa de ganho esperado até a semana gestacional informada (estimativa linear IOM 2009):
 * até a 13ª semana: proporcional a 0,5–2,0 kg; depois soma-se o ganho semanal recomendado.
 * @param {number} imcPreGestacional
 * @param {number} semana
 */
export function ganhoEsperadoAteSemana(imcPreGestacional, semana) {
  const rec = recomendacaoGestacional(imcPreGestacional);
  if (!rec || !ok(semana) || semana < 0) return null;
  if (semana <= 13) {
    const f = semana / 13;
    return { min: 0.5 * f, max: 2 * f, rec };
  }
  const extra = semana - 13;
  return { min: 0.5 + extra * rec.semanalMin, max: 2 + extra * rec.semanalMax, rec };
}
