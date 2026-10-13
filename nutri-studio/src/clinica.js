// @ts-check
// Junta os dados do paciente às funções de cálculo: tudo o que a interface exibe sai daqui.
import { imc, classificarImc, rcq, rcest, riscoCintura, pesoIdeal, pesoAjustado, faixaPesoSaudavel, cmb, ambCorrigida, necessidadeHidrica } from './calc/antropometria.js';
import { composicaoPorDobras, composicaoPorPercentual } from './calc/composicao.js';
import { calcularGasto } from './calc/energia.js';
import { distribuirMacros } from './calc/macros.js';
import { idadeEmAnos, num, ok } from './calc/util.js';

/**
 * @typedef {import('./store.js').Paciente} Paciente
 * @typedef {import('./store.js').Avaliacao} Avaliacao
 */

/** @param {Paciente} p */
export function avaliacoesOrdenadas(p) {
  return [...p.avaliacoes].sort((a, b) => a.data.localeCompare(b.data));
}

/** @param {Paciente} p */
export function ultimaAvaliacao(p) {
  const l = avaliacoesOrdenadas(p);
  return l[l.length - 1];
}

/**
 * Indicadores calculados de uma avaliação.
 * @param {Paciente} p
 * @param {Avaliacao} a
 */
export function indicadores(p, a) {
  const peso = num(a.peso);
  const altura = num(a.altura);
  const idade = idadeEmAnos(p.nascimento, a.data);
  const valorImc = imc(peso, altura);
  const cintura = num(a.circ?.cintura);
  const quadril = num(a.circ?.quadril);
  const braco = num(a.circ?.braco);
  /** @type {Record<string, number>} */
  const dobras = {};
  for (const [k, v] of Object.entries(a.dobras ?? {})) dobras[k] = num(v);

  const porDobras = a.protocolo
    ? composicaoPorDobras({ protocolo: a.protocolo, sexo: p.sexo, idade, peso, dobras, conversao: a.conversao || 'siri' })
    : null;
  const porBio = composicaoPorPercentual(peso, num(a.bioGordura));
  const composicao = porDobras && porDobras.faltando.length === 0 ? { ...porDobras, origem: 'dobras' } : porBio ? { ...porBio, origem: 'percentual informado', densidade: null } : null;

  return {
    idade,
    peso,
    altura,
    imc: valorImc,
    classificacaoImc: classificarImc(valorImc, idade),
    faixaSaudavel: faixaPesoSaudavel(altura),
    rcq: rcq(cintura, quadril, p.sexo),
    rcest: rcest(cintura, altura),
    riscoCintura: riscoCintura(cintura, p.sexo),
    cmb: cmb(braco, dobras.triceps),
    amb: ambCorrigida(braco, dobras.triceps, p.sexo),
    composicaoDobras: porDobras,
    composicao,
  };
}

/**
 * Gasto energético e meta de macronutrientes do paciente, com base na última avaliação.
 * @param {Paciente} p
 */
export function planejamento(p) {
  const a = ultimaAvaliacao(p);
  if (!a) return null;
  const ind = indicadores(p, a);
  const e = p.energia;
  const ideal = pesoIdeal(ind.altura, num(e.imcAlvo));
  const ajustado = pesoAjustado(ind.peso, ideal);
  const pesoBase = e.basePeso === 'ideal' ? ideal : e.basePeso === 'ajustado' ? ajustado : ind.peso;
  const mlg = ind.composicao && ok(ind.composicao.massaMagra) ? ind.composicao.massaMagra : NaN;

  const gasto = calcularGasto({
    equacao: e.equacao,
    entrada: { sexo: p.sexo, peso: pesoBase, altura: ind.altura, idade: ind.idade, mlg, nivelIom: e.nivelIom, kcalPorKg: num(e.kcalPorKg) },
    fatorAtividade: num(e.fa),
    fatorInjuria: num(e.fi),
    ajusteKcal: num(e.ajuste),
  });

  const m = p.macros;
  const macros =
    gasto && ok(gasto.vet)
      ? distribuirMacros({
          vet: gasto.vet,
          peso: pesoBase,
          modo: m.modo,
          valores: m.modo === 'percentual' ? { ptn: num(m.ptn), cho: num(m.cho), lip: num(m.lip) } : { ptn: num(m.gkgPtn), cho: 0, lip: num(m.gkgLip) },
        })
      : null;

  return {
    avaliacao: a,
    ind,
    pesoIdeal: ideal,
    pesoAjustado: ajustado,
    pesoBase,
    mlg,
    gasto,
    macros,
    agua: necessidadeHidrica(ind.peso, num(e.mlKg)),
  };
}
