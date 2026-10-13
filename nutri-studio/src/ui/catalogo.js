// Alimentos do consultório para as telas de receitas e planejamento: "Meus alimentos" + receitas salvas
// (que entram como alimento por 100 g, origem "Receita", com os ingredientes para a lista de compras),
// medidas caseiras e o seletor de alimento (campo com sugestões + medida + quantidade).
//
// O app não tem tabela de alimentos embutida (a base do WebDiet não foi copiada): os alimentos vêm do
// cadastro por rótulo e da importação de tabelas em CSV (página "Meus alimentos").
import { h, campo, selecao, avisar } from './dom.js';
import { check } from '../calc/numeros.js';

/** Valor do <select> de medida para "personalizada" (nome e peso digitados). */
export const MEDIDA_PERSONALIZADA = '__personalizada';

/** Chave única de um alimento do catálogo: "alimento:<id>" ou "receita:<id>". */
export const chaveAlimento = (a) => `${a?.tipo === 'receita' ? 'receita' : 'alimento'}:${a?.id ?? ''}`;

/** Número curto para tabelas: até `casas` casas, sem zeros à direita (ponto decimal, como no resto do app). */
export function num(v, casas = 2) {
  const n = check(v);
  return String(parseFloat(n.toFixed(casas)));
}

/** Medida da unidade do alimento: "grama(s)" ou "mililitro(s)" (sempre vale 1). */
export function medidaDaUnidade(alimento) {
  return alimento?.unidade === 'ml' ? 'mililitro(s)' : 'grama(s)';
}

/** Sigla da unidade ("g" ou "ml"). */
export const unidadeDe = (alimento) => (alimento?.unidade === 'ml' ? 'ml' : 'g');

/**
 * Medidas oferecidas para um alimento: as do cadastro (`mc`) e a da unidade (se não estiver no cadastro).
 * @param {object} alimento
 * @param {string|{nome_mc:string, peso:number}} [atual] medida em uso; objeto = personalizada (entra na lista)
 * @returns {{valor:string, rotulo:string, peso:number}[]}
 */
export function medidasDe(alimento, atual) {
  const u = unidadeDe(alimento);
  const lista = (alimento?.mc ?? [])
    .filter((m) => String(m?.nome_mc ?? '').trim())
    .map((m) => ({ valor: m.nome_mc, rotulo: `${m.nome_mc} (${num(m.peso, 1)} ${u})`, peso: check(m.peso) }));
  const unidade = medidaDaUnidade(alimento);
  if (!lista.some((m) => m.valor === unidade)) lista.push({ valor: unidade, rotulo: unidade, peso: 1 });
  if (atual && typeof atual === 'object') {
    lista.push({ valor: MEDIDA_PERSONALIZADA, rotulo: `${atual.nome_mc ?? atual.nome} (${num(atual.peso, 1)} ${u}, personalizada)`, peso: check(atual.peso) });
  }
  return lista;
}

/** Valor do <select> para a medida guardada (texto ou objeto personalizado). */
export const valorMedida = (medida) => (medida && typeof medida === 'object' ? MEDIDA_PERSONALIZADA : String(medida ?? ''));

/**
 * Cópia leve de um alimento para guardar em receitas e planos (o plano continua igual mesmo que o
 * alimento seja editado ou excluído depois). Receitas levam os ingredientes só com nome e nome de compra.
 * @param {object} a alimento ou receita do catálogo
 * @param {boolean} [completo] true = com nutrientes e medidas (padrão); false = só identificação
 */
export function instantaneo(a, completo = true, nivel = 0) {
  if (!a) return null;
  const receita = a.tipo === 'receita' || String(a.origem ?? '').toLowerCase() === 'receita';
  const base = {
    id: a.id ?? '',
    tipo: receita ? 'receita' : 'alimento',
    nome: a.nome ?? '',
    unidade: unidadeDe(a),
    origem: receita ? 'Receita' : a.origem ?? '',
    compras: a.compras ?? '',
  };
  if (receita && Array.isArray(a.ingredientes) && nivel < 5) {
    base.ingredientes = a.ingredientes.map((i) => ({ alimento: instantaneo(i?.alimento ?? i, false, nivel + 1) }));
  }
  if (!completo) return base;
  return {
    ...base,
    mc: (a.mc ?? []).map((m) => ({ nome_mc: m.nome_mc, peso: check(m.peso) })),
    kcal: check(a.kcal), ptn: check(a.ptn), lip: check(a.lip), cho: check(a.cho), fibras: check(a.fibras),
    micros: Array.from({ length: 27 }, (_, i) => check(a.micros?.[i])),
  };
}

/**
 * Catálogo de alimentos do consultório (alimentos + receitas), com uma <datalist> compartilhada pelos
 * seletores da página.
 * @param {object} db
 * @param {{id?:string, semReceitas?:boolean, excluir?:string}} [opcoes] `excluir` = chave a deixar de fora
 *        (a própria receita em edição)
 */
export function criarCatalogo(db, { id = 'catalogo-alimentos', semReceitas = false, excluir = null } = {}) {
  const datalist = h('datalist', { id });
  let itens = [];
  const porRotulo = new Map();
  const rotulos = new Map();

  function carregar() {
    const alimentos = db.listar('alimentos').map((a) => ({ ...a, tipo: 'alimento' }));
    const receitas = semReceitas ? [] : db.listar('receitas').map((r) => ({ ...r, tipo: 'receita', origem: 'Receita' }));
    itens = [...alimentos, ...receitas]
      .filter((a) => chaveAlimento(a) !== excluir)
      .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    porRotulo.clear();
    rotulos.clear();
    for (const a of itens) {
      const base = a.origem ? `${a.nome} · ${a.origem}` : String(a.nome);
      let r = base;
      for (let n = 2; porRotulo.has(r.toLowerCase()); n++) r = `${base} (${n})`;
      porRotulo.set(r.toLowerCase(), a);
      rotulos.set(chaveAlimento(a), r);
    }
    datalist.replaceChildren(...itens.map((a) => h('option', { value: rotulos.get(chaveAlimento(a)) })));
  }

  /** Alimento pelo texto digitado: rótulo exato (sem diferenciar maiúsculas) ou nome único. */
  function resolver(texto) {
    const t = String(texto ?? '').trim().toLowerCase();
    if (!t) return null;
    if (porRotulo.has(t)) return porRotulo.get(t);
    const pelos = itens.filter((a) => String(a.nome).trim().toLowerCase() === t);
    return pelos.length === 1 ? pelos[0] : null;
  }

  carregar();
  return {
    id,
    datalist,
    get itens() { return itens; },
    recarregar: carregar,
    resolver,
    rotulo: (a) => rotulos.get(chaveAlimento(a)) ?? a?.nome ?? '',
    obter: (chave) => itens.find((a) => chaveAlimento(a) === chave) ?? null,
  };
}

let seqSeletor = 0;

/**
 * Seletor de alimento: campo com sugestões (datalist do catálogo), medida caseira, quantidade e botão.
 * @param {ReturnType<typeof criarCatalogo>} catalogo
 * @param {{rotulo?:string, textoBotao?:string, quantidade?:number|string|((alimento:object)=>number|string),
 *          medidaPadrao?:(alimento:object)=>string|null,
 *          aoAdicionar:(alimento:object, quantidade:number, medida:string|{nome_mc:string, peso:number})=>void}} opcoes
 *   `quantidade` pode ser uma função do alimento escolhido (ex.: substituto equivalente em kcal);
 *   `medidaPadrao` escolhe a medida inicial (padrão: a primeira do cadastro).
 * @returns {{el:HTMLElement, focar:()=>void, limpar:()=>void}}
 */
export function criarSeletor(catalogo, { rotulo = 'Alimento', textoBotao = 'Adicionar', quantidade = 1, medidaPadrao = null, aoAdicionar }) {
  const n = ++seqSeletor;
  let escolhido = null;
  const entrada = h('input', {
    type: 'text', list: catalogo.id, autocomplete: 'off', spellcheck: 'false', name: `alimento-${n}`,
    placeholder: catalogo.itens.length ? 'Digite para buscar' : 'Nenhum alimento cadastrado',
  });
  const medida = h('select', { name: `medida-${n}`, disabled: true }, h('option', { value: '' }, 'Escolha o alimento'));
  const qtd = h('input', { name: `quantidade-${n}`, inputmode: 'decimal', autocomplete: 'off', value: typeof quantidade === 'function' ? '' : String(quantidade) });
  const nomePers = h('input', { name: `medida-nome-${n}`, autocomplete: 'off', placeholder: 'Ex.: Pegador(es)' });
  const pesoPers = h('input', { name: `medida-peso-${n}`, inputmode: 'decimal', autocomplete: 'off' });
  const camposPers = h('div', { class: 'campos compactos oculto' },
    campo('Nome da medida', nomePers),
    campo('Peso de 1 medida (g ou mL)', pesoPers));
  const botao = h('button', { type: 'button', class: 'botao secundario', disabled: true }, textoBotao);

  function escolher() {
    const a = catalogo.resolver(entrada.value);
    if (a === escolhido) return;
    escolhido = a;
    botao.disabled = !a;
    if (!a) {
      medida.replaceChildren(h('option', { value: '' }, 'Escolha o alimento'));
      medida.disabled = true;
      camposPers.classList.add('oculto');
      return;
    }
    const ops = medidasDe(a);
    const inicial = (medidaPadrao && medidaPadrao(a)) || ops[0]?.valor;
    medida.replaceChildren(...ops.map((o) => h('option', { value: o.valor, selected: o.valor === inicial ? true : null }, o.rotulo)),
      h('option', { value: MEDIDA_PERSONALIZADA }, 'Personalizada…'));
    medida.value = inicial;
    medida.disabled = false;
    camposPers.classList.add('oculto');
    if (typeof quantidade === 'function') qtd.value = String(quantidade(a, medida.value) ?? 1);
  }

  entrada.addEventListener('input', escolher);
  entrada.addEventListener('change', escolher);
  medida.addEventListener('change', () => {
    camposPers.classList.toggle('oculto', medida.value !== MEDIDA_PERSONALIZADA);
    if (typeof quantidade === 'function' && escolhido && medida.value !== MEDIDA_PERSONALIZADA) qtd.value = String(quantidade(escolhido, medida.value) ?? 1);
  });

  function adicionar() {
    escolher();
    if (!escolhido) { avisar('Escolha um alimento da lista de sugestões.'); entrada.focus(); return; }
    const q = check(qtd.value);
    if (!(q > 0)) { avisar('Informe a quantidade (maior que zero).'); qtd.focus(); return; }
    let m = medida.value;
    if (m === MEDIDA_PERSONALIZADA) {
      const nome = nomePers.value.trim();
      const peso = check(pesoPers.value);
      if (!nome || !(peso > 0)) { avisar('Informe o nome e o peso da medida personalizada.'); (nome ? pesoPers : nomePers).focus(); return; }
      m = { nome_mc: nome, peso };
    }
    aoAdicionar(escolhido, q, m);
    limpar();
    entrada.focus();
  }

  function limpar() {
    entrada.value = '';
    nomePers.value = '';
    pesoPers.value = '';
    if (typeof quantidade !== 'function') qtd.value = String(quantidade);
    escolher();
  }

  botao.addEventListener('click', adicionar);
  for (const el of [entrada, qtd, nomePers, pesoPers]) {
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } });
  }

  const el = h('div', { class: 'seletor-alimento pilha' },
    h('div', { class: 'seletor-linha' },
      h('div', { class: 'seletor-busca' }, campo(rotulo, entrada)),
      campo('Medida caseira', medida),
      h('div', { class: 'seletor-qtd' }, campo('Quantidade', qtd)),
      h('div', { class: 'seletor-botao' }, botao)),
    camposPers);
  return { el, focar: () => entrada.focus(), limpar };
}

/**
 * <select> de medida para uma linha já adicionada (ingrediente, item ou substituto).
 * @param {object} alimento
 * @param {string|object} atual
 * @param {string} rotuloAcessivel
 * @param {(medida:string|object)=>void} aoMudar recebe o nome da medida (ou o objeto personalizado atual)
 */
export function seletorMedidaLinha(alimento, atual, rotuloAcessivel, aoMudar) {
  const ops = medidasDe(alimento, atual);
  const sel = selecao({ 'aria-label': rotuloAcessivel, class: 'medida-linha' }, ops, valorMedida(atual));
  sel.addEventListener('change', () => aoMudar(sel.value === MEDIDA_PERSONALIZADA ? atual : sel.value));
  return sel;
}

/** Campo de quantidade para uma linha (dispara `aoMudar` a cada digitação e `aoConfirmar` ao sair do campo). */
export function campoQuantidadeLinha(valor, rotuloAcessivel, aoMudar, aoConfirmar) {
  const el = h('input', { class: 'qtd-linha', inputmode: 'decimal', autocomplete: 'off', 'aria-label': rotuloAcessivel, value: String(valor ?? '') });
  el.addEventListener('input', () => aoMudar(el.value));
  if (aoConfirmar) el.addEventListener('change', () => aoConfirmar(el.value));
  return el;
}
