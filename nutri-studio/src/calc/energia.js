// @ts-check
import { ok } from './util.js';

/** @typedef {'M'|'F'} Sexo */
/** @typedef {'sedentario'|'poucoAtivo'|'ativo'|'muitoAtivo'} NivelIom */

/**
 * @typedef {Object} Entrada
 * @property {Sexo} sexo
 * @property {number} peso kg (já na base escolhida: atual, ideal ou ajustado)
 * @property {number} altura cm
 * @property {number} idade anos
 * @property {number} [mlg] massa livre de gordura (kg)
 * @property {NivelIom} [nivelIom]
 * @property {number} [kcalPorKg]
 */

/**
 * @typedef {Object} Equacao
 * @property {string} id
 * @property {string} nome
 * @property {'TMB'|'GET'} tipo TMB = taxa metabólica basal/ de repouso (multiplicar por FA); GET = já é gasto total
 * @property {string} referencia
 * @property {string} publico
 * @property {Array<'peso'|'altura'|'idade'|'mlg'|'nivelIom'|'kcalPorKg'>} requer
 * @property {(e: Entrada) => number} calc
 */

/**
 * Coeficientes de atividade física (PA) da DRI/IOM 2005.
 * @type {Record<'adulto'|'crianca', Record<Sexo, Record<NivelIom, number>>>}
 */
export const PA_IOM = {
  adulto: {
    M: { sedentario: 1.0, poucoAtivo: 1.11, ativo: 1.25, muitoAtivo: 1.48 },
    F: { sedentario: 1.0, poucoAtivo: 1.12, ativo: 1.27, muitoAtivo: 1.45 },
  },
  crianca: {
    M: { sedentario: 1.0, poucoAtivo: 1.13, ativo: 1.26, muitoAtivo: 1.42 },
    F: { sedentario: 1.0, poucoAtivo: 1.16, ativo: 1.31, muitoAtivo: 1.56 },
  },
};

export const NIVEIS_IOM = /** @type {const} */ ({
  sedentario: 'Sedentário',
  poucoAtivo: 'Pouco ativo',
  ativo: 'Ativo',
  muitoAtivo: 'Muito ativo',
});

/**
 * Seleciona a linha da faixa etária: cada linha é [idadeLimiteExclusiva, a, b] → a·peso + b.
 * @param {number[][]} faixas
 * @param {number} idade
 */
function porFaixa(faixas, idade) {
  return faixas.find(([lim]) => idade < lim) ?? faixas[faixas.length - 1];
}

// FAO/OMS/ONU 1985 (WHO TRS 724), equações por peso, kcal/dia.
const FAO_1985 = {
  M: [
    [3, 60.9, -54],
    [10, 22.7, 495],
    [18, 17.5, 651],
    [30, 15.3, 679],
    [60, 11.6, 879],
    [Infinity, 13.5, 487],
  ],
  F: [
    [3, 61.0, -51],
    [10, 22.5, 499],
    [18, 12.2, 746],
    [30, 14.7, 496],
    [60, 8.7, 829],
    [Infinity, 10.5, 596],
  ],
};

// Schofield 1985, equações por peso, kcal/dia.
const SCHOFIELD_1985 = {
  M: [
    [3, 59.512, -30.4],
    [10, 22.706, 504.3],
    [18, 17.686, 658.2],
    [30, 15.057, 692.2],
    [60, 11.472, 873.1],
    [Infinity, 11.711, 587.7],
  ],
  F: [
    [3, 58.317, -31.1],
    [10, 20.315, 485.9],
    [18, 13.384, 692.6],
    [30, 14.818, 486.6],
    [60, 8.126, 845.6],
    [Infinity, 9.082, 658.5],
  ],
};

/** @type {Equacao[]} */
export const EQUACOES = [
  {
    id: 'hb1919',
    nome: 'Harris-Benedict (1919)',
    tipo: 'TMB',
    referencia: 'Harris JA, Benedict FG. A Biometric Study of Basal Metabolism in Man. Carnegie Institution of Washington, 1919.',
    publico: 'Adultos',
    requer: ['peso', 'altura', 'idade'],
    calc: ({ sexo, peso, altura, idade }) =>
      sexo === 'M'
        ? 66.473 + 13.7516 * peso + 5.0033 * altura - 6.755 * idade
        : 655.0955 + 9.5634 * peso + 1.8496 * altura - 4.6756 * idade,
  },
  {
    id: 'hb1984',
    nome: 'Harris-Benedict revisada (Roza & Shizgal, 1984)',
    tipo: 'TMB',
    referencia: 'Roza AM, Shizgal HM. Am J Clin Nutr. 1984;40(1):168-182.',
    publico: 'Adultos',
    requer: ['peso', 'altura', 'idade'],
    calc: ({ sexo, peso, altura, idade }) =>
      sexo === 'M'
        ? 88.362 + 13.397 * peso + 4.799 * altura - 5.677 * idade
        : 447.593 + 9.247 * peso + 3.098 * altura - 4.33 * idade,
  },
  {
    id: 'mifflin',
    nome: 'Mifflin-St Jeor (1990)',
    tipo: 'TMB',
    referencia: 'Mifflin MD, St Jeor ST, et al. Am J Clin Nutr. 1990;51(2):241-247.',
    publico: 'Adultos, inclusive com sobrepeso/ obesidade',
    requer: ['peso', 'altura', 'idade'],
    calc: ({ sexo, peso, altura, idade }) => 10 * peso + 6.25 * altura - 5 * idade + (sexo === 'M' ? 5 : -161),
  },
  {
    id: 'fao1985',
    nome: 'FAO/OMS/ONU (1985)',
    tipo: 'TMB',
    referencia: 'FAO/WHO/UNU. Energy and protein requirements. WHO Technical Report Series 724, 1985.',
    publico: 'Todas as idades (equação por faixa etária)',
    requer: ['peso', 'idade'],
    calc: ({ sexo, peso, idade }) => {
      const [, a, b] = porFaixa(FAO_1985[sexo], idade);
      return a * peso + b;
    },
  },
  {
    id: 'schofield',
    nome: 'Schofield (1985)',
    tipo: 'TMB',
    referencia: 'Schofield WN. Hum Nutr Clin Nutr. 1985;39 Suppl 1:5-41.',
    publico: 'Todas as idades (equação por faixa etária)',
    requer: ['peso', 'idade'],
    calc: ({ sexo, peso, idade }) => {
      const [, a, b] = porFaixa(SCHOFIELD_1985[sexo], idade);
      return a * peso + b;
    },
  },
  {
    id: 'cunningham',
    nome: 'Cunningham (1980)',
    tipo: 'TMB',
    referencia: 'Cunningham JJ. Am J Clin Nutr. 1980;33(11):2372-2374.',
    publico: 'Adultos fisicamente ativos/ atletas',
    requer: ['mlg'],
    calc: ({ mlg }) => 500 + 22 * /** @type {number} */ (mlg),
  },
  {
    id: 'katch',
    nome: 'Katch-McArdle',
    tipo: 'TMB',
    referencia: 'McArdle WD, Katch FI, Katch VL. Exercise Physiology. 370 + 21,6 × MLG.',
    publico: 'Adultos com composição corporal conhecida',
    requer: ['mlg'],
    calc: ({ mlg }) => 370 + 21.6 * /** @type {number} */ (mlg),
  },
  {
    id: 'tinsleyPeso',
    nome: 'Tinsley (2019) · peso',
    tipo: 'TMB',
    referencia: 'Tinsley GM, Graybeal AJ, Moore ML. Appl Physiol Nutr Metab. 2019;44(4):397-406.',
    publico: 'Atletas de força/ fisiculturismo',
    requer: ['peso'],
    calc: ({ peso }) => 24.8 * peso + 10,
  },
  {
    id: 'tinsleyMlg',
    nome: 'Tinsley (2019) · MLG',
    tipo: 'TMB',
    referencia: 'Tinsley GM, Graybeal AJ, Moore ML. Appl Physiol Nutr Metab. 2019;44(4):397-406.',
    publico: 'Atletas de força/ fisiculturismo',
    requer: ['mlg'],
    calc: ({ mlg }) => 25.9 * /** @type {number} */ (mlg) + 284,
  },
  {
    id: 'iom2005',
    nome: 'DRI/IOM (2005) · EER',
    tipo: 'GET',
    referencia:
      'Institute of Medicine. Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids. 2005.',
    publico: '3 anos ou mais, peso saudável (não usar fator atividade adicional)',
    requer: ['peso', 'altura', 'idade', 'nivelIom'],
    calc: ({ sexo, peso, altura, idade, nivelIom = 'sedentario' }) => {
      const m = altura / 100;
      if (idade >= 19) {
        const pa = PA_IOM.adulto[sexo][nivelIom];
        return sexo === 'M'
          ? 662 - 9.53 * idade + pa * (15.91 * peso + 539.6 * m)
          : 354 - 6.91 * idade + pa * (9.36 * peso + 726 * m);
      }
      const pa = PA_IOM.crianca[sexo][nivelIom];
      const deposicao = idade < 9 ? 20 : 25;
      return sexo === 'M'
        ? 88.5 - 61.9 * idade + pa * (26.7 * peso + 903 * m) + deposicao
        : 135.3 - 30.8 * idade + pa * (10.0 * peso + 934 * m) + deposicao;
    },
  },
  {
    id: 'kcalkg',
    nome: 'Regra de bolso (kcal/kg)',
    tipo: 'GET',
    referencia: 'Estimativa prática: kcal/kg/dia × peso.',
    publico: 'Uso clínico rápido',
    requer: ['peso', 'kcalPorKg'],
    calc: ({ peso, kcalPorKg }) => peso * /** @type {number} */ (kcalPorKg),
  },
];

/** @param {string} id */
export function equacaoPorId(id) {
  return EQUACOES.find((e) => e.id === id);
}

/**
 * Fatores de atividade física (multiplicadores da TMB) mais usados na prática clínica.
 */
export const FATORES_ATIVIDADE = [
  { valor: 1.2, rotulo: 'Sedentário · 1,2' },
  { valor: 1.375, rotulo: 'Levemente ativo · 1,375' },
  { valor: 1.55, rotulo: 'Moderadamente ativo · 1,55' },
  { valor: 1.725, rotulo: 'Muito ativo · 1,725' },
  { valor: 1.9, rotulo: 'Extremamente ativo · 1,9' },
];

/**
 * Valida as entradas exigidas por uma equação.
 * @param {Equacao} eq
 * @param {Entrada} e
 * @returns {string[]} campos ausentes
 */
export function camposFaltando(eq, e) {
  return eq.requer.filter((campo) => {
    const v = /** @type {any} */ (e)[campo];
    if (campo === 'nivelIom') return !v;
    return !ok(v) || v <= 0;
  });
}

/**
 * Calcula TMB e gasto energético total.
 * GET = TMB × FA × FI (para equações de TMB); para EER/ kcal/kg o valor já é o GET.
 * VET = GET + ajuste (kcal; negativo para déficit).
 * @param {Object} p
 * @param {string} p.equacao
 * @param {Entrada} p.entrada
 * @param {number} [p.fatorAtividade]
 * @param {number} [p.fatorInjuria]
 * @param {number} [p.ajusteKcal]
 */
export function calcularGasto({ equacao, entrada, fatorAtividade = 1, fatorInjuria = 1, ajusteKcal = 0 }) {
  const eq = equacaoPorId(equacao);
  if (!eq) return null;
  const faltando = camposFaltando(eq, entrada);
  if (faltando.length) return { eq, faltando, tmb: NaN, get: NaN, vet: NaN };
  const valor = eq.calc(entrada);
  const tmb = eq.tipo === 'TMB' ? valor : NaN;
  const fa = ok(fatorAtividade) ? fatorAtividade : 1;
  const fi = ok(fatorInjuria) ? fatorInjuria : 1;
  const get = eq.tipo === 'TMB' ? valor * fa * fi : valor * fi;
  const vet = get + (ok(ajusteKcal) ? ajusteKcal : 0);
  return { eq, faltando: [], tmb, get, vet };
}
