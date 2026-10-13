// §10.3 Sarcopenia em idosos — 12 itens de seleção (SARC-F + 7 itens), máximo 26.
// O WebDiet mostra SÓ o total ("N pontos"): o trecho de classificação está comentado no código.
//
// Campos de `tela` ↔ elementos do WebDiet (evidência tela_q_sarcopenia.json):
//   pontuacao ↔ #pontuacaoSelecionados  (#resultadoRast, #cronotipo e #condutaNutricionalTexto ficam vazios)
import { congelar, criarItem, intervalo, lerRespostas, somar } from './comum.js';

// Pontos de cada opção, na ordem da tela (tabela "Estrutura" de §10.3). Os itens 10–12 não têm rótulo
// no relatório: usam o rótulo genérico; o critério de §10.3 vai em `criterio`.
const ITENS = [
  ...intervalo(1, 5).map((n) => criarItem(n, 'SARC-F', [0, 1, 2], ['0', '1', '2'])),
  criarItem(6, 'Sexo', [0, 1], ['Feminino', 'Masculino']),
  criarItem(7, 'Idade', [0, 1, 2], ['< 66', '66–75', '> 75']),
  criarItem(8, 'Medicamentos', [0, 1, 2], ['Nenhum', '1–3', '4 ou mais']),
  criarItem(9, 'IMC', [2, 0, 1], ['< 22', '22–27', '> 27']),
  criarItem(10, 'Preensão manual baixa', [5, 0], null, { criterio: 'homens < 27 kg; mulheres < 16 kg' }),
  criarItem(11, 'Circunferência do braço ≤ 32 cm', [1, 0], null, { criterio: '≤ 32 cm' }),
  criarItem(12, 'Panturrilha baixa', [3, 0], null, { criterio: 'homens ≤ 34; mulheres ≤ 33' }),
];

/** Definição do questionário (para a UI). Nenhuma opção vem marcada. */
export const SARCOPENIA = congelar({
  id: 'sarcopenia',
  nome: 'Sarcopenia em idosos',
  secao: '10.3',
  tipo: 'selecao',
  exigeTodas: false,
  maximo: 26,
  categorias: [
    { nome: 'SARC-F', itens: intervalo(1, 5) },
    ...ITENS.slice(5).map((it) => ({ nome: it.categoria, itens: [it.n] })),
  ],
  itens: ITENS,
  padrao: ITENS.map(() => null),
  calcular: calcularSarcopenia,
});

/**
 * Calcula a sarcopenia: só o total. Itens sem resposta não somam; o total aparece mesmo com itens em branco.
 * @param {(number|string|null)[]} respostas  Pontos da opção escolhida em cada item; posição 0 = item 1.
 * @returns {{
 *   id:'sarcopenia', total:number, pontos:(number|null)[], classe:null, aviso:null, semResposta:number[],
 *   tela:{pontuacao:string}
 * }}
 */
export function calcularSarcopenia(respostas) {
  const { valores, semResposta } = lerRespostas(SARCOPENIA, respostas);
  const total = somar(valores);
  return {
    id: 'sarcopenia',
    total,
    pontos: valores,
    // Sem classificação: no WebDiet ela está comentada no código e nunca aparece (não é um "vazio" inesperado).
    classe: null,
    aviso: null,
    semResposta,
    tela: { pontuacao: `${total} pontos` },
  };
}
