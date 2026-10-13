// @ts-check
import { ok } from './util.js';

/** @typedef {'M'|'F'} Sexo */
/** @typedef {'triceps'|'biceps'|'subescapular'|'suprailiaca'|'abdominal'|'peitoral'|'axilarMedia'|'coxa'|'panturrilha'} Dobra */

/** @type {Record<Dobra, string>} */
export const DOBRAS = {
  triceps: 'Tricipital',
  biceps: 'Bicipital',
  subescapular: 'Subescapular',
  suprailiaca: 'Suprailíaca',
  abdominal: 'Abdominal',
  peitoral: 'Peitoral',
  axilarMedia: 'Axilar média',
  coxa: 'Coxa',
  panturrilha: 'Panturrilha medial',
};

/**
 * Conversão de densidade corporal em % de gordura.
 * Siri (1961): %G = (4,95 / D − 4,50) × 100
 * Brozek et al. (1963): %G = (4,57 / D − 4,142) × 100
 */
export const CONVERSOES = {
  siri: { nome: 'Siri (1961)', calc: (/** @type {number} */ d) => (4.95 / d - 4.5) * 100 },
  brozek: { nome: 'Brozek (1963)', calc: (/** @type {number} */ d) => (4.57 / d - 4.142) * 100 },
};

/** @param {number[]} xs */
const soma = (xs) => xs.reduce((a, b) => a + b, 0);

/**
 * Coeficientes de Durnin & Womersley (1974): D = c − m · log10(Σ4).
 * Σ4 = bicipital + tricipital + subescapular + suprailíaca.
 * @param {Sexo} sexo
 * @param {number} idade
 */
function coefDurnin(sexo, idade) {
  const tabela =
    sexo === 'M'
      ? [
          [20, 1.162, 0.063],
          [30, 1.1631, 0.0632],
          [40, 1.1422, 0.0544],
          [50, 1.162, 0.07],
          [Infinity, 1.1715, 0.0779],
        ]
      : [
          [20, 1.1549, 0.0678],
          [30, 1.1599, 0.0717],
          [40, 1.1423, 0.0632],
          [50, 1.1333, 0.0612],
          [Infinity, 1.1339, 0.0645],
        ];
  const linha = tabela.find(([limite]) => idade < limite) ?? tabela[tabela.length - 1];
  return { c: linha[1], m: linha[2] };
}

/**
 * @typedef {Object} Protocolo
 * @property {string} id
 * @property {string} nome
 * @property {string} referencia
 * @property {(sexo: Sexo) => Dobra[]} dobras
 * @property {string} publico
 * @property {'densidade'|'percentual'} saida
 * @property {(sexo: Sexo, s: Record<Dobra, number>, idade: number) => number} calc
 */

/** @type {Protocolo[]} */
export const PROTOCOLOS = [
  {
    id: 'jp7',
    nome: 'Jackson & Pollock · 7 dobras',
    referencia:
      'Jackson AS, Pollock ML. Br J Nutr. 1978;40:497-504 (homens) · Jackson AS, Pollock ML, Ward A. Med Sci Sports Exerc. 1980;12:175-182 (mulheres).',
    publico: 'Adultos 18–61 anos (H) · 18–55 anos (M)',
    dobras: () => ['peitoral', 'axilarMedia', 'triceps', 'subescapular', 'abdominal', 'suprailiaca', 'coxa'],
    saida: 'densidade',
    calc: (sexo, s, idade) => {
      const x = soma(['peitoral', 'axilarMedia', 'triceps', 'subescapular', 'abdominal', 'suprailiaca', 'coxa'].map((k) => s[/** @type {Dobra} */ (k)]));
      return sexo === 'M'
        ? 1.112 - 0.00043499 * x + 0.00000055 * x * x - 0.00028826 * idade
        : 1.097 - 0.00046971 * x + 0.00000056 * x * x - 0.00012828 * idade;
    },
  },
  {
    id: 'jp3',
    nome: 'Jackson & Pollock · 3 dobras',
    referencia:
      'Jackson AS, Pollock ML. Br J Nutr. 1978;40:497-504 (homens: peitoral, abdominal, coxa) · Jackson AS, Pollock ML, Ward A. 1980 (mulheres: tricipital, suprailíaca, coxa).',
    publico: 'Adultos 18–61 anos (H) · 18–55 anos (M)',
    dobras: (sexo) => (sexo === 'M' ? ['peitoral', 'abdominal', 'coxa'] : ['triceps', 'suprailiaca', 'coxa']),
    saida: 'densidade',
    calc: (sexo, s, idade) => {
      if (sexo === 'M') {
        const x = s.peitoral + s.abdominal + s.coxa;
        return 1.10938 - 0.0008267 * x + 0.0000016 * x * x - 0.0002574 * idade;
      }
      const x = s.triceps + s.suprailiaca + s.coxa;
      return 1.0994921 - 0.0009929 * x + 0.0000023 * x * x - 0.0001392 * idade;
    },
  },
  {
    id: 'durnin',
    nome: 'Durnin & Womersley · 4 dobras',
    referencia: 'Durnin JVGA, Womersley J. Br J Nutr. 1974;32:77-97.',
    publico: 'A partir de 17 anos (coeficientes por faixa etária)',
    dobras: () => ['biceps', 'triceps', 'subescapular', 'suprailiaca'],
    saida: 'densidade',
    calc: (sexo, s, idade) => {
      const x = s.biceps + s.triceps + s.subescapular + s.suprailiaca;
      const { c, m } = coefDurnin(sexo, idade);
      return c - m * Math.log10(x);
    },
  },
  {
    id: 'petroski',
    nome: 'Petroski · 4 dobras',
    referencia: 'Petroski EL. Tese de doutorado, UFSM, 1995 (população brasileira).',
    publico: 'Adultos brasileiros 18–66 anos (H) · 18–51 anos (M)',
    dobras: (sexo) =>
      sexo === 'M' ? ['subescapular', 'triceps', 'suprailiaca', 'panturrilha'] : ['axilarMedia', 'suprailiaca', 'coxa', 'panturrilha'],
    saida: 'densidade',
    calc: (sexo, s, idade) => {
      if (sexo === 'M') {
        const x = s.subescapular + s.triceps + s.suprailiaca + s.panturrilha;
        return 1.10726863 - 0.00081201 * x + 0.00000212 * x * x - 0.00041761 * idade;
      }
      const x = s.axilarMedia + s.suprailiaca + s.coxa + s.panturrilha;
      return 1.1954713 - 0.07513507 * Math.log10(x) - 0.00041072 * idade;
    },
  },
  {
    id: 'guedes',
    nome: 'Guedes · 3 dobras',
    referencia: 'Guedes DP. Dissertação de mestrado, UFSM, 1985 (universitários brasileiros).',
    publico: 'Adultos jovens brasileiros',
    dobras: (sexo) => (sexo === 'M' ? ['triceps', 'suprailiaca', 'abdominal'] : ['subescapular', 'suprailiaca', 'coxa']),
    saida: 'densidade',
    calc: (sexo, s) => {
      if (sexo === 'M') return 1.17136 - 0.06706 * Math.log10(s.triceps + s.suprailiaca + s.abdominal);
      return 1.1665 - 0.07063 * Math.log10(s.subescapular + s.suprailiaca + s.coxa);
    },
  },
  {
    id: 'faulkner',
    nome: 'Faulkner · 4 dobras',
    referencia: 'Faulkner JA. In: Falls HB (ed). Exercise Physiology. Academic Press, 1968.',
    publico: 'Adultos (frequente em atletas)',
    dobras: () => ['triceps', 'subescapular', 'suprailiaca', 'abdominal'],
    saida: 'percentual',
    calc: (_sexo, s) => (s.triceps + s.subescapular + s.suprailiaca + s.abdominal) * 0.153 + 5.783,
  },
];

/** @param {string} id */
export function protocoloPorId(id) {
  return PROTOCOLOS.find((p) => p.id === id);
}

/**
 * Calcula composição corporal por dobras cutâneas.
 * @param {Object} p
 * @param {string} p.protocolo
 * @param {Sexo} p.sexo
 * @param {number} p.idade
 * @param {number} p.peso
 * @param {Partial<Record<Dobra, number>>} p.dobras mm
 * @param {'siri'|'brozek'} [p.conversao]
 * @returns {null | { densidade: number|null, percentualGordura: number, massaGorda: number, massaMagra: number, somaDobras: number, faltando: Dobra[] }}
 */
export function composicaoPorDobras({ protocolo, sexo, idade, peso, dobras, conversao = 'siri' }) {
  const prot = protocoloPorId(protocolo);
  if (!prot) return null;
  const necessarias = prot.dobras(sexo);
  const faltando = necessarias.filter((d) => !ok(/** @type {number} */ (dobras[d])) || /** @type {number} */ (dobras[d]) <= 0);
  if (faltando.length || !ok(idade)) {
    return { densidade: null, percentualGordura: NaN, massaGorda: NaN, massaMagra: NaN, somaDobras: NaN, faltando };
  }
  const s = /** @type {Record<Dobra, number>} */ (dobras);
  const somaDobras = soma(necessarias.map((d) => s[d]));
  let densidade = null;
  let percentualGordura;
  if (prot.saida === 'densidade') {
    densidade = prot.calc(sexo, s, idade);
    percentualGordura = CONVERSOES[conversao].calc(densidade);
  } else {
    percentualGordura = prot.calc(sexo, s, idade);
  }
  const massaGorda = ok(peso) ? (peso * percentualGordura) / 100 : NaN;
  const massaMagra = ok(peso) ? peso - massaGorda : NaN;
  return { densidade, percentualGordura, massaGorda, massaMagra, somaDobras, faltando: [] };
}

/**
 * Composição a partir de % de gordura informado (ex.: bioimpedância).
 * @param {number} peso
 * @param {number} percentualGordura
 */
export function composicaoPorPercentual(peso, percentualGordura) {
  if (!ok(peso) || !ok(percentualGordura)) return null;
  const massaGorda = (peso * percentualGordura) / 100;
  return { percentualGordura, massaGorda, massaMagra: peso - massaGorda };
}
