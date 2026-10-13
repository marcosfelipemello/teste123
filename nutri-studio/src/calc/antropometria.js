// @ts-check
import { ok } from './util.js';

/** @typedef {'M'|'F'} Sexo */

/**
 * Índice de Massa Corporal (kg/m²).
 * @param {number} pesoKg
 * @param {number} alturaCm
 */
export function imc(pesoKg, alturaCm) {
  if (!ok(pesoKg) || !ok(alturaCm) || alturaCm <= 0) return NaN;
  const m = alturaCm / 100;
  return pesoKg / (m * m);
}

/**
 * Classificação do IMC.
 * Adultos (20–59 anos): OMS, 1995/2000.
 * Idosos (≥ 60 anos): Lipschitz, 1994 (adotado pelo SISVAN/Ministério da Saúde).
 * @param {number} valor
 * @param {number} idade
 * @returns {{ rotulo: string, nivel: 'success'|'warning'|'error'|'info', referencia: string }}
 */
export function classificarImc(valor, idade) {
  if (!ok(valor)) return { rotulo: '—', nivel: 'info', referencia: '' };
  if (ok(idade) && idade >= 60) {
    const referencia = 'Lipschitz (1994) · idosos';
    if (valor < 22) return { rotulo: 'Baixo peso', nivel: 'warning', referencia };
    if (valor <= 27) return { rotulo: 'Eutrofia', nivel: 'success', referencia };
    return { rotulo: 'Sobrepeso', nivel: 'warning', referencia };
  }
  const referencia = 'OMS (2000) · adultos';
  if (valor < 16) return { rotulo: 'Magreza grau III', nivel: 'error', referencia };
  if (valor < 17) return { rotulo: 'Magreza grau II', nivel: 'error', referencia };
  if (valor < 18.5) return { rotulo: 'Magreza grau I', nivel: 'warning', referencia };
  if (valor < 25) return { rotulo: 'Eutrofia', nivel: 'success', referencia };
  if (valor < 30) return { rotulo: 'Sobrepeso (pré-obesidade)', nivel: 'warning', referencia };
  if (valor < 35) return { rotulo: 'Obesidade grau I', nivel: 'error', referencia };
  if (valor < 40) return { rotulo: 'Obesidade grau II', nivel: 'error', referencia };
  return { rotulo: 'Obesidade grau III', nivel: 'error', referencia };
}

/**
 * Risco de complicações metabólicas pela circunferência da cintura (OMS, 2000).
 * @param {number} cinturaCm
 * @param {Sexo} sexo
 */
export function riscoCintura(cinturaCm, sexo) {
  if (!ok(cinturaCm)) return null;
  const [elevado, muitoElevado] = sexo === 'M' ? [94, 102] : [80, 88];
  if (cinturaCm >= muitoElevado) return { rotulo: 'Risco muito elevado', nivel: /** @type {const} */ ('error') };
  if (cinturaCm >= elevado) return { rotulo: 'Risco elevado', nivel: /** @type {const} */ ('warning') };
  return { rotulo: 'Sem risco aumentado', nivel: /** @type {const} */ ('success') };
}

/**
 * Relação cintura/quadril e risco (OMS, 2008: ≥ 0,90 H · ≥ 0,85 M).
 * @param {number} cinturaCm
 * @param {number} quadrilCm
 * @param {Sexo} sexo
 */
export function rcq(cinturaCm, quadrilCm, sexo) {
  if (!ok(cinturaCm) || !ok(quadrilCm) || quadrilCm <= 0) return null;
  const valor = cinturaCm / quadrilCm;
  const limite = sexo === 'M' ? 0.9 : 0.85;
  return {
    valor,
    rotulo: valor >= limite ? 'Risco aumentado' : 'Adequado',
    nivel: valor >= limite ? /** @type {const} */ ('warning') : /** @type {const} */ ('success'),
  };
}

/**
 * Relação cintura/estatura (Ashwell & Hsieh, 2005: ponto de corte 0,5).
 * @param {number} cinturaCm
 * @param {number} alturaCm
 */
export function rcest(cinturaCm, alturaCm) {
  if (!ok(cinturaCm) || !ok(alturaCm) || alturaCm <= 0) return null;
  const valor = cinturaCm / alturaCm;
  return {
    valor,
    rotulo: valor >= 0.5 ? 'Risco aumentado' : 'Adequado',
    nivel: valor >= 0.5 ? /** @type {const} */ ('warning') : /** @type {const} */ ('success'),
  };
}

/**
 * Peso ideal pelo IMC alvo: IMC × altura².
 * @param {number} alturaCm
 * @param {number} imcAlvo
 */
export function pesoIdeal(alturaCm, imcAlvo) {
  if (!ok(alturaCm) || !ok(imcAlvo)) return NaN;
  const m = alturaCm / 100;
  return imcAlvo * m * m;
}

/**
 * Faixa de peso para IMC de eutrofia em adultos (18,5–24,9 kg/m²).
 * @param {number} alturaCm
 */
export function faixaPesoSaudavel(alturaCm) {
  return { min: pesoIdeal(alturaCm, 18.5), max: pesoIdeal(alturaCm, 24.9) };
}

/**
 * Peso ajustado (para obesidade/ desnutrição):
 * PA = (peso atual − peso ideal) × 0,25 + peso ideal.
 * @param {number} pesoAtual
 * @param {number} pesoIdealKg
 */
export function pesoAjustado(pesoAtual, pesoIdealKg) {
  if (!ok(pesoAtual) || !ok(pesoIdealKg)) return NaN;
  return (pesoAtual - pesoIdealKg) * 0.25 + pesoIdealKg;
}

/**
 * Circunferência muscular do braço (cm): CMB = CB − π × DCT.
 * @param {number} cbCm circunferência do braço (cm)
 * @param {number} dctMm dobra cutânea tricipital (mm)
 */
export function cmb(cbCm, dctMm) {
  if (!ok(cbCm) || !ok(dctMm)) return NaN;
  return cbCm - Math.PI * (dctMm / 10);
}

/**
 * Área muscular do braço corrigida (cm²) — Heymsfield et al., 1982:
 * AMBc = (CB − π·DCT)² / 4π − 10 (homens) ou − 6,5 (mulheres).
 * @param {number} cbCm
 * @param {number} dctMm
 * @param {Sexo} sexo
 */
export function ambCorrigida(cbCm, dctMm, sexo) {
  const c = cmb(cbCm, dctMm);
  if (!ok(c)) return NaN;
  return (c * c) / (4 * Math.PI) - (sexo === 'M' ? 10 : 6.5);
}

/**
 * Variação percentual de peso: (atual − referência) / referência × 100.
 * @param {number} atual
 * @param {number} referencia
 */
export function variacaoPeso(atual, referencia) {
  if (!ok(atual) || !ok(referencia) || referencia === 0) return NaN;
  return ((atual - referencia) / referencia) * 100;
}

/**
 * Necessidade hídrica diária (mL) por mL/kg.
 * @param {number} pesoKg
 * @param {number} [mlPorKg] padrão 35 mL/kg (adultos)
 */
export function necessidadeHidrica(pesoKg, mlPorKg = 35) {
  if (!ok(pesoKg) || !ok(mlPorKg)) return NaN;
  return pesoKg * mlPorKg;
}
