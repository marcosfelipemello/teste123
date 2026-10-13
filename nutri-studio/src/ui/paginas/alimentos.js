// Página "Meus alimentos" (#/alimentos): a base de alimentos do consultório.
// O app não traz tabela de alimentos pronta (a base do WebDiet não foi copiada, relatório §1.2). Os
// alimentos entram por:
//   - cadastro pelo rótulo (calc/alimentoProprio.js, relatório §8.7): valores da porção → por 100 g;
//   - cadastro direto por 100 g (ou edição de um alimento importado);
//   - importação de uma tabela em CSV (src/ui/alimentosCsv.js; formato documentado na própria página).
// Cada alimento fica na coleção "alimentos": {id, nome, unidade, mc, kcal, ptn, lip, cho, fibras,
// micros[27], origem, compras?, rotulo? (entrada do rótulo, para editar)} — valores por 100 g ou 100 mL.
import { h, campo, selecao, lerFormulario, avisar, baixar, lerArquivo } from '../dom.js';
import { registrarRota, db } from '../app.js';
import { fx } from '../../calc/numeros.js';
import { cadastrarAlimento, kcalAutomatica } from '../../calc/alimentoProprio.js';
import { CHAVES_MICROS } from '../../calc/dris.js';
import {
  importarAlimentosCsv, exportarAlimentosCsv, planejarImportacao, modeloCsv, lerNumero, lerMedidas,
  COLUNAS, COLUNAS_MICROS, MICROS, chaveNome,
} from '../alimentosCsv.js';
import { criarPainel } from '../abas/painel-resultados.js';
import { num } from '../catalogo.js';

/** Quantos alimentos a lista mostra de uma vez (tabelas importadas podem ter milhares). */
const LIMITE_LISTA = 200;
const I_FIBRAS = CHAVES_MICROS.indexOf('fibras');

const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const numero = (nome, rotulo, extra = {}, ajuda) =>
  campo(rotulo, h('input', { name: nome, inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', ...extra }), ajuda);
const ordenar = (lista) => lista.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));

export function paginaAlimentos(raiz, banco = db) {
  let filtro = '';
  let filtroOrigem = '';

  function cabecalho(titulo, ...acoes) {
    return h('div', { class: 'cabecalho-pagina' },
      h('div', {}, h('p', { class: 'rotulo' }, 'Consultório'), h('h1', {}, titulo)),
      acoes.length ? h('div', { class: 'acoes' }, ...acoes) : null);
  }

  // ---- Lista ------------------------------------------------------------------------------------
  function lista() {
    const todos = ordenar(banco.listar('alimentos'));
    const origens = [...new Set(todos.map((a) => a.origem || 'Sem origem'))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const contagem = h('p', { class: 'legenda', role: 'status', 'aria-live': 'polite' });
    const corpo = h('div', {});
    const busca = h('input', { type: 'search', placeholder: 'Buscar por nome', 'aria-label': 'Buscar alimento', value: filtro });
    const origem = selecao({ 'aria-label': 'Filtrar por origem' }, [{ valor: '', rotulo: 'Todas as origens' }, ...origens], filtroOrigem);
    busca.addEventListener('input', () => { filtro = busca.value; desenhar(); });
    origem.addEventListener('change', () => { filtroOrigem = origem.value; desenhar(); });

    function desenhar() {
      const termo = semAcento(filtro).trim();
      const achados = todos.filter((a) => (!termo || semAcento(a.nome).includes(termo)) && (!filtroOrigem || (a.origem || 'Sem origem') === filtroOrigem));
      const mostrados = achados.slice(0, LIMITE_LISTA);
      contagem.textContent = !todos.length ? '' : achados.length > LIMITE_LISTA
        ? `${achados.length} alimentos encontrados; mostrando os ${LIMITE_LISTA} primeiros. Refine a busca.`
        : `${achados.length} ${achados.length === 1 ? 'alimento' : 'alimentos'}${termo || filtroOrigem ? ' encontrados' : ''}.`;
      if (!todos.length) {
        corpo.replaceChildren(h('div', { class: 'vazio' }, 'Nenhum alimento ainda. Cadastre pelo rótulo de um produto ou importe uma tabela de alimentos em CSV.'));
        return;
      }
      if (!achados.length) { corpo.replaceChildren(h('p', { class: 'vazio' }, 'Nenhum alimento com esse filtro.')); return; }
      corpo.replaceChildren(h('div', { class: 'tabela-rolagem' }, h('table', { class: 'medidas tabela-alimentos' },
        h('caption', { class: 'oculto-visual' }, 'Meus alimentos, valores por 100 g ou 100 mL'),
        h('thead', {}, h('tr', {},
          h('th', { scope: 'col' }, 'Alimento'),
          h('th', { scope: 'col', class: 'num' }, 'kcal'),
          h('th', { scope: 'col', class: 'num' }, 'PTN'),
          h('th', { scope: 'col', class: 'num' }, 'LIP'),
          h('th', { scope: 'col', class: 'num' }, 'CHO'),
          h('th', { scope: 'col', class: 'num' }, 'Fibras'),
          h('th', { scope: 'col' }, 'Medidas caseiras'),
          h('th', { scope: 'col' }, h('span', { class: 'oculto-visual' }, 'Ações')))),
        h('tbody', {}, mostrados.map((a) => h('tr', {},
          h('th', { scope: 'row' }, a.nome, h('div', {}, h('small', {}, [a.origem, `por 100 ${a.unidade === 'ml' ? 'mL' : 'g'}`].filter(Boolean).join(' · ')))),
          h('td', { class: 'num' }, num(a.kcal, 1)),
          h('td', { class: 'num' }, num(a.ptn)),
          h('td', { class: 'num' }, num(a.lip)),
          h('td', { class: 'num' }, num(a.cho)),
          h('td', { class: 'num' }, num(a.fibras)),
          h('td', {}, h('small', {}, (a.mc || []).filter((m) => m.peso > 0).map((m) => `${m.nome_mc} = ${num(m.peso, 1)} ${a.unidade === 'ml' ? 'mL' : 'g'}`).join('; ') || '—')),
          h('td', {}, h('div', { class: 'acoes', style: 'flex-wrap:nowrap' },
            h('button', { type: 'button', class: 'botao discreto', 'aria-label': `Editar ${a.nome}`, onclick: () => (a.rotulo ? formRotulo(a) : formPorCem(a)) }, 'Editar'),
            h('button', { type: 'button', class: 'botao discreto', 'aria-label': `Excluir ${a.nome}`, onclick: () => excluir(a) }, 'Excluir')))))))));
    }

    raiz.replaceChildren(
      cabecalho('Meus alimentos',
        h('button', { class: 'botao', type: 'button', onclick: () => formRotulo(null) }, 'Cadastrar pelo rótulo'),
        h('button', { class: 'botao secundario', type: 'button', onclick: () => formPorCem(null) }, 'Cadastrar por 100 g'),
        h('button', { class: 'botao secundario', type: 'button', onclick: telaImportar }, 'Importar tabela (CSV)'),
        h('button', { class: 'botao secundario', type: 'button', disabled: todos.length ? null : true, onclick: exportar }, 'Exportar CSV')),
      h('p', { class: 'legenda' }, 'O app não traz uma tabela de alimentos pronta: cadastre pelo rótulo dos produtos ou importe uma tabela (TACO, TBCA, a sua) em CSV. Valores por 100 g ou 100 mL. As receitas salvas também entram no planejamento como alimento.'),
      h('div', { class: 'pilha' },
        h('div', { class: 'filtros' }, busca, origem),
        contagem,
        corpo));
    desenhar();
  }

  function excluir(a) {
    if (!confirm(`Excluir "${a.nome}"? Planos e receitas que já usam este alimento guardam uma cópia e não mudam.`)) return;
    banco.excluir('alimentos', a.id);
    avisar(`"${a.nome}" excluído.`);
    lista();
  }

  function exportar() {
    const todos = ordenar(banco.listar('alimentos'));
    baixar(`meus-alimentos-${new Date().toISOString().slice(0, 10)}.csv`, exportarAlimentosCsv(todos), 'text/csv;charset=utf-8');
    avisar(`${todos.length} alimento(s) exportado(s).`);
  }

  /** true se já existe outro alimento com o mesmo nome. */
  function nomeRepetido(nome, id) {
    return banco.listar('alimentos').some((a) => a.id !== id && chaveNome(a.nome) === chaveNome(nome));
  }

  // ---- Cadastro pelo rótulo (§8.7) ----------------------------------------------------------------
  function formRotulo(existente) {
    const e = existente?.rotulo || {};
    const painel = criarPainel();
    const form = h('form', { class: 'painel-duplo', novalidate: true, 'aria-label': 'Cadastro pelo rótulo' },
      h('div', { class: 'pilha' },
        h('div', { class: 'cartao pilha', role: 'group', 'aria-labelledby': 'rot-produto' },
          h('h3', { id: 'rot-produto' }, 'Produto'),
          h('div', { class: 'campos' },
            campo('Nome', h('input', { name: 'nome', value: e.nome ?? existente?.nome ?? '', autocomplete: 'off', required: true })),
            campo('Unidade', selecao({ name: 'unidade' }, [{ valor: 'g', rotulo: 'g (sólido)' }, { valor: 'ml', rotulo: 'mL (líquido)' }], e.unidade ?? existente?.unidade ?? 'g')),
            campo('Nome na lista de compras', h('input', { name: 'compras', value: existente?.compras ?? '', autocomplete: 'off' }), 'Opcional. Sem ele, vale o nome.'))),
        h('div', { class: 'cartao pilha', role: 'group', 'aria-labelledby': 'rot-porcao' },
          h('h3', { id: 'rot-porcao' }, 'Porção do rótulo'),
          h('div', { class: 'campos alinhados' },
            campo('Medida caseira', h('input', { name: 'medida', value: e.medida ?? '', placeholder: 'Ex.: Unidade(s)', autocomplete: 'off' })),
            numero('quantidadeMedidas', 'Quantidade de medidas na porção', { value: e.quantidadeMedidas ?? '' }),
            numero('peso', 'Peso da porção (g ou mL)', { value: e.peso ?? '' })),
          h('p', { class: 'legenda' }, 'Ex.: "porção de 45 g (2 unidades)" → medida "Unidade(s)", 2 medidas, 45 g. O peso de 1 medida é calculado.')),
        h('div', { class: 'cartao pilha', role: 'group', 'aria-labelledby': 'rot-valores' },
          h('h3', { id: 'rot-valores' }, 'Valores da porção'),
          h('div', { class: 'campos compactos' },
            numero('cho', 'Carboidratos (g)', { value: e.cho ?? '' }),
            numero('ptn', 'Proteínas (g)', { value: e.ptn ?? '' }),
            numero('lip', 'Lipídios (g)', { value: e.lip ?? '' }),
            numero('fibras', 'Fibras (g)', { value: e.fibras ?? '' }),
            numero('kcal', 'Energia (kcal)', { value: e.kcal ?? '', placeholder: 'automática' })),
          h('p', { class: 'legenda' }, 'Energia vazia = automática: CHO×4 + PTN×4 + LIP×9 + fibras×2, como no WebDiet. Se o carboidrato do rótulo já inclui as fibras, elas contam duas vezes: nesse caso digite a energia do rótulo.'))),
      h('aside', { class: 'cartao pilha painel-fixo', 'aria-labelledby': 'rot-previa' },
        h('h3', { id: 'rot-previa' }, 'Prévia'),
        painel.el,
        h('div', { class: 'acoes' },
          h('button', { class: 'botao', type: 'submit' }, existente ? 'Salvar alterações' : 'Salvar alimento'),
          h('button', { class: 'botao secundario', type: 'button', onclick: lista }, 'Cancelar'),
          existente ? h('button', { class: 'botao discreto', type: 'button', onclick: () => formPorCem(existente) }, 'Editar por 100 g') : null),
        h('p', { class: 'legenda' }, existente
          ? 'Os micronutrientes do cadastro pelo rótulo ficam zerados. "Editar por 100 g" permite preenchê-los (o alimento deixa de ser editável pelo rótulo).'
          : 'Os micronutrientes ficam zerados, como no WebDiet. Depois de salvar, "Editar" → "Editar por 100 g" permite preenchê-los.')));

    const NOMES_FALTANDO = { nome: 'nome', peso: 'peso da porção', medida: 'medida caseira', quantidadeMedidas: 'quantidade de medidas' };

    function calcular() {
      const v = lerFormulario(form);
      return { v, r: cadastrarAlimento(v), auto: kcalAutomatica(v) };
    }

    function atualizar() {
      const { v, r, auto } = calcular();
      const u = v.unidade === 'ml' ? 'mL' : 'g';
      const digitada = String(v.kcal ?? '').trim() !== '';
      form.elements.kcal.placeholder = `automática: ${auto.tela.kcalAuto}`;
      painel.atualizar({
        destaques: [
          { chave: 'kcal', rotulo: 'Energia da porção', valor: `${r.kcalPorcao ?? auto.tela.kcalAuto} kcal`, detalhe: digitada ? 'digitada' : `automática (${num(auto.kcal, 2)})` },
          { chave: 'medida', rotulo: 'Medida caseira', valor: r.medida ? `${num(r.medida.peso, 1)} ${u}` : '-', detalhe: r.medida ? `1 ${r.medida.nome_mc}` : '' },
        ],
        grupos: [{
          titulo: `Por 100 ${u} (o que é gravado)`,
          itens: [
            { chave: 'k100', rotulo: 'Energia', valor: r.porCem ? `${fx(r.porCem.kcal, 0)} kcal` : '-' },
            { chave: 'p100', rotulo: 'Proteínas', valor: r.porCem ? `${fx(r.porCem.ptn, 1)} g` : '-' },
            { chave: 'l100', rotulo: 'Lipídios', valor: r.porCem ? `${fx(r.porCem.lip, 1)} g` : '-' },
            { chave: 'c100', rotulo: 'Carboidratos', valor: r.porCem ? `${fx(r.porCem.cho, 1)} g` : '-' },
            { chave: 'f100', rotulo: 'Fibras', valor: r.porCem ? `${fx(r.porCem.fibras, 1)} g` : '-' },
          ],
        }],
        avisos: r.valido ? [] : [`Para salvar, preencha: ${r.faltando.map((f) => NOMES_FALTANDO[f]).join(', ')}.`],
      });
      return { v, r };
    }

    form.addEventListener('input', atualizar);
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const { v, r } = atualizar();
      if (!r.valido) { avisar(`Preencha: ${r.faltando.map((f) => NOMES_FALTANDO[f]).join(', ')}.`); form.elements[r.faltando[0]]?.focus(); return; }
      if (nomeRepetido(v.nome, existente?.id) && !confirm(`Já existe um alimento chamado "${v.nome.trim()}". Salvar mesmo assim?`)) return;
      const micros = new Array(27).fill(0);
      micros[I_FIBRAS] = r.porCem.fibras;
      banco.salvar('alimentos', {
        ...(existente || {}),
        nome: v.nome.trim(),
        unidade: r.envio.unidade,
        compras: v.compras.trim(),
        origem: 'Rótulo',
        ...r.porCem,
        micros,
        mc: [r.medida],
        rotulo: { nome: v.nome.trim(), unidade: v.unidade, medida: v.medida.trim(), quantidadeMedidas: v.quantidadeMedidas, peso: v.peso, cho: v.cho, ptn: v.ptn, lip: v.lip, fibras: v.fibras, kcal: v.kcal },
        atualizadoEm: new Date().toISOString(),
      });
      avisar(`"${v.nome.trim()}" salvo: ${r.porCem.kcal} kcal por 100 ${v.unidade === 'ml' ? 'mL' : 'g'}.`);
      lista();
    });

    raiz.replaceChildren(cabecalho(existente ? 'Editar alimento' : 'Cadastrar pelo rótulo'), form);
    atualizar();
    form.elements.nome.focus();
  }

  // ---- Cadastro / edição por 100 g ----------------------------------------------------------------
  function formPorCem(existente) {
    const a = existente || { unidade: 'g', micros: [] };
    const medidasTexto = (a.mc || []).map((m) => `${m.nome_mc}: ${num(m.peso, 2)}`).join('\n');
    const form = h('form', { class: 'pilha', novalidate: true, 'aria-label': 'Alimento por 100 g' },
      h('div', { class: 'cartao pilha', role: 'group', 'aria-labelledby': 'cem-dados' },
        h('h3', { id: 'cem-dados' }, 'Alimento'),
        h('div', { class: 'campos' },
          campo('Nome', h('input', { name: 'nome', value: a.nome ?? '', autocomplete: 'off', required: true })),
          campo('Unidade', selecao({ name: 'unidade' }, [{ valor: 'g', rotulo: 'por 100 g' }, { valor: 'ml', rotulo: 'por 100 mL' }], a.unidade)),
          campo('Origem', h('input', { name: 'origem', value: a.origem ?? '', placeholder: 'Ex.: TACO', autocomplete: 'off' })),
          campo('Nome na lista de compras', h('input', { name: 'compras', value: a.compras ?? '', autocomplete: 'off' })))),
      h('div', { class: 'cartao pilha', role: 'group', 'aria-labelledby': 'cem-macros' },
        h('h3', { id: 'cem-macros' }, 'Energia e macronutrientes (por 100 g ou 100 mL)'),
        h('div', { class: 'campos compactos' },
          numero('kcal', 'Energia (kcal)', { value: existente ? num(a.kcal, 4) : '' }),
          numero('ptn', 'Proteínas (g)', { value: existente ? num(a.ptn, 4) : '' }),
          numero('lip', 'Lipídios (g)', { value: existente ? num(a.lip, 4) : '' }),
          numero('cho', 'Carboidratos (g)', { value: existente ? num(a.cho, 4) : '' }),
          numero('fibras', 'Fibras (g)', { value: existente ? num(a.fibras, 4) : '' }))),
      h('div', { class: 'cartao pilha', role: 'group', 'aria-labelledby': 'cem-medidas' },
        h('h3', { id: 'cem-medidas' }, 'Medidas caseiras'),
        campo('Uma por linha: nome: peso de 1 medida', h('textarea', { name: 'medidas', rows: 4, spellcheck: 'false', placeholder: 'Colher(es) de sopa: 25\nXícara(s) de chá: 130' }, medidasTexto),
          '"grama(s)" ou "mililitro(s)" = 1 já vem sempre.')),
      h('details', { class: 'cartao pilha dobravel' },
        h('summary', {}, 'Micronutrientes (por 100 g ou 100 mL)'),
        h('div', { class: 'campos compactos' }, MICROS.filter((m) => m.chave !== 'fibras').map((m) =>
          numero(`micro.${m.chave}`, `${m.nome} (${m.unidadeValor})`, { value: existente ? num(a.micros?.[CHAVES_MICROS.indexOf(m.chave)] ?? 0, 4) : '' })))),
      h('div', { class: 'acoes' },
        h('button', { class: 'botao', type: 'submit' }, existente ? 'Salvar alterações' : 'Salvar alimento'),
        h('button', { class: 'botao secundario', type: 'button', onclick: lista }, 'Cancelar')));

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const v = lerFormulario(form);
      const erros = [];
      if (!v.nome.trim()) erros.push('informe o nome');
      const ler = (chave, rotulo, obrigatorio) => {
        const n = lerNumero(v[chave]);
        if (n.erro) erros.push(`${rotulo}: ${n.erro}`);
        else if (obrigatorio && n.vazio) erros.push(`informe ${rotulo}`);
        return n.valor ?? 0;
      };
      const valores = { kcal: ler('kcal', 'a energia', true), ptn: ler('ptn', 'proteínas'), lip: ler('lip', 'lipídios'), cho: ler('cho', 'carboidratos'), fibras: ler('fibras', 'fibras') };
      const micros = CHAVES_MICROS.map((c) => (c === 'fibras' ? valores.fibras : ler(`micro.${c}`, c)));
      const med = lerMedidas(String(v.medidas).split(/\r?\n/).join('|'));
      erros.push(...med.erros);
      if (erros.length) { avisar(`Corrija: ${erros.join('; ')}.`); return; }
      if (nomeRepetido(v.nome, existente?.id) && !confirm(`Já existe um alimento chamado "${v.nome.trim()}". Salvar mesmo assim?`)) return;
      const { rotulo, ...resto } = existente || {}; // eslint-disable-line no-unused-vars
      banco.salvar('alimentos', {
        ...resto,
        nome: v.nome.trim(), unidade: v.unidade === 'ml' ? 'ml' : 'g', origem: v.origem.trim() || 'Manual', compras: v.compras.trim(),
        ...valores, micros, mc: med.mc, atualizadoEm: new Date().toISOString(),
      });
      avisar(`"${v.nome.trim()}" salvo.`);
      lista();
    });

    raiz.replaceChildren(cabecalho(existente ? 'Editar alimento' : 'Cadastrar por 100 g'), form);
    form.elements.nome.focus();
  }

  // ---- Importação de tabela em CSV ----------------------------------------------------------------
  function telaImportar() {
    const arquivo = h('input', { type: 'file', name: 'arquivo', accept: '.csv,text/csv,text/plain' });
    const atualizarExistentes = h('input', { type: 'checkbox', name: 'atualizar', checked: true });
    const previa = h('div', { class: 'pilha', 'aria-live': 'polite' });
    let lido = null;

    const descricaoMicros = MICROS.filter((m) => m.chave !== 'fibras').map((m) => `${m.chave} (${m.nome}, ${m.unidadeValor})`).join(' · ');

    function mostrarPrevia() {
      if (!lido) { previa.replaceChildren(); return; }
      if (lido.erro) { previa.replaceChildren(h('p', { class: 'aviso' }, lido.erro)); return; }
      const plano = planejarImportacao(lido.alimentos, banco.listar('alimentos'), { atualizar: atualizarExistentes.checked });
      const total = plano.novos.length + plano.atualizados.length;
      const amostra = lido.alimentos.slice(0, 20).map((x) => x.alimento);
      previa.replaceChildren(h('div', { class: 'bloco pilha' },
        h('p', { class: 'resumo-importacao' }, `${lido.alimentos.length} alimento(s) lido(s): ${plano.novos.length} novo(s), ${plano.atualizados.length} atualização(ões)${plano.ignorados.length ? `, ${plano.ignorados.length} ignorado(s) (já existem)` : ''}. ${lido.rejeitados.length} linha(s) recusada(s).`),
        h('p', { class: 'legenda' }, 'Colunas reconhecidas: ' + (Object.entries(lido.colunas.reconhecidas).map(([c, k]) => (c === k ? c : `${c} → ${k}`)).join(', ') || 'nenhuma') +
          (lido.colunas.ignoradas.length ? `. Ignoradas: ${lido.colunas.ignoradas.join(', ')}.` : '.')),
        lido.rejeitados.length ? h('details', { class: 'recusadas', open: true }, h('summary', {}, `Linhas recusadas (${lido.rejeitados.length})`),
          h('ul', { class: 'lista-avisos' }, lido.rejeitados.map((r) => h('li', {}, `Linha ${r.linha}${r.nome ? ` (${r.nome})` : ''}: ${r.erros.join('; ')}.`)))) : null,
        amostra.length ? h('div', { class: 'tabela-rolagem' }, h('table', { class: 'medidas' },
          h('caption', { class: 'legenda', style: 'text-align:left' }, amostra.length < lido.alimentos.length ? `Primeiros ${amostra.length} alimentos lidos (por 100 g/mL)` : 'Alimentos lidos (por 100 g/mL)'),
          h('thead', {}, h('tr', {}, ['Alimento', 'Un.', 'kcal', 'PTN', 'LIP', 'CHO', 'Fibras', 'Medidas'].map((t, i) => h('th', { scope: 'col', class: i >= 2 && i <= 6 ? 'num' : null }, t)))),
          h('tbody', {}, amostra.map((a) => h('tr', {},
            h('th', { scope: 'row' }, a.nome), h('td', {}, a.unidade),
            h('td', { class: 'num' }, num(a.kcal, 1)), h('td', { class: 'num' }, num(a.ptn)), h('td', { class: 'num' }, num(a.lip)),
            h('td', { class: 'num' }, num(a.cho)), h('td', { class: 'num' }, num(a.fibras)),
            h('td', {}, String(a.mc.length))))))) : null,
        h('div', { class: 'acoes' },
          h('button', { class: 'botao', type: 'button', disabled: total ? null : true, onclick: () => importar(plano) }, `Importar ${total} alimento(s)`),
          h('button', { class: 'botao secundario', type: 'button', onclick: () => { lido = null; arquivo.value = ''; mostrarPrevia(); } }, 'Descartar'))));
    }

    function importar(plano) {
      const agora = new Date().toISOString();
      const existentes = new Map(banco.listar('alimentos').map((a) => [a.id, a]));
      const itens = [
        ...plano.novos.map((a) => ({ ...a, criadoEm: agora, atualizadoEm: agora })),
        ...plano.atualizados.map(({ id, alimento }) => {
          const { rotulo, ...antigo } = existentes.get(id) || {}; // eslint-disable-line no-unused-vars
          return { ...antigo, ...alimento, id, atualizadoEm: agora };
        }),
      ];
      const r = banco.salvarVarios('alimentos', itens);
      if (!r.gravado) { avisar('O navegador recusou a gravação (armazenamento cheio?). Baixe um backup e tente importar uma tabela menor.'); return; }
      avisar(`${plano.novos.length} alimento(s) novo(s) e ${plano.atualizados.length} atualizado(s).`);
      lista();
    }

    arquivo.addEventListener('change', async () => {
      const f = arquivo.files?.[0];
      if (!f) return;
      lido = importarAlimentosCsv(await lerArquivo(f));
      mostrarPrevia();
    });
    atualizarExistentes.addEventListener('change', mostrarPrevia);

    raiz.replaceChildren(
      cabecalho('Importar tabela de alimentos',
        h('button', { class: 'botao secundario', type: 'button', onclick: () => baixar('modelo-alimentos.csv', modeloCsv(), 'text/csv;charset=utf-8') }, 'Baixar modelo (CSV)'),
        h('button', { class: 'botao secundario', type: 'button', onclick: lista }, 'Voltar à lista')),
      h('div', { class: 'pilha' },
        h('section', { class: 'cartao pilha', 'aria-labelledby': 'imp-formato' },
          h('h2', { id: 'imp-formato' }, 'Formato do arquivo'),
          h('p', {}, 'CSV com cabeçalho na primeira linha e um alimento por linha, separado por ";" ou ",". Valores por 100 g ou 100 mL. A ordem das colunas não importa.'),
          h('div', { class: 'tabela-rolagem' }, h('table', { class: 'medidas' },
            h('caption', { class: 'oculto-visual' }, 'Colunas do CSV de alimentos'),
            h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Coluna'), h('th', { scope: 'col' }, 'Obrigatória'), h('th', { scope: 'col' }, 'Conteúdo'))),
            h('tbody', {},
              COLUNAS.map((c) => h('tr', {}, h('th', { scope: 'row' }, h('code', {}, c.chave)), h('td', {}, c.obrigatoria ? 'sim' : 'não'),
                h('td', {}, c.descricao, c.aceita.length > 1 ? h('div', {}, h('small', {}, `Também aceita: ${c.aceita.filter((x) => x !== c.chave).join(', ')}`)) : null))),
              h('tr', {}, h('th', { scope: 'row' }, 'micronutrientes'), h('td', {}, 'não'),
                h('td', {}, `${COLUNAS_MICROS.length} colunas opcionais, pelos nomes abaixo (ou pelo nome do nutriente): `, h('small', {}, descricaoMicros)))))),
          h('ul', { class: 'legenda' },
            h('li', {}, 'Números com vírgula ou ponto decimal. "Tr", "NA", "N/D", "*", "-" e células vazias valem 0 (a energia não pode ficar vazia).'),
            h('li', {}, 'Medidas: "Colher(es) de sopa:25|Xícara(s) de chá:130" (peso de uma medida). "grama(s)" e "mililitro(s)" já vêm sempre.'),
            h('li', {}, 'Linhas com erro não entram; a prévia mostra o motivo de cada uma. O arquivo exportado por esta página pode ser importado de volta.'))),
        h('section', { class: 'cartao pilha', 'aria-labelledby': 'imp-arquivo' },
          h('h2', { id: 'imp-arquivo' }, 'Arquivo'),
          campo('Arquivo CSV', arquivo),
          h('label', { class: 'opcao' }, atualizarExistentes, ' Atualizar os alimentos que já existem com o mesmo nome (senão, eles ficam como estão)'),
          previa)));
    arquivo.focus();
  }

  lista();
}

registrarRota(/^#\/alimentos$/, (raiz) => paginaAlimentos(raiz, db));
