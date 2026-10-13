// §10.1 Rastreamento metabólico — 66 sintomas, nota 0 a 4, 14 categorias.
//
// Campos de `tela` ↔ elementos do WebDiet (evidência tela_q_rastreamento.json e tela_q_fronteiras.json):
//   pontuacao ↔ .total-pontos · resultado ↔ #resultadoRast · categorias (juntas) ↔ #resultadoRastCategoria
import { congelar, criarItem, faixaDe, intervalo, lerRespostas } from './comum.js';

// Categoria, primeiro item, último item, máximo (tabelas "Máximo por categoria" e "Estrutura" de §10.1).
// Nomes como aparecem na tela (evidência: "Articulações / Músculos", com espaços).
const CATEGORIAS = [
  ['Cabeça', 1, 4, 16],
  ['Olhos', 5, 8, 16],
  ['Ouvidos', 9, 12, 16],
  ['Nariz', 13, 17, 20],
  ['Boca e Garganta', 18, 22, 20],
  ['Pele', 23, 27, 20],
  ['Coração', 28, 30, 12],
  ['Pulmões', 31, 34, 16],
  ['Trato digestivo', 35, 41, 28],
  ['Articulações / Músculos', 42, 46, 20],
  ['Energia / Atividade', 47, 50, 16],
  ['Mente', 51, 58, 32],
  ['Emoções', 59, 62, 16],
  ['Outros', 63, 66, 16],
];

// Cor da nota marcada: 0 verde · 1 amarelo · 2 laranja · 3 vermelho · 4 vermelho-escuro.
const CORES_NOTA = ['verde', 'amarelo', 'laranja', 'vermelho', 'vermelho-escuro'];

const ITENS = CATEGORIAS.flatMap(([nome, de, ate]) =>
  intervalo(de, ate).map((n) => {
    const it = criarItem(n, nome, [0, 1, 2, 3, 4], ['0', '1', '2', '3', '4']);
    it.opcoes.forEach((o) => (o.cor = CORES_NOTA[o.pontos]));
    return it;
  }),
);

/** Definição do questionário (para a UI). Todo item começa marcado com 0. */
export const RASTREAMENTO = congelar({
  id: 'rastreamento',
  nome: 'Rastreamento metabólico',
  secao: '10.1',
  tipo: 'escala',
  exigeTodas: false,
  maximo: 264,
  categorias: CATEGORIAS.map(([nome, de, ate, maximo]) => ({ nome, itens: intervalo(de, ate), maximo })),
  itens: ITENS,
  padrao: ITENS.map(() => 0),
  // Resultado do total (fronteiras conferidas na tela: 30/31, 40/41, 100/101).
  faixas: [
    { max: 30, texto: 'Saudável, baixa chance de ter hipersensibilidades', cor: 'verde' },
    { min: 31, max: 40, texto: 'Indicativo de existência de hipersensibilidades', cor: 'amarelo' },
    { min: 41, max: 100, texto: 'Absoluta certeza de existência de hipersensibilidades', cor: '#fa5423' },
    { min: 101, texto: 'Saúde muito ruim, com possível relação com doenças crônicas/degenerativas', cor: '#e61c24' },
  ],
  calcular: calcularRastreamento,
});

/**
 * Classifica o total do rastreamento (as faixas cobrem todos os totais possíveis, 0 a 264).
 * @param {number} total
 * @returns {{texto:string, cor:string}}
 */
export function classificarRastreamento(total) {
  const f = faixaDe(RASTREAMENTO.faixas, total);
  return { texto: f.texto, cor: f.cor };
}

/**
 * Calcula o rastreamento metabólico.
 * Item sem resposta conta como 0 (no WebDiet todo item começa marcado com 0).
 * @param {(number|string|null)[]} respostas  66 notas (0–4); posição 0 = item 1.
 * @returns {{
 *   id:'rastreamento', total:number, notas:number[],
 *   categorias:{nome:string, soma:number, maximo:number}[],
 *   classe:{texto:string, cor:string}, aviso:null, semResposta:number[],
 *   tela:{pontuacao:string, resultado:string, cor:string, categorias:string[]}
 * }}
 */
export function calcularRastreamento(respostas) {
  const { valores, semResposta } = lerRespostas(RASTREAMENTO, respostas);
  const notas = valores.map((v, i) => v ?? RASTREAMENTO.padrao[i]);
  const categorias = RASTREAMENTO.categorias.map((c) => ({
    nome: c.nome,
    soma: c.itens.reduce((s, n) => s + notas[n - 1], 0),
    maximo: c.maximo,
  }));
  const total = notas.reduce((s, v) => s + v, 0);
  const classe = classificarRastreamento(total);
  return {
    id: 'rastreamento',
    total,
    notas,
    categorias,
    classe,
    aviso: null,
    semResposta,
    tela: {
      pontuacao: `${total} pontos`,
      resultado: classe.texto,
      cor: classe.cor,
      // As 14 categorias sempre aparecem, no formato "Categoria soma/máximo".
      categorias: categorias.map((c) => `${c.nome} ${c.soma}/${c.maximo}`),
    },
  };
}
