// §10.9 Doshas Ayurveda — 24 perguntas com opções A/B/C (valores 0/1/2).
// A maior contagem define o dosha: VATA (A), PITTA (B), KAPHA (C). Exige todas as respostas.
// Empate não gera resultado no WebDiet (§12 #23): aqui, resultado null + aviso.
//
// Campos de `tela` ↔ elementos do WebDiet (evidência tela_q_doshas.json):
//   resultado ↔ #condutaNutricionalTexto · mensagem = texto de questionário incompleto.
//   Atenção: na evidência, mesmo com as 24 respostas, #cronotipo continuou mostrando a mensagem de
//   incompleto ao lado do resultado. Isso não é reproduzido (ver DIVERGENCIAS em index.js).
import { MENSAGEM_INCOMPLETO, congelar, criarItem, intervalo, lerRespostas } from './comum.js';

/** Letra da resposta (pelo valor 0/1/2) e dosha correspondente. */
export const LETRAS = Object.freeze(['A', 'B', 'C']);
export const DOSHAS_POR_LETRA = Object.freeze({ A: 'VATA', B: 'PITTA', C: 'KAPHA' });

const ITENS = intervalo(1, 24).map((n) => criarItem(n, null, [0, 1, 2], LETRAS));

/** Definição do questionário (para a UI). Nenhuma opção vem marcada; o resultado exige todas as respostas. */
export const DOSHAS = congelar({
  id: 'doshas',
  nome: 'Doshas Ayurveda',
  secao: '10.9',
  tipo: 'selecao',
  exigeTodas: true,
  categorias: LETRAS.map((letra) => ({ nome: DOSHAS_POR_LETRA[letra], letra })),
  itens: ITENS,
  padrao: ITENS.map(() => null),
  calcular: calcularDoshas,
});

/**
 * Calcula o dosha predominante.
 * - Com pergunta em branco: sem resultado, mensagem do WebDiet.
 * - Empate: o dosha só sai quando uma letra tem contagem MAIOR que as outras duas; se a maior contagem
 *   é dividida por duas ou três letras, não há resultado (§12 #23).
 * @param {(number|string|null)[]} respostas  24 valores (0 = A, 1 = B, 2 = C); posição 0 = item 1.
 * @returns {{
 *   id:'doshas', contagem:{A:number, B:number, C:number}|null, letra:string|null, dosha:string|null,
 *   aviso:string|null, semResposta:number[], tela:{resultado:string|null, mensagem:string|null}
 * }}
 */
export function calcularDoshas(respostas) {
  const { valores, semResposta } = lerRespostas(DOSHAS, respostas);
  if (semResposta.length > 0) {
    return {
      id: 'doshas',
      contagem: null,
      letra: null,
      dosha: null,
      aviso: MENSAGEM_INCOMPLETO,
      semResposta,
      tela: { resultado: null, mensagem: MENSAGEM_INCOMPLETO },
    };
  }
  const contagem = { A: 0, B: 0, C: 0 };
  for (const v of valores) contagem[LETRAS[v]] += 1;
  const maior = Math.max(contagem.A, contagem.B, contagem.C);
  const vencedoras = LETRAS.filter((l) => contagem[l] === maior);
  if (vencedoras.length > 1) {
    return {
      id: 'doshas',
      contagem,
      letra: null,
      dosha: null,
      aviso: `Empate entre ${vencedoras.join(', ')} (${maior} respostas cada): o WebDiet não mostra resultado (§12 #23).`,
      semResposta,
      tela: { resultado: null, mensagem: null },
    };
  }
  const letra = vencedoras[0];
  const dosha = DOSHAS_POR_LETRA[letra];
  return {
    id: 'doshas',
    contagem,
    letra,
    dosha,
    aviso: null,
    semResposta,
    tela: { resultado: `Predomínio de respostas ${letra} corresponde ao Dosha ${dosha}`, mensagem: null },
  };
}
