// §10.10 Análise de sinais e sintomas — 289 sinais em 16 categorias; cada sinal aponta nutrientes em
// deficiência e em excesso. A base sinal → nutrientes é conteúdo autoral do WebDiet e NÃO foi copiada
// (§1.2): este módulo é só o motor de contagem e cor. Quem chama informa, para cada sinal marcado, as
// listas de IDs de nutrientes (deficiência e excesso) e o mapa ID → nome do nutriente.
//
// Campos de `tela` ↔ elementos do WebDiet (evidência tela_q_sinais.json):
//   deficiencia/excesso = um marcador por nutriente (nome + cor); deficienciaTexto/excessoTexto = texto
//   da lista como a evidência o registrou (cada nome seguido de espaço) ou a frase de lista vazia.
import { congelar, faixaDe, semResposta as vazio } from './comum.js';

/** Categorias de sinais, na ordem de §10.10. */
const CATEGORIAS = [
  'Cabelos/Pelos',
  'Olhos',
  'Pele',
  'Unhas',
  'Cavidade oral',
  'Sistema Cardiovascular',
  'Sistema Respiratório',
  'Sistema Gastrointestinal',
  'Sistema Renal',
  'Sistema Nervoso',
  'Sistema Neuromotor',
  'Sistema Endócrino',
  'Articulações',
  'Extremidades',
  'Anemias',
  'Outros',
];

/** Frases de lista vazia (§10.10). */
export const NENHUMA_DEFICIENCIA = 'Nenhuma deficiência associada aos sinais';
export const NENHUM_EXCESSO = 'Nenhum excesso associado aos sinais';

/** Definição (para a UI). Sem itens: a base de sinais não está disponível e deve ser fornecida. */
export const SINAIS = congelar({
  id: 'sinais',
  nome: 'Análise de sinais e sintomas',
  secao: '10.10',
  tipo: 'sinais',
  exigeTodas: false,
  totalSinais: 289,
  categorias: CATEGORIAS.map((nome) => ({ nome })),
  itens: [],
  padrao: [],
  // Cor pela quantidade de sinais que apontam o nutriente (≥ 4 lida só no código, §14).
  cores: [
    { min: 1, max: 1, cor: 'amarelo' },
    { min: 2, max: 2, cor: '#ffa425' },
    { min: 3, max: 3, cor: '#fa5423' },
    { min: 4, cor: '#e61c24' },
  ],
  calcular: calcularSinais,
});

/**
 * Cor de um nutriente pela contagem: 1 amarelo · 2 #ffa425 · 3 #fa5423 · ≥ 4 #e61c24.
 * @param {number} contagem  ≥ 1
 * @returns {string}
 */
export function corSinais(contagem) {
  const f = faixaDe(SINAIS.cores, contagem);
  if (!f) throw new RangeError(`Sinais: contagem ${contagem} inválida (mínimo 1).`);
  return f.cor;
}

/**
 * Nome do nutriente no mapa (objeto ID → nome ou Map).
 * @param {Object<string,string>|Map<string|number,string>} nutrientes
 * @param {string} id
 * @returns {string}
 */
function nomeNutriente(nutrientes, id) {
  const nome =
    nutrientes instanceof Map
      ? nutrientes.get(id) ?? nutrientes.get(Number(id))
      : Object.prototype.hasOwnProperty.call(nutrientes, id)
        ? nutrientes[id]
        : undefined;
  if (nome === undefined || nome === null) throw new RangeError(`Sinais: nutriente de ID ${id} não está no mapa de nomes.`);
  return nome;
}

/**
 * Conta, por ID, quantas vezes cada nutriente aparece nas listas dos sinais marcados.
 * A ordem de saída é a das chaves de um objeto JS (IDs numéricos em ordem crescente), como no WebDiet.
 * @param {((number|string)[]|undefined)[]} listas
 * @param {Object<string,string>|Map<string|number,string>} nutrientes
 * @returns {{id:string, nome:string, contagem:number, cor:string}[]}
 */
function contar(listas, nutrientes) {
  const cont = Object.create(null);
  for (const lista of listas) {
    if (lista === undefined || lista === null) continue;
    if (!Array.isArray(lista)) throw new TypeError('Sinais: cada lista de nutrientes deve ser um array de IDs.');
    for (const id of lista) {
      if (vazio(id)) continue;
      const k = String(id).trim();
      cont[k] = (cont[k] ?? 0) + 1;
    }
  }
  return Object.keys(cont).map((id) => ({
    id,
    nome: nomeNutriente(nutrientes, id),
    contagem: cont[id],
    cor: corSinais(cont[id]),
  }));
}

/**
 * Calcula a análise de sinais e sintomas.
 * Cada sinal marcado acrescenta sua lista de IDs às listas de deficiência e de excesso; a contagem é por
 * ID e separada para deficiência e excesso (um ID repetido conta de novo).
 * @param {{deficiencia?:(number|string)[], excesso?:(number|string)[]}[]} marcados  Sinais marcados.
 * @param {{nutrientes:Object<string,string>|Map<string|number,string>}} opcoes  Mapa ID → nome do nutriente.
 * @returns {{
 *   id:'sinais', marcados:number,
 *   deficiencia:{id:string, nome:string, contagem:number, cor:string}[],
 *   excesso:{id:string, nome:string, contagem:number, cor:string}[],
 *   aviso:null, semResposta:number[],
 *   tela:{
 *     deficiencia:{nome:string, cor:string}[], excesso:{nome:string, cor:string}[],
 *     deficienciaTexto:string, excessoTexto:string
 *   }
 * }}
 */
export function calcularSinais(marcados, opcoes = {}) {
  const lista = marcados ?? [];
  if (!Array.isArray(lista)) throw new TypeError('Sinais: `marcados` deve ser um array de sinais.');
  const nutrientes = opcoes.nutrientes;
  if (!nutrientes || typeof nutrientes !== 'object') {
    throw new TypeError('Sinais: informe `opcoes.nutrientes` (mapa ID → nome do nutriente).');
  }
  const deficiencia = contar(lista.map((s) => s?.deficiencia), nutrientes);
  const excesso = contar(lista.map((s) => s?.excesso), nutrientes);
  const texto = (itens, vazia) => (itens.length ? itens.map((x) => `${x.nome} `).join('') : vazia);
  return {
    id: 'sinais',
    marcados: lista.length,
    deficiencia,
    excesso,
    aviso: null,
    semResposta: [],
    tela: {
      deficiencia: deficiencia.map(({ nome, cor }) => ({ nome, cor })),
      excesso: excesso.map(({ nome, cor }) => ({ nome, cor })),
      deficienciaTexto: texto(deficiencia, NENHUMA_DEFICIENCIA),
      excessoTexto: texto(excesso, NENHUM_EXCESSO),
    },
  };
}
