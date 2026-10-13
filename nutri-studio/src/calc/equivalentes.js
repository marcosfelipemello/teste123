// Planejamento alimentar — método por equivalentes (metodoWebdiet.php): relatório §8.5.
// Conferido contra docs/webdiet-evidencias/tela_planejamento_equivalentes.json (114/114 na tela do WebDiet).
//
// Cada grupo (g1..g15) tem uma lista própria de alimentos com valores POR PORÇÃO:
//   {id, nome, grupo: 'g4'|4, selecionado?: boolean, quantidade, medida, peso, ptn, lip, cho, kcal, fibras, micros?: [27]}
// As listas curadas do WebDiet não foram copiadas (§1.2): quem chama fornece os alimentos de cada grupo.
//
// Valor do grupo = média simples dos alimentos selecionados; cada valor é arredondado em 1 casa antes e a
// média também sai com 1 casa. Desvio-padrão populacional (÷ n) em torno da média SEM arredondar (é o que
// reproduz, bit a bit, o desvio de fibras do g4 da evidência).
//
// Total do dia = Σ por grupo, na ordem g1→g15, de (Σ das porções do grupo nas refeições calculadas) × média
// do grupo; depois os avulsos. Somar por refeição e depois por grupo muda a última casa (a evidência traz
// os totais sem arredondar, e só esta ordem os reproduz).

import { check, fx, fxn } from './numeros.js';
import {
  medidaDoAlimento, nutrientesPorPeso, tabelaMicros, analisarTotal, calcularMetas, calcularAdequacao, CORES, N_MICROS,
} from './planejamento.js';

/** Os 15 grupos de equivalentes (relatório §8.3). */
export const GRUPOS = Object.freeze([
  { id: 'g1', nome: 'baixa caloria' },
  { id: 'g2', nome: 'vegetais A' },
  { id: 'g3', nome: 'vegetais B' },
  { id: 'g4', nome: 'proteínas' },
  { id: 'g5', nome: 'cereais e tubérculos' },
  { id: 'g6', nome: 'leguminosas' },
  { id: 'g7', nome: 'óleos e gorduras' },
  { id: 'g8', nome: 'alimentos gordurosos' },
  { id: 'g9', nome: 'frutas' },
  { id: 'g10', nome: 'frutas oleosas' },
  { id: 'g11', nome: 'oleaginosas e sementes' },
  { id: 'g12', nome: 'pães e fibras' },
  { id: 'g13', nome: 'laticínios' },
  { id: 'g14', nome: 'suplementos' },
  { id: 'g15', nome: 'açúcares' },
]);

/** Ordem dos valores de cada grupo (como `macrosGrupo` da evidência). */
export const CAMPOS_GRUPO = Object.freeze(['ptn', 'lip', 'cho', 'kcal', 'fibras']);

/**
 * Nenhum item do §12 é só do cálculo por equivalentes (o #26 está em listaCompras.js; #20, #31 e #32, das
 * metas e da análise, valem aqui também e estão em planejamento.js). O #30 não acontece aqui: a página
 * recalcula o total antes das metas.
 */
export const DIVERGENCIAS = Object.freeze([]);

/**
 * Normaliza o identificador do grupo: 'g4', 'G4', 4 ou '4' → 'g4'. Fora de g1..g15 → null.
 * @param {unknown} g
 * @returns {string|null}
 */
export function normalizarGrupo(g) {
  const m = /^g?(\d+)$/i.exec(String(g ?? '').trim());
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 15 ? `g${n}` : null;
}

/** true se a refeição entra no total (`calculada` true/"sim"; ausente = sim). */
export function refeicaoCalculada(refeicao) {
  const c = refeicao?.calculada;
  if (c === undefined || c === null) return true;
  if (c === true) return true;
  const t = String(c).trim().toLowerCase();
  return t === 'sim' || t === 'true';
}

/**
 * Porções de um grupo numa refeição. `porcoes` pode usar 'g5' ou '5' como chave.
 * @param {Record<string, number|string>|undefined} porcoes
 * @param {string} grupo 'g1'..'g15'
 */
export function porcoesDoGrupo(porcoes, grupo) {
  if (!porcoes) return 0;
  const n = grupo.slice(1);
  return check(porcoes[grupo] ?? porcoes[n]);
}

/**
 * Média (1 casa) e desvio-padrão populacional de uma coluna de valores, cada um arredondado em 1 casa antes.
 * Lista vazia: média 0 e desvio 0.
 * @param {(number|string)[]} valores
 * @returns {{media:number, dp:number}}
 */
export function mediaDesvio(valores) {
  const xs = valores.map((v) => fxn(check(v), 1));
  const n = xs.length;
  if (!n) return { media: 0, dp: 0 };
  const media = xs.reduce((a, x) => a + x, 0) / n;
  const dp = Math.sqrt(xs.reduce((a, x) => a + (x - media) ** 2, 0) / n);
  return { media: fxn(media, 1), dp };
}

/**
 * Estatísticas de um grupo a partir dos alimentos selecionados (a lista recebida já é a do grupo).
 * @param {object[]} alimentos
 * @returns {{n:number, media:number[], dp:number[], microsMedia:number[]|null, microsDp:number[]|null}}
 *   `media`/`dp` na ordem de CAMPOS_GRUPO; micros só quando algum alimento traz o vetor `micros`.
 */
export function estatisticasGrupo(alimentos = []) {
  const media = [], dp = [];
  for (const c of CAMPOS_GRUPO) {
    const r = mediaDesvio(alimentos.map((a) => a[c]));
    media.push(r.media);
    dp.push(r.dp);
  }
  let microsMedia = null, microsDp = null;
  if (alimentos.some((a) => Array.isArray(a.micros))) {
    microsMedia = [];
    microsDp = [];
    for (let i = 0; i < N_MICROS; i++) {
      const r = mediaDesvio(alimentos.map((a) => a.micros?.[i]));
      microsMedia.push(r.media);
      microsDp.push(r.dp);
    }
  }
  return { n: alimentos.length, media, dp, microsMedia, microsDp };
}

/**
 * Médias e desvios dos 15 grupos a partir da lista de alimentos de equivalentes (só os selecionados:
 * `selecionado !== false`).
 * @param {object[]} alimentos
 * @returns {{macrosGrupo:Record<string,number[]>, macros_desvp:Record<string,number[]>,
 *   microsGrupo:Record<string,number[]|null>, n:Record<string,number>, tela:Record<string,string[]>}}
 *   `macrosGrupo`/`macros_desvp` como na evidência; `tela[g]` = "± dp" de cada campo (kcal com 0 casas,
 *   os outros com 1).
 */
export function calcularGrupos(alimentos = []) {
  const porGrupo = Object.fromEntries(GRUPOS.map((g) => [g.id, []]));
  for (const a of alimentos) {
    if (a?.selecionado === false) continue;
    const g = normalizarGrupo(a?.grupo);
    if (g) porGrupo[g].push(a);
  }
  const macrosGrupo = {}, macros_desvp = {}, microsGrupo = {}, n = {}, tela = {};
  for (const { id } of GRUPOS) {
    const e = estatisticasGrupo(porGrupo[id]);
    macrosGrupo[id] = e.media;
    macros_desvp[id] = e.dp;
    microsGrupo[id] = e.microsMedia;
    n[id] = e.n;
    tela[id] = e.dp.map((d, j) => `± ${fx(d, CAMPOS_GRUPO[j] === 'kcal' ? 0 : 1)}`);
  }
  return { macrosGrupo, macros_desvp, microsGrupo, n, tela };
}

/**
 * Um alimento avulso (da base geral, por 100 g): peso = quantidade × medida (1 casa) ou `peso` informado;
 * cada nutriente arredondado em 1 casa antes de somar.
 * @param {{alimento:object, quantidade?:number|string, medida?:string|object, peso?:number|string}} avulso
 */
export function calcularAvulso(avulso) {
  const al = avulso.alimento ?? {};
  const peso = avulso.medida === undefined && avulso.peso !== undefined
    ? fxn(check(avulso.peso), 1)
    : fxn(check(avulso.quantidade) * medidaDoAlimento(al, avulso.medida).peso, 1);
  const n = nutrientesPorPeso(al, peso);
  return {
    peso,
    ptn: fxn(n.ptn, 1), lip: fxn(n.lip, 1), cho: fxn(n.cho, 1), kcal: fxn(n.kcal, 1), fibras: fxn(n.fibras, 1),
    micros: n.micros.map((v) => fxn(v, 1)),
  };
}

/**
 * Total do dia no método por equivalentes.
 *
 * @param {{refeicoes:{porcoes?:Record<string,number|string>, calculada?:boolean|string,
 *            avulsos?:object[]}[],
 *          macrosGrupo:Record<string,number[]>, microsGrupo?:Record<string,number[]|null>,
 *          referencias?:{valores:(number|string|null)[], tela:Record<string,string>}|null,
 *          metas?:Parameters<typeof calcularMetas>[0]|null}} entrada
 *   `macrosGrupo`/`microsGrupo` = resultado de `calcularGrupos` (ou as médias vistas na tela). `metas` como
 *   no método por alimentos (`{}` = plano sem metas salvas: g/kg com tudo 0, como o WebDiet mostra).
 * @param {{corrigir?: boolean}} [opcoes] repassado a `calcularMetas` (§12 #20)
 * @returns {{porcoesGrupo:Record<string,number>, totalMacros:number[], micros:number[]|null,
 *   tabelaMicros:object[]|null, total:ReturnType<typeof analisarTotal>, metas:object|null,
 *   adequacao:object|null, tela:Record<string, unknown>}}
 *   `totalMacros` = [PTN, LIP, CHO, kcal, fibras] sem arredondar (como na evidência). A tela segue
 *   `graficoMacros()` de metodoWebdiet.php (`analisarTotal` com `equivalentes`); metas e adequação seguem
 *   `mostrarReferencias()`, sobre os totais SEM arredondar, com o neutro cinza.
 */
export function calcularTotaisEquivalentes({ refeicoes = [], macrosGrupo, microsGrupo = null, referencias = null, metas = null } = {}, opcoes = {}) {
  const calc = refeicoes.map(refeicaoCalculada);
  const temMicros = !!microsGrupo && Object.values(microsGrupo).some((m) => Array.isArray(m));
  const total = [0, 0, 0, 0, 0];
  const micros = temMicros ? new Array(N_MICROS).fill(0) : null;
  const porcoesGrupo = {};
  for (const { id } of GRUPOS) {
    let por = 0;
    refeicoes.forEach((r, i) => {
      if (calc[i]) por += porcoesDoGrupo(r?.porcoes, id);
    });
    porcoesGrupo[id] = por;
    const media = macrosGrupo?.[id] ?? [];
    for (let j = 0; j < CAMPOS_GRUPO.length; j++) total[j] += por * check(media[j]);
    if (micros) for (let i = 0; i < N_MICROS; i++) micros[i] += por * check(microsGrupo[id]?.[i]);
  }
  refeicoes.forEach((r, i) => {
    if (!calc[i]) return;
    for (const av of r?.avulsos ?? []) {
      const a = calcularAvulso(av);
      CAMPOS_GRUPO.forEach((c, j) => (total[j] += a[c]));
      if (micros) for (let k = 0; k < N_MICROS; k++) micros[k] += a.micros[k];
    }
  });

  const analise = analisarTotal(total, metas?.peso, { equivalentes: true });
  const planejado = metas ? calcularMetas(metas, opcoes) : null;
  const adequacao = planejado ? calcularAdequacao(analise, planejado, { neutro: CORES.neutroEquivalentes }) : null;
  const tabela = micros ? tabelaMicros(micros, referencias) : null;
  const tela = {
    ...analise.tela,
    ...(planejado ? planejado.tela : {}),
    ...(adequacao ? { ...adequacao.tela, cores: adequacao.cores } : {}),
    ...(tabela ? { micros: tabela.map((m) => m.tela) } : {}),
  };
  return { porcoesGrupo, totalMacros: total, micros, tabelaMicros: tabela, total: analise, metas: planejado, adequacao, tela };
}
