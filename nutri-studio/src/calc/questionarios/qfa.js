// §10.7 Frequência alimentar (QFA) — 42 itens com porções por semana digitadas, 8 categorias.
// O resultado são dois gráficos: consumido × recomendado por categoria, e bebidas açucaradas × saudáveis.
//
// Campos de `tela` ↔ dados dos gráficos (Chart.js) do WebDiet (evidência tela_q_qfa.json):
//   consumido, recomendado, bebidas ([açucaradas, saudáveis], com 0 trocado por 1).
import { check } from '../numeros.js';
import { congelar, intervalo, normalizarLista, semResposta as vazio } from './comum.js';

// Categoria, primeiro item, último item, recomendado (porções por semana) — §10.7, na ordem da tela.
const CATEGORIAS = [
  ['Leites e derivados', 1, 4, 21],
  ['Carnes e ovos', 5, 9, 14],
  ['Óleos', 10, 15, 7],
  ['Cereais e leguminosas', 16, 23, 42],
  ['Frutas/verduras/legumes', 24, 27, 42],
  ['Petiscos/embutidos/enlatados', 28, 31, 7],
  ['Sobremesas e doces', 32, 35, 7],
  ['Bebidas', 36, 42, 7],
];

/** Itens do gráfico de bebidas: saudáveis 36–38, açucaradas 39–42. */
export const BEBIDAS = Object.freeze({ saudaveis: Object.freeze(intervalo(36, 38)), acucaradas: Object.freeze(intervalo(39, 42)) });

const ITENS = CATEGORIAS.flatMap(([nome, de, ate]) =>
  intervalo(de, ate).map((n) => {
    const it = { n, categoria: nome, texto: null, opcoes: null, unidade: 'porções/semana' };
    if (BEBIDAS.saudaveis.includes(n)) it.bebida = 'saudável';
    if (BEBIDAS.acucaradas.includes(n)) it.bebida = 'açucarada';
    return it;
  }),
);

/** Definição do questionário (para a UI). Campos numéricos, começam vazios. */
export const QFA = congelar({
  id: 'qfa',
  nome: 'Frequência alimentar (QFA)',
  secao: '10.7',
  tipo: 'numerico',
  exigeTodas: false,
  categorias: CATEGORIAS.map(([nome, de, ate, recomendado]) => ({ nome, itens: intervalo(de, ate), recomendado })),
  itens: ITENS,
  padrao: ITENS.map(() => null),
  calcular: calcularQfa,
});

/**
 * Calcula o QFA. Cada resposta é lida como o WebDiet lê números (`check`: vazio ou inválido = 0,
 * vírgula decimal aceita). Consumido = soma das porções da categoria.
 * @param {(number|string|null)[]} respostas  42 valores (porções por semana); posição 0 = item 1.
 * @returns {{
 *   id:'qfa', porcoes:number[],
 *   categorias:{nome:string, consumido:number, recomendado:number}[],
 *   bebidas:{acucaradas:number, saudaveis:number}, aviso:null, semResposta:number[],
 *   tela:{consumido:number[], recomendado:number[], bebidas:number[]}
 * }}
 */
export function calcularQfa(respostas) {
  const lista = normalizarLista(QFA, respostas);
  const porcoes = lista.map((v) => check(v));
  const soma = (itens) => itens.reduce((s, n) => s + porcoes[n - 1], 0);
  const categorias = QFA.categorias.map((c) => ({ nome: c.nome, consumido: soma(c.itens), recomendado: c.recomendado }));
  const bebidas = { acucaradas: soma(BEBIDAS.acucaradas), saudaveis: soma(BEBIDAS.saudaveis) };
  return {
    id: 'qfa',
    porcoes,
    categorias,
    bebidas,
    aviso: null,
    semResposta: QFA.itens.filter((_, i) => vazio(lista[i])).map((it) => it.n),
    tela: {
      consumido: categorias.map((c) => c.consumido),
      recomendado: categorias.map((c) => c.recomendado),
      // Ordem do gráfico: [açucaradas, saudáveis]. Soma 0 vira 1 só para desenhar a pizza.
      bebidas: [bebidas.acucaradas, bebidas.saudaveis].map((s) => (s === 0 ? 1 : s)),
    },
  };
}
