// Importação e exportação de "Meus alimentos" em CSV. Funções puras (não acessam o navegador);
// testadas em test/alimentosCsv.test.js.
//
// Formato (uma linha por alimento, valores por 100 g ou 100 mL, separador ";" ou ","):
//   nome; unidade; kcal; ptn; lip; cho; fibras        ← obrigatórias (nesta ou em qualquer ordem)
//   medidas; compras; origem                           ← opcionais
//   gorduramono; gordurapoli; …; alcool                ← opcionais: os micronutrientes, com os nomes de
//                                                         dris.js → CHAVES_MICROS (a coluna "fibras" é a mesma)
// - Números aceitam vírgula ou ponto decimal ("2,5" ou "2.5"); "Tr", "NA", "N/D", "*" e "-" (como nas
//   tabelas de composição) e célula vazia valem 0. Só a kcal não pode ficar vazia.
// - medidas: "nome_mc:peso|nome_mc:peso" (peso de UMA medida, em g ou mL). Ex.: "Colher(es) de sopa:25|Xícara(s):130".
//   "grama(s)" / "mililitro(s)" = 1 não precisa ser informada: o app sempre oferece a medida da unidade.

import { lerCsv } from './importacao.js';
import { NUTRIENTES, CHAVES_MICROS } from '../calc/dris.js';

/** Normaliza um nome de coluna: sem acento, minúsculo, só letras e números. */
export function normalizarColuna(s) {
  return String(s ?? '').replace(/^﻿/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Colunas principais, com descrição (para a página) e nomes alternativos aceitos no cabeçalho. */
export const COLUNAS = Object.freeze([
  { chave: 'nome', obrigatoria: true, descricao: 'Nome do alimento (único na planilha).', aceita: ['nome', 'alimento', 'descricao', 'descricaodoalimento'] },
  { chave: 'unidade', obrigatoria: true, descricao: '"g" ou "ml": os valores são por 100 g ou por 100 mL. Vazio = g.', aceita: ['unidade', 'un'] },
  { chave: 'kcal', obrigatoria: true, descricao: 'Energia (kcal) por 100 g/mL. Não pode ficar vazia.', aceita: ['kcal', 'energia', 'energiakcal', 'calorias'] },
  { chave: 'ptn', obrigatoria: true, descricao: 'Proteínas (g).', aceita: ['ptn', 'proteina', 'proteinas', 'proteinag'] },
  { chave: 'lip', obrigatoria: true, descricao: 'Lipídios (g).', aceita: ['lip', 'lipidio', 'lipidios', 'lipideos', 'lipidiosg', 'gordurastotais'] },
  { chave: 'cho', obrigatoria: true, descricao: 'Carboidratos (g).', aceita: ['cho', 'carboidrato', 'carboidratos', 'carboidratosg'] },
  { chave: 'fibras', obrigatoria: true, descricao: 'Fibras (g). Também é o micronutriente "fibras".', aceita: ['fibras', 'fibra', 'fibraalimentar', 'fibrasg'] },
  { chave: 'medidas', obrigatoria: false, descricao: 'Medidas caseiras: "nome_mc:peso|nome_mc:peso", peso de uma medida em g ou mL.', aceita: ['medidas', 'medidascaseiras', 'mc'] },
  { chave: 'compras', obrigatoria: false, descricao: 'Nome na lista de compras (sem ele, vale o nome).', aceita: ['compras', 'nomedecompra', 'nomecompra'] },
  { chave: 'origem', obrigatoria: false, descricao: 'Tabela de origem (ex.: TACO). Vazio = "Importado".', aceita: ['origem', 'fonte', 'tabela'] },
]);

/** Unidade em que cada micronutriente é lido (dris.js não traz unidade para os que não têm referência). */
const UNIDADES_SEM_REFERENCIA = { gorduramono: 'g', gordurapoli: 'g', gordurasat: 'g', gorduratrans: 'g', colesterol: 'mg', re: 'mcg', alcool: 'g' };

/** Os 27 micronutrientes com a unidade dos valores por 100 g (para rótulos e documentação). */
export const MICROS = Object.freeze(NUTRIENTES.map((n) => ({ ...n, unidadeValor: n.unidade || UNIDADES_SEM_REFERENCIA[n.chave] || '' })));

/** Colunas de micronutrientes do CSV: as 27 chaves menos "fibras" (que já é coluna principal). */
export const COLUNAS_MICROS = Object.freeze(CHAVES_MICROS.filter((c) => c !== 'fibras'));

/** Origem gravada quando a planilha não diz. */
export const ORIGEM_PADRAO = 'Importado';

/** Mapa nome normalizado → chave (principais + micronutrientes, pela chave ou pelo nome em dris.js). */
const MAPA_COLUNAS = (() => {
  const m = new Map();
  for (const c of COLUNAS) for (const a of c.aceita) m.set(a, c.chave);
  for (const n of NUTRIENTES) {
    if (n.chave === 'fibras') continue;
    if (!m.has(n.chave)) m.set(n.chave, `micro:${n.chave}`);
    const porNome = normalizarColuna(n.nome);
    if (!m.has(porNome)) m.set(porNome, `micro:${n.chave}`);
  }
  return m;
})();

const SEM_VALOR = /^(tr|traco|traços?|na|nd|n\/d|n\.d\.|\*|-|—)$/i;

/**
 * Lê um número de uma célula. Aceita vírgula ou ponto decimal e separador de milhar ("1.234,5").
 * @param {unknown} texto
 * @returns {{valor:number|null, vazio:boolean, erro:string|null}} vazio = célula vazia ou marcador
 *   ("Tr", "NA", "*"…), que vale 0; erro = texto que não é número (ou número negativo)
 */
export function lerNumero(texto) {
  let s = String(texto ?? '').trim();
  if (s === '' || SEM_VALOR.test(s)) return { valor: 0, vazio: true, erro: null };
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return { valor: null, vazio: false, erro: `"${String(texto).trim()}" não é um número` };
  const valor = Number(s);
  if (!Number.isFinite(valor)) return { valor: null, vazio: false, erro: `"${String(texto).trim()}" não é um número` };
  if (valor < 0) return { valor: null, vazio: false, erro: `"${String(texto).trim()}" é negativo` };
  return { valor, vazio: false, erro: null };
}

/**
 * Lê a coluna de medidas caseiras: "nome_mc:peso|nome_mc:peso". O peso fica depois do ÚLTIMO ":".
 * Peso 0 é aceito (ex.: "À vontade:0", como no WebDiet).
 * @param {unknown} texto
 * @returns {{mc:{nome_mc:string, peso:number}[], erros:string[]}}
 */
export function lerMedidas(texto) {
  const mc = [], erros = [];
  const vistos = new Set();
  for (const parte of String(texto ?? '').split('|')) {
    const p = parte.trim();
    if (!p) continue;
    const i = p.lastIndexOf(':');
    const nome = i > 0 ? p.slice(0, i).trim() : '';
    if (!nome) { erros.push(`medida "${p}" sem nome (use nome:peso)`); continue; }
    const n = lerNumero(p.slice(i + 1));
    if (n.erro || n.vazio) { erros.push(`medida "${nome}": peso inválido`); continue; }
    if (vistos.has(nome.toLowerCase())) { erros.push(`medida "${nome}" repetida`); continue; }
    vistos.add(nome.toLowerCase());
    mc.push({ nome_mc: nome, peso: n.valor });
  }
  return { mc, erros };
}

/** Texto da coluna de medidas a partir de `mc` (inverso de lerMedidas). */
export function formatarMedidas(mc = []) {
  return (mc || []).filter((m) => String(m?.nome_mc ?? '').trim()).map((m) => `${String(m.nome_mc).trim()}:${numeroCsv(m.peso)}`).join('|');
}

/** Chave para comparar nomes de alimentos (sem acento, minúsculo, espaços simples). */
export function chaveNome(nome) {
  return String(nome ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Importa alimentos de um CSV com cabeçalho.
 * @param {string} texto
 * @returns {{erro:string|null, alimentos:{linha:number, alimento:object}[],
 *   rejeitados:{linha:number, nome:string, erros:string[]}[],
 *   colunas:{reconhecidas:Record<string,string>, ignoradas:string[]}}}
 *   `alimento` = {nome, unidade, kcal, ptn, lip, cho, fibras, micros[27], mc, compras, origem}, por 100 g/mL.
 *   `erro` = problema no arquivo todo (vazio, sem cabeçalho, faltando coluna obrigatória).
 */
export function importarAlimentosCsv(texto) {
  const vazio = { alimentos: [], rejeitados: [], colunas: { reconhecidas: {}, ignoradas: [] } };
  const linhas = lerCsv(texto ?? '');
  if (!linhas.length) return { ...vazio, erro: 'Arquivo vazio.' };
  const cab = linhas[0];
  const indice = {};
  const reconhecidas = {}, ignoradas = [];
  cab.forEach((c, i) => {
    const chave = MAPA_COLUNAS.get(normalizarColuna(c));
    if (chave && !(chave in indice)) { indice[chave] = i; reconhecidas[String(c).trim()] = chave.replace(/^micro:/, ''); }
    else if (String(c).trim()) ignoradas.push(String(c).trim());
  });
  const faltam = COLUNAS.filter((c) => c.obrigatoria && !(c.chave in indice)).map((c) => c.chave);
  if (faltam.length) {
    return { ...vazio, colunas: { reconhecidas, ignoradas }, erro: `Faltam colunas obrigatórias: ${faltam.join(', ')}. A primeira linha precisa ser o cabeçalho.` };
  }

  const alimentos = [], rejeitados = [];
  const vistos = new Map(); // nome normalizado → linha
  linhas.slice(1).forEach((l, k) => {
    const linha = k + 2;
    const cel = (chave) => (chave in indice ? String(l[indice[chave]] ?? '') : '');
    const erros = [];
    const nome = cel('nome').trim();
    if (!nome) erros.push('sem nome');

    const u = cel('unidade').trim().toLowerCase();
    let unidade = 'g';
    if (['ml', 'mililitro', 'mililitros', 'ml.'].includes(u)) unidade = 'ml';
    else if (u && !['g', 'gr', 'grama', 'gramas', 'g.'].includes(u)) erros.push(`unidade "${cel('unidade').trim()}" (use g ou ml)`);

    const num = (chave, rotulo, obrigatorio = false) => {
      const n = lerNumero(cel(chave));
      if (n.erro) { erros.push(`${rotulo}: ${n.erro}`); return 0; }
      if (obrigatorio && n.vazio) { erros.push(`${rotulo} vazio`); return 0; }
      return n.valor;
    };
    const kcal = num('kcal', 'kcal', true);
    const ptn = num('ptn', 'ptn');
    const lip = num('lip', 'lip');
    const cho = num('cho', 'cho');
    const fibras = num('fibras', 'fibras');
    const micros = CHAVES_MICROS.map((c) => (c === 'fibras' ? fibras : num(`micro:${c}`, c)));

    const med = lerMedidas(cel('medidas'));
    erros.push(...med.erros);

    if (nome && vistos.has(chaveNome(nome))) erros.push(`nome repetido na planilha (linha ${vistos.get(chaveNome(nome))})`);
    if (erros.length) {
      rejeitados.push({ linha, nome, erros });
      return;
    }
    vistos.set(chaveNome(nome), linha);
    alimentos.push({
      linha,
      alimento: {
        nome,
        unidade,
        kcal, ptn, lip, cho, fibras,
        micros,
        mc: med.mc,
        compras: cel('compras').trim(),
        origem: cel('origem').trim() || ORIGEM_PADRAO,
      },
    });
  });
  return { erro: null, alimentos, rejeitados, colunas: { reconhecidas, ignoradas } };
}

/**
 * Decide o que fazer com cada alimento lido diante dos já cadastrados (mesmo nome, sem diferenciar acento
 * e maiúsculas).
 * @param {{alimento:object}[]} lidos resultado de importarAlimentosCsv().alimentos
 * @param {{id:string, nome:string}[]} existentes
 * @param {{atualizar?: boolean}} [opcoes] atualizar = mesmo nome substitui os valores (mantém o id);
 *   senão o alimento é ignorado
 * @returns {{novos:object[], atualizados:{id:string, alimento:object}[], ignorados:object[]}}
 */
export function planejarImportacao(lidos, existentes = [], { atualizar = true } = {}) {
  const porNome = new Map(existentes.map((a) => [chaveNome(a.nome), a]));
  const novos = [], atualizados = [], ignorados = [];
  for (const { alimento } of lidos) {
    const ja = porNome.get(chaveNome(alimento.nome));
    if (!ja) novos.push(alimento);
    else if (atualizar) atualizados.push({ id: ja.id, alimento });
    else ignorados.push(alimento);
  }
  return { novos, atualizados, ignorados };
}

/** Número para o CSV: vírgula decimal (Excel em português), sem notação científica nos casos comuns. */
function numeroCsv(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return String(n).replace('.', ',');
}

const escCsv = (v) => {
  const s = String(v ?? '');
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Cabeçalho completo do CSV (exportação e modelo). */
export function cabecalhoCsv() {
  return ['nome', 'unidade', 'kcal', 'ptn', 'lip', 'cho', 'fibras', 'medidas', 'compras', 'origem', ...COLUNAS_MICROS];
}

/**
 * Gera o CSV de alimentos (todas as colunas), com ";" , vírgula decimal e BOM para abrir certo no Excel.
 * Importar o arquivo gerado devolve os mesmos alimentos.
 * @param {object[]} alimentos
 * @returns {string}
 */
export function exportarAlimentosCsv(alimentos = []) {
  const cab = cabecalhoCsv();
  const linha = (a) => [
    a.nome, a.unidade === 'ml' ? 'ml' : 'g',
    numeroCsv(a.kcal ?? 0), numeroCsv(a.ptn ?? 0), numeroCsv(a.lip ?? 0), numeroCsv(a.cho ?? 0), numeroCsv(a.fibras ?? 0),
    formatarMedidas(a.mc), a.compras ?? '', a.origem ?? '',
    ...COLUNAS_MICROS.map((c) => numeroCsv(a.micros?.[CHAVES_MICROS.indexOf(c)] ?? 0)),
  ].map(escCsv).join(';');
  return '﻿' + [cab.join(';'), ...alimentos.map(linha)].join('\r\n') + '\r\n';
}

/** Modelo para baixar: cabeçalho completo + 2 linhas de exemplo (valores fictícios, só para mostrar o formato). */
export function modeloCsv() {
  const exemplos = [
    { nome: 'Exemplo: cereal cozido', unidade: 'g', kcal: 130, ptn: 2.6, lip: 0.3, cho: 28, fibras: 1.5, mc: [{ nome_mc: 'Colher(es) de sopa cheia(s)', peso: 25 }, { nome_mc: 'Escumadeira(s)', peso: 90 }], compras: 'Cereal', origem: 'Minha tabela', micros: CHAVES_MICROS.map((c) => ({ fibras: 1.5, ca: 4, fe: 0.2, na: 1, k: 30 })[c] ?? 0) },
    { nome: 'Exemplo: bebida láctea', unidade: 'ml', kcal: 61, ptn: 3.2, lip: 3.3, cho: 4.6, fibras: 0, mc: [{ nome_mc: 'Copo(s) duplo(s)', peso: 240 }], compras: '', origem: 'Minha tabela', micros: CHAVES_MICROS.map((c) => ({ ca: 120, na: 50, k: 140 })[c] ?? 0) },
  ];
  return exportarAlimentosCsv(exemplos);
}
