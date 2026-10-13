// §10.8 Fenótipo do comportamento alimentar — 16 itens, escala 1 a 5, 5 subescalas.
// A classificação usa a SOMA da subescala (o código do WebDiet chama de "média", mas não divide).
// Só Desorganizado e Hedônico foram conferidos na tela (§14); as outras 3 vêm da tabela de §10.8.
//
// Campos de `tela` ↔ elementos do WebDiet (evidência tela_q_fenotipo.json):
//   subescalas[i].linha ↔ i-ésima linha de #resultadoRastCategoria ("Subescala X Escala: BAIXO"),
//   seguida do texto de conduta (conteúdo autoral não copiado: vem de `opcoes.textos`).
//   .total-pontos e #resultadoRast ficam vazios (não há total).
import { congelar, criarItem, faixaDe, intervalo, lerRespostas } from './comum.js';

// Subescala, itens (numeração do cadastro), limite de BAIXO (≤), limite de MÉDIO (≤); acima = ALTO.
const SUBESCALAS = [
  ['Desorganizado', [9, 11, 16], 4, 6],
  ['Hedônico', [5, 8, 12, 14], 11, 14],
  ['Compulsivo', [13, 15], 3, 6],
  ['Emocional', [2, 4, 7, 10], 8, 12],
  ['Hiperfágico', [1, 3, 6], 5, 8],
];

/** Cor de cada classe (§10.8). */
export const CORES_FENOTIPO = Object.freeze({ BAIXO: '#2eca9a', MÉDIO: '#00985E', ALTO: '#006639' });

const SUBESCALA_DO_ITEM = Object.fromEntries(SUBESCALAS.flatMap(([nome, itens]) => itens.map((n) => [n, nome])));

const ITENS = intervalo(1, 16).map((n) => criarItem(n, SUBESCALA_DO_ITEM[n], [1, 2, 3, 4, 5], ['1', '2', '3', '4', '5']));

/** Definição do questionário (para a UI). Itens na ordem do cadastro; todo item começa marcado com 1. */
export const FENOTIPO = congelar({
  id: 'fenotipo',
  nome: 'Fenótipo do comportamento alimentar',
  secao: '10.8',
  tipo: 'escala',
  exigeTodas: false,
  categorias: SUBESCALAS.map(([nome, itens, baixoAte, medioAte]) => ({
    nome,
    itens,
    maximo: itens.length * 5,
    faixas: [
      { max: baixoAte, classe: 'BAIXO' },
      { min: baixoAte + 1, max: medioAte, classe: 'MÉDIO' },
      { min: medioAte + 1, classe: 'ALTO' },
    ],
  })),
  itens: ITENS,
  padrao: ITENS.map(() => 1),
  calcular: calcularFenotipo,
});

/**
 * Classe de uma subescala pela soma: BAIXO, MÉDIO ou ALTO.
 * @param {string} subescala  Nome da subescala (ex.: 'Hedônico').
 * @param {number} soma
 * @returns {'BAIXO'|'MÉDIO'|'ALTO'}
 */
export function classificarSubescala(subescala, soma) {
  const c = FENOTIPO.categorias.find((x) => x.nome === subescala);
  if (!c) throw new RangeError(`Fenótipo: subescala "${subescala}" não existe.`);
  // A primeira faixa não tem mínimo e a última não tem máximo: sempre há uma classe.
  return faixaDe(c.faixas, soma).classe;
}

/**
 * Calcula o fenótipo. Item sem resposta vale 1 (no WebDiet todo item começa marcado com 1).
 * @param {(number|string|null)[]} respostas  16 notas (1–5), na ordem do cadastro; posição 0 = item 1.
 * @param {{textos?:Object<string,{BAIXO?:string, MÉDIO?:string, ALTO?:string}>}} [opcoes]
 *   `textos[subescala][classe]` = texto de conduta (conteúdo autoral do WebDiet não copiado; sem ele, null).
 * @returns {{
 *   id:'fenotipo', notas:number[],
 *   subescalas:{nome:string, soma:number, maximo:number, classe:'BAIXO'|'MÉDIO'|'ALTO', cor:string, texto:string|null}[],
 *   aviso:null, semResposta:number[],
 *   tela:{subescalas:{linha:string, titulo:string, escala:string, texto:string|null, cor:string}[]}
 * }}
 */
export function calcularFenotipo(respostas, opcoes = {}) {
  const { valores, semResposta } = lerRespostas(FENOTIPO, respostas);
  const notas = valores.map((v, i) => v ?? FENOTIPO.padrao[i]);
  const textos = opcoes.textos || {};
  const subescalas = FENOTIPO.categorias.map((c) => {
    const soma = c.itens.reduce((s, n) => s + notas[n - 1], 0);
    const classe = classificarSubescala(c.nome, soma);
    return { nome: c.nome, soma, maximo: c.maximo, classe, cor: CORES_FENOTIPO[classe], texto: textos[c.nome]?.[classe] ?? null };
  });
  return {
    id: 'fenotipo',
    notas,
    subescalas,
    aviso: null,
    semResposta,
    tela: {
      subescalas: subescalas.map((s) => ({
        linha: `Subescala ${s.nome} Escala: ${s.classe}`,
        titulo: `Subescala ${s.nome}`,
        escala: `Escala: ${s.classe}`,
        texto: s.texto,
        cor: s.cor,
      })),
    },
  };
}
