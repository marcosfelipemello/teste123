// Lista de compras: relatório §8.8. Dois caminhos:
//   1) "Importar alimentos" (sem quantidades, `importarCompras2`), nos dois métodos de planejamento;
//   2) lista com quantidades (só no método por equivalentes): o navegador calcula as quantidades
//      (`carregarDadosListaGeral`, `calcularQuantidadeGrupoEquivalente`, `calcularQuantidadeCompra`) antes de
//      mandar a lista para a IA do WebDiet reescrever. A reescrita por IA não faz parte deste módulo.
//
// Alimentos: objetos da base com `compras` (nome de compra). Receita: `tipo: 'receita'` ou
// `origem: 'Receita'`, com `ingredientes: [{alimento, …} | alimento]` (o que `getIngredientes` devolveria).
//
// Divergências tratadas aqui: §12 itens 25 e 26 (ver DIVERGENCIAS).

import { check, fx } from './numeros.js';
import { GRUPOS, normalizarGrupo, porcoesDoGrupo } from './equivalentes.js';
import { medidaDoAlimento } from './planejamento.js';

/** Períodos oferecidos na lista com quantidades (dias); "personalizado" aceita qualquer número > 0. */
export const PERIODOS = Object.freeze([7, 15, 30, 45, 60]);

/** Período padrão (dias). */
export const PERIODO_PADRAO = 15;

/**
 * Divergências do WebDiet (relatório §12) tratadas neste módulo.
 * @type {ReadonlyArray<{item:number, descricao:string, comportamento:string}>}
 */
export const DIVERGENCIAS = Object.freeze([
  {
    item: 25,
    descricao:
      'Método por alimentos, "com receitas": `final.concat(...)` sem atribuição descarta os ingredientes das receitas ' +
      'SUBSTITUTAS, e `parseInt(origem) == "Receita"` nunca é verdadeiro, então a receita substituta entra pelo nome de compra.',
    comportamento:
      'Padrão igual ao WebDiet: com receitas, só a receita principal é trocada pelos ingredientes; a receita ' +
      'substituta entra pelo nome de compra. Com a opção { corrigir: true }, toda receita (principal ou ' +
      'substituta) é trocada pelos seus ingredientes.',
  },
  {
    item: 26,
    descricao: 'Método por equivalentes: o diálogo oferece "com" ou "sem" receitas, mas `importarCompras2()` ignora a escolha.',
    comportamento:
      'Corrigido: a escolha vale — com receitas, as receitas dos grupos e os avulsos que são receitas entram pelos ' +
      'ingredientes. (Não reproduzido: o relatório não diz qual dos dois resultados o WebDiet dá ao ignorar a escolha.)',
  },
]);

/** true se o alimento é uma receita. */
export function ehReceita(alimento) {
  return alimento?.tipo === 'receita' || String(alimento?.origem ?? '').trim().toLowerCase() === 'receita';
}

/** Nome de compra do alimento (`compras`; sem ele, o `nome`). */
export function nomeDeCompra(alimento) {
  return String(alimento?.compras ?? '').trim() || String(alimento?.nome ?? '').trim();
}

/**
 * Nomes de compra de um alimento; com receitas, uma receita vira os nomes dos seus ingredientes.
 * @param {object} alimento
 * @param {boolean} comReceitas
 * @param {number} [nivel] proteção contra receitas que se referem a si mesmas
 * @returns {string[]}
 */
function nomesDoAlimento(alimento, comReceitas, nivel = 0) {
  if (comReceitas && ehReceita(alimento) && Array.isArray(alimento.ingredientes) && nivel < 5) {
    return alimento.ingredientes.flatMap((i) => nomesDoAlimento(i?.alimento ?? i, comReceitas, nivel + 1));
  }
  const n = nomeDeCompra(alimento);
  return n ? [n] : [];
}

/** Remove repetidos e ordena alfabeticamente (ordem do português). */
function unicosOrdenados(nomes) {
  return [...new Set(nomes)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/**
 * "Importar alimentos" no método por alimentos: nomes de compra de cada alimento principal e de cada
 * substituto, sem repetidos e em ordem alfabética.
 * @param {{itens:{alimento:object, subs?:({alimento:object}|object)[]}[]}[]} refeicoes
 * @param {{comReceitas?: boolean, corrigir?: boolean}} [opcoes] com receitas (padrão), a receita principal vira
 *        seus ingredientes; sem receitas, entra pelo nome de compra. Substitutos: como no WebDiet (§12 #25), a
 *        receita substituta entra sempre pelo nome de compra; com `corrigir: true`, também vira ingredientes.
 * @returns {string[]}
 */
export function importarComprasAlimentos(refeicoes = [], { comReceitas = true, corrigir = false } = {}) {
  const nomes = [];
  for (const r of refeicoes) {
    for (const it of r?.itens ?? []) {
      nomes.push(...nomesDoAlimento(it.alimento, comReceitas));
      // WebDiet §12 #25: os ingredientes da receita substituta são descartados e ela entra pelo nome de compra.
      for (const s of it.subs ?? it.substitutos ?? []) nomes.push(...nomesDoAlimento(s?.alimento ?? s, comReceitas && corrigir));
    }
  }
  return unicosOrdenados(nomes);
}

/** Alimentos selecionados de cada grupo (`selecionado !== false`), na ordem da lista. */
function alimentosPorGrupo(alimentos = []) {
  const porGrupo = Object.fromEntries(GRUPOS.map((g) => [g.id, []]));
  for (const a of alimentos) {
    if (a?.selecionado === false) continue;
    const g = normalizarGrupo(a?.grupo);
    if (g) porGrupo[g].push(a);
  }
  return porGrupo;
}

/**
 * "Importar alimentos" no método por equivalentes: todos os alimentos de cada grupo com porção > 0 em cada
 * refeição, mais os avulsos; sem repetidos e em ordem alfabética.
 * @param {{refeicoes:{porcoes?:Record<string,number|string>, avulsos?:{alimento:object}[]}[],
 *          alimentos:object[]}} entrada `alimentos` = lista de equivalentes (com `grupo`)
 * @param {{comReceitas?: boolean}} [opcoes] §12 #26 corrigido: a escolha vale
 * @returns {string[]}
 */
export function importarComprasEquivalentes({ refeicoes = [], alimentos = [] } = {}, { comReceitas = true } = {}) {
  const porGrupo = alimentosPorGrupo(alimentos);
  const nomes = [];
  for (const r of refeicoes) {
    for (const { id } of GRUPOS) {
      if (porcoesDoGrupo(r?.porcoes, id) > 0) for (const a of porGrupo[id]) nomes.push(...nomesDoAlimento(a, comReceitas));
    }
    for (const av of r?.avulsos ?? []) nomes.push(...nomesDoAlimento(av?.alimento ?? av, comReceitas));
  }
  return unicosOrdenados(nomes);
}

/**
 * Quantidade de um alimento de grupo (`calcularQuantidadeGrupoEquivalente`): qtd = porções × quantidade da
 * medida; peso = porções × peso; nome da medida no plural quando qtd > 1 (`medidaPlural`, se o alimento
 * tiver; senão o próprio nome).
 * @param {number|string} porcoes
 * @param {{quantidade:number|string, medida:string, medidaPlural?:string, peso:number|string}} alimento
 * @returns {{qtd:number, medida:string, peso:number}}
 */
export function calcularQuantidadeGrupoEquivalente(porcoes, alimento) {
  const p = check(porcoes);
  const qtd = p * check(alimento?.quantidade);
  const peso = p * check(alimento?.peso);
  const medida = qtd > 1 && alimento?.medidaPlural ? alimento.medidaPlural : String(alimento?.medida ?? '');
  return { qtd, medida, peso };
}

/**
 * Conversão para compra (`calcularQuantidadeCompra`):
 * - medida contém "unidade" (sem diferenciar maiúsculas) → Math.round(qtd × período) + " Unidade(s)";
 * - ml: total = peso × período; > 1000 → (total/1000).toFixed(2) com vírgula + " Litros";
 *   senão Math.round(total) + " ml" (vazio se der 0);
 * - g (qualquer unidade que não seja ml): > 1000 → "x,xx Kg"; senão Math.round(total) + " g" (vazio se 0).
 * Período vazio, inválido ou ≤ 0 vale 1.
 * @param {number|string} qtd
 * @param {string} medida
 * @param {number|string} peso
 * @param {string} unidade 'g' | 'ml'
 * @param {number|string} periodo dias
 * @returns {string}
 */
export function calcularQuantidadeCompra(qtd, medida, peso, unidade, periodo) {
  let dias = check(periodo);
  if (!(dias > 0)) dias = 1;
  if (/unidade/i.test(String(medida ?? ''))) return `${Math.round(check(qtd) * dias)} Unidade(s)`;
  const total = check(peso) * dias;
  const ml = String(unidade ?? '').trim().toLowerCase() === 'ml';
  if (total > 1000) return `${fx(total / 1000, 2).replace('.', ',')} ${ml ? 'Litros' : 'Kg'}`;
  const r = Math.round(total);
  return r === 0 ? '' : `${r} ${ml ? 'ml' : 'g'}`;
}

/**
 * Dados da lista com quantidades (`carregarDadosListaGeral`): uma entrada por refeição e por grupo com
 * porção > 0 (o primeiro alimento do grupo é o principal; os demais viram opções) e uma por avulso.
 * Não há soma entre refeições.
 * @param {{refeicoes:{porcoes?:Record<string,number|string>,
 *            avulsos?:{alimento:object, quantidade?:number|string, medida?:string|object, peso?:number|string}[]}[],
 *          alimentos:object[]}} entrada
 * @param {{periodo?:number|string, comQuantidades?:boolean, comSubstitutos?:boolean}} [opcoes]
 *        período padrão 15 dias; sem quantidades, `compra` sai null; sem substitutos, `opcoes` vazio
 * @returns {{refeicao:number, grupo:string|null, porcoes:number|null,
 *   principal:{nome:string, qtd:number, medida:string, peso:number, unidade:string, compra:string|null},
 *   opcoes:object[]}[]}
 */
export function montarListaComQuantidades({ refeicoes = [], alimentos = [] } = {}, opcoes = {}) {
  const { periodo = PERIODO_PADRAO, comQuantidades = true, comSubstitutos = true } = opcoes;
  const porGrupo = alimentosPorGrupo(alimentos);
  const item = (alimento, q) => ({
    nome: nomeDeCompra(alimento),
    qtd: q.qtd,
    medida: q.medida,
    peso: q.peso,
    unidade: alimento?.unidade ?? 'g',
    compra: comQuantidades ? calcularQuantidadeCompra(q.qtd, q.medida, q.peso, alimento?.unidade ?? 'g', periodo) : null,
  });
  const lista = [];
  refeicoes.forEach((r, i) => {
    for (const { id } of GRUPOS) {
      const por = porcoesDoGrupo(r?.porcoes, id);
      const doGrupo = porGrupo[id];
      if (!(por > 0) || !doGrupo.length) continue;
      const [principal, ...outros] = doGrupo.map((a) => item(a, calcularQuantidadeGrupoEquivalente(por, a)));
      lista.push({ refeicao: i, grupo: id, porcoes: por, principal, opcoes: comSubstitutos ? outros : [] });
    }
    for (const av of r?.avulsos ?? []) {
      const al = av?.alimento ?? {};
      const med = av.medida === undefined ? null : medidaDoAlimento(al, av.medida);
      const peso = med ? check(av.quantidade) * med.peso : check(av.peso);
      const porPeso = al.unidade === 'ml' ? 'mililitro(s)' : 'grama(s)';
      const q = { qtd: med ? check(av.quantidade) : peso, medida: med ? med.nome : porPeso, peso };
      lista.push({ refeicao: i, grupo: null, porcoes: null, principal: item(al, q), opcoes: [] });
    }
  });
  return lista;
}
