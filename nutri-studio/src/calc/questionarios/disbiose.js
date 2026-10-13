// §10.6 Risco de disbiose — 17 itens de seleção; itens 2 e 3 aceitam "Não sei informar" ('-').
// As faixas e o "máximo exibido" mudam com a quantidade de "-".
//
// Soma máxima real = 50, mas a faixa (sem "-") vai até 49: com 50 pontos o WebDiet mostra
// "50 pontos de 49 possíveis" e o resultado VAZIO (§12 #22). Aqui: classe null + aviso, e o texto da
// pontuação igual ao do WebDiet. O mesmo acontece, pelas tabelas, com 47 pontos e um "-" e com 44 e dois.
//
// Campos de `tela` ↔ elementos do WebDiet (evidência tela_q_disbiose.json):
//   pontuacao ↔ #pontuacaoResultado · resultado ↔ #resultadoRast
import { congelar, criarItem, faixaDe, intervalo, lerRespostas, somar } from './comum.js';

/** Valor da opção "Não sei informar" (itens 2 e 3). */
export const NAO_SEI = '-';

// Pontos de cada opção, na ordem da tela (tabela "Estrutura" de §10.6).
const PONTOS = {
  1: [3, 0],
  2: [3, 0, NAO_SEI], // tipo de parto
  3: [3, 2, 0, NAO_SEI], // amamentação
  4: [3, 2, 1, 0],
  5: [3, 2, 1, 0],
  6: [3, 2, 1, 0],
  7: [3, 2, 1, 0],
  8: [3, 2, 1, 0],
  9: [3, 2, 1, 0],
  10: [2, 0], // fumante
  11: [3, 0],
  12: [3, 0],
  13: [0, 3],
  14: [3, 2, 1, 0],
  15: [3, 0],
  16: [3, 0],
  17: [3, 0],
};
const CATEGORIA = { 2: 'Tipo de parto', 3: 'Amamentação', 10: 'Fumante' };

const ITENS = intervalo(1, 17).map((n) =>
  criarItem(
    n,
    CATEGORIA[n] ?? null,
    PONTOS[n],
    PONTOS[n].map((p) => (p === NAO_SEI ? 'Não sei informar' : null)),
  ),
);

// Classes de risco: texto do resultado e cor (§10.6).
const CLASSES = [
  { classe: 'baixo risco', cor: 'verde' },
  { classe: 'médio risco', cor: '#ffcd16' },
  { classe: 'risco alto', cor: '#fa5423' },
  { classe: 'risco muito alto', cor: '#e61c24' },
];

// Faixas por quantidade de "-": [limite superior de baixo, médio, alto, muito alto]; o último é o
// "máximo exibido" ("de N possíveis").
const LIMITES = [
  [10, 23, 36, 49], // nenhum "-"
  [10, 22, 34, 46], // um "-"
  [10, 21, 32, 43], // dois "-"
];

/**
 * Faixas (com min/max inclusivos) para uma quantidade de "-".
 * @param {0|1|2} tracos
 * @returns {{min:number, max:number, classe:string, cor:string}[]}
 */
function faixasPara(tracos) {
  const lim = LIMITES[tracos];
  return CLASSES.map((c, i) => ({ min: i === 0 ? 0 : lim[i - 1] + 1, max: lim[i], ...c }));
}

/** Definição do questionário (para a UI). Nenhuma opção vem marcada. */
export const DISBIOSE = congelar({
  id: 'disbiose',
  nome: 'Risco de disbiose',
  secao: '10.6',
  tipo: 'selecao',
  exigeTodas: false,
  somaMaxima: 50,
  categorias: [],
  itens: ITENS,
  padrao: ITENS.map(() => null),
  // faixas[k] = faixas com k respostas "-"; maximoExibido[k] = N de "de N possíveis".
  faixas: [0, 1, 2].map(faixasPara),
  maximoExibido: LIMITES.map((l) => l[3]),
  calcular: calcularDisbiose,
});

/**
 * Classifica o total da disbiose para a quantidade de "-". Acima da última faixa → null (§12 #22).
 * @param {number} total
 * @param {number} [tracos=0]  Quantidade de respostas "-" (0, 1 ou 2).
 * @returns {{classe:string, texto:string, cor:string}|null}
 */
export function classificarDisbiose(total, tracos = 0) {
  const faixas = DISBIOSE.faixas[tracos];
  if (!faixas) throw new RangeError(`Disbiose: ${tracos} respostas "-" (o máximo é 2).`);
  const f = faixaDe(faixas, total);
  if (!f) return null;
  return { classe: f.classe, texto: `O paciente encontra-se com ${f.classe} de disbiose`, cor: f.cor };
}

/**
 * Calcula o risco de disbiose.
 * - Os "-" não somam; a quantidade deles escolhe a tabela de faixas e o "máximo exibido". (O WebDiet conta
 *   os caracteres "-" na lista de respostas convertida em texto; como só a opção "Não sei informar" tem
 *   "-", é o mesmo que contar as respostas "-".)
 * - Item sem resposta não soma (o relatório não diz o que o WebDiet faz; decisão do nutri-studio, igual ao
 *   FINDRISC e à sarcopenia). Os itens em branco vão em `semResposta`.
 * @param {(number|string|null)[]} respostas  Pontos da opção (ou '-') em cada item; posição 0 = item 1.
 * @returns {{
 *   id:'disbiose', total:number, naoSei:number, maximoExibido:number, pontos:(number|string|null)[],
 *   classe:{classe:string, texto:string, cor:string}|null, aviso:string|null, semResposta:number[],
 *   tela:{pontuacao:string, resultado:string|null, cor:string|null}
 * }}
 */
export function calcularDisbiose(respostas) {
  const { valores, semResposta } = lerRespostas(DISBIOSE, respostas);
  const naoSei = valores.filter((v) => v === NAO_SEI).length;
  const total = somar(valores);
  const maximoExibido = DISBIOSE.maximoExibido[naoSei];
  const classe = classificarDisbiose(total, naoSei);
  return {
    id: 'disbiose',
    total,
    naoSei,
    maximoExibido,
    pontos: valores,
    classe,
    aviso:
      classe === null
        ? `Total ${total} acima da última faixa (até ${maximoExibido}): o WebDiet mostra "${total} pontos de ` +
          `${maximoExibido} possíveis" e deixa o resultado vazio (§12 #22).`
        : null,
    semResposta,
    tela: {
      pontuacao: `${total} pontos de ${maximoExibido} possíveis`,
      resultado: classe ? classe.texto : null,
      cor: classe ? classe.cor : null,
    },
  };
}
