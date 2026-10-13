// §10.2 FINDRISC (risco de diabetes mellitus) — 8 itens de seleção, máximo 26.
//
// Campos de `tela` ↔ elementos do WebDiet (evidência tela_q_diabetes.json):
//   pontuacao ↔ #pontuacaoResultado · resultado ↔ #resultadoRast
import { congelar, criarItem, faixaDe, lerRespostas, somar } from './comum.js';

const SIM_NAO = ['Sim', 'Não'];

// Pontos de cada opção, na ordem da tela (tabela "Estrutura" de §10.2). Rótulos = faixas da 1ª tabela.
// No relatório, "H" = homens e "M" = mulheres; aqui os rótulos escrevem por extenso para não confundir
// com o "M" = masculino das evidências.
const ITENS = [
  criarItem(1, 'Idade', [0, 2, 3, 4], ['< 45', '45–54', '55–64', '> 64']),
  criarItem(2, 'IMC', [0, 1, 3], ['< 25', '25–30', '> 30']),
  // 6 opções: 3 para homens e 3 para mulheres (mesmos pontos).
  criarItem(3, 'Cintura', [0, 3, 4, 0, 3, 4], [
    'Homens: < 94', 'Homens: 94–102', 'Homens: > 102',
    'Mulheres: < 80', 'Mulheres: 80–88', 'Mulheres: > 88',
  ]),
  criarItem(4, 'Atividade física 30 min/dia', [0, 2], SIM_NAO),
  criarItem(5, 'Frutas, legumes e verduras diários', [0, 1], SIM_NAO),
  // Itens 6 e 7: a primeira opção é "sim" (por isso "todas as primeiras opções" dá 7 pontos).
  criarItem(6, 'Anti-hipertensivo', [2, 0], SIM_NAO),
  criarItem(7, 'Glicemia alta já registrada', [5, 0], SIM_NAO),
  criarItem(8, 'Família com diabetes', [0, 3, 5], ['Não', '2º grau', '1º grau']),
];

/** Definição do questionário (para a UI). Nenhuma opção vem marcada. */
export const FINDRISC = congelar({
  id: 'findrisc',
  nome: 'FINDRISC (diabetes mellitus)',
  secao: '10.2',
  tipo: 'selecao',
  exigeTodas: false,
  maximo: 26,
  categorias: ITENS.map((it) => ({ nome: it.categoria, itens: [it.n] })),
  itens: ITENS,
  padrao: ITENS.map(() => null),
  // < 7 BAIXO · 7–11 DISCRETAMENTE AUMENTADO · 12–14 MODERADO · 15–20 ALTO · > 20 MUITO ALTO.
  faixas: [
    { max: 6, classe: 'BAIXO', cor: 'verde' },
    { min: 7, max: 11, classe: 'DISCRETAMENTE AUMENTADO', cor: '#f8ce4f' },
    { min: 12, max: 14, classe: 'MODERADO', cor: '#FFA500' },
    { min: 15, max: 20, classe: 'ALTO', cor: '#E53935' },
    { min: 21, classe: 'MUITO ALTO', cor: '#8B0000' },
  ],
  calcular: calcularFindrisc,
});

/**
 * Classifica o total do FINDRISC. O texto exibido é "RISCO " + classe.
 * @param {number} total
 * @returns {{classe:string, texto:string, cor:string}}
 */
export function classificarFindrisc(total) {
  const f = faixaDe(FINDRISC.faixas, total);
  return { classe: f.classe, texto: `RISCO ${f.classe}`, cor: f.cor };
}

/**
 * Calcula o FINDRISC. Item sem resposta não soma (§10.2).
 * @param {(number|string|null)[]} respostas  Pontos da opção escolhida em cada item; posição 0 = item 1.
 * @returns {{
 *   id:'findrisc', total:number, pontos:(number|null)[], classe:{classe:string, texto:string, cor:string},
 *   aviso:null, semResposta:number[], tela:{pontuacao:string, resultado:string, cor:string}
 * }}
 */
export function calcularFindrisc(respostas) {
  const { valores, semResposta } = lerRespostas(FINDRISC, respostas);
  const total = somar(valores);
  const classe = classificarFindrisc(total);
  return {
    id: 'findrisc',
    total,
    pontos: valores,
    classe,
    aviso: null,
    semResposta,
    tela: {
      pontuacao: `${total} pontos de ${FINDRISC.maximo} possíveis`,
      resultado: classe.texto,
      cor: classe.cor,
    },
  };
}
