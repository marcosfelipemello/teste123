// Acompanhamento gestacional (relatório §7, conferido na tela: 5 cenários × 40 semanas + 4 semanas
// testadas em cada). Classe pré-gestacional, curvas brasileiras de ganho de peso (Kac et al., 2021),
// avaliação da semana, percentis de CMB/DCT pela idade da paciente, tabela semanal e aporte calórico.
//
// Convenções (§3): arredondamento sempre com toFixed do JS (fx/fxn de numeros.js); datas "dd/mm/aaaa";
// "hoje" é sempre o parâmetro `dataReferencia` (no WebDiet vem do servidor).

import { check, fx, fxn, idadeAnos, partesData } from './numeros.js';
import CURVAS from '../dados/curvas_ganho_peso_gestacional.json' with { type: 'json' };

/** Aviso para o aporte calórico quando não há nenhum peso registrado (WebDiet §12 #18). */
export const AVISO_SEM_PESO =
  'Nenhum peso registrado: registre o peso de uma semana para calcular o aporte calórico. ' +
  '(O WebDiet calcula contra 0 kg e mostra valores sem sentido, como "+7431 Kcal/dia".)';

/**
 * Divergências do WebDiet (relatório §12) tratadas neste módulo e o comportamento adotado.
 * @type {{item:number, descricao:string, comportamento:string}[]}
 */
export const DIVERGENCIAS = [
  {
    item: 18,
    descricao:
      'Aporte calórico sem nenhum peso registrado: o WebDiet usa peso_ult = 0 e mostra valores como ' +
      '"+7431 Kcal/dia" a partir da 10ª semana.',
    comportamento:
      'Corrigido: sem peso registrado, o aporte das semanas ≥ 10 é null, com `aviso` em português; a tela ' +
      'mostra "-". A fórmula pura (aporteSemana com pesoUlt = 0) ainda reproduz o número do WebDiet.',
  },
  {
    item: 19,
    descricao: 'Percentis da DCT, 16 anos: o corte p5 é 1,5 (provavelmente 10,5).',
    comportamento: 'Mantido igual ao WebDiet (p5 = 1,5).',
  },
];

// ---------------------------------------------------------------------------
// Dados iniciais (§7.1, §7.2)
// ---------------------------------------------------------------------------

/**
 * Classe pré-gestacional pelo IMC (§7.2).
 * @param {number} imc
 * @returns {'Baixo Peso'|'Saudável'|'Sobrepeso'|'Obesidade'}
 */
export function classePreGestacional(imc) {
  if (imc < 18.5) return 'Baixo Peso';
  if (imc < 25) return 'Saudável';
  if (imc < 30) return 'Sobrepeso';
  return 'Obesidade';
}

/**
 * IMC pré-gestacional: ppg / alt², com toFixed(2) (é o valor salvo; a tela mostra toFixed(1) dele).
 * @param {number|string} ppg kg
 * @param {number|string} altura cm
 * @returns {number|null}
 */
export function imcPreGestacional(ppg, altura) {
  const p = check(ppg), a = check(altura);
  if (p <= 0 || a <= 0) return null;
  return fxn(p / Math.pow(a / 100, 2), 2);
}

/**
 * Normaliza o tipo de gestação.
 * @param {unknown} tipo
 * @returns {'Única'|'Gemelar'}
 */
export function normalizarTipo(tipo) {
  const t = String(tipo ?? 'Única').trim().toLowerCase();
  if (t === 'única' || t === 'unica' || t === '') return 'Única';
  if (t === 'gemelar') return 'Gemelar';
  throw new TypeError('tipo deve ser "Única" ou "Gemelar"');
}

const DIA_MS = 86400000;

function utc(data) {
  const p = partesData(data);
  return p ? Date.UTC(p.a, p.m - 1, p.d) : null;
}

function textoData(ms) {
  const d = new Date(ms);
  const p2 = (x) => String(x).padStart(2, '0');
  return `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/**
 * Idade gestacional e DUM (§7.1). Recebe `semanas` (idade gestacional) ou `dum`:
 * - DUM = dataReferencia − semanas;
 * - semanas = parseInt(diferença em semanas entre dataReferencia e DUM).
 * Se vierem os dois, vale `semanas`. Com `semanas` e sem `dataReferencia`, a DUM fica null.
 * A semana atual acima de 43 é tratada como 40.
 * @param {{semanas?:number|string, dum?:string, dataReferencia?:string}} e
 * @returns {{semanas:number, semanaAtual:number, dum:string|null}}
 */
export function idadeGestacional({ semanas, dum, dataReferencia }) {
  const ref = utc(dataReferencia);
  let s;
  let dumTexto;
  if (semanas !== undefined && semanas !== null && semanas !== '') {
    s = parseInt(String(check(semanas)), 10);
    dumTexto = ref === null ? null : textoData(ref - s * 7 * DIA_MS);
  } else {
    if (ref === null) throw new RangeError('dataReferencia inválida (use "dd/mm/aaaa")');
    const d = utc(dum);
    if (d === null) throw new RangeError('informe semanas ou dum ("dd/mm/aaaa")');
    s = parseInt(String((ref - d) / (7 * DIA_MS)), 10);
    dumTexto = textoData(d);
  }
  return { semanas: s, semanaAtual: s > 43 ? 40 : s, dum: dumTexto };
}

// ---------------------------------------------------------------------------
// Curvas (§7.3)
// ---------------------------------------------------------------------------

/** Par de percentis cuja média dá o peso esperado (§7.3). */
const PAR_ESPERADO = {
  'Baixo Peso': ['p16', 'p34'],
  'Saudável': ['p10', 'p34'],
  'Sobrepeso': ['p16', 'p25'],
  'Obesidade': ['p25', 'p38'],
};

/**
 * Curva de 40 semanas: peso esperado e faixa recomendada (mínimo/máximo).
 * - Da 10ª semana em diante: esperado = ppg + (pA[i] + pB[i]) / 2 (pares em PAR_ESPERADO; gemelar p10/p50);
 *   faixa = ppg + faixa_min[i] e ppg + faixa_max[i] (gemelar: ppg + p10[i] e ppg + p50[i]).
 * - Semanas 1–9: esperado interpolado em linha reta de ppg (semana 0) até o esperado da 10ª,
 *   alcançado já na 9ª: ppg + (esperado10 − ppg) × semana / 9. Mínimo = máximo = ppg.
 * @param {{ppg:number|string, classe:string, tipo?:string}} e
 * @returns {{semana:number, esperado:number, minimo:number, maximo:number}[]}
 */
export function curvaGestacional({ ppg, classe, tipo }) {
  const p = check(ppg);
  const t = normalizarTipo(tipo);
  const c = CURVAS[`${t}|${classe}`];
  if (!c) throw new RangeError(`classe pré-gestacional desconhecida: ${classe}`);
  const [kA, kB] = t === 'Gemelar' ? ['p10', 'p50'] : PAR_ESPERADO[classe];
  const [kMin, kMax] = t === 'Gemelar' ? ['p10', 'p50'] : ['faixa_min', 'faixa_max'];

  const esperado10 = p + (c[kA][9] + c[kB][9]) / 2;
  const curva = [];
  for (let semana = 1; semana <= 40; semana++) {
    const i = semana - 1;
    if (semana < 10) {
      curva.push({ semana, esperado: p + ((esperado10 - p) * semana) / 9, minimo: p, maximo: p });
    } else {
      curva.push({
        semana,
        esperado: p + (c[kA][i] + c[kB][i]) / 2,
        minimo: p + c[kMin][i],
        maximo: p + c[kMax][i],
      });
    }
  }
  return curva;
}

/**
 * Avaliação do peso numa semana (§7.4): antes da 10ª "N/D"; depois, abaixo do mínimo
 * "Abaixo do peso", entre mínimo e máximo "Saudável", acima do máximo "Acima do peso".
 * Compara com os valores da curva sem arredondar.
 * @param {number} peso
 * @param {{semana:number, minimo:number, maximo:number}} linhaCurva
 * @returns {'N/D'|'Abaixo do peso'|'Saudável'|'Acima do peso'}
 */
export function avaliarPesoSemana(peso, { semana, minimo, maximo }) {
  if (semana < 10) return 'N/D';
  if (peso < minimo) return 'Abaixo do peso';
  if (peso > maximo) return 'Acima do peso';
  return 'Saudável';
}

// ---------------------------------------------------------------------------
// Aporte calórico e tabela semanal (§7.6)
// ---------------------------------------------------------------------------

/**
 * Normaliza os pesos registrados: { semana: peso } → Map<number, number> só com pesos > 0
 * e semanas de 1 a 40.
 * @param {Record<string|number, number|string>|Map<number, number|string>|undefined} pesos
 * @returns {Map<number, number>}
 */
function mapaPesos(pesos) {
  const m = new Map();
  if (!pesos) return m;
  const entradas = pesos instanceof Map ? [...pesos.entries()] : Object.entries(pesos);
  for (const [s, v] of entradas) {
    const semana = parseInt(String(s), 10);
    const peso = check(v);
    if (semana >= 1 && semana <= 40 && peso > 0) m.set(semana, peso);
  }
  return m;
}

/**
 * Última semana com peso registrado e o peso dela (§7.6). Sem peso: ult = 1 (como no WebDiet)
 * e pesoUlt = null (o WebDiet usa 0 — §12 #18).
 * @param {Map<number, number>} pesos
 * @returns {{ult:number, pesoUlt:number|null}}
 */
function ultimoPeso(pesos) {
  if (pesos.size === 0) return { ult: 1, pesoUlt: null };
  const ult = Math.max(...pesos.keys());
  return { ult, pesoUlt: pesos.get(ult) };
}

/**
 * Aporte calórico de uma semana da tabela (§7.6):
 * dif = parseFloat((esperado − pesoUlt).toFixed(1)); se dif > 0 e semana > ult,
 * "+" + (dif × 7700 / ((semana − ult) × 7)).toFixed(0) + " Kcal/dia"; senão "0 Kcal/dia".
 * Antes da 10ª semana: "-".
 *
 * WebDiet §12 #18: sem nenhum peso registrado o WebDiet usa pesoUlt = 0. Aqui, `pesoUlt` null/undefined
 * devolve kcal null + `aviso`. Passar pesoUlt = 0 explicitamente reproduz o número do WebDiet.
 * @param {{semana:number, esperado:number, ult:number, pesoUlt:number|null|undefined}} e
 * @returns {{kcal:number|null, tela:string, aviso?:string}}
 */
export function aporteSemana({ semana, esperado, ult, pesoUlt }) {
  if (semana < 10) return { kcal: null, tela: '-' };
  if (pesoUlt === null || pesoUlt === undefined) return { kcal: null, tela: '-', aviso: AVISO_SEM_PESO };
  const dif = fxn(esperado - pesoUlt, 1);
  if (dif > 0 && semana > ult) {
    const v = (dif * 7700) / ((semana - ult) * 7);
    return { kcal: fxn(v, 0), tela: `+${fx(v, 0)} Kcal/dia` };
  }
  return { kcal: 0, tela: '0 Kcal/dia' };
}

/**
 * Tabela semanal (§7.6): semana · mínimo · máximo · peso registrado (ou "registrar peso") · kcal.
 * As colunas "ver conduta" e "usar aporte" são ações; o texto da conduta não está no relatório, então
 * cada linha traz só a `avaliacao` do peso registrado (base da conduta).
 * @param {object} e
 * @param {{semana:number, esperado:number, minimo:number, maximo:number}[]} e.curva saída de curvaGestacional
 * @param {Record<string|number, number|string>|Map<number, number|string>} [e.pesos] pesos registrados por semana
 * @returns {{
 *   ult:number, pesoUlt:number|null, avisos:string[],
 *   linhas:{semana:number, minimo:number, maximo:number, esperado:number, peso:number|null,
 *           avaliacao:string|null, kcal:number|null, aviso?:string}[],
 *   tela:string[][]
 * }}
 */
export function tabelaSemanal({ curva, pesos }) {
  const mp = mapaPesos(pesos);
  const { ult, pesoUlt } = ultimoPeso(mp);
  const avisos = new Set();
  const linhas = [];
  const tela = [];
  for (const lc of curva) {
    const peso = mp.get(lc.semana) ?? null;
    const a = aporteSemana({ semana: lc.semana, esperado: lc.esperado, ult, pesoUlt });
    if (a.aviso) avisos.add(a.aviso);
    linhas.push({
      semana: lc.semana,
      minimo: lc.minimo,
      maximo: lc.maximo,
      esperado: lc.esperado,
      peso,
      // Situação da linha (base da "conduta"; o texto da conduta não está no relatório).
      avaliacao: peso === null ? null : avaliarPesoSemana(peso, lc),
      kcal: a.kcal,
      ...(a.aviso ? { aviso: a.aviso } : {}),
    });
    tela.push([
      `${lc.semana} semanas`,
      lc.semana < 10 ? '-' : `${fx(lc.minimo, 1)} Kg`,
      lc.semana < 10 ? '-' : `${fx(lc.maximo, 1)} Kg`,
      peso === null ? 'registrar peso' : `${fx(peso, 1)} Kg`,
      a.tela,
    ]);
  }
  return { ult, pesoUlt, avisos: [...avisos], linhas, tela };
}

// ---------------------------------------------------------------------------
// CMB e DCT (§7.5)
// ---------------------------------------------------------------------------

/** Percentis da CMB (p5, p10, p25, p50, p75, p90, p95) por faixa de idade [idade mínima, cortes]. */
const CORTES_CMB = [
  [12, [16.2, 16.6, 18.0, 19.1, 20.1, 21.4, 22.0]],
  [13, [16.9, 17.5, 18.3, 19.8, 21.1, 22.6, 24.0]],
  [14, [17.4, 17.9, 19.0, 20.1, 21.6, 23.2, 24.7]],
  [15, [17.5, 17.8, 18.9, 20.0, 21.5, 22.8, 24.4]],
  [16, [17.0, 18.0, 19.0, 20.0, 21.6, 23.4, 24.9]],
  [17, [17.5, 18.3, 19.4, 20.5, 22.1, 23.9, 25.7]],
  [18, [17.4, 17.9, 19.5, 20.2, 21.5, 23.7, 24.5]],
  [19, [17.9, 18.5, 19.5, 20.7, 22.1, 23.6, 24.9]], // 19–24
  [25, [18.3, 18.8, 19.9, 21.2, 22.8, 24.6, 26.4]], // 25–34
  [35, [18.6, 19.2, 20.5, 21.8, 23.6, 25.7, 27.2]], // ≥ 35
];
const PERCENTIS_CMB = [5, 10, 25, 50, 75, 90, 95];

/** Percentis da DCT (p5, p10, p15, p25, p50, p75, p85, p90, p95) por faixa de idade. */
const CORTES_DCT = [
  [12, [7, 8, 9, 11, 14, 18.5, 21.5, 24, 27.5]],
  [13, [7, 8, 9, 11, 15, 20, 24, 25, 30]],
  [14, [8, 9, 10, 11.5, 16, 21, 23.5, 26.5, 32]],
  [15, [8, 9.5, 10.5, 12, 16.5, 20.5, 23, 26, 32.5]],
  // WebDiet §12 #19: p5 = 1,5 aos 16 anos (provavelmente 10,5); mantido igual ao WebDiet.
  [16, [1.5, 11.5, 12, 14, 18, 23, 26, 29, 32.5]],
  [17, [9, 10, 12, 13, 18, 24, 26.5, 29, 34.5]],
  [18, [9, 11, 12, 14, 18.5, 24.5, 28.5, 31, 36]], // 18–24
  [25, [10, 12, 13, 15, 20, 26.5, 31, 34, 38]], // 25–29
  [30, [10.5, 13, 15, 17, 22.5, 29.5, 33, 35.5, 41.5]], // 30–34
  [35, [11, 13, 15.5, 18, 23.5, 30, 35, 37, 41]], // 35–39
  [40, [12, 14, 16, 19, 24.5, 30.5, 35, 37, 41]], // ≥ 40
];
const PERCENTIS_DCT = [5, 10, 15, 25, 50, 75, 85, 90, 95];

function cortesPorIdade(tabela, idade) {
  let cortes = null;
  for (const [min, c] of tabela) if (idade >= min) cortes = c;
  return cortes;
}

/**
 * Rótulo da faixa de percentil: "Abaixo do p5", "Entre pX e pY", "Acima do p95".
 * Um valor igual a um corte fica na faixa de cima (valor < corte → faixa de baixo).
 */
function rotuloPercentil(valor, cortes, percentis) {
  if (valor < cortes[0]) return `Abaixo do p${percentis[0]}`;
  for (let i = 1; i < cortes.length; i++) {
    if (valor < cortes[i]) return `Entre p${percentis[i - 1]} e p${percentis[i]}`;
  }
  return `Acima do p${percentis[percentis.length - 1]}`;
}

/**
 * Faixa de percentil da CMB pela idade da paciente (§7.5). Sem tabela para menos de 12 anos: null.
 * @param {number} cmb cm
 * @param {number} idade anos
 * @returns {string|null}
 */
export function percentilCMB(cmb, idade) {
  const cortes = cortesPorIdade(CORTES_CMB, idade);
  return cortes ? rotuloPercentil(cmb, cortes, PERCENTIS_CMB) : null;
}

/**
 * Faixa de percentil da DCT pela idade da paciente (§7.5). Sem tabela para menos de 12 anos: null.
 * @param {number} dct mm
 * @param {number} idade anos
 * @returns {string|null}
 */
export function percentilDCT(dct, idade) {
  const cortes = cortesPorIdade(CORTES_DCT, idade);
  return cortes ? rotuloPercentil(dct, cortes, PERCENTIS_DCT) : null;
}

// ---------------------------------------------------------------------------
// Funções principais
// ---------------------------------------------------------------------------

/**
 * @typedef {object} DadosGestante
 * @property {number|string} ppg peso pré-gestacional, kg
 * @property {number|string} [altura] estatura, cm (aceita também `alt`, como na evidência)
 * @property {number|string} [alt]
 * @property {'Única'|'Gemelar'} [tipo] padrão "Única"
 * @property {number|string} [semanas] idade gestacional na dataReferencia (ou informe `dum`)
 * @property {string} [dum] data da última menstruação, "dd/mm/aaaa"
 * @property {string} [dataReferencia] "hoje", "dd/mm/aaaa" (obrigatória com `dum` ou `nascimento`)
 * @property {number} [idade] idade da paciente em anos (ou informe `nascimento`)
 * @property {string} [nascimento] "dd/mm/aaaa"
 * @property {Record<string|number, number|string>|Map<number, number|string>} [pesos] pesos registrados por semana
 */

function idadePaciente(e) {
  if (e.idade !== undefined && e.idade !== null && e.idade !== '') return Math.trunc(check(e.idade));
  if (e.nascimento && e.dataReferencia) return idadeAnos(e.nascimento, e.dataReferencia);
  return null;
}

/**
 * Tela principal do acompanhamento gestacional: IMC e classe pré-gestacional, semana atual, idade,
 * curva (tabela do gráfico) e tabela semanal com o aporte calórico.
 * @param {DadosGestante} e
 * @returns {{
 *   imcPpg:number|null, classe:string|null, tipo:'Única'|'Gemelar',
 *   semanas:number|null, semanaAtual:number|null, dum:string|null, idade:number|null,
 *   curva:{semana:number, esperado:number, minimo:number, maximo:number}[],
 *   ult:number, pesoUlt:number|null,
 *   linhas:object[], avisos:string[],
 *   tela:{imcPpg:string, classe:string, semanaAtual:number|null, idade:number|null,
 *         tabela:[number, number, number, number][], linhas:string[][]}
 * }}
 */
export function acompanhamentoGestacional(e) {
  const tipo = normalizarTipo(e.tipo);
  const altura = e.altura ?? e.alt;
  const imcPpg = imcPreGestacional(e.ppg, altura);
  if (imcPpg === null) throw new RangeError('informe ppg e altura maiores que zero');
  const classe = classePreGestacional(imcPpg);

  let ig = { semanas: null, semanaAtual: null, dum: null };
  if ((e.semanas !== undefined && e.semanas !== null && e.semanas !== '') || e.dum) {
    ig = idadeGestacional({ semanas: e.semanas, dum: e.dum, dataReferencia: e.dataReferencia });
  }
  const idade = idadePaciente(e);

  const curva = curvaGestacional({ ppg: e.ppg, classe, tipo });
  const t = tabelaSemanal({ curva, pesos: e.pesos });

  return {
    imcPpg, classe, tipo,
    semanas: ig.semanas, semanaAtual: ig.semanaAtual, dum: ig.dum, idade,
    curva,
    ult: t.ult, pesoUlt: t.pesoUlt,
    linhas: t.linhas,
    avisos: t.avisos,
    tela: {
      imcPpg: `${fx(imcPpg, 1)} kg/m2`,
      classe,
      semanaAtual: ig.semanaAtual,
      idade,
      tabela: curva.map((l) => [l.semana, l.esperado, l.minimo, l.maximo]),
      linhas: t.tela,
    },
  };
}

/**
 * Registro/avaliação do peso de uma semana (§7.4–§7.6): IMC atual, avaliação na curva, CMB e DCT com
 * percentis pela idade, ganho total e a coluna de aporte calórico já com este peso registrado.
 *
 * @param {DadosGestante & {semana:number|string, peso:number|string, dct?:number|string, cb?:number|string}} e
 *   `semana` (1–40) e `peso` (kg) a registrar; `dct` (mm) e `cb` (cm) opcionais.
 *   `pesos` são os pesos já registrados; o desta semana substitui o anterior.
 * @returns {{
 *   semana:number, peso:number, imc:number, avaliacao:string, ganhoTotal:number,
 *   cmb:number|null, percentilCmb:string|null, percentilDct:string|null,
 *   pesos:Record<number, number>, kcal:(number|null)[], avisos:string[],
 *   tela:{semana:string, imc:string, en:string, cmb:string, proteico:string, lipidico:string,
 *         pesoTotal:string, kcal:string[]}
 * }}
 */
export function avaliarSemana(e) {
  const semana = parseInt(String(check(e.semana)), 10);
  if (!(semana >= 1 && semana <= 40)) throw new RangeError('semana deve estar entre 1 e 40');
  const peso = check(e.peso);
  if (peso <= 0) throw new RangeError('peso deve ser maior que zero');

  const tipo = normalizarTipo(e.tipo);
  const altura = check(e.altura ?? e.alt);
  const ppg = check(e.ppg);
  const imcPpg = imcPreGestacional(ppg, altura);
  if (imcPpg === null) throw new RangeError('informe ppg e altura maiores que zero');
  const classe = classePreGestacional(imcPpg);
  const curva = curvaGestacional({ ppg, classe, tipo });

  // Registra o peso da semana e recalcula a coluna de aporte.
  const pesos = Object.fromEntries(mapaPesos(e.pesos));
  pesos[semana] = peso;
  const t = tabelaSemanal({ curva, pesos });

  const imc = fxn(peso / Math.pow(altura / 100, 2), 1);
  const avaliacao = avaliarPesoSemana(peso, curva[semana - 1]);
  const ganhoTotal = fxn(peso - ppg, 2);

  const idade = idadePaciente(e);
  const avisos = [...t.avisos];
  const dct = check(e.dct), cb = check(e.cb);
  // CMB = CB − 0,314 × DCT. A faixa de percentil usa o valor sem arredondar.
  const cmbBruta = cb > 0 && dct > 0 ? cb - 0.314 * dct : null;
  let percentilCmb = null, percentilDct = null;
  if (idade === null) {
    if (cmbBruta !== null || dct > 0) avisos.push('Informe a idade (ou nascimento) da paciente para os percentis de CMB e DCT.');
  } else {
    if (cmbBruta !== null) percentilCmb = percentilCMB(cmbBruta, idade);
    if (dct > 0) percentilDct = percentilDCT(dct, idade);
    if (idade < 12 && (cmbBruta !== null || dct > 0)) avisos.push('Não há percentis de CMB e DCT para menos de 12 anos.');
  }

  return {
    semana, peso, imc, avaliacao, ganhoTotal,
    cmb: cmbBruta === null ? null : fxn(cmbBruta, 1),
    percentilCmb, percentilDct,
    pesos,
    kcal: t.linhas.map((l) => l.kcal),
    avisos,
    tela: {
      semana: `${semana} sem`,
      imc: `${fx(imc, 1)} kg/m2`,
      en: avaliacao,
      cmb: cmbBruta === null ? '-' : `${fx(cmbBruta, 1)} cm`,
      proteico: percentilCmb ?? '-',
      lipidico: percentilDct ?? '-',
      pesoTotal: fx(peso - ppg, 2),
      kcal: t.tela.map((l) => l[4]),
    },
  };
}
