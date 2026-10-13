// Aba "Planejamento" da ficha do paciente: planejamento alimentar (relatório §8).
// - Método por alimentos (calc/planejamento.js, §8.3): refeições com alimentos e substitutos, total de cada
//   refeição, total do dia, análise calórica, metas (modal do WebDiet; GET importável do cálculo energético), adequação e os 27
//   micronutrientes contra as DRIs do paciente (calc/dris.js, §8.10).
// - Método por equivalentes (calc/equivalentes.js, §8.5): porções dos 15 grupos por refeição, mais avulsos.
//   As listas de alimentos de cada grupo do WebDiet não foram copiadas (§1.2). Cada grupo usa a lista do
//   consultório, montada a partir de "Meus alimentos" (coleção "equivalentes"; cada alimento com a medida de
//   1 porção); sem lista própria, usa as médias padrão que o WebDiet mostra (dados/equivalentes_padrao.json),
//   e os totais saem iguais aos do WebDiet.
// - Lista de compras (calc/listaCompras.js, §8.8) e versão para impressão.
// Os alimentos vêm do catálogo do consultório (Meus alimentos + receitas, ui/catalogo.js); o plano guarda uma
// cópia de cada alimento, para não mudar se o cadastro for editado depois.
//
// Cada plano é um registro do tipo "planejamento":
// { data, nome, metodo: 'alimentos'|'equivalentes', metas, refeicoes, compras: [{nome, marcado}], resumo }.
import { h, campo, selecao, avisar } from '../dom.js';
import { registrarAba } from '../paginas/pacientes.js';
import { normalizarData } from '../importacao.js';
import { check, fx, fxn, hojeTexto } from '../../calc/numeros.js';
import {
  calcularPlanejamento, ajustarSubstitutos, medidaDoAlimento, nutrientesPorPeso, tabelaMicros, CORES,
} from '../../calc/planejamento.js';
import { GRUPOS, CAMPOS_GRUPO, calcularGrupos, calcularTotaisEquivalentes } from '../../calc/equivalentes.js';
import PADRAO_EQUIVALENTES from '../../dados/equivalentes_padrao.json' with { type: 'json' };
import {
  importarComprasAlimentos, importarComprasEquivalentes, montarListaComQuantidades, PERIODOS, PERIODO_PADRAO,
} from '../../calc/listaCompras.js';
import { referenciasMicros, NUTRIENTES, FONTES } from '../../calc/dris.js';
import { MICROS } from '../alimentosCsv.js';
import {
  criarCatalogo, criarSeletor, instantaneo, medidasDe, seletorMedidaLinha, campoQuantidadeLinha, num, unidadeDe,
} from '../catalogo.js';
import { criarPainel } from './painel-resultados.js';
import { porData, ultimoRegistro, textoNumero } from './comum.js';

const TIPO = 'planejamento';
const REFEICOES_PADRAO = ['Café da manhã', 'Almoço', 'Jantar']; // planejamento em branco do WebDiet (§8.3)
// Metas de um plano novo, como no WebDiet (plano sem metas salvas): "fórmula de bolso" (g/kg) com tudo 0.
const METAS_PADRAO = Object.freeze({ tipo: 'gkg', ptn: '0', lip: '0', cho: '0', get: '0', peso: '0' });
const TIPOS_META = [
  { valor: 'gkg', rotulo: 'Distribuir usando fórmula de bolso (g/Kg)' },
  { valor: 'percentual', rotulo: 'Distribuir usando percentual do GET' },
];

const estadoDaCor = (cor) => (cor === CORES.vermelho ? 'perigo' : cor === CORES.verde ? 'ok' : '');

/**
 * Metas no formato do modal do WebDiet: {tipo, ptn, lip, cho, get, peso}, os mesmos campos nos dois tipos.
 * Planos salvos por versões anteriores do app (CHO vazio; PTN/LIP/CHO em g/kg em campos à parte; CHO% e GET em
 * g/kg sempre calculados) são convertidos com os números que mostravam; os campos antigos ficam em
 * `formatoAntigo`.
 */
export function normalizarMetas(m = {}) {
  const t = (v) => (v === undefined || v === null || String(v).trim() === '' ? '0' : String(v));
  if (['ptnKg', 'lipKg', 'choKg'].some((k) => k in m) || m.cho === '') {
    const { ptnKg, lipKg, choKg, ...resto } = m;
    const formatoAntigo = { ...resto, ptnKg, lipKg, choKg };
    if (m.tipo === 'gkg') {
      const peso = check(m.peso);
      const get = check(ptnKg) * peso * 4 + check(lipKg) * peso * 9 + check(choKg) * peso * 4;
      return { tipo: 'gkg', ptn: t(ptnKg), lip: t(lipKg), cho: t(choKg), get: get > 0 ? String(get) : '-', peso: t(m.peso), formatoAntigo };
    }
    return { tipo: 'percentual', ptn: t(m.ptn), lip: t(m.lip), cho: String(check(100 - check(m.ptn) - check(m.lip))), get: t(m.get), peso: t(m.peso), formatoAntigo };
  }
  return { ...m, tipo: m.tipo === 'percentual' ? 'percentual' : 'gkg', ptn: t(m.ptn), lip: t(m.lip), cho: t(m.cho), get: t(m.get), peso: t(m.peso) };
}

/** Item de equivalentes (alimento + medida de 1 porção) → valores por porção, no formato de calc/equivalentes.js. */
export function porcaoEquivalente(item) {
  const al = item.alimento || {};
  const m = medidaDoAlimento(al, item.medida);
  const q = check(item.quantidade) || 1;
  const peso = fxn(q * m.peso, 1);
  const n = nutrientesPorPeso(al, peso);
  return {
    ...al, id: item.id, grupo: item.grupo, selecionado: item.selecionado !== false,
    quantidade: q, medida: m.nome, peso, ptn: n.ptn, lip: n.lip, cho: n.cho, kcal: n.kcal, fibras: n.fibras, micros: n.micros,
  };
}

function montar(raiz, { db, paciente: p }) {
  const area = h('div', { class: 'pilha' });
  raiz.append(h('div', { class: 'pilha', 'aria-live': 'off' }, area));
  const ordenados = () => porData(db.listarRegistros(p.id, TIPO));
  const gestanteAtiva = db.listarRegistros(p.id, 'gestacao').some((g) => !g.encerradoEm);
  const condicao = p.sexo === 'F' ? p.condicao || (gestanteAtiva ? 'gestante' : '') : '';

  // ---- Lista de planos ------------------------------------------------------------------------
  function lista() {
    const regs = ordenados();
    area.replaceChildren(
      h('div', { class: 'cabecalho-pagina' }, h('h2', {}, 'Planejamento alimentar'),
        h('div', { class: 'acoes' },
          h('button', { type: 'button', class: 'botao', onclick: () => editar(novoPlano('alimentos')) }, 'Novo plano por alimentos'),
          h('button', { type: 'button', class: 'botao secundario', onclick: () => editar(novoPlano('equivalentes')) }, 'Novo plano por equivalentes'))),
      h('div', { class: 'cartao pilha' },
        h('h3', { id: 'plan-historico' }, 'Planos salvos'),
        regs.length ? h('div', { class: 'tabela-rolagem' }, h('table', { class: 'medidas', 'aria-labelledby': 'plan-historico' },
          h('thead', {}, h('tr', {},
            h('th', { scope: 'col' }, 'Data'), h('th', { scope: 'col' }, 'Plano'), h('th', { scope: 'col' }, 'Método'),
            h('th', { scope: 'col', class: 'num' }, 'Energia'), h('th', { scope: 'col' }, h('span', { class: 'oculto-visual' }, 'Ações')))),
          h('tbody', {}, regs.map((r) => h('tr', {},
            h('th', { scope: 'row' }, r.data || '-'),
            h('td', {}, r.nome || '-'),
            h('td', {}, r.metodo === 'equivalentes' ? 'Equivalentes' : 'Alimentos'),
            h('td', { class: 'num' }, r.resumo?.kcal !== undefined ? `${r.resumo.kcal} kcal` : '-'),
            h('td', {}, h('div', { class: 'acoes', style: 'flex-wrap:nowrap' },
              h('button', { type: 'button', class: 'botao discreto', 'aria-label': `Abrir ${r.nome} de ${r.data}`, onclick: () => editar(structuredClone(r)) }, 'Abrir'),
              h('button', { type: 'button', class: 'botao discreto', 'aria-label': `Duplicar ${r.nome} de ${r.data}`, onclick: () => duplicar(r) }, 'Duplicar'),
              h('button', { type: 'button', class: 'botao discreto', 'aria-label': `Excluir ${r.nome} de ${r.data}`, onclick: () => excluir(r) }, 'Excluir'))))))))
          : h('p', { class: 'legenda' }, 'Nenhum plano salvo ainda.'),
        h('p', { class: 'legenda' }, 'Os alimentos vêm de "Meus alimentos" e das receitas salvas. O método qualitativo (texto livre) e o piloto automático do WebDiet não foram reproduzidos.')));
  }

  function novoPlano(metodo) {
    const base = { data: hojeTexto(), nome: 'Plano alimentar', metodo, metas: { ...METAS_PADRAO }, compras: [] };
    base.refeicoes = REFEICOES_PADRAO.map((nome) => (metodo === 'equivalentes'
      ? { nome, horario: '', calculada: true, obs: '', porcoes: {}, avulsos: [] }
      : { nome, horario: '', ativo: true, obs: '', itens: [] }));
    return base;
  }

  function duplicar(r) {
    const { id, criadoEm, atualizadoEm, ...resto } = structuredClone(r); // eslint-disable-line no-unused-vars
    editar({ ...resto, data: hojeTexto(), nome: `${r.nome || 'Plano'} (cópia)` });
    avisar('Cópia aberta: salve para guardar.');
  }

  function excluir(r) {
    if (!confirm(`Excluir o plano "${r.nome}" de ${r.data}? Esta ação não pode ser desfeita.`)) return;
    db.excluirRegistro(p.id, TIPO, r.id);
    avisar('Plano excluído.');
    lista();
  }

  // ---- Editor ---------------------------------------------------------------------------------
  /** Abre o editor. `estado.alterado` mantém o aviso de alterações não salvas ao voltar de outra tela. */
  function editar(plano, estado = {}) {
    const eq = plano.metodo === 'equivalentes';
    const catalogo = criarCatalogo(db, { id: `catalogo-plano-${p.id}` });
    let resultado = null;
    let alterado = !!estado.alterado;
    const painel = criarPainel();
    const legendaPainel = h('p', { class: 'legenda' });
    const corpoRefeicoes = h('div', { class: 'pilha' });
    const corpoMicros = h('div', { class: 'pilha' });
    const corpoGrupos = h('div', { class: 'pilha' });
    const corpoCompras = h('div', { class: 'pilha' });
    const linhas = new Map(); // chave "r.i" ou "r.i.s" → células calculadas
    const totaisRefeicao = new Map(); // índice → elemento do total
    const botaoSalvar = h('button', { class: 'botao', type: 'button', onclick: salvar }, plano.id ? 'Salvar alterações' : 'Salvar plano');

    const marcarAlterado = () => { alterado = true; };

    // Cabeçalho do plano
    const nomeEl = h('input', { value: plano.nome ?? '', autocomplete: 'off', 'aria-label': 'Nome do plano' });
    const dataEl = h('input', { value: plano.data ?? hojeTexto(), placeholder: 'dd/mm/aaaa', inputmode: 'numeric', autocomplete: 'off' });
    nomeEl.addEventListener('input', () => { plano.nome = nomeEl.value; marcarAlterado(); });
    dataEl.addEventListener('change', () => { const d = normalizarData(dataEl.value); if (d) { dataEl.value = d; plano.data = d; recalcular(); } marcarAlterado(); });

    // Metas: o modal "Cálculos" do WebDiet (calculoEnergetico, mudarCalculoRef, recalcularRef, importarCalculo2).
    plano.metas = normalizarMetas(plano.metas);
    const m = plano.metas;
    const camposMeta = {};
    const sinais = [];
    // `refaz`: o campo refaz CHO (%) ou GET (g/kg). No WebDiet só PTN, LIP e CHO refazem; aqui o peso também
    // (§12 #31, corrigido a pedido do usuário).
    const metaCampo = (chave, rotulo, { macro = false, refaz = macro } = {}) => {
      const el = h('input', { name: `meta-${chave}`, inputmode: 'decimal', autocomplete: 'off', value: m[chave] ?? '' });
      camposMeta[chave] = el;
      el.addEventListener('input', () => {
        m[chave] = el.value;
        if (refaz) recalcularRef();
        marcarAlterado();
        recalcular();
      });
      const sinal = macro ? h('span', { class: 'sinal-meta' }) : null;
      if (sinal) sinais.push(sinal);
      return campo(macro ? h('span', {}, `${rotulo} `, sinal) : rotulo, el);
    };
    /** Como recalcularRef(): no modo %, CHO = 100 − PTN − LIP; no g/kg, GET = PTN×P×4 + LIP×P×9 + CHO×P×4 ("-" se ≤ 0). */
    function recalcularRef() {
      if (m.tipo === 'percentual') {
        m.cho = String(check(100 - check(m.ptn) - check(m.lip)));
        camposMeta.cho.value = m.cho;
      } else {
        const peso = check(m.peso);
        const get = check(m.ptn) * peso * 4 + check(m.lip) * peso * 9 + check(m.cho) * peso * 4;
        m.get = get > 0 ? String(get) : '-';
        camposMeta.get.value = m.get;
      }
    }
    /** Como mudarCalculoRef(): trocar o tipo zera PTN, LIP, CHO e GET (o peso fica). */
    function mudarTipoMeta(tipo) {
      m.tipo = tipo;
      for (const c of ['ptn', 'lip', 'cho', 'get']) { m[c] = '0'; camposMeta[c].value = '0'; }
      mostrarTipoMeta();
    }
    const tipoMeta = selecao({ name: 'meta-tipo' }, TIPOS_META, m.tipo);
    tipoMeta.addEventListener('change', () => { mudarTipoMeta(tipoMeta.value); marcarAlterado(); recalcular(); });
    function mostrarTipoMeta() {
      tipoMeta.value = m.tipo;
      const pct = m.tipo === 'percentual';
      for (const s of sinais) s.textContent = pct ? '(% do GET)' : '(g/Kg corporal)';
      camposMeta.get.disabled = !pct; // no g/kg o GET é calculado
      camposMeta.cho.readOnly = pct; // no % o CHO é 100 − PTN − LIP (o WebDiet sobrescreve o que for digitado)
    }
    const ultimaEnergia = ultimoRegistro(db, p.id, 'energia');
    const botaoGet = ultimaEnergia?.resumo?.get
      ? h('button', { type: 'button', class: 'botao discreto', onclick: () => {
        // importarCalculo2(GET, peso): passa para "% do GET", zera os campos e preenche peso e GET.
        mudarTipoMeta('percentual');
        m.peso = ultimaEnergia.resumo.peso ? textoNumero(ultimaEnergia.resumo.peso, 2) : '0';
        m.get = String(ultimaEnergia.resumo.get);
        camposMeta.peso.value = m.peso;
        camposMeta.get.value = m.get;
        marcarAlterado();
        recalcular();
        avisar(`GET do cálculo de ${ultimaEnergia.data} importado: preencha PTN e LIP (% do GET).`);
      } }, `Usar o GET de ${ultimaEnergia.data} (${ultimaEnergia.resumo.get} kcal)`)
      : null;
    const cartaoMetas = h('div', { class: 'cartao pilha', role: 'group', 'aria-labelledby': 'plan-metas' },
      h('h3', { id: 'plan-metas' }, 'Metas'),
      h('div', { class: 'campos' }, campo('Distribuição', tipoMeta)),
      h('div', { class: 'campos compactos' },
        metaCampo('peso', 'Peso (kg)', { refaz: true }), metaCampo('ptn', 'PTN', { macro: true }), metaCampo('lip', 'LIP', { macro: true }),
        metaCampo('cho', 'CHO', { macro: true }), metaCampo('get', 'GET (kcal)')),
      h('p', { class: 'legenda' }, 'Como no WebDiet: trocar a distribuição zera as metas; em "% do GET" o CHO é 100 − PTN − LIP; em g/kg o GET é refeito ao digitar PTN, LIP ou CHO. Diferente do WebDiet: mudar o peso também refaz o GET (relatório §12, item 31).'),
      h('p', { class: 'legenda' }, ultimaEnergia ? `Último cálculo energético: ${ultimaEnergia.data} (${ultimaEnergia.protocolo}).` : 'Nenhum cálculo energético salvo: digite o GET ou faça o cálculo na aba Cálculo energético.'),
      botaoGet ? h('div', { class: 'acoes' }, botaoGet) : null);

    // ---- Refeições (método por alimentos) -----------------------------------------------------
    function qtdEquivalente(principal) {
      return (a, medidaValor) => {
        const kcal = principal?.kcal ?? 0;
        if (!(kcal > 0) || !(check(a.kcal) > 0)) return 1;
        const pm = medidasDe(a).find((x) => x.valor === medidaValor)?.peso || 1;
        const peso = (kcal / check(a.kcal)) * 100;
        return pm > 0 ? fxn(peso / pm, 1) || 1 : 1;
      };
    }

    function celulasCalculadas(chave) {
      const c = { peso: h('td', { class: 'num' }), ptn: h('td', { class: 'num' }), lip: h('td', { class: 'num' }), cho: h('td', { class: 'num' }), kcal: h('td', { class: 'num' }) };
      linhas.set(chave, c);
      return [c.peso, c.ptn, c.lip, c.cho, c.kcal];
    }

    function linhaAlimento(r, ri, it, ii) {
      const rotulo = it.alimento.nome;
      const qtd = campoQuantidadeLinha(it.quantidade, `Quantidade de ${rotulo}`, (v) => { it.quantidade = v; marcarAlterado(); recalcular(); }, () => confirmarSubstitutos(it, ri, ii));
      const med = seletorMedidaLinha(it.alimento, it.medida, `Medida de ${rotulo}`, (v) => { const antes = pesoLinha(ri, ii); it.medida = v; marcarAlterado(); recalcular(); perguntarAjuste(it, antes, pesoLinha(ri, ii)); desenharRefeicoes(); });
      const nSubs = it.subs?.length || 0;
      const linha = h('tr', {},
        h('th', { scope: 'row' }, rotulo, it.alimento.origem ? h('div', {}, h('small', {}, it.alimento.origem)) : null),
        h('td', { class: 'num' }, qtd), h('td', {}, med),
        ...celulasCalculadas(`${ri}.${ii}`),
        h('td', {}, h('div', { class: 'acoes', style: 'flex-wrap:nowrap' },
          h('button', { type: 'button', class: 'botao discreto', 'aria-expanded': it.abrirSubs ? 'true' : 'false', 'aria-label': `Substitutos de ${rotulo} (${nSubs})`, onclick: () => { it.abrirSubs = !it.abrirSubs; desenharRefeicoes(); } }, `Subst. (${nSubs})`),
          h('button', { type: 'button', class: 'botao discreto', 'aria-label': `Remover ${rotulo}`, onclick: () => { r.itens.splice(ii, 1); marcarAlterado(); desenharRefeicoes(); } }, 'Remover'))));
      if (!it.abrirSubs) return [linha];
      const subs = (it.subs ||= []);
      const linhasSubs = subs.map((s, si) => {
        const nome = s.alimento.nome;
        return h('tr', { class: 'linha-substituto' },
          h('th', { scope: 'row' }, h('small', {}, 'ou '), nome),
          h('td', { class: 'num' }, campoQuantidadeLinha(s.quantidade, `Quantidade do substituto ${nome}`, (v) => { s.quantidade = v; marcarAlterado(); recalcular(); })),
          h('td', {}, seletorMedidaLinha(s.alimento, s.medida, `Medida do substituto ${nome}`, (v) => { s.medida = v; marcarAlterado(); desenharRefeicoes(); })),
          ...celulasCalculadas(`${ri}.${ii}.${si}`),
          h('td', {}, h('button', { type: 'button', class: 'botao discreto', 'aria-label': `Remover o substituto ${nome}`, onclick: () => { subs.splice(si, 1); marcarAlterado(); desenharRefeicoes(); } }, 'Remover')));
      });
      const principalCalc = () => resultado?.refeicoes?.[ri]?.linhas?.[ii];
      const seletor = criarSeletor(catalogo, {
        rotulo: `Substituto de ${rotulo}`, textoBotao: 'Adicionar substituto',
        quantidade: (a, medidaValor) => qtdEquivalente(principalCalc())(a, medidaValor),
        aoAdicionar: (a, q, med) => { subs.push({ alimento: instantaneo(a), quantidade: q, medida: med }); marcarAlterado(); desenharRefeicoes(); },
      });
      return [linha, ...linhasSubs, h('tr', { class: 'linha-substituto' }, h('td', { colspan: 9 }, seletor.el,
        h('p', { class: 'legenda' }, 'A quantidade sugerida tem a mesma energia do alimento principal.')))];
    }

    function pesoLinha(ri, ii) {
      return resultado?.refeicoes?.[ri]?.linhas?.[ii]?.peso ?? null;
    }

    /** Ao mudar o peso do principal, o WebDiet pergunta se ajusta os substitutos na mesma proporção (§8.3). */
    function perguntarAjuste(it, antes, depois) {
      if (!it.subs?.length || !(antes > 0) || !(depois > 0) || antes === depois) return;
      if (!confirm(`O peso de ${it.alimento.nome} mudou de ${antes} para ${depois} ${unidadeDe(it.alimento)}. Ajustar os substitutos na mesma proporção?`)) return;
      const r = ajustarSubstitutos(it.subs.map((s) => ({ ...s, peso: 0 })), antes, depois);
      it.subs.forEach((s, i) => { s.quantidade = r.substitutos[i].quantidade; });
      recalcular();
    }

    const pesoAntesDeDigitar = new Map(); // peso de cada linha antes da digitação (ajuste dos substitutos)
    function confirmarSubstitutos(it, ri, ii) {
      const chave = `${ri}.${ii}`;
      const antes = pesoAntesDeDigitar.get(chave);
      pesoAntesDeDigitar.delete(chave);
      perguntarAjuste(it, antes, pesoLinha(ri, ii));
      if (it.abrirSubs) desenharRefeicoes();
    }

    function cartaoRefeicaoAlimentos(r, ri) {
      const ativo = h('input', { type: 'checkbox', checked: r.ativo !== false });
      ativo.addEventListener('change', () => { r.ativo = ativo.checked; marcarAlterado(); recalcular(); });
      const total = h('p', { class: 'total-refeicao' });
      totaisRefeicao.set(ri, total);
      const seletor = criarSeletor(catalogo, {
        rotulo: 'Adicionar alimento',
        aoAdicionar: (a, q, med) => { r.itens.push({ alimento: instantaneo(a), quantidade: q, medida: med, subs: [] }); marcarAlterado(); desenharRefeicoes(); },
      });
      const tabela = r.itens.length
        ? h('div', { class: 'tabela-rolagem' }, h('table', { class: 'medidas tabela-plano' },
          h('caption', { class: 'oculto-visual' }, `Alimentos de ${r.nome}`),
          h('thead', {}, h('tr', {}, ['Alimento', 'Qtd.', 'Medida', 'Peso', 'PTN', 'LIP', 'CHO', 'kcal'].map((t, i) => h('th', { scope: 'col', class: i === 1 || i >= 3 ? 'num' : null }, t)),
            h('th', { scope: 'col' }, h('span', { class: 'oculto-visual' }, 'Ações')))),
          h('tbody', {}, r.itens.flatMap((it, ii) => linhaAlimento(r, ri, it, ii)))))
        : h('p', { class: 'legenda' }, catalogo.itens.length ? 'Nenhum alimento nesta refeição.' : 'Cadastre alimentos em "Meus alimentos" para montar o plano.');
      return cartaoRefeicao(r, ri, [h('label', { class: 'opcao' }, ativo, ' Entra no cálculo do dia')], tabela, total, seletor.el);
    }

    // ---- Refeições (método por equivalentes) --------------------------------------------------
    function cartaoRefeicaoEquivalentes(r, ri) {
      const calculada = h('input', { type: 'checkbox', checked: r.calculada !== false });
      calculada.addEventListener('change', () => { r.calculada = calculada.checked; marcarAlterado(); recalcular(); });
      r.porcoes ||= {};
      r.avulsos ||= [];
      const total = h('p', { class: 'total-refeicao' });
      totaisRefeicao.set(ri, total);
      const porcoes = h('div', { class: 'campos compactos grade-porcoes' }, GRUPOS.map((g) => {
        const el = h('input', { inputmode: 'decimal', autocomplete: 'off', value: r.porcoes[g.id] ?? '', 'aria-label': `Porções de ${g.nome} em ${r.nome}` });
        el.addEventListener('input', () => { r.porcoes[g.id] = el.value; marcarAlterado(); recalcular(); });
        return h('label', { class: 'campo' }, h('span', {}, `${g.id.slice(1)}. ${g.nome}`), el);
      }));
      const avulsos = r.avulsos.length ? h('div', { class: 'tabela-rolagem' }, h('table', { class: 'medidas tabela-plano' },
        h('caption', { class: 'legenda', style: 'text-align:left' }, 'Avulsos (fora dos grupos, por 100 g)'),
        h('thead', {}, h('tr', {}, ['Alimento', 'Qtd.', 'Medida', 'Peso', 'PTN', 'LIP', 'CHO', 'kcal'].map((t, i) => h('th', { scope: 'col', class: i === 1 || i >= 3 ? 'num' : null }, t)),
          h('th', { scope: 'col' }, h('span', { class: 'oculto-visual' }, 'Ações')))),
        h('tbody', {}, r.avulsos.map((a, ai) => h('tr', {},
          h('th', { scope: 'row' }, a.alimento.nome),
          h('td', { class: 'num' }, campoQuantidadeLinha(a.quantidade, `Quantidade de ${a.alimento.nome}`, (v) => { a.quantidade = v; marcarAlterado(); recalcular(); })),
          h('td', {}, seletorMedidaLinha(a.alimento, a.medida, `Medida de ${a.alimento.nome}`, (v) => { a.medida = v; marcarAlterado(); recalcular(); })),
          ...celulasCalculadas(`${ri}.a${ai}`),
          h('td', {}, h('button', { type: 'button', class: 'botao discreto', 'aria-label': `Remover ${a.alimento.nome}`, onclick: () => { r.avulsos.splice(ai, 1); marcarAlterado(); desenharRefeicoes(); } }, 'Remover'))))))) : null;
      const seletor = criarSeletor(catalogo, {
        rotulo: 'Adicionar avulso',
        aoAdicionar: (a, q, med) => { r.avulsos.push({ alimento: instantaneo(a), quantidade: q, medida: med }); marcarAlterado(); desenharRefeicoes(); },
      });
      return cartaoRefeicao(r, ri, [h('label', { class: 'opcao' }, calculada, ' Refeição calculada (entra no total)')],
        h('div', { class: 'pilha' }, h('h4', { class: 'titulo-grupo' }, 'Porções por grupo'), porcoes), total, avulsos, seletor.el);
    }

    /** Moldura comum das refeições: nome, horário, mover, remover, observações. */
    function cartaoRefeicao(r, ri, opcoes, ...conteudo) {
      const nome = h('input', { value: r.nome ?? '', autocomplete: 'off', 'aria-label': `Nome da refeição ${ri + 1}` });
      nome.addEventListener('input', () => { r.nome = nome.value; marcarAlterado(); });
      const horario = h('input', { value: r.horario ?? '', autocomplete: 'off', placeholder: 'hh:mm', inputmode: 'numeric', 'aria-label': `Horário de ${r.nome}` });
      horario.addEventListener('input', () => { r.horario = horario.value; marcarAlterado(); });
      const obs = h('textarea', { rows: 2, 'aria-label': `Observações de ${r.nome}` }, r.obs ?? '');
      obs.addEventListener('input', () => { r.obs = obs.value; marcarAlterado(); });
      const mover = (d) => { const j = ri + d; if (j < 0 || j >= plano.refeicoes.length) return; [plano.refeicoes[ri], plano.refeicoes[j]] = [plano.refeicoes[j], plano.refeicoes[ri]]; marcarAlterado(); desenharRefeicoes(); };
      return h('section', { class: 'cartao pilha refeicao', 'aria-label': r.nome || `Refeição ${ri + 1}` },
        h('div', { class: 'cabecalho-refeicao' },
          h('div', { class: 'campos' }, campo('Refeição', nome), campo('Horário', horario)),
          h('div', { class: 'acoes' },
            h('button', { type: 'button', class: 'botao discreto', disabled: ri === 0 ? true : null, 'aria-label': `Subir ${r.nome}`, onclick: () => mover(-1) }, '↑'),
            h('button', { type: 'button', class: 'botao discreto', disabled: ri === plano.refeicoes.length - 1 ? true : null, 'aria-label': `Descer ${r.nome}`, onclick: () => mover(1) }, '↓'),
            h('button', { type: 'button', class: 'botao discreto', 'aria-label': `Remover a refeição ${r.nome}`, onclick: () => {
              if ((r.itens?.length || r.avulsos?.length || Object.values(r.porcoes || {}).some((x) => check(x) > 0)) && !confirm(`Remover a refeição "${r.nome}" e tudo o que ela tem?`)) return;
              plano.refeicoes.splice(ri, 1); marcarAlterado(); desenharRefeicoes();
            } }, 'Remover'))),
        ...opcoes, ...conteudo.filter(Boolean),
        campo('Observações', obs));
    }

    // Redesenho adiado e sem reentrada: tirar da página o campo com foco dispara blur/change, que pediria
    // outro redesenho no meio deste.
    let redesenhando = false;
    let redesenhoPendente = false;
    function desenharRefeicoes() {
      if (redesenhando) { redesenhoPendente = true; return; }
      redesenhando = true;
      try {
        desenharRefeicoesAgora();
      } finally {
        redesenhando = false;
      }
      if (redesenhoPendente) { redesenhoPendente = false; queueMicrotask(desenharRefeicoes); }
    }

    function desenharRefeicoesAgora() {
      linhas.clear();
      pesoAntesDeDigitar.clear();
      totaisRefeicao.clear();
      catalogo.recarregar();
      corpoRefeicoes.replaceChildren(
        ...plano.refeicoes.map((r, ri) => (eq ? cartaoRefeicaoEquivalentes(r, ri) : cartaoRefeicaoAlimentos(r, ri))),
        h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'botao secundario', onclick: () => {
          plano.refeicoes.push(eq ? { nome: 'Nova refeição', horario: '', calculada: true, obs: '', porcoes: {}, avulsos: [] } : { nome: 'Nova refeição', horario: '', ativo: true, obs: '', itens: [] });
          marcarAlterado(); desenharRefeicoes();
        } }, 'Adicionar refeição')));
      recalcular();
    }

    // ---- Grupos de equivalentes (lista do consultório) ----------------------------------------
    const itensEquivalentes = () => db.listar('equivalentes');
    let grupos = null; // resultado de calcularGrupos

    function calcularGruposAtuais() {
      const erros = [];
      const porcoes = itensEquivalentes().flatMap((it) => {
        try { return [porcaoEquivalente(it)]; } catch (e) { erros.push(`${it.alimento?.nome}: ${e.message}`); return []; }
      });
      grupos = calcularGrupos(porcoes);
      // Grupo sem alimentos do consultório: médias padrão do WebDiet (só macronutrientes foram registrados).
      grupos.padrao = {};
      for (const { id } of GRUPOS) {
        if (grupos.n[id]) continue;
        grupos.padrao[id] = true;
        grupos.macrosGrupo[id] = PADRAO_EQUIVALENTES.macrosGrupo[id].slice();
        grupos.macros_desvp[id] = PADRAO_EQUIVALENTES.macros_desvp[id].slice();
        grupos.tela[id] = grupos.macros_desvp[id].map((d, j) => `± ${fx(d, CAMPOS_GRUPO[j] === 'kcal' ? 0 : 1)}`);
      }
      return { porcoes, erros };
    }

    function desenharGrupos() {
      const { erros } = calcularGruposAtuais();
      const comPadrao = GRUPOS.filter((g) => grupos.padrao[g.id]).length;
      corpoGrupos.replaceChildren(
        h('div', { class: 'tabela-rolagem' }, h('table', { class: 'medidas' },
          h('caption', { class: 'oculto-visual' }, 'Média por porção de cada grupo'),
          h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Grupo'), h('th', { scope: 'col', class: 'num' }, 'Alimentos'),
            ...CAMPOS_GRUPO.map((c) => h('th', { scope: 'col', class: 'num' }, c === 'kcal' ? 'kcal' : c.toUpperCase())))),
          h('tbody', {}, GRUPOS.map((g) => h('tr', {},
            h('th', { scope: 'row' }, `${g.id.slice(1)}. ${g.nome}`),
            h('td', { class: 'num' }, grupos.padrao[g.id] ? h('span', {}, 'padrão', h('div', {}, h('small', {}, `WebDiet, ${PADRAO_EQUIVALENTES.n[g.id]}`))) : String(grupos.n[g.id])),
            ...grupos.macrosGrupo[g.id].map((v, j) => h('td', { class: 'num' }, String(v), h('div', {}, h('small', {}, grupos.tela[g.id][j]))))))))),
        h('p', { class: 'legenda' }, 'Média simples dos alimentos selecionados de cada grupo (valores de 1 porção com 1 casa), ± desvio-padrão.' +
          (comPadrao ? ` ${comPadrao === GRUPOS.length ? 'Todos os grupos usam' : `${comPadrao} grupo(s) usam`} as médias padrão do WebDiet (relatório §8.5), com os mesmos totais do WebDiet. Ao montar a lista do consultório para um grupo, ele passa a usar a média dessa lista.` : '')),
        erros.length ? h('ul', { class: 'lista-avisos' }, erros.map((e) => h('li', { class: 'aviso' }, e))) : null,
        h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'botao secundario', onclick: editarGrupos }, 'Editar os alimentos dos grupos')));
    }

    function editarGrupos() {
      const corpo = h('div', { class: 'pilha' });
      let grupoAtual = GRUPOS[0].id;
      const escolhaGrupo = selecao({ 'aria-label': 'Grupo' }, GRUPOS.map((g) => ({ valor: g.id, rotulo: `${g.id.slice(1)}. ${g.nome}` })), grupoAtual);
      escolhaGrupo.addEventListener('change', () => { grupoAtual = escolhaGrupo.value; desenhar(); });
      const cat = criarCatalogo(db, { id: 'catalogo-equivalentes', semReceitas: false });
      function desenhar() {
        const doGrupo = itensEquivalentes().filter((it) => it.grupo === grupoAtual).sort((a, b) => String(a.alimento?.nome).localeCompare(String(b.alimento?.nome), 'pt-BR'));
        const seletor = criarSeletor(cat, {
          rotulo: 'Alimento', textoBotao: 'Adicionar ao grupo',
          aoAdicionar: (a, q, med) => { db.salvar('equivalentes', { grupo: grupoAtual, alimento: instantaneo(a), quantidade: q, medida: med, selecionado: true }); desenhar(); },
        });
        corpo.replaceChildren(
          doGrupo.length ? h('div', { class: 'tabela-rolagem' }, h('table', { class: 'medidas' },
            h('caption', { class: 'oculto-visual' }, 'Alimentos do grupo e a porção'),
            h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Usar'), h('th', { scope: 'col' }, 'Alimento'), h('th', { scope: 'col' }, '1 porção'),
              h('th', { scope: 'col', class: 'num' }, 'kcal'), h('th', { scope: 'col' }, h('span', { class: 'oculto-visual' }, 'Ações')))),
            h('tbody', {}, doGrupo.map((it) => {
              let porcao = null;
              try { porcao = porcaoEquivalente(it); } catch { /* medida inválida: mostra traço */ }
              const usar = h('input', { type: 'checkbox', checked: it.selecionado !== false, 'aria-label': `Usar ${it.alimento?.nome} na média` });
              usar.addEventListener('change', () => { db.salvar('equivalentes', { ...it, selecionado: usar.checked }); });
              return h('tr', {},
                h('td', {}, usar),
                h('th', { scope: 'row' }, it.alimento?.nome ?? '-'),
                h('td', {}, porcao ? `${num(porcao.quantidade, 2)} ${porcao.medida} (${num(porcao.peso, 1)} ${unidadeDe(it.alimento)})` : '-'),
                h('td', { class: 'num' }, porcao ? fx(porcao.kcal, 0) : '-'),
                h('td', {}, h('button', { type: 'button', class: 'botao discreto', 'aria-label': `Tirar ${it.alimento?.nome} do grupo`, onclick: () => { db.excluir('equivalentes', it.id); desenhar(); } }, 'Tirar')));
            })))) : h('p', { class: 'legenda' }, 'Nenhum alimento neste grupo.'),
          seletor.el,
          h('p', { class: 'legenda' }, 'Escolha a medida e a quantidade que formam 1 porção (ex.: arroz, 2 colheres de sopa cheias). A lista vale para todos os pacientes.'));
      }
      area.replaceChildren(
        cat.datalist,
        h('div', { class: 'cabecalho-pagina' }, h('h2', {}, 'Alimentos dos grupos de equivalentes'),
          h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'botao', onclick: () => editar(plano, { alterado }) }, 'Voltar ao plano'))),
        h('div', { class: 'cartao pilha' }, campo('Grupo', escolhaGrupo), corpo));
      desenhar();
    }

    // ---- Cálculo ------------------------------------------------------------------------------
    const metasCalculo = () => ({ tipo: m.tipo, ptn: m.ptn, lip: m.lip, cho: m.cho, get: m.get, peso: m.peso });

    function referencias() {
      return referenciasMicros({ sexo: p.sexo, ...(p.nascimento ? { nascimento: p.nascimento } : {}), dataReferencia: normalizarData(dataEl.value) || hojeTexto(), condicao });
    }

    function calcularAlimentos(refs) {
      const entrada = {
        refeicoes: plano.refeicoes.map((r) => ({ nome: r.nome, ativo: r.ativo !== false, itens: r.itens.map((it) => ({ alimento: it.alimento, quantidade: it.quantidade, medida: it.medida })) })),
        metas: metasCalculo(),
        referencias: refs.valores ? refs : null,
      };
      // Adequação do gN com o prescrito atual: o WebDiet usa o do cálculo anterior (§12 #30, corrigido a pedido do usuário).
      const res = calcularPlanejamento(entrada);
      // Substitutos: só exibição (não entram no total, como no WebDiet).
      res.substitutos = plano.refeicoes.map((r) => r.itens.map((it) => (it.subs || []).map((s) => {
        const c = calcularPlanejamento({ refeicoes: [{ itens: [{ alimento: s.alimento, quantidade: s.quantidade, medida: s.medida }] }] });
        return c.refeicoes[0].linhas[0];
      })));
      return res;
    }

    function calcularEquivalentes(refs) {
      if (!grupos) calcularGruposAtuais();
      const r = calcularTotaisEquivalentes({
        refeicoes: plano.refeicoes.map((x) => ({ porcoes: x.porcoes, calculada: x.calculada !== false, avulsos: (x.avulsos || []).map((a) => ({ alimento: a.alimento, quantidade: a.quantidade, medida: a.medida })) })),
        macrosGrupo: grupos.macrosGrupo, microsGrupo: grupos.microsGrupo, referencias: refs.valores ? refs : null,
        metas: metasCalculo(),
      });
      // Por refeição (exibição): porções × média de cada grupo + avulsos.
      r.porRefeicao = plano.refeicoes.map((x) => {
        const t = [0, 0, 0, 0, 0];
        for (const g of GRUPOS) { const por = check(x.porcoes?.[g.id]); grupos.macrosGrupo[g.id].forEach((v, j) => { t[j] += por * v; }); }
        const avulsos = (x.avulsos || []).map((a) => calcularPlanejamento({ refeicoes: [{ itens: [{ alimento: a.alimento, quantidade: a.quantidade, medida: a.medida }] }] }).refeicoes[0].linhas[0]);
        for (const l of avulsos) { t[0] += fxn(l.ptn, 1); t[1] += fxn(l.lip, 1); t[2] += fxn(l.cho, 1); t[3] += fxn(l.kcal, 1); t[4] += fxn(l.fibras, 1); }
        return { total: t, avulsos };
      });
      r.micros = r.tabelaMicros || tabelaMicros(new Array(27).fill(0), refs.valores ? refs : null);
      return r;
    }

    function recalcular() {
      const refs = referencias();
      const avisos = [];
      try {
        resultado = eq ? calcularEquivalentes(refs) : calcularAlimentos(refs);
      } catch (e) {
        console.error(e);
        resultado = null;
        avisos.push('Não foi possível calcular: ' + e.message);
      }
      if (resultado) {
        preencherLinhas();
        preencherTotaisRefeicao();
      }
      if (!(check(m.get) > 0)) avisos.push('Metas zeradas (como num plano novo do WebDiet): preencha as metas ou use o GET do cálculo energético.');
      if (refs.aviso) avisos.push(`Micronutrientes: ${refs.aviso}.`);
      painel.atualizar({ ...(resultado ? itensPainel(resultado) : { destaques: [], grupos: [] }), avisos });
      legendaPainel.textContent = eq ? 'Total do dia: só as refeições calculadas.' : 'Total do dia: só as refeições que entram no cálculo. Substitutos não somam.';
      desenharMicros(refs);
    }

    function preencherLinhas() {
      // Textos da linha como na tela do WebDiet ("120g", "3.0g", "33.7 g", "154 Kcal").
      const pc = (c, l) => {
        c.peso.textContent = l.tela.peso;
        c.ptn.textContent = l.tela.ptn; c.lip.textContent = l.tela.lip; c.cho.textContent = l.tela.cho;
        c.kcal.textContent = l.tela.kcal;
      };
      if (eq) {
        resultado.porRefeicao.forEach((r, ri) => r.avulsos.forEach((l, ai) => { const c = linhas.get(`${ri}.a${ai}`); if (c) pc(c, l); }));
        return;
      }
      resultado.refeicoes.forEach((r, ri) => r.linhas.forEach((l, ii) => {
        const c = linhas.get(`${ri}.${ii}`);
        if (c) { pc(c, l); if (!pesoAntesDeDigitar.has(`${ri}.${ii}`)) pesoAntesDeDigitar.set(`${ri}.${ii}`, l.peso); }
        (resultado.substitutos[ri]?.[ii] || []).forEach((s, si) => { const cs = linhas.get(`${ri}.${ii}.${si}`); if (cs) pc(cs, s); });
      }));
    }

    function preencherTotaisRefeicao() {
      for (const [ri, el] of totaisRefeicao) {
        if (eq) {
          const t = resultado.porRefeicao[ri]?.total;
          if (!t) continue;
          const calc = plano.refeicoes[ri].calculada !== false;
          el.textContent = `Total da refeição: PTN ${fx(t[0], 1)} g · LIP ${fx(t[1], 1)} g · CHO ${fx(t[2], 1)} g · ${fx(t[3], 0)} kcal · fibras ${fx(t[4], 1)} g${calc ? '' : ' (não calculada)'}`;
          continue;
        }
        const r = resultado.refeicoes[ri];
        if (!r) continue;
        const t = r.tela;
        el.replaceChildren(
          h('span', {}, `Total: ${t.peso} · PTN ${t.ptn} · LIP ${t.lip} · CHO ${t.cho} · ${t.kcal}`),
          h('br'),
          h('small', {}, r.linhas.length ? `${t.gptn} · ${t.glip} · ${t.gcho}. ${t.classe}, ${t.dens} Kcal/g.` : ''),
          ...(r.ativo ? [] : [h('small', {}, ' Não entra no cálculo do dia.')]));
      }
    }

    function itensPainel(res) {
      const t = eq ? res.tela : res.total.tela;
      const a = res.adequacao;
      const mt = res.metas;
      const adequacaoItem = (chave, rotulo, planejada, telaChave) => ({
        chave: `a-${chave}`, rotulo, valor: a ? a.tela[telaChave] : '-',
        detalhe: a ? `planejado ${planejada}${a[chave].percentual !== null ? ` · ${a[chave].percentual}%` : ''}` : '',
        estado: a ? estadoDaCor(a[chave].cor) : '', estadoValor: a ? estadoDaCor(a[chave].cor) : '',
      });
      const grupos = [
        { titulo: 'Prescrito (total do dia)', itens: [
          { chave: 'ptn', rotulo: 'Proteínas', valor: t.ptnPrescrita },
          { chave: 'lip', rotulo: 'Lipídios', valor: t.lipPrescrita },
          { chave: 'cho', rotulo: 'Carboidratos', valor: t.choPrescrita },
          { chave: 'choDisp', rotulo: 'CHO disponível', valor: t.choDisponivelPrescrita },
          { chave: 'fibras', rotulo: 'Fibras', valor: t.fibrasPrescrita },
          ...(eq ? [] : [{ chave: 'dens', rotulo: 'Densidade', valor: t.densidadePrescrita }]),
          { chave: 'gN', rotulo: 'kcal não proteica/g N', valor: t.gNPrescrita },
        ] },
        { titulo: 'Análise calórica', itens: [
          { chave: 'kPtn', rotulo: 'Proteínas', valor: t.ptnTotalanalise },
          { chave: 'kLip', rotulo: 'Lipídios', valor: t.lipTotalanalise },
          { chave: 'kCho', rotulo: 'Carboidratos', valor: t.choTotalanalise },
        ] },
      ];
      if (mt) {
        grupos.push({ titulo: 'Adequação (prescrito − planejado)', itens: [
          adequacaoItem('kcal', 'Energia', mt.tela.kcalPlanejada, 'kcalAdequacao'),
          adequacaoItem('ptn', 'Proteínas', mt.tela.ptnPlanejada, 'ptnAdequacao'),
          adequacaoItem('lip', 'Lipídios', mt.tela.lipPlanejada, 'lipAdequacao'),
          adequacaoItem('cho', 'Carboidratos', mt.tela.choPlanejada, 'choAdequacao'),
          adequacaoItem('gN', 'kcal não proteica/g N', mt.tela.gNPlanejada, 'gNAdequacao'),
        ] });
      }
      return {
        destaques: [
          { chave: 'kcal', rotulo: 'Energia do plano', valor: t.kcalPrescrita },
          { chave: 'meta', rotulo: 'Meta', valor: mt ? mt.tela.kcalPlanejada : '-', detalhe: a && a.kcal.percentual !== null ? `${a.kcal.percentual}% da meta` : '', estado: a ? estadoDaCor(a.kcal.cor) : '' },
        ],
        grupos,
      };
    }

    // ---- Micronutrientes ----------------------------------------------------------------------
    function desenharMicros(refs) {
      if (!resultado) { corpoMicros.replaceChildren(); return; }
      const fonte = refs.fonte === FONTES.webdiet ? 'valores conferidos na tela do WebDiet' : refs.fonte === FONTES.nasem ? 'tabelas oficiais das DRIs (NASEM)' : '';
      const linhasMicros = resultado.micros.map((x, i) => {
        const nut = NUTRIENTES[i];
        const unidade = MICROS[i]?.unidadeValor || '';
        const barra = x.barra === null ? null : h('span', { class: 'barra', 'aria-hidden': 'true' }, h('span', { style: `width:${(x.barra / 2).toFixed(1)}%` }));
        return h('tr', {},
          h('th', { scope: 'row' }, nut.nome),
          h('td', { class: 'num' }, `${x.tela[0]} ${unidade}`),
          h('td', { class: 'num' }, x.tela[1] || '-', barra),
          h('td', { class: 'num' }, x.tela[2] || '-'));
      });
      corpoMicros.replaceChildren(
        h('p', { class: 'legenda' }, refs.rotulo ? `Referência: ${refs.rotulo}${condicao ? ` (${condicao})` : ''}, ${fonte}. Detalhes em "Referências".` : 'Sem referência para este perfil (informe sexo e nascimento no cadastro).'),
        eq && grupos && Object.keys(grupos.padrao).length ? h('p', { class: 'legenda' }, 'Grupos com a média padrão do WebDiet não têm micronutrientes (só os macronutrientes das médias foram registrados): eles contam 0 nesta tabela.') : null,
        h('div', { class: 'tabela-rolagem' }, h('table', { class: 'medidas tabela-micros' },
          h('caption', { class: 'oculto-visual' }, 'Micronutrientes do plano e adequação'),
          h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Nutriente'), h('th', { scope: 'col', class: 'num' }, 'Plano'), h('th', { scope: 'col', class: 'num' }, 'Adequação'), h('th', { scope: 'col', class: 'num' }, 'Referência'))),
          h('tbody', {}, linhasMicros))));
    }

    // ---- Lista de compras ---------------------------------------------------------------------
    const opcoesCompras = { comReceitas: true, periodo: String(PERIODO_PADRAO), comQuantidades: true, comSubstitutos: true };
    function desenharCompras() {
      plano.compras ||= [];
      const lista = h('ul', { class: 'lista-compras' }, plano.compras.map((c, i) => {
        const marca = h('input', { type: 'checkbox', checked: !!c.marcado, 'aria-label': `Comprado: ${c.nome}` });
        marca.addEventListener('change', () => { c.marcado = marca.checked; marcarAlterado(); });
        const nome = h('input', { value: c.nome, autocomplete: 'off', 'aria-label': `Item ${i + 1} da lista de compras` });
        nome.addEventListener('input', () => { c.nome = nome.value; marcarAlterado(); });
        return h('li', {}, marca, nome, h('button', { type: 'button', class: 'botao discreto', 'aria-label': `Tirar ${c.nome} da lista`, onclick: () => { plano.compras.splice(i, 1); marcarAlterado(); desenharCompras(); } }, 'Tirar'));
      }));
      const comReceitas = h('input', { type: 'checkbox', checked: opcoesCompras.comReceitas });
      comReceitas.addEventListener('change', () => { opcoesCompras.comReceitas = comReceitas.checked; });
      const importar = () => {
        const nomes = eq
          ? importarComprasEquivalentes({ refeicoes: plano.refeicoes.map((r) => ({ porcoes: r.porcoes, avulsos: r.avulsos })), alimentos: calcularGruposAtuais().porcoes }, { comReceitas: opcoesCompras.comReceitas })
          : importarComprasAlimentos(plano.refeicoes.map((r) => ({ itens: r.itens.map((it) => ({ alimento: it.alimento, subs: (it.subs || []).map((s) => ({ alimento: s.alimento })) })) })), { comReceitas: opcoesCompras.comReceitas });
        const ja = new Set(plano.compras.map((c) => c.nome.trim().toLowerCase()));
        const novos = nomes.filter((n) => !ja.has(n.toLowerCase()));
        plano.compras.push(...novos.map((nome) => ({ nome, marcado: false })));
        plano.compras.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        marcarAlterado();
        desenharCompras();
        avisar(nomes.length ? `${novos.length} item(ns) importado(s).` : 'Nenhum alimento no plano para importar.');
      };
      const novoItem = h('input', { autocomplete: 'off', placeholder: 'Outro item', 'aria-label': 'Novo item da lista de compras' });
      const adicionarItem = () => { if (!novoItem.value.trim()) return; plano.compras.push({ nome: novoItem.value.trim(), marcado: false }); marcarAlterado(); desenharCompras(); };
      novoItem.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarItem(); } });
      corpoCompras.replaceChildren(
        h('label', { class: 'opcao' }, comReceitas, ' Receitas entram pelos ingredientes'),
        h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'botao secundario', onclick: importar }, 'Importar alimentos do plano')),
        plano.compras.length ? lista : h('p', { class: 'legenda' }, 'Lista vazia. "Importar alimentos do plano" junta os nomes de compra dos alimentos e substitutos, sem repetir.'),
        h('div', { class: 'seletor-linha' }, h('div', { class: 'seletor-busca' }, campo('Acrescentar item', novoItem)), h('div', { class: 'seletor-botao' }, h('button', { type: 'button', class: 'botao secundario', onclick: adicionarItem }, 'Acrescentar'))),
        eq ? listaComQuantidades() : null);
    }

    function listaComQuantidades() {
      const corpo = h('div', {});
      const periodo = selecao({ 'aria-label': 'Período' }, [...PERIODOS.map((d) => ({ valor: String(d), rotulo: `${d} dias` })), { valor: 'outro', rotulo: 'Outro' }], PERIODOS.includes(Number(opcoesCompras.periodo)) ? opcoesCompras.periodo : 'outro');
      const outro = h('input', { inputmode: 'numeric', autocomplete: 'off', value: PERIODOS.includes(Number(opcoesCompras.periodo)) ? '' : opcoesCompras.periodo, 'aria-label': 'Dias (período personalizado)' });
      const comQ = h('input', { type: 'checkbox', checked: opcoesCompras.comQuantidades });
      const comS = h('input', { type: 'checkbox', checked: opcoesCompras.comSubstitutos });
      const desenhar = () => {
        opcoesCompras.periodo = periodo.value === 'outro' ? outro.value : periodo.value;
        opcoesCompras.comQuantidades = comQ.checked;
        opcoesCompras.comSubstitutos = comS.checked;
        outro.parentElement?.classList.toggle('oculto', periodo.value !== 'outro');
        const itens = montarListaComQuantidades({ refeicoes: plano.refeicoes.map((r) => ({ porcoes: r.porcoes, avulsos: r.avulsos })), alimentos: calcularGruposAtuais().porcoes }, opcoesCompras);
        const nomeRef = (i) => plano.refeicoes[i]?.nome || `Refeição ${i + 1}`;
        corpo.replaceChildren(itens.length ? h('div', { class: 'tabela-rolagem' }, h('table', { class: 'medidas' },
          h('caption', { class: 'oculto-visual' }, 'Lista de compras com quantidades'),
          h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Refeição'), h('th', { scope: 'col' }, 'Alimento'), h('th', { scope: 'col' }, 'Por dia'), opcoesCompras.comQuantidades ? h('th', { scope: 'col', class: 'num' }, 'Comprar') : null)),
          h('tbody', {}, itens.flatMap((it) => [it.principal, ...it.opcoes.map((o) => ({ ...o, opcao: true }))].map((x) => h('tr', {},
            h('td', {}, x.opcao ? '' : nomeRef(it.refeicao)),
            h('th', { scope: 'row' }, x.opcao ? h('small', {}, 'ou ') : null, x.nome),
            h('td', {}, `${num(x.qtd, 2)} ${x.medida} (${num(x.peso, 1)} ${x.unidade})`),
            opcoesCompras.comQuantidades ? h('td', { class: 'num' }, x.compra || '-') : null)))))) : h('p', { class: 'legenda' }, 'Sem porções nem avulsos no plano.'));
      };
      [periodo, outro, comQ, comS].forEach((el) => el.addEventListener('input', desenhar));
      [periodo, comQ, comS].forEach((el) => el.addEventListener('change', desenhar));
      const bloco = h('details', { class: 'dobravel pilha' },
        h('summary', {}, 'Lista com quantidades'),
        h('div', { class: 'campos compactos' }, campo('Período', periodo), campo('Dias', outro)),
        h('label', { class: 'opcao' }, comQ, ' Com quantidades para o período'),
        h('label', { class: 'opcao' }, comS, ' Com as outras opções de cada grupo'),
        corpo,
        h('p', { class: 'legenda' }, 'Uma linha por refeição e grupo, sem somar refeições, como no WebDiet (§8.8). A reescrita da lista por IA do WebDiet não foi reproduzida.'));
      bloco.addEventListener('toggle', () => { if (bloco.open) desenhar(); }); // as porções podem ter mudado
      desenhar();
      return bloco;
    }

    // ---- Salvar, imprimir, voltar -------------------------------------------------------------
    function salvar() {
      const data = normalizarData(dataEl.value);
      if (!data) { avisar('Informe a data do plano (dd/mm/aaaa).'); dataEl.focus(); return; }
      recalcular();
      const t = resultado?.totalMacros;
      const resumo = t ? { ptn: fxn(t[0], 1), lip: fxn(t[1], 1), cho: fxn(t[2], 1), kcal: fxn(t[3], 0) } : null;
      // "abrirSubs" é só estado da tela (substitutos à mostra).
      const refeicoes = plano.refeicoes.map((r) => (eq ? r : { ...r, itens: r.itens.map(({ abrirSubs, ...it }) => it) })); // eslint-disable-line no-unused-vars
      const salvo = db.salvarRegistro(p.id, TIPO, { ...plano, data, nome: nomeEl.value.trim() || 'Plano alimentar', refeicoes, resumo });
      plano.id = salvo.id;
      plano.criadoEm = salvo.criadoEm;
      plano.data = data;
      alterado = false;
      botaoSalvar.textContent = 'Salvar alterações';
      avisar('Plano salvo.');
    }

    function voltar() {
      if (alterado && !confirm('Há alterações não salvas. Sair mesmo assim?')) return;
      lista();
    }

    function imprimir() {
      recalcular();
      const linhasImpressao = (r, ri) => {
        if (eq) {
          const opcoes = calcularGruposAtuais().porcoes.filter((x) => x.selecionado !== false);
          const por = GRUPOS.filter((g) => check(r.porcoes?.[g.id]) > 0).map((g) => h('li', {}, `${num(r.porcoes[g.id], 2)} porção(ões) de ${g.nome}`,
            h('ul', {}, opcoes.filter((x) => x.grupo === g.id).map((x) => h('li', {}, `${x.nome}: ${num(x.quantidade, 2)} ${x.medida} (${num(x.peso, 1)} ${unidadeDe(x)}) por porção`)))));
          const av = (r.avulsos || []).map((a) => h('li', {}, `${a.alimento.nome}: ${num(a.quantidade, 2)} ${typeof a.medida === 'object' ? a.medida.nome_mc : a.medida}`));
          return [...por, ...av];
        }
        return r.itens.map((it, ii) => {
          const l = resultado?.refeicoes?.[ri]?.linhas?.[ii];
          const medida = typeof it.medida === 'object' ? it.medida.nome_mc : it.medida;
          return h('li', {}, `${it.alimento.nome}: ${num(it.quantidade, 2)} ${medida}${l ? ` (${l.peso} ${unidadeDe(it.alimento)})` : ''}`,
            it.subs?.length ? h('ul', {}, it.subs.map((s) => h('li', {}, `ou ${s.alimento.nome}: ${num(s.quantidade, 2)} ${typeof s.medida === 'object' ? s.medida.nome_mc : s.medida}`))) : null);
        });
      };
      const t = resultado ? (eq ? resultado.tela : resultado.total.tela) : null;
      area.replaceChildren(
        h('div', { class: 'acoes nao-imprimir' },
          h('button', { type: 'button', class: 'botao', onclick: () => window.print() }, 'Imprimir'),
          h('button', { type: 'button', class: 'botao secundario', onclick: () => editar(plano, { alterado }) }, 'Voltar ao plano')),
        h('article', { class: 'impressao pilha' },
          h('header', {}, h('p', { class: 'rotulo' }, `${p.nome} · ${dataEl.value}`), h('h2', {}, nomeEl.value || 'Plano alimentar')),
          ...plano.refeicoes.map((r, ri) => ({ r, itens: linhasImpressao(r, ri) })).filter((x) => x.itens.length).map(({ r, itens }) => h('section', { class: 'pilha' },
            h('h3', {}, [r.horario, r.nome].filter(Boolean).join(' · ')),
            h('ul', {}, itens),
            r.obs ? h('p', { style: 'white-space:pre-wrap' }, r.obs) : null)),
          t ? h('p', { class: 'legenda' }, `Total do dia: ${t.kcalPrescrita} · PTN ${t.ptnPrescrita} · LIP ${t.lipPrescrita} · CHO ${t.choPrescrita}`) : null,
          plano.compras?.length ? h('section', {}, h('h3', {}, 'Lista de compras'), h('ul', {}, plano.compras.map((c) => h('li', {}, c.nome)))) : null));
    }

    // ---- Montagem -----------------------------------------------------------------------------
    const aside = h('aside', { class: 'cartao pilha painel-fixo', 'aria-labelledby': 'plan-total' },
      h('h3', { id: 'plan-total' }, 'Total do dia'),
      legendaPainel,
      painel.el,
      h('div', { class: 'acoes' }, botaoSalvar,
        h('button', { type: 'button', class: 'botao secundario', onclick: imprimir }, 'Imprimir'),
        h('button', { type: 'button', class: 'botao discreto', onclick: voltar }, 'Voltar')),
      h('p', { class: 'legenda' }, eq
        ? 'kcal não proteica/g N planejada: fórmula do WebDiet mantida (relatório §12, item 20).'
        : 'kcal não proteica/g N: fórmula planejada do WebDiet mantida (relatório §12, item 20); a adequação usa o valor prescrito atual (o WebDiet usa o do cálculo anterior, item 30).'));

    area.replaceChildren(
      catalogo.datalist,
      h('div', { class: 'cabecalho-pagina' },
        h('h2', {}, eq ? 'Plano por equivalentes' : 'Plano por alimentos'),
        h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'botao discreto', onclick: voltar }, 'Planos salvos'))),
      h('div', { class: 'painel-duplo plano' },
        h('div', { class: 'pilha' },
          h('div', { class: 'cartao pilha' }, h('div', { class: 'campos' }, campo('Nome do plano', nomeEl), campo('Data', dataEl))),
          cartaoMetas,
          eq ? h('div', { class: 'cartao pilha' }, h('h3', {}, 'Grupos de equivalentes'), corpoGrupos) : null,
          corpoRefeicoes,
          h('div', { class: 'cartao pilha' }, h('h3', {}, 'Micronutrientes'), corpoMicros),
          h('div', { class: 'cartao pilha' }, h('h3', {}, 'Lista de compras'), corpoCompras)),
        aside));
    mostrarTipoMeta();
    if (eq) desenharGrupos();
    desenharRefeicoes();
    desenharCompras();
    nomeEl.focus();
  }

  lista();
}

registrarAba({ id: 'planejamento', rotulo: 'Planejamento', ordem: 40, montar });
