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
// - Textos das perguntas NÃO foram copiados (relatório §1.2). Cada item e cada opção tem o campo
//   `texto: null`, para ser preenchido depois (ver `comTextos`). O `rotulo` da opção é curto: a faixa ou
//   o sim/não quando o relatório os informa; senão um rótulo genérico ("Opção 1 (5 pts)").

/** Mensagem do WebDiet quando o questionário exige todas as respostas (§10.5 e §10.9). */
export const MENSAGEM_INCOMPLETO =
  'Há perguntas que ainda não foram preenchidas. Assim que terminar, você poderá ver o resultado aqui.';

/**
 * @typedef {Object} Opcao
 * @property {number|string} pontos  Pontuação da opção (é o valor guardado na resposta). Na disbiose,
 *   a opção "Não sei informar" usa o texto '-'.
 * @property {string} rotulo         Rótulo curto (faixa, sim/não, A/B/C, a nota ou "Opção k (N pts)").
 * @property {string|null} texto     Texto da opção, a preencher pelo usuário (não copiado do WebDiet).
 * @property {string} [cor]          Cor da nota marcada, quando o relatório a informa.
 * @property {boolean} [oculta]      Opção que não aparece na tela (ex.: "0" = sem resposta na cafeína).
 */

/**
 * @typedef {Object} Item
 * @property {number} n                  Número do item (1, 2, …), na ordem do relatório.
 * @property {string|null} categoria     Categoria, fator, subescala ou nome curto do item (null se o relatório não dá).
 * @property {string|null} texto         Texto da pergunta, a preencher pelo usuário (não copiado do WebDiet).
 * @property {Opcao[]|null} opcoes       Opções (null nos itens de digitação livre, como no QFA).
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
 * Rótulo genérico de opção, usado quando o relatório não informa o rótulo: "Opção 1 (5 pts)".
 * @param {number} k  Posição da opção na tela (1, 2, …).
 * @param {number|string} pontos
 * @returns {string}
 */
export function rotuloGenerico(k, pontos) {
  return `Opção ${k} (${pontos} ${pontos === 1 ? 'pt' : 'pts'})`;
}

/**
 * Monta um item com suas opções. `rotulos` (opcional) acompanha `pontos` posição a posição;
 * posição sem rótulo recebe o rótulo genérico ("Opção k (N pts)").
 * @param {number} n
 * @param {string|null} categoria
 * @param {(number|string)[]} pontos
 * @param {(string|null|undefined)[]} [rotulos]
 * @param {Object} [extra]  Campos adicionais do item (ex.: `resumido`, `criterio`).
 * @returns {Item}
 */
export function criarItem(n, categoria, pontos, rotulos, extra) {
  const opcoes = pontos.map((p, i) => ({
    pontos: p,
    rotulo: rotulos && rotulos[i] != null ? rotulos[i] : rotuloGenerico(i + 1, p),
    texto: null,
  }));
  return { n, categoria, texto: null, ...(extra || {}), opcoes };
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
 * Lê todas as respostas de um questionário de seleção.
 * @param {{nome:string, itens:Item[]}} def
 * @param {unknown[]|null|undefined} respostas
 * @returns {{valores:(number|string|null)[], semResposta:number[]}}
 *   `valores[i]` = pontos do item i+1 (null = sem resposta); `semResposta` = números dos itens em branco.
 */
export function lerRespostas(def, respostas) {
  const lista = normalizarLista(def, respostas);
  const valores = def.itens.map((item, i) => lerSelecao(item, lista[i]));
  return { valores, semResposta: itensSemResposta(def.itens, valores) };
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
 * Soma pontuações ignorando itens sem resposta (null) e opções não numéricas ('-').
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

/**
 * Devolve uma cópia (congelada) da definição com os textos das perguntas e das opções preenchidos.
 * Os textos do WebDiet não foram copiados (§1.2); use textos próprios. `calcular` não muda.
 * @template {{itens:Item[]}} D
 * @param {D} def
 * @param {{itens?:Object<number,string>, opcoes?:Object<number,(string|null)[]>}} textos
 *   `itens[n]` = texto da pergunta n; `opcoes[n][k]` = texto da opção k (0 = primeira) da pergunta n.
 * @returns {D}
 */
export function comTextos(def, textos = {}) {
  const ti = textos.itens || {};
  const to = textos.opcoes || {};
  return congelar({
    ...def,
    itens: def.itens.map((it) => ({
      ...it,
      texto: ti[it.n] ?? it.texto ?? null,
      opcoes: it.opcoes ? it.opcoes.map((o, k) => ({ ...o, texto: to[it.n]?.[k] ?? o.texto ?? null })) : it.opcoes,
    })),
  });
}
