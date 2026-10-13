// Receitas culinárias, tipo "calculada" (receitas.php): relatório §8.6.
// Conferido contra docs/webdiet-evidencias/tela_receita.json (editor aberto, receita não salva).
//
// Ingredientes vêm da base de alimentos (valores por 100 g/mL, como em planejamento.js). A receita "comum"
// (só texto e PDF) não tem cálculo.
//
// Divergência tratada aqui: §12 item 28 (ver DIVERGENCIAS).

import { check, fx, fxn } from './numeros.js';
import { medidaDoAlimento, nutrientesPorPeso, N_MICROS } from './planejamento.js';

/** Nome da medida da porção automática (rendimento > 0). */
export const NOME_PORCAO_AUTOMATICA = 'Porção';

/** Nome da medida criada pelo botão "gerar medida". */
export const NOME_PORCAO_GERADA = 'Porção(ões)';

/** Texto da ficha da receita (infoReceita). */
export const TEXTO_INFO_PORCAO = 'Cálculo referente a uma porção';

/** Aviso de "gerar medida" sem rendimento ou peso (o texto do WebDiet não foi registrado; este é próprio). */
export const AVISO_GERAR_MEDIDA = 'Informe o rendimento e o peso final da receita para gerar a medida';

/**
 * Divergências do WebDiet (relatório §12) tratadas neste módulo.
 * @type {ReadonlyArray<{item:number, descricao:string, comportamento:string}>}
 */
export const DIVERGENCIAS = Object.freeze([
  {
    item: 28,
    descricao:
      'A kcal de um ingrediente aparece com 0 casas e sem espaço ("256Kcal") quando a lista é redesenhada, ou com ' +
      '1 casa ("117.6 Kcal") quando a linha é recalculada. Os totais não são afetados.',
    comportamento:
      'Igual ao WebDiet na tela de receitas: a linha redesenhada mostra "256Kcal" e a recalculada "117.6 Kcal" ' +
      '(formatarKcalIngrediente). calcularIngrediente().tela.kcal traz o formato da linha recalculada.',
  },
]);

/**
 * Texto da kcal de um ingrediente.
 * @param {number} kcal
 * @param {'recalculada'|'redesenhada'} [modo] "recalculada" (padrão, §12 #28 corrigido): "117.6 Kcal";
 *        "redesenhada": formato que o WebDiet mostra ao redesenhar a lista, "256Kcal".
 * @returns {string}
 */
export function formatarKcalIngrediente(kcal, modo = 'recalculada') {
  return modo === 'redesenhada' ? `${fx(kcal, 0)}Kcal` : `${fx(kcal, 1)} Kcal`;
}

/**
 * Um ingrediente: peso = quantidade × peso da medida (SEM arredondar) ou `peso` informado; PTN, LIP e CHO
 * com 1 casa + "g". A medida pode ser "personalizada": {nome_mc, peso}, só para esta receita.
 * @param {{alimento:object, quantidade?:number|string, medida?:string|object, peso?:number|string}} ingrediente
 */
export function calcularIngrediente(ingrediente) {
  const al = ingrediente.alimento ?? {};
  const peso = ingrediente.medida === undefined && ingrediente.peso !== undefined
    ? check(ingrediente.peso)
    : check(ingrediente.quantidade) * medidaDoAlimento(al, ingrediente.medida).peso;
  const n = nutrientesPorPeso(al, peso);
  return {
    id: String(al.id ?? ''),
    nome: al.nome ?? '',
    unidade: al.unidade ?? 'g',
    peso,
    ...n,
    tela: {
      peso: `${peso}${al.unidade ?? 'g'}`,
      ptn: `${fx(n.ptn, 1)}g`,
      lip: `${fx(n.lip, 1)}g`,
      cho: `${fx(n.cho, 1)}g`,
      kcal: formatarKcalIngrediente(n.kcal),
    },
  };
}

/**
 * Calcula a receita: linhas, totais e porção automática.
 * Totais = Σ valor/100 × peso com os valores da base, SEM arredondar (não somam as linhas exibidas);
 * peso com 0 casas vai para o campo editável "peso final" (#peso); kcal 0 casas; PTN, LIP e CHO 1 casa.
 * Porção automática (rendimento > 0): soma dos pesos / rendimento, 0 casas, nome "Porção".
 *
 * @param {{ingredientes:object[], rendimento?:number|string}} receita
 * @returns {{linhas:object[], totais:{peso:number, kcal:number, ptn:number, lip:number, cho:number,
 *   fibras:number, micros:number[]}, porcao:{nome:string, peso:number}|null,
 *   tela:{peso:string, kcal:string, ptn:string, lip:string, cho:string, mc1:string, mcQnt1:string}}}
 *   `totais` sem arredondar; `tela` = campos do formulário (peso, kcal, ptn, lip, cho, mc1, mcQnt1).
 */
export function calcularReceita({ ingredientes = [], rendimento } = {}) {
  const linhas = ingredientes.map(calcularIngrediente);
  const t = { peso: 0, kcal: 0, ptn: 0, lip: 0, cho: 0, fibras: 0, micros: new Array(N_MICROS).fill(0) };
  for (const l of linhas) {
    t.peso += l.peso;
    t.kcal += l.kcal;
    t.ptn += l.ptn;
    t.lip += l.lip;
    t.cho += l.cho;
    t.fibras += l.fibras;
    for (let i = 0; i < N_MICROS; i++) t.micros[i] += l.micros[i];
  }
  const rend = check(rendimento);
  const porcao = rend > 0 ? { nome: NOME_PORCAO_AUTOMATICA, peso: fxn(t.peso / rend, 0) } : null;
  return {
    linhas,
    totais: t,
    porcao,
    tela: {
      peso: fx(t.peso, 0),
      kcal: fx(t.kcal, 0),
      ptn: fx(t.ptn, 1),
      lip: fx(t.lip, 1),
      cho: fx(t.cho, 1),
      mc1: porcao ? porcao.nome : '',
      mcQnt1: porcao ? fx(t.peso / rend, 0) : '',
    },
  };
}

/**
 * Botão "gerar medida": porção = peso final (#peso, ex.: depois do cozimento) / rendimento, com 1 casa
 * (`parseFloat(toFixed(1))`), nome "Porção(ões)". Rendimento ou peso vazio/0: aviso.
 * @param {{pesoFinal:number|string, rendimento:number|string}} entrada
 * @returns {{nome:string|null, peso:number|null, tela:{mc1:string, mcQnt1:string}|null, aviso:string|null}}
 */
export function gerarMedida({ pesoFinal, rendimento } = {}) {
  const p = check(pesoFinal), r = check(rendimento);
  if (!(p > 0) || !(r > 0)) return { nome: null, peso: null, tela: null, aviso: AVISO_GERAR_MEDIDA };
  const peso = fxn(p / r, 1);
  return { nome: NOME_PORCAO_GERADA, peso, tela: { mc1: NOME_PORCAO_GERADA, mcQnt1: String(peso) }, aviso: null };
}

/**
 * Gravação da receita (`salvarReceita`): valores POR 100 g = parseFloat((valor / peso × 100).toFixed(1)),
 * com peso = peso final (#peso). kcal, PTN, LIP e CHO saem dos campos já arredondados (kcal 0 casas, macros
 * 1 casa); os micronutrientes (e as fibras) saem das somas sem arredondar. A medida gravada é a única
 * linha "mc1" (nome + gramas da porção). Exige nome, rendimento, peso, macros, descrição e medida.
 *
 * @param {{nome:string, descricao:string, rendimento:number|string, peso:number|string,
 *          kcal:number|string, ptn:number|string, lip:number|string, cho:number|string,
 *          fibras?:number, micros?:number[], mc1:string, mcQnt1:number|string}} campos
 *   Campos do formulário: em geral `{...calcularReceita(r).tela, micros: totais.micros, fibras: totais.fibras}`
 *   + nome, descrição, rendimento e o peso final.
 * @returns {{valido:boolean, faltando:string[], registro:object|null}}
 */
export function salvarReceita(campos = {}) {
  const vazio = (v) => v === undefined || v === null || String(v).trim() === '';
  const faltando = [];
  if (vazio(campos.nome)) faltando.push('nome');
  if (!(check(campos.rendimento) > 0)) faltando.push('rendimento');
  if (!(check(campos.peso) > 0)) faltando.push('peso');
  if (['kcal', 'ptn', 'lip', 'cho'].some((k) => vazio(campos[k]))) faltando.push('macros');
  if (vazio(campos.descricao)) faltando.push('descricao');
  if (vazio(campos.mc1) || !(check(campos.mcQnt1) > 0)) faltando.push('medida');
  if (faltando.length) return { valido: false, faltando, registro: null };

  const peso = check(campos.peso);
  const por100 = (v) => fxn((check(v) / peso) * 100, 1);
  const micros = [];
  for (let i = 0; i < N_MICROS; i++) micros.push(por100(campos.micros?.[i]));
  return {
    valido: true,
    faltando,
    registro: {
      tipo: 'receita',
      origem: 'Receita',
      nome: String(campos.nome).trim(),
      descricao: String(campos.descricao),
      unidade: 'g',
      rendimento: check(campos.rendimento),
      peso,
      kcal: por100(campos.kcal),
      ptn: por100(campos.ptn),
      lip: por100(campos.lip),
      cho: por100(campos.cho),
      fibras: por100(campos.fibras),
      micros,
      mc: [{ nome_mc: String(campos.mc1), peso: check(campos.mcQnt1) }],
    },
  };
}

/**
 * Ficha da receita (`infoReceita`): valor por porção = valor por 100 g × (peso da porção / 100);
 * PTN, LIP e CHO com 1 casa, kcal com 0.
 * @param {{kcal:number, ptn:number, lip:number, cho:number, mc?:{peso:number|string}[]}} receita registro por 100 g
 * @param {number|string} [pesoPorcao] padrão: a medida gravada (mc[0])
 */
export function infoReceita(receita, pesoPorcao = receita?.mc?.[0]?.peso) {
  const p = check(pesoPorcao);
  const f = (v) => check(v) * (p / 100);
  const r = { peso: p, kcal: f(receita?.kcal), ptn: f(receita?.ptn), lip: f(receita?.lip), cho: f(receita?.cho) };
  return {
    ...r,
    tela: { kcal: fx(r.kcal, 0), ptn: fx(r.ptn, 1), lip: fx(r.lip, 1), cho: fx(r.cho, 1), texto: TEXTO_INFO_PORCAO },
  };
}
