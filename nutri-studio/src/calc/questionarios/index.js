// Questionários de saúde (relatório §10): registro único para a UI.
//
// QUESTIONARIOS[id] = { id, nome, secao, tipo, exigeTodas, itens, categorias, padrao, modos?, calcular, … }
//   tipo: 'escala' (nota em escala, com opção já marcada) · 'selecao' (lista de seleção) ·
//         'numerico' (valor digitado, QFA) · 'sinais' (motor de contagem; base fornecida por quem chama).
//   itens: [{ n, categoria, texto (null, a preencher), opcoes: [{ pontos, rotulo, texto, cor?, oculta? }] }]
//   padrao: resposta inicial de cada item (posição 0 = item 1); null = sem resposta.
//   calcular(respostas, opcoes): números + `aviso` (null ou texto) + `semResposta` + `tela` (textos exibidos).
//
// As respostas são os PONTOS da opção escolhida (não o índice), em array: posição 0 = item 1.
// Divergências do WebDiet e a política adotada: DIVERGENCIAS (abaixo).
import { congelar, MENSAGEM_INCOMPLETO } from './comum.js';
import { RASTREAMENTO } from './rastreamento.js';
import { FINDRISC } from './findrisc.js';
import { SARCOPENIA } from './sarcopenia.js';
import { CAFEINA } from './cafeina.js';
import { CRONOTIPO } from './cronotipo.js';
import { DISBIOSE } from './disbiose.js';
import { QFA } from './qfa.js';
import { FENOTIPO } from './fenotipo.js';
import { DOSHAS } from './doshas.js';
import { SINAIS } from './sinais.js';

export * from './rastreamento.js';
export * from './findrisc.js';
export * from './sarcopenia.js';
export * from './cafeina.js';
export * from './cronotipo.js';
export * from './disbiose.js';
export * from './qfa.js';
export * from './fenotipo.js';
export * from './doshas.js';
export * from './sinais.js';
export { MENSAGEM_INCOMPLETO, comTextos } from './comum.js';

/** Registro dos 10 questionários, na ordem de §10. */
export const QUESTIONARIOS = congelar({
  rastreamento: RASTREAMENTO,
  findrisc: FINDRISC,
  sarcopenia: SARCOPENIA,
  cafeina: CAFEINA,
  cronotipo: CRONOTIPO,
  disbiose: DISBIOSE,
  qfa: QFA,
  fenotipo: FENOTIPO,
  doshas: DOSHAS,
  sinais: SINAIS,
});

/**
 * Calcula um questionário pelo id.
 * @param {string} id  Chave de QUESTIONARIOS.
 * @param {unknown[]} respostas
 * @param {Object} [opcoes]
 * @returns {Object}
 */
export function calcularQuestionario(id, respostas, opcoes) {
  const q = Object.prototype.hasOwnProperty.call(QUESTIONARIOS, id) ? QUESTIONARIOS[id] : null;
  if (!q) throw new RangeError(`Questionário "${id}" não existe (use: ${Object.keys(QUESTIONARIOS).join(', ')}).`);
  return q.calcular(respostas, opcoes);
}

/**
 * Divergências e lacunas do WebDiet nos questionários (§12 #21–23 e casos em que a tela fica vazia),
 * com o comportamento adotado aqui. `item` = número em §12 (null quando não está na tabela de §12).
 */
export const DIVERGENCIAS = congelar([
  {
    item: 21,
    questionario: 'cronotipo',
    descricao:
      'MEQ: item 3 (despertador) com pontuação invertida; item 12 (cansaço às 23 h) com 1/2/3/4 no lugar de ' +
      '0/2/3/5 do original; o código monta "N pontos de 43 possíveis" (com estes pontos o total vai de 16 a 83).',
    comportamento:
      'Mantido igual ao WebDiet (marcado "// WebDiet §12 #21" em cronotipo.js): mesmos pontos, mesmas faixas. ' +
      'O texto "de 43 possíveis" não é exibido, como no WebDiet.',
  },
  {
    item: 22,
    questionario: 'disbiose',
    descricao:
      'Soma máxima real = 50, mas a faixa vai até 49: a tela mostra "50 pontos de 49 possíveis" e o resultado vazio. ' +
      'Pelas tabelas de §10.6, o mesmo acontece com 47 pontos e um "-" (máximo 46) e com 44 e dois "-" (máximo 43); ' +
      'esses dois casos não foram vistos na tela.',
    comportamento:
      'Pontuação igual ao WebDiet ("50 pontos de 49 possíveis"); classe, tela.resultado e tela.cor = null, com `aviso`.',
  },
  {
    item: 23,
    questionario: 'doshas',
    descricao: 'Empate na maior contagem de respostas A/B/C não gera resultado.',
    comportamento: 'dosha, letra e tela.resultado = null, com `aviso` (letras empatadas). A contagem é devolvida.',
  },
  {
    item: null,
    questionario: 'cronotipo',
    descricao: 'Total fora de todas as faixas de perfil (16–86): o WebDiet não mostra perfil.',
    comportamento:
      'perfil e tela.perfil = null, com `aviso`. Com os pontos do WebDiet o total vai de 16 a 83, então isso só ' +
      'acontece chamando classificarCronotipo direto.',
  },
  {
    item: null,
    questionario: 'cronotipo, doshas',
    descricao: `Questionário com pergunta em branco: não há resultado; a tela mostra "${MENSAGEM_INCOMPLETO}"`,
    comportamento: 'Total/perfil/conduta (cronotipo) e contagem/dosha (doshas) = null; `aviso` e tela.mensagem = a mensagem do WebDiet.',
  },
  {
    item: null,
    questionario: 'doshas',
    descricao:
      'Na evidência (tela_q_doshas.json), mesmo com as 24 respostas preenchidas, #cronotipo continua mostrando a ' +
      'mensagem de incompleto ao lado do resultado (provável texto antigo que o código não limpa; o relatório não comenta).',
    comportamento: 'Não reproduzido: com todas as respostas, tela.mensagem = null e só o resultado aparece.',
  },
  {
    item: null,
    questionario: 'fenotipo',
    descricao: 'O código chama de "média" a pontuação da subescala, mas não divide: a classificação usa a soma.',
    comportamento: 'Mantido igual ao WebDiet: classificação pela soma (campo `soma`).',
  },
]);
