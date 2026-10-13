// Página "Receitas" (#/receitas): receitas calculadas de calc/receitas.js (relatório §8.6).
// Ingredientes vêm do catálogo do consultório (Meus alimentos e outras receitas). Os totais somam os
// valores da base sem arredondar; a porção é automática (soma dos pesos / rendimento, "Porção") ou gerada
// pelo peso final digitado ("gerar medida", "Porção(ões)"). Ao salvar, a receita é gravada por 100 g e
// passa a valer como alimento de origem "Receita" no planejamento.
//
// A receita "comum" do WebDiet (só texto e PDF, sem cálculo) não foi reproduzida.
//
// Cada receita fica na coleção "receitas": o registro de salvarReceita (por 100 g, tipo "receita",
// origem "Receita", mc = [porção]) + ingredientes [{alimento (cópia), quantidade, medida}] + compras.
import { h, campo, avisar } from '../dom.js';
import { registrarRota, db } from '../app.js';
import { fxn } from '../../calc/numeros.js';
import {
  calcularReceita, gerarMedida, salvarReceita, infoReceita, formatarKcalIngrediente, TEXTO_INFO_PORCAO, AVISO_GERAR_MEDIDA,
  NOME_PORCAO_GERADA,
} from '../../calc/receitas.js';
import { criarCatalogo, criarSeletor, instantaneo, seletorMedidaLinha, campoQuantidadeLinha, chaveAlimento, num } from '../catalogo.js';
import { criarPainel } from '../abas/painel-resultados.js';

const NOMES_FALTANDO = { nome: 'nome', rendimento: 'rendimento', peso: 'peso final', macros: 'ingredientes', descricao: 'modo de preparo', medida: 'medida da porção' };
const ordenar = (lista) => lista.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));

export function paginaReceitas(raiz, banco = db) {
  function cabecalho(titulo, ...acoes) {
    return h('div', { class: 'cabecalho-pagina' },
      h('div', {}, h('p', { class: 'rotulo' }, 'Consultório'), h('h1', {}, titulo)),
      acoes.length ? h('div', { class: 'acoes' }, ...acoes) : null);
  }

  // ---- Lista ------------------------------------------------------------------------------------
  function lista() {
    const receitas = ordenar(banco.listar('receitas'));
    raiz.replaceChildren(
      cabecalho('Receitas', h('button', { class: 'botao', type: 'button', onclick: () => editar(null) }, 'Nova receita')),
      h('p', { class: 'legenda' }, 'Receitas calculadas a partir dos ingredientes. A receita salva vira um alimento de origem "Receita" no planejamento, com a medida da porção.'),
      receitas.length ? h('div', { class: 'tabela-rolagem' }, h('table', { class: 'medidas' },
        h('caption', { class: 'oculto-visual' }, 'Receitas salvas'),
        h('thead', {}, h('tr', {},
          h('th', { scope: 'col' }, 'Receita'), h('th', { scope: 'col', class: 'num' }, 'Rende'), h('th', { scope: 'col', class: 'num' }, 'Porção'),
          h('th', { scope: 'col', class: 'num' }, 'kcal/porção'), h('th', { scope: 'col', class: 'num' }, 'kcal/100 g'),
          h('th', { scope: 'col' }, h('span', { class: 'oculto-visual' }, 'Ações')))),
        h('tbody', {}, receitas.map((r) => {
          const info = infoReceita(r);
          return h('tr', {},
            h('th', { scope: 'row' }, r.nome, h('div', {}, h('small', {}, `${(r.ingredientes || []).length} ingrediente(s)`))),
            h('td', { class: 'num' }, `${num(r.rendimento, 1)}`),
            h('td', { class: 'num' }, r.mc?.[0] ? `${num(r.mc[0].peso, 1)} g` : '-'),
            h('td', { class: 'num' }, info.tela.kcal),
            h('td', { class: 'num' }, num(r.kcal, 1)),
            h('td', {}, h('div', { class: 'acoes', style: 'flex-wrap:nowrap' },
              h('button', { type: 'button', class: 'botao discreto', 'aria-label': `Editar ${r.nome}`, onclick: () => editar(r) }, 'Editar'),
              h('button', { type: 'button', class: 'botao discreto', 'aria-label': `Excluir ${r.nome}`, onclick: () => excluir(r) }, 'Excluir'))));
        }))))
        : h('div', { class: 'vazio' }, 'Nenhuma receita ainda. Cadastre os ingredientes em "Meus alimentos" e monte a primeira receita.'));
  }

  function excluir(r) {
    if (!confirm(`Excluir a receita "${r.nome}"? Planos que já a usam guardam uma cópia e não mudam.`)) return;
    banco.excluir('receitas', r.id);
    avisar(`"${r.nome}" excluída.`);
    lista();
  }

  // ---- Editor -----------------------------------------------------------------------------------
  function editar(existente) {
    const catalogo = criarCatalogo(banco, { id: 'catalogo-receita', excluir: existente ? chaveAlimento({ ...existente, tipo: 'receita' }) : null });
    const ingredientes = (existente?.ingredientes || []).map((i) => ({ ...i }));
    // {nome, peso} depois de "gerar medida"; volta ao automático quando os ingredientes ou o rendimento mudam.
    let medidaGerada = existente?.mc?.[0]?.nome_mc === NOME_PORCAO_GERADA ? { nome: NOME_PORCAO_GERADA, peso: existente.mc[0].peso } : null;
    let pesoFinalEditado = !!existente;
    let resultado = null;
    const painel = criarPainel();
    const linhas = new Map();
    // Formato da kcal de cada linha, como no WebDiet (§12 #28): ao redesenhar a lista, "256Kcal"; a linha
    // recalculada (o ingrediente recém-incluído ou o que teve a quantidade/medida mudada), "117.6 Kcal".
    let modos = ingredientes.map(() => 'redesenhada');

    const nome = h('input', { value: existente?.nome ?? '', autocomplete: 'off', required: true });
    const rendimento = h('input', { value: existente?.rendimento ?? '', inputmode: 'decimal', autocomplete: 'off' });
    const descricao = h('textarea', { rows: 5 }, existente?.descricao ?? '');
    const pesoFinal = h('input', { value: existente?.peso ?? '', inputmode: 'decimal', autocomplete: 'off' });
    const compras = h('input', { value: existente?.compras ?? '', autocomplete: 'off' });
    const nomeMedida = h('input', { value: existente?.mc?.[0]?.nome_mc ?? '', autocomplete: 'off', readonly: true, 'aria-readonly': 'true' });
    const pesoMedida = h('input', { value: existente?.mc?.[0]?.peso ?? '', autocomplete: 'off', readonly: true, 'aria-readonly': 'true' });
    const corpoIngredientes = h('div', {});

    const seletor = criarSeletor(catalogo, {
      rotulo: 'Ingrediente',
      aoAdicionar: (a, q, medida) => {
        ingredientes.push({ alimento: instantaneo(a), quantidade: q, medida });
        modos = [...ingredientes.map(() => 'redesenhada').slice(1), 'recalculada'];
        medidaGerada = null;
        desenhar();
      },
    });

    function desenhar() {
      linhas.clear();
      corpoIngredientes.replaceChildren(ingredientes.length ? h('div', { class: 'tabela-rolagem' }, h('table', { class: 'medidas tabela-plano' },
        h('caption', { class: 'oculto-visual' }, 'Ingredientes'),
        h('thead', {}, h('tr', {}, ['Ingrediente', 'Qtd.', 'Medida', 'Peso', 'PTN', 'LIP', 'CHO', 'kcal'].map((t, i) => h('th', { scope: 'col', class: i === 1 || i >= 3 ? 'num' : null }, t)),
          h('th', { scope: 'col' }, h('span', { class: 'oculto-visual' }, 'Ações')))),
        h('tbody', {}, ingredientes.map((ing, i) => {
          const c = { peso: h('td', { class: 'num' }), ptn: h('td', { class: 'num' }), lip: h('td', { class: 'num' }), cho: h('td', { class: 'num' }), kcal: h('td', { class: 'num' }) };
          linhas.set(i, c);
          return h('tr', {},
            h('th', { scope: 'row' }, ing.alimento.nome, ing.alimento.origem ? h('div', {}, h('small', {}, ing.alimento.origem)) : null),
            h('td', { class: 'num' }, campoQuantidadeLinha(ing.quantidade, `Quantidade de ${ing.alimento.nome}`, (v) => { ing.quantidade = v; modos[i] = 'recalculada'; medidaGerada = null; recalcular(); })),
            h('td', {}, seletorMedidaLinha(ing.alimento, ing.medida, `Medida de ${ing.alimento.nome}`, (v) => { ing.medida = v; modos[i] = 'recalculada'; medidaGerada = null; recalcular(); })),
            c.peso, c.ptn, c.lip, c.cho, c.kcal,
            h('td', {}, h('button', { type: 'button', class: 'botao discreto', 'aria-label': `Remover ${ing.alimento.nome}`, onclick: () => { ingredientes.splice(i, 1); modos = ingredientes.map(() => 'redesenhada'); medidaGerada = null; desenhar(); } }, 'Remover')));
        })))) : h('p', { class: 'legenda' }, catalogo.itens.length ? 'Nenhum ingrediente ainda.' : 'Cadastre os ingredientes em "Meus alimentos" primeiro.'));
      recalcular();
    }

    function recalcular() {
      const avisos = [];
      try {
        resultado = calcularReceita({ ingredientes, rendimento: rendimento.value });
      } catch (e) {
        console.error(e);
        resultado = null;
        avisos.push('Não foi possível calcular: ' + e.message);
      }
      if (resultado) {
        resultado.linhas.forEach((l, i) => {
          const c = linhas.get(i);
          if (!c) return;
          // Textos da linha como na tela do WebDiet ("200g", "5.0g").
          c.peso.textContent = l.tela.peso;
          c.ptn.textContent = l.tela.ptn; c.lip.textContent = l.tela.lip; c.cho.textContent = l.tela.cho;
          c.kcal.textContent = formatarKcalIngrediente(l.kcal, modos[i] || 'redesenhada');
        });
        // O peso final acompanha a soma dos ingredientes até ser digitado (como o campo #peso do WebDiet).
        if (!pesoFinalEditado) pesoFinal.value = ingredientes.length ? resultado.tela.peso : '';
        const medida = medidaGerada || resultado.porcao;
        nomeMedida.value = medida ? medida.nome : '';
        pesoMedida.value = medida ? String(medida.peso) : '';
        if (!resultado.porcao && !medidaGerada) avisos.push('Informe o rendimento (número de porções) para calcular a porção.');
      }
      const t = resultado?.tela;
      // Ficha da porção com os valores por 100 g que serão gravados (mesmo arredondamento de salvarReceita).
      const pf = Number(String(pesoFinal.value).replace(',', '.'));
      const por100 = (v) => fxn((Number(v) / pf) * 100, 1);
      const porcao = resultado && pesoMedida.value && pf > 0
        ? infoReceita({ kcal: por100(t.kcal), ptn: por100(t.ptn), lip: por100(t.lip), cho: por100(t.cho) }, pesoMedida.value)
        : null;
      painel.atualizar({
        destaques: [
          { chave: 'peso', rotulo: 'Peso dos ingredientes', valor: t ? `${t.peso} g` : '-' },
          { chave: 'kcal', rotulo: 'Energia total', valor: t ? `${t.kcal} kcal` : '-' },
          { chave: 'porcao', rotulo: 'Porção', valor: pesoMedida.value ? `${pesoMedida.value} g` : '-', detalhe: nomeMedida.value, estado: '' },
        ],
        grupos: [
          { titulo: 'Total da receita', itens: [
            { chave: 'ptn', rotulo: 'Proteínas', valor: t ? `${t.ptn} g` : '-' },
            { chave: 'lip', rotulo: 'Lipídios', valor: t ? `${t.lip} g` : '-' },
            { chave: 'cho', rotulo: 'Carboidratos', valor: t ? `${t.cho} g` : '-' },
          ] },
          { titulo: TEXTO_INFO_PORCAO, itens: [
            { chave: 'pKcal', rotulo: 'Energia', valor: porcao ? `${porcao.tela.kcal} kcal` : '-' },
            { chave: 'pPtn', rotulo: 'Proteínas', valor: porcao ? `${porcao.tela.ptn} g` : '-' },
            { chave: 'pLip', rotulo: 'Lipídios', valor: porcao ? `${porcao.tela.lip} g` : '-' },
            { chave: 'pCho', rotulo: 'Carboidratos', valor: porcao ? `${porcao.tela.cho} g` : '-' },
          ] },
        ],
        avisos,
      });
    }

    function gerar() {
      const g = gerarMedida({ pesoFinal: pesoFinal.value, rendimento: rendimento.value });
      if (g.aviso) { avisar(AVISO_GERAR_MEDIDA + '.'); return; }
      medidaGerada = { nome: g.nome, peso: g.peso };
      recalcular();
      avisar(`Porção gerada pelo peso final: ${g.peso} g.`);
    }

    function salvar(ev) {
      ev.preventDefault();
      recalcular();
      if (!resultado) return;
      const r = salvarReceita({
        ...resultado.tela,
        fibras: resultado.totais.fibras,
        micros: resultado.totais.micros,
        nome: nome.value,
        descricao: descricao.value,
        rendimento: rendimento.value,
        peso: pesoFinal.value,
        mc1: nomeMedida.value,
        mcQnt1: pesoMedida.value,
      });
      if (!r.valido) { avisar(`Para salvar, preencha: ${r.faltando.map((f) => NOMES_FALTANDO[f] || f).join(', ')}.`); return; }
      const salvo = banco.salvar('receitas', {
        ...(existente || {}),
        ...r.registro,
        compras: compras.value.trim(),
        ingredientes: ingredientes.map((i) => ({ alimento: i.alimento, quantidade: i.quantidade, medida: i.medida })),
        atualizadoEm: new Date().toISOString(),
      });
      avisar(`"${salvo.nome}" salva: ${num(salvo.kcal, 1)} kcal por 100 g; porção de ${salvo.mc[0].peso} g.`);
      lista();
    }

    const form = h('form', { class: 'painel-duplo', novalidate: true, 'aria-label': 'Receita' },
      h('div', { class: 'pilha' },
        h('div', { class: 'cartao pilha', role: 'group', 'aria-labelledby': 'rec-dados' },
          h('h3', { id: 'rec-dados' }, 'Receita'),
          h('div', { class: 'campos' },
            campo('Nome', nome),
            campo('Rendimento (porções)', rendimento),
            campo('Nome na lista de compras', compras, 'Opcional. Com receitas, a lista de compras usa os ingredientes.')),
          campo('Modo de preparo', descricao)),
        h('div', { class: 'cartao pilha', role: 'group', 'aria-labelledby': 'rec-ingredientes' },
          h('h3', { id: 'rec-ingredientes' }, 'Ingredientes'),
          corpoIngredientes,
          seletor.el),
        h('div', { class: 'cartao pilha', role: 'group', 'aria-labelledby': 'rec-porcao' },
          h('h3', { id: 'rec-porcao' }, 'Peso final e porção'),
          h('div', { class: 'campos compactos' },
            campo('Peso final (g)', pesoFinal, 'Ex.: depois do cozimento.'),
            campo('Medida', nomeMedida),
            campo('Porção (g)', pesoMedida)),
          h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'botao secundario', onclick: gerar }, 'Gerar medida pelo peso final')),
          h('p', { class: 'legenda' }, 'Com o rendimento, a porção é automática: soma dos ingredientes / rendimento ("Porção"). "Gerar medida" usa o peso final / rendimento ("Porção(ões)") e volta ao automático se os ingredientes mudarem. Os valores por 100 g são gravados sobre o peso final.'))),
      h('aside', { class: 'cartao pilha painel-fixo', 'aria-labelledby': 'rec-resultado' },
        h('h3', { id: 'rec-resultado' }, 'Resultado'),
        painel.el,
        h('div', { class: 'acoes' },
          h('button', { class: 'botao', type: 'submit' }, existente ? 'Salvar alterações' : 'Salvar receita'),
          h('button', { class: 'botao secundario', type: 'button', onclick: lista }, 'Cancelar'))));

    rendimento.addEventListener('input', () => { medidaGerada = null; recalcular(); });
    pesoFinal.addEventListener('input', () => { pesoFinalEditado = pesoFinal.value.trim() !== ''; recalcular(); });
    form.addEventListener('submit', salvar);

    raiz.replaceChildren(catalogo.datalist, cabecalho(existente ? 'Editar receita' : 'Nova receita'), form);
    desenhar();
    nome.focus();
  }

  lista();
}

registrarRota(/^#\/receitas$/, (raiz) => paginaReceitas(raiz, db));
