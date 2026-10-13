// Referências de micronutrientes (DRIs) por perfil — relatório §8.3 (homem de 35 anos) e §8.10
// (15 perfis conferidos na tela; evidência tela_dris.json).
//
// No WebDiet as referências vêm prontas do servidor (atributo `referencia_micro` de #refMicro1..27).
// Aqui elas ficam em src/dados/dris.json, organizadas pelos estágios de vida do IOM. Cada estágio diz a
// sua fonte:
//   - "webdiet-conferido": valores vistos na tela do WebDiet (16 perfis do relatório);
//   - "nasem-oficial": faixa não observada no WebDiet; valores das tabelas-resumo oficiais (NASEM; Na e K
//     NASEM 2019 via Health Canada; fibras pela tabela de macronutrientes da Health Canada).
// Nas faixas do IOM que não distinguem sexo e em que só um sexo foi visto (crianças de 1–3 e 4–8 anos), a
// fonte é dada por sexo: {"M": "webdiet-conferido", "F": "nasem-oficial"}.
//
// Limites de faixa adotados (decisão; o relatório §8.10 diz que a troca de faixa no aniversário não foi
// testada): idade em meses/anos COMPLETOS na data de referência (idadeAnos/idadeMeses de numeros.js),
// limites inclusivos:
//   0–6 m = 0 a 6 meses completos · 7–12 m = 7 a 11 meses · 1–3 a · 4–8 a · 9–13 a · 14–18 a ·
//   19–30 a · 31–50 a · 51–70 a · > 70 a = 71 anos ou mais.
//   Gestante/lactante (só sexo F): ≤ 18 a · 19–30 a · 31–50 a. Acima de 50 anos não há faixa (aviso).

import { idadeAnos, idadeMeses, partesData, hojeTexto } from './numeros.js';
import DRIS from '../dados/dris.json' with { type: 'json' };

/** Fontes possíveis de um estágio de vida. */
export const FONTES = Object.freeze({ webdiet: 'webdiet-conferido', nasem: 'nasem-oficial' });

/** Texto devolvido quando sexo ou idade não permitem escolher uma faixa. */
export const AVISO_DADOS_INVALIDOS = 'Sexo ou idade inválidos: não é possível escolher a referência';

/** Texto devolvido quando nenhuma faixa do IOM se aplica (gestante ou lactante acima de 50 anos). */
export const AVISO_SEM_FAIXA = 'Não há faixa de referência para este perfil';

/**
 * Os 27 micronutrientes, na ordem da tela (#refMicro1..27) e do vetor `micros` dos alimentos:
 * mono, poli, saturada, trans, colesterol, fibras, Ca, Mg, P, Fe, Na, K, Cu, Zn, Se, retinol, RAE,
 * folato, B12, B1, B2, B6, niacina, C, D, E, álcool (relatório §8.3).
 * @type {{n:number, chave:string, nome:string, unidade:string|null}[]}
 */
export const NUTRIENTES = DRIS.nutrientes;

/** Chaves dos 27 micronutrientes na ordem da tela (nomes dos campos da base, relatório §8.2). */
export const CHAVES_MICROS = DRIS.nutrientes.map((x) => x.chave);

/**
 * Divergências do WebDiet (relatório §12) tratadas neste módulo.
 * @type {ReadonlyArray<{item:number, descricao:string, comportamento:string}>}
 */
export const DIVERGENCIAS = Object.freeze([
  {
    item: 24,
    descricao:
      'Referência de selênio para 0–6 meses exibida como "15 mg"; a DRI é 15 mcg e os outros perfis mostram mcg. ' +
      'O % de adequação compara só os números, então a conta não muda.',
    comportamento: 'Corrigido: o rótulo sai "15 mcg"; o valor numérico (15) é o mesmo do WebDiet.',
  },
]);

/**
 * Normaliza o sexo para "M" ou "F" (aceita "M", "F", "masculino", "feminino"…).
 * @param {unknown} sexo
 * @returns {'M'|'F'|null}
 */
function normalizarSexo(sexo) {
  const s = String(sexo ?? '').trim().toUpperCase().charAt(0);
  return s === 'M' || s === 'F' ? s : null;
}

/**
 * Normaliza a condição. Só "gestante" e "lactante" mudam a faixa (e só para o sexo F);
 * "nao_gestante", "" ou qualquer outro valor = sem condição.
 * @param {unknown} condicao
 * @returns {'gestante'|'lactante'|null}
 */
function normalizarCondicao(condicao) {
  const c = String(condicao ?? '').trim().toLowerCase();
  return c === 'gestante' || c === 'lactante' ? c : null;
}

/**
 * Texto da referência como na tela do WebDiet: "<valor> <unidade>", "N/D", "0" ou "" (sem referência).
 * O número sai com `String(n)`, como na tela ("0.9 mg", "1 mg", "0.27 mg").
 * @param {{chave:string, unidade:string|null}} nutriente
 * @param {number|string|null} valor
 * @param {Record<string,string>} fixos
 * @returns {string}
 */
function textoReferencia(nutriente, valor, fixos) {
  if (Object.prototype.hasOwnProperty.call(fixos, nutriente.chave)) return fixos[nutriente.chave];
  if (valor === 'N/D') return 'N/D';
  if (valor === null || valor === undefined || valor === '') return '';
  return `${valor} ${nutriente.unidade}`;
}

/**
 * Converte o texto fixo da tela em valor: "" → null (sem referência), "0" → 0, "N/D" → "N/D".
 * @param {string} texto
 * @returns {number|string|null}
 */
function valorFixo(texto) {
  if (texto === '') return null;
  if (texto === 'N/D') return 'N/D';
  return Number(texto);
}

/**
 * Fonte do estágio para o sexo do perfil ("webdiet-conferido" ou "nasem-oficial").
 * @param {string|{M:string,F:string}} fonte
 * @param {'M'|'F'} sexo
 * @returns {string}
 */
function fonteDoSexo(fonte, sexo) {
  return typeof fonte === 'string' ? fonte : fonte?.[sexo] ?? null;
}

/**
 * Procura o estágio de vida que se aplica ao perfil.
 * @param {{sexo:'M'|'F', anos:number, meses:number, condicao:'gestante'|'lactante'|null}} perfil
 * @param {object} dados conteúdo de dris.json
 * @returns {object|null} o estágio, ou null se nenhuma faixa se aplica
 */
function procurarEstagio(perfil, dados) {
  const cond = perfil.sexo === 'F' ? perfil.condicao : null;
  return (
    dados.estagios.find((e) => {
      if ((e.condicao ?? null) !== cond) return false;
      if (e.sexo && e.sexo !== perfil.sexo) return false;
      const { unidade, min, max } = e.idade;
      if (unidade === 'meses') {
        if (perfil.anos >= 1) return false;
        return (min === null || perfil.meses >= min) && (max === null || perfil.meses <= max);
      }
      return (min === null || perfil.anos >= min) && (max === null || perfil.anos <= max);
    }) ?? null
  );
}

/**
 * Referências dos 27 micronutrientes para um perfil (sexo, idade e condição).
 *
 * A idade vem de `nascimento` + `dataReferencia` ("dd/mm/aaaa"; sem `dataReferencia` usa a data de hoje),
 * ou diretamente de `idadeAnos`/`idadeMeses`.
 *
 * @param {{sexo:string, nascimento?:string, dataReferencia?:string, condicao?:string,
 *          idadeAnos?:number, idadeMeses?:number}} perfil
 * @param {object} [dados] tabela no formato de dris.json (padrão: src/dados/dris.json)
 * @returns {{
 *   estagio: string|null, rotulo: string|null, fonte: string|null,
 *   idadeAnos: number|null, idadeMeses: number|null,
 *   valores: (number|string|null)[]|null,
 *   tela: Record<string,string>|null,
 *   aviso: string|null
 * }} `valores[i]` é número, "N/D" ou null (sem referência), na ordem de NUTRIENTES; `tela.micro1..micro27`
 *    é o texto da coluna de referência ("1000 mg", "N/D", "0", ""). Sem faixa: valores e tela null + aviso.
 */
export function referenciasMicros(perfil, dados = DRIS) {
  const sexo = normalizarSexo(perfil?.sexo);
  const condicao = normalizarCondicao(perfil?.condicao);
  let anos = perfil?.idadeAnos ?? null;
  let meses = perfil?.idadeMeses ?? null;
  if (perfil?.nascimento !== undefined && perfil?.nascimento !== null) {
    const ref = perfil.dataReferencia ?? hojeTexto();
    if (partesData(perfil.nascimento) && partesData(ref)) {
      anos = idadeAnos(perfil.nascimento, ref);
      meses = idadeMeses(perfil.nascimento, ref);
    } else {
      anos = null;
      meses = null;
    }
  }
  if (meses === null && anos !== null && anos >= 1) meses = anos * 12;
  if (anos === null && meses !== null) anos = Math.floor(meses / 12);

  const vazio = { estagio: null, rotulo: null, fonte: null, idadeAnos: anos, idadeMeses: meses, valores: null, tela: null };
  if (!sexo || anos === null || anos < 0 || (anos < 1 && (meses === null || meses < 0))) {
    return { ...vazio, aviso: AVISO_DADOS_INVALIDOS };
  }

  const estagio = procurarEstagio({ sexo, anos, meses, condicao }, dados);
  if (!estagio) return { ...vazio, aviso: AVISO_SEM_FAIXA };

  const valores = [];
  const tela = {};
  for (const nut of dados.nutrientes) {
    const fixo = Object.prototype.hasOwnProperty.call(dados.fixos, nut.chave);
    const v = fixo ? valorFixo(dados.fixos[nut.chave]) : estagio.valores[nut.chave] ?? null;
    valores.push(v);
    tela[`micro${nut.n}`] = textoReferencia(nut, v, dados.fixos);
  }
  return {
    estagio: estagio.id,
    rotulo: estagio.rotulo,
    fonte: fonteDoSexo(estagio.fonte, sexo),
    idadeAnos: anos,
    idadeMeses: meses,
    valores,
    tela,
    aviso: null,
  };
}

/**
 * Confere a estrutura de uma tabela de DRIs: 27 nutrientes; cada estágio tem fonte válida e todos os
 * nutrientes que não são fixos, com número ou "N/D".
 * @param {object} [dados]
 * @returns {string[]} lista de problemas (vazia se está tudo certo)
 */
export function validarDris(dados = DRIS) {
  const problemas = [];
  if (!Array.isArray(dados?.nutrientes) || dados.nutrientes.length !== 27) problemas.push('nutrientes: são esperados 27 itens');
  const variaveis = (dados?.nutrientes ?? []).filter((n) => !Object.prototype.hasOwnProperty.call(dados.fixos ?? {}, n.chave));
  const fontes = Object.values(FONTES);
  const ids = new Set();
  for (const e of dados?.estagios ?? []) {
    if (ids.has(e.id)) problemas.push(`${e.id}: id repetido`);
    ids.add(e.id);
    const fs = typeof e.fonte === 'string' ? [e.fonte] : [e.fonte?.M, e.fonte?.F];
    if (fs.some((f) => !fontes.includes(f))) problemas.push(`${e.id}: fonte inválida`);
    for (const n of variaveis) {
      const v = e.valores?.[n.chave];
      if (!(typeof v === 'number' && Number.isFinite(v)) && v !== 'N/D') problemas.push(`${e.id}: ${n.chave} ausente ou inválido`);
    }
  }
  return problemas;
}
