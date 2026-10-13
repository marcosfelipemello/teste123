// §10.4 Dependência de cafeína (CaffEQ) — 47 afirmações, escala 1 a 6, 7 fatores.
// Dois modos: "resumido" (padrão; a página do WebDiet abre nele: 21 itens "R", 3 por fator) e
// "completo" (47 itens). A versão completa não foi rodada na tela (§14): a regra vem do código (§10.4).
//
// Campos de `tela` ↔ elementos do WebDiet (evidência tela_q_cafeina.json e tela_q_fronteiras.json):
//   fatores[i] ↔ i-ésima linha de #resultadoRastCategoria, "• {nome} Média: {média} {texto}".
//   Na evidência o texto da linha aparece sem espaços entre os elementos: "DependênciaMédia: 1.00".
//   .total-pontos e #resultadoRast ficam vazios (não há total).
import { fx } from '../numeros.js';
import { congelar, criarItem, intervalo, lerRespostas } from './comum.js';

// Fator, primeiro item, último item, itens "R" (resumida), efeito (tabela "Estrutura" de §10.4).
// Efeito "desejado" = fatores 2–5; "indesejado" = fatores 1, 6 e 7 (define a cor).
const FATORES = [
  ['Dependência', 1, 12, [2, 3, 8], 'indesejado'],
  ['Energia e disposição', 13, 20, [13, 17, 20], 'desejado'],
  ['Supressão do apetite', 21, 25, [22, 23, 25], 'desejado'],
  ['Melhoras no humor', 26, 31, [27, 30, 31], 'desejado'],
  ['Melhoria do desempenho físico', 32, 34, [32, 33, 34], 'desejado'],
  ['Ansiedade e efeitos negativos', 35, 43, [37, 38, 41], 'indesejado'],
  ['Distúrbios do sono', 44, 47, [44, 45, 46], 'indesejado'],
];

/** Modos aceitos em `opcoes.modo`. */
export const MODOS_CAFEINA = Object.freeze(['resumido', 'completo']);

/** Média a partir da qual o fator mostra o texto "alto" (§10.4: média ≥ 4). */
export const CORTE_ALTO_CAFEINA = 4;

const ITENS = FATORES.flatMap(([nome, de, ate, r]) =>
  intervalo(de, ate).map((n) => {
    // Opção 0 = "não respondido": marcação oculta com que todo item começa.
    const it = criarItem(n, nome, [0, 1, 2, 3, 4, 5, 6], ['Sem resposta', '1', '2', '3', '4', '5', '6'], {
      resumido: r.includes(n),
    });
    it.opcoes[0].oculta = true;
    return it;
  }),
);

/** Definição do questionário (para a UI). Todo item começa com a marcação oculta 0. */
export const CAFEINA = congelar({
  id: 'cafeina',
  nome: 'Dependência de cafeína (CaffEQ)',
  secao: '10.4',
  tipo: 'escala',
  exigeTodas: false,
  modos: MODOS_CAFEINA,
  modoPadrao: 'resumido',
  categorias: FATORES.map(([nome, de, ate, r, efeito]) => ({
    nome,
    itens: intervalo(de, ate),
    itensResumido: r,
    maximo: (ate - de + 1) * 6,
    efeito,
  })),
  itens: ITENS,
  padrao: ITENS.map(() => 0),
  calcular: calcularCafeina,
});

/**
 * Cor do fator: fatores 2–5 (efeitos desejados) ≥ 4 verde, < 4 cinza #a2a2a2;
 * fatores 1, 6 e 7 ≥ 4 vermelho #f44336, < 4 verde.
 * @param {'desejado'|'indesejado'} efeito
 * @param {boolean} alto
 * @returns {string}
 */
function corFator(efeito, alto) {
  if (efeito === 'desejado') return alto ? 'verde' : '#a2a2a2';
  return alto ? '#f44336' : 'verde';
}

/**
 * Calcula o CaffEQ.
 * - Média do fator = soma / nº de itens do fator (resumido: os 3 itens "R"; completo: todos).
 * - Item sem resposta (ou com a marcação oculta 0) conta 0 na soma e continua no divisor.
 * - Média ≥ 4 → texto "alto"; abaixo de 4 → texto "baixo".
 * - No modo resumido, as respostas dos itens não "R" são ignoradas (ficam ocultas na tela).
 * @param {(number|string|null)[]} respostas  47 notas (0–6); posição 0 = item 1.
 * @param {{modo?:'resumido'|'completo', textos?:Object<string,{alto?:string, baixo?:string}>}} [opcoes]
 *   `textos[nomeDoFator]` = textos "alto"/"baixo" do fator (conteúdo autoral do WebDiet não copiado;
 *   sem eles, `texto` sai null).
 * @returns {{
 *   id:'cafeina', modo:string,
 *   fatores:{nome:string, itens:number[], soma:number, divisor:number, media:number, nivel:'alto'|'baixo',
 *            cor:string, texto:string|null}[],
 *   aviso:null, semResposta:number[],
 *   tela:{fatores:{nome:string, media:string, texto:string|null, cor:string}[]}
 * }}
 */
export function calcularCafeina(respostas, opcoes = {}) {
  const modo = opcoes.modo ?? CAFEINA.modoPadrao;
  if (!MODOS_CAFEINA.includes(modo)) {
    throw new RangeError(`Cafeína: modo "${modo}" inválido (use ${MODOS_CAFEINA.join(' ou ')}).`);
  }
  const { valores } = lerRespostas(CAFEINA, respostas);
  const textos = opcoes.textos || {};
  const fatores = CAFEINA.categorias.map((c) => {
    const itens = modo === 'resumido' ? c.itensResumido : c.itens;
    const soma = itens.reduce((s, n) => s + (valores[n - 1] ?? 0), 0);
    const media = soma / itens.length;
    const nivel = media >= CORTE_ALTO_CAFEINA ? 'alto' : 'baixo';
    return {
      nome: c.nome,
      itens: [...itens],
      soma,
      divisor: itens.length,
      media,
      nivel,
      cor: corFator(c.efeito, nivel === 'alto'),
      texto: textos[c.nome]?.[nivel] ?? null,
    };
  });
  // Sem resposta = em branco ou com a marcação oculta 0. No modo resumido só contam os itens "R".
  const semResposta = CAFEINA.itens
    .filter((it, i) => (modo === 'completo' || it.resumido) && !valores[i])
    .map((it) => it.n);
  return {
    id: 'cafeina',
    modo,
    fatores,
    aviso: null,
    semResposta,
    tela: {
      // Todos os 7 fatores sempre aparecem. Média com 2 casas e ponto decimal (toFixed).
      fatores: fatores.map((f) => ({ nome: f.nome, media: `Média: ${fx(f.media, 2)}`, texto: f.texto, cor: f.cor })),
    },
  };
}
