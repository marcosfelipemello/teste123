// §10.5 Sono e cronotipo (MEQ, Horne-Östberg) — 19 itens de seleção, perfil + conduta de VET por refeição.
//
// Pontuação: igual ao WebDiet, que difere do MEQ original (§12 #21). Ver DIVERGENCIAS em index.js.
//
// Campos de `tela` ↔ elementos do WebDiet (evidência tela_q_cronotipo.json):
//   pontuacao ↔ #pontuacaoSelecionados ("Resultado: N pontos") · perfil ↔ #cronotipo ("Perfil: …")
//   mensagem = texto de questionário incompleto (§10.5). #condutaNutricionalTexto e #resultadoRast
//   ficaram vazios em todos os cenários da evidência; o formato de exibição da conduta não está no
//   relatório, por isso ela sai só como números (`conduta`), fora de `tela`.
import { MENSAGEM_INCOMPLETO, congelar, criarItem, faixaDe, lerRespostas, somar } from './comum.js';

// Pontos de cada opção, na ordem da tela (tabela "Estrutura" de §10.5). Faixa possível: 16 a 83.
const PONTOS = [
  [5, 4, 3, 2, 1, 0], // 1
  [5, 4, 3, 2, 1, 0], // 2
  // WebDiet §12 #21: item 3 (despertador) com a pontuação invertida em relação ao MEQ original.
  [1, 2, 3, 4], // 3
  [1, 2, 3, 4], // 4
  [1, 2, 3, 4], // 5
  [1, 2, 3, 4], // 6
  [1, 2, 3, 4], // 7
  [4, 3, 2, 1], // 8
  [4, 3, 2, 1], // 9
  [5, 4, 3, 2, 1], // 10
  [4, 3, 2, 1], // 11
  // WebDiet §12 #21: item 12 (cansaço às 23 h) com 1/2/3/4 no lugar de 0/2/3/5 do MEQ original.
  [1, 2, 3, 4], // 12
  [4, 3, 2, 1], // 13
  [1, 2, 3, 4], // 14
  [4, 3, 2, 1], // 15
  [4, 3, 2, 1], // 16
  [5, 4, 3, 2, 1], // 17
  [5, 4, 3, 2, 1], // 18
  [6, 4, 2, 0], // 19
];

const ITENS = PONTOS.map((p, i) => criarItem(i + 1, null, p));

/** Refeições da conduta, na ordem da tabela de §10.5. */
export const REFEICOES = Object.freeze(['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar']);

/** Definição do questionário (para a UI). Nenhuma opção vem marcada; o resultado exige todas as respostas. */
export const CRONOTIPO = congelar({
  id: 'cronotipo',
  nome: 'Sono e cronotipo (MEQ)',
  secao: '10.5',
  tipo: 'selecao',
  exigeTodas: true,
  minimo: 16,
  maximo: 83,
  categorias: [],
  itens: ITENS,
  padrao: ITENS.map(() => null),
  faixas: [
    { min: 16, max: 30, perfil: 'Vespertino extremo ou noturno' },
    { min: 31, max: 41, perfil: 'Moderadamente vespertino' },
    { min: 42, max: 58, perfil: 'Intermediário' },
    { min: 59, max: 69, perfil: 'Moderadamente matutino' },
    { min: 70, max: 86, perfil: 'Matutino extremo' },
  ],
  // Conduta: distribuição do VET (%) por refeição, na ordem de REFEICOES.
  conduta: [
    { max: 41, grupo: 'Vespertinos (total ≤ 41)', percentuais: [20, 5, 35, 10, 30] },
    { min: 42, grupo: 'Intermediário e matutinos (total > 41)', percentuais: [30, 10, 35, 5, 20] },
  ],
  calcular: calcularCronotipo,
});

/**
 * Perfil do total. Fora de todas as faixas (16–86) → null: o WebDiet não mostra perfil.
 * Com as pontuações do WebDiet o total vai de 16 a 83, então isso só acontece chamando esta função direto.
 * @param {number} total
 * @returns {string|null}
 */
export function classificarCronotipo(total) {
  return faixaDe(CRONOTIPO.faixas, total)?.perfil ?? null;
}

/**
 * Conduta de distribuição do VET por refeição: total ≤ 41 (vespertinos) ou > 41 (intermediário e matutinos).
 * @param {number} total
 * @returns {{grupo:string, refeicoes:{refeicao:string, percentual:number}[]}}
 */
export function condutaCronotipo(total) {
  const c = faixaDe(CRONOTIPO.conduta, total);
  return { grupo: c.grupo, refeicoes: REFEICOES.map((refeicao, i) => ({ refeicao, percentual: c.percentuais[i] })) };
}

/**
 * Calcula o cronotipo. Com qualquer item sem resposta não há resultado: só a mensagem do WebDiet.
 * @param {(number|string|null)[]} respostas  Pontos da opção escolhida em cada item; posição 0 = item 1.
 * @returns {{
 *   id:'cronotipo', total:number|null, perfil:string|null,
 *   conduta:{grupo:string, refeicoes:{refeicao:string, percentual:number}[]}|null,
 *   aviso:string|null, semResposta:number[],
 *   tela:{pontuacao:string|null, perfil:string|null, mensagem:string|null}
 * }}
 */
export function calcularCronotipo(respostas) {
  const { valores, semResposta } = lerRespostas(CRONOTIPO, respostas);
  if (semResposta.length > 0) {
    return {
      id: 'cronotipo',
      total: null,
      perfil: null,
      conduta: null,
      aviso: MENSAGEM_INCOMPLETO,
      semResposta,
      tela: { pontuacao: null, perfil: null, mensagem: MENSAGEM_INCOMPLETO },
    };
  }
  // O código do WebDiet também monta "N pontos de 43 possíveis", mas não o exibe (§10.5, §12 #21).
  const total = somar(valores);
  const perfil = classificarCronotipo(total);
  return {
    id: 'cronotipo',
    total,
    perfil,
    conduta: condutaCronotipo(total),
    aviso: perfil === null ? `Total ${total} fora das faixas do MEQ (16–86): o WebDiet não mostra perfil.` : null,
    semResposta,
    tela: {
      pontuacao: `Resultado: ${total} pontos`,
      perfil: perfil === null ? null : `Perfil: ${perfil}`,
      mensagem: null,
    },
  };
}
