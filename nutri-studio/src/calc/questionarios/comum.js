// Utilitários comuns aos questionários de saúde (relatório §10).
//
// Convenções deste módulo:
// - As respostas chegam como array indexado pelo item: posição 0 = item 1 (ordem usada pelo relatório).
// - Nos questionários de seleção, o valor de cada resposta é a PONTUAÇÃO da opção (não o índice da opção),
//   como nas evidências `tela_q_*.json`. Aceita número ou texto numérico ("3").
// - `null`, `undefined` ou texto vazio = item sem resposta. O que acontece com item sem resposta
//   depende do questionário (padrão marcado, não soma, ou bloqueia o resultado).
// - Valor que não é a pontuação de nenhuma opção do item gera RangeError (erro de programação da UI;
//   o WebDiet usa listas de seleção, que não permitem outro valor).
// - Cores: hexadecimal quando o relatório dá o código; senão o nome em português usado no relatório
//   ("verde", "amarelo"…), para a UI mapear.

/** Mensagem do WebDiet quando o questionário exige todas as respostas (§10.5 e §10.9). */
export const MENSAGEM_INCOMPLETO =
  'Há perguntas que ainda não foram preenchidas. Assim que terminar, você poderá ver o resultado aqui.';

/**
 * @typedef {Object} Opcao
 * @property {number|string} pontos  Pontuação da opção (é o valor guardado na resposta). Na disbiose,
 *   a opção "Não sei informar" usa o texto '-'.
 * @property {string} [rotulo]       Rótulo curto, só quando o relatório o informa (faixa, sim/não, A/B/C).
 * @property {string} [cor]          Cor da nota marcada, quando o relatório a informa.
 * @property {boolean} [oculta]      Opção que não aparece na tela (ex.: "0" = sem resposta na cafeína).
 */

/**
 * @typedef {Object} Item
 * @property {number} n                  Número do item (1, 2, …), na ordem do relatório.
 * @property {string|null} categoria     Categoria, fator, subescala ou nome curto do item (null se o relatório não dá).
 * @property {Opcao[]} [opcoes]          Opções (ausente nos itens de digitação livre, como no QFA).
 */

/**
 * Congela um objeto em profundidade (as definições são compartilhadas com a UI e não devem mudar).
 * @template T
 * @param {T} obj
 * @returns {T}
 */
export function congelar(obj) {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const v of Object.values(obj)) congelar(v);
  }
  return obj;
}

/**
 * Lista de inteiros de `de` até `ate`, inclusive.
 * @param {number} de
 * @param {number} ate
 * @returns {number[]}
 */
export function intervalo(de, ate) {
  const r = [];
  for (let i = de; i <= ate; i++) r.push(i);
  return r;
}

/**
 * Monta um item com suas opções. `rotulos` (opcional) acompanha `pontos` posição a posição;
 * posição sem rótulo fica sem a chave `rotulo`.
 * @param {number} n
 * @param {string|null} categoria
 * @param {(number|string)[]} pontos
 * @param {(string|null|undefined)[]} [rotulos]
 * @param {Object} [extra]  Campos adicionais do item (ex.: `fator`, `resumido`).
 * @returns {Item}
 */
export function criarItem(n, categoria, pontos, rotulos, extra) {
  const opcoes = pontos.map((p, i) => {
    const o = { pontos: p };
    if (rotulos && rotulos[i] != null) o.rotulo = rotulos[i];
    return o;
  });
  return { n, categoria, ...(extra || {}), opcoes };
}

/**
 * Verdadeiro quando a resposta está em branco.
 * @param {unknown} v
 * @returns {boolean}
 */
export function semResposta(v) {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

/**
 * Confere o formato da lista de respostas e devolve uma cópia com exatamente um valor por item.
 * @param {{nome:string, itens:Item[]}} def
 * @param {unknown[]|null|undefined} respostas  Array: posição 0 = item 1. Posições faltando = sem resposta.
 * @returns {unknown[]}
 */
export function normalizarLista(def, respostas) {
  if (respostas === null || respostas === undefined) return def.itens.map(() => undefined);
  if (!Array.isArray(respostas)) {
    throw new TypeError(`${def.nome}: as respostas devem ser um array (posição 0 = item 1).`);
  }
  if (respostas.length > def.itens.length) {
    throw new RangeError(`${def.nome}: ${respostas.length} respostas para ${def.itens.length} itens.`);
  }
  return def.itens.map((_, i) => respostas[i]);
}

/**
 * Lê a resposta de um item de seleção e devolve a pontuação da opção escolhida.
 * @param {Item} item
 * @param {unknown} valor  Pontuação da opção (número ou texto); '-' na disbiose.
 * @returns {number|string|null}  null = sem resposta.
 * @throws {RangeError} se o valor não corresponde a nenhuma opção do item.
 */
export function lerSelecao(item, valor) {
  if (semResposta(valor)) return null;
  let chave;
  if (typeof valor === 'number') {
    chave = valor;
  } else if (typeof valor === 'string') {
    const t = valor.trim();
    chave = /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : t;
  } else {
    throw new TypeError(`Item ${item.n}: resposta de tipo inválido (${typeof valor}).`);
  }
  const opcao = item.opcoes.find((o) => o.pontos === chave);
  if (!opcao) {
    const validos = item.opcoes.map((o) => o.pontos).join(', ');
    throw new RangeError(`Item ${item.n}: a resposta ${JSON.stringify(valor)} não é uma opção (pontos: ${validos}).`);
  }
  return opcao.pontos;
}

/**
 * Procura a faixa que contém o total. Limites inclusivos; `min` ou `max` ausente = sem limite.
 * Os totais dos questionários são inteiros, então "< 7" é escrito como `max: 6`.
 * @template {{min?:number, max?:number}} F
 * @param {F[]} faixas
 * @param {number} total
 * @returns {F|null}  null quando nenhuma faixa contém o total.
 */
export function faixaDe(faixas, total) {
  return (
    faixas.find(
      (f) => (f.min === undefined || total >= f.min) && (f.max === undefined || total <= f.max),
    ) ?? null
  );
}

/**
 * Soma pontuações ignorando itens sem resposta (null).
 * @param {(number|string|null)[]} valores
 * @returns {number}
 */
export function somar(valores) {
  let s = 0;
  for (const v of valores) if (typeof v === 'number') s += v;
  return s;
}

/**
 * Números dos itens sem resposta.
 * @param {Item[]} itens
 * @param {(number|string|null)[]} valores
 * @returns {number[]}
 */
export function itensSemResposta(itens, valores) {
  return itens.filter((_, i) => valores[i] === null).map((it) => it.n);
}
