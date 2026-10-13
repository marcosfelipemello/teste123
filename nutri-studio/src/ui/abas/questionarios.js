// Aba "Questionários" da ficha do paciente: os 10 questionários de calc/questionarios (relatório §10).
// O formulário é gerado pelo registro QUESTIONARIOS: tipo "escala" e "selecao" viram grupos de opções
// (rádio), "numerico" (QFA) vira campos de porções por semana. Os textos das perguntas não foram copiados
// do WebDiet (relatório §1.2): cada pergunta aparece como "Item n" e a categoria. Os textos de resultado
// são os do módulo de cálculo (iguais aos do WebDiet).
//
// A "Análise de sinais e sintomas" depende da base sinal → nutrientes do WebDiet, que não foi copiada:
// aparece na lista como indisponível.
//
// Cada questionário salvo é um registro do tipo "questionario":
// { data, questionario (id), nome, modo?, respostas (pontos por item; posição 0 = item 1), resumo, tela }.
import { h, campo, selecao, avisar } from '../dom.js';
import { registrarAba } from '../paginas/pacientes.js';
import { normalizarData } from '../importacao.js';
import { hojeTexto } from '../../calc/numeros.js';
import { QUESTIONARIOS } from '../../calc/questionarios/index.js';
import { criarPainel } from './painel-resultados.js';
import { porData } from './comum.js';

const TIPO = 'questionario';
const AVISO_TEXTOS = 'Os textos das perguntas não foram copiados do WebDiet: cada pergunta aparece como "Item n" e a categoria. Leia as perguntas no instrumento publicado.';

/** Cor do relatório (nome ou hexadecimal) → estado visual do app (o texto continua visível). */
const ESTADO_COR = {
  verde: 'ok', '#2eca9a': 'ok', amarelo: 'alerta', laranja: 'alerta', '#ffa425': 'alerta',
  vermelho: 'perigo', '#fa5423': 'perigo', '#e61c24': 'perigo', '#e53935': 'perigo',
};
const estadoDaCor = (cor) => ESTADO_COR[String(cor ?? '').toLowerCase()] ?? '';

/** Resumo de uma linha para o histórico. */
function resumoTexto(q, r) {
  const t = r?.tela || {};
  switch (q.id) {
    case 'cafeina': {
      const altos = r.fatores.filter((f) => f.nivel === 'alto').map((f) => f.nome);
      return altos.length ? `Média ≥ 4: ${altos.join(', ')}` : 'Nenhum fator com média ≥ 4';
    }
    case 'fenotipo': {
      const altos = r.subescalas.filter((s) => s.classe === 'ALTO').map((s) => s.nome);
      return altos.length ? `Escala ALTO: ${altos.join(', ')}` : 'Nenhuma subescala ALTO';
    }
    case 'qfa': {
      const abaixo = r.categorias.filter((c) => c.consumido < c.recomendado).length;
      return `${abaixo} de ${r.categorias.length} grupos abaixo do recomendado`;
    }
    default:
      return [t.pontuacao, t.perfil, t.resultado].filter(Boolean).join(' · ') || t.mensagem || '-';
  }
}

function montar(raiz, { db, paciente: p }) {
  const area = h('div', { class: 'pilha' });
  raiz.append(h('div', { class: 'pilha', 'aria-live': 'off' }, h('h2', {}, 'Questionários'), area));

  const ordenados = () => porData(db.listarRegistros(p.id, TIPO));

  // ---- Lista ----------------------------------------------------------------------------------
  function lista() {
    const regs = ordenados();
    const escolha = selecao({ name: 'novo', 'aria-label': 'Questionário' },
      Object.values(QUESTIONARIOS).filter((q) => q.tipo !== 'sinais').map((q) => ({ valor: q.id, rotulo: q.nome })), 'rastreamento');
    const historico = regs.length
      ? h('div', { class: 'tabela-rolagem' }, h('table', { class: 'medidas', 'aria-labelledby': 'quest-historico' },
        h('thead', {}, h('tr', {},
          h('th', { scope: 'col' }, 'Data'),
          h('th', { scope: 'col' }, 'Questionário'),
          h('th', { scope: 'col' }, 'Resultado'),
          h('th', { scope: 'col' }, h('span', { class: 'oculto-visual' }, 'Ações')))),
        h('tbody', {}, regs.map((r) => h('tr', {},
          h('th', { scope: 'row' }, r.data || '-'),
          h('td', {}, r.nome || QUESTIONARIOS[r.questionario]?.nome || r.questionario),
          h('td', {}, h('small', {}, r.resumo?.texto || '-')),
          h('td', {}, h('div', { class: 'acoes', style: 'flex-wrap:nowrap' },
            h('button', { type: 'button', class: 'botao discreto', 'aria-label': `Abrir ${r.nome} de ${r.data}`, onclick: () => responder(QUESTIONARIOS[r.questionario], r) }, 'Abrir'),
            h('button', { type: 'button', class: 'botao discreto', 'aria-label': `Excluir ${r.nome} de ${r.data}`, onclick: () => excluir(r) }, 'Excluir'))))))))
      : h('p', { class: 'legenda' }, 'Nenhum questionário respondido ainda.');

    area.replaceChildren(
      h('div', { class: 'cartao pilha' },
        h('h3', {}, 'Novo questionário'),
        h('div', { class: 'seletor-linha' },
          h('div', { class: 'seletor-busca' }, campo('Questionário', escolha)),
          h('div', { class: 'seletor-botao' }, h('button', { type: 'button', class: 'botao', onclick: () => responder(QUESTIONARIOS[escolha.value], null) }, 'Responder'))),
        h('p', { class: 'legenda' }, AVISO_TEXTOS),
        h('p', { class: 'legenda' }, `${QUESTIONARIOS.sinais.nome}: indisponível. Ela depende da base que liga cada um dos ${QUESTIONARIOS.sinais.totalSinais} sinais aos nutrientes, que é conteúdo do WebDiet e não foi copiada.`)),
      h('div', { class: 'cartao pilha' }, h('h3', { id: 'quest-historico' }, 'Respondidos'), historico));
  }

  function excluir(r) {
    if (!confirm(`Excluir ${r.nome} de ${r.data}? Esta ação não pode ser desfeita.`)) return;
    db.excluirRegistro(p.id, TIPO, r.id);
    avisar('Questionário excluído.');
    lista();
  }

  // ---- Formulário de um questionário ----------------------------------------------------------
  function responder(q, registro) {
    if (!q) return;
    const respostas = q.itens.map((_, i) => registro?.respostas?.[i] ?? q.padrao[i] ?? null);
    let modo = registro?.modo ?? q.modoPadrao ?? null;
    let registroId = registro?.id ?? null;
    const painel = criarPainel();
    const dataEl = h('input', { name: 'data', value: registro?.data ?? hojeTexto(), placeholder: 'dd/mm/aaaa', inputmode: 'numeric', autocomplete: 'off' });
    const corpo = h('div', { class: 'pilha' });
    const contagem = h('p', { class: 'legenda' });
    const botaoSalvar = h('button', { class: 'botao', type: 'submit' }, registro ? 'Salvar alterações' : 'Salvar questionário');

    const visivel = (it) => !(q.id === 'cafeina' && modo === 'resumido' && !it.resumido);

    /** Grupos de itens para o formulário: as categorias com lista de itens, ou todos em sequência. */
    function grupos() {
      const comItens = (q.categorias || []).filter((c) => Array.isArray(c.itens) && c.itens.length);
      if (!comItens.length) return [{ nome: null, itens: q.itens.map((it) => it.n) }];
      const vistos = new Set();
      const g = comItens.map((c) => {
        c.itens.forEach((n) => vistos.add(n));
        return { nome: c.nome, itens: c.itens, extra: c.recomendado !== undefined ? `recomendado: ${c.recomendado} porções/semana` : c.maximo ? `máximo ${c.maximo}` : '' };
      });
      const resto = q.itens.map((it) => it.n).filter((n) => !vistos.has(n));
      if (resto.length) g.push({ nome: 'Outros itens', itens: resto });
      return g;
    }

    function controleItem(it) {
      const i = it.n - 1;
      const titulo = `Item ${it.n}`;
      const detalhe = [it.categoria, it.criterio].filter(Boolean).join(' · ');
      if (q.tipo === 'numerico') {
        const el = h('input', { inputmode: 'decimal', autocomplete: 'off', value: respostas[i] ?? '', 'aria-label': `${titulo}${detalhe ? ` (${detalhe})` : ''}, ${it.unidade}` });
        el.addEventListener('input', () => { respostas[i] = el.value; atualizar(); });
        return h('div', { class: 'item-questionario numerico' },
          h('span', { class: 'item-titulo' }, titulo, it.bebida ? h('small', {}, ` bebida ${it.bebida}`) : null),
          h('div', { class: 'item-numero' }, el, h('small', {}, it.unidade)));
      }
      const nome = `q-${q.id}-${it.n}`;
      const legendaId = `${nome}-legenda`;
      const opcoes = it.opcoes.filter((o) => !o.oculta).map((o) => {
        const radio = h('input', { type: 'radio', name: nome, value: String(o.pontos), checked: respostas[i] !== null && String(respostas[i]) === String(o.pontos) });
        radio.addEventListener('change', () => { if (radio.checked) { respostas[i] = o.pontos; atualizar(); } });
        return h('label', { class: 'opcao-questionario' }, radio, h('span', {}, o.rotulo));
      });
      // Itens sem opção "marcada por padrão" podem ser desmarcados (voltam a ficar sem resposta).
      const limpar = q.padrao[i] === null || q.padrao[i] === undefined || it.opcoes.some((o) => o.oculta && o.pontos === q.padrao[i])
        ? h('button', { type: 'button', class: 'botao discreto', 'aria-label': `Limpar a resposta do item ${it.n}`, onclick: (e) => {
          respostas[i] = q.padrao[i] ?? null;
          e.currentTarget.closest('fieldset').querySelectorAll('input').forEach((r) => { r.checked = false; });
          atualizar();
        } }, 'Limpar')
        : null;
      return h('fieldset', { class: `item-questionario ${q.tipo}`, 'aria-labelledby': legendaId },
        h('legend', { id: legendaId, class: 'item-titulo' }, titulo, detalhe && !grupoUnico(it) ? h('small', {}, ` · ${detalhe}`) : null),
        h('div', { class: 'opcoes-questionario' }, opcoes, limpar));
    }

    /** true se a categoria do item já é o título do grupo (não repete no item). */
    function grupoUnico(it) {
      return (q.categorias || []).some((c) => c.nome === it.categoria && Array.isArray(c.itens) && c.itens.includes(it.n));
    }

    function desenharItens() {
      corpo.replaceChildren(...grupos().map((g) => {
        const itens = g.itens.map((n) => q.itens[n - 1]).filter(visivel);
        if (!itens.length) return null;
        return h('div', { class: 'cartao pilha' },
          g.nome ? h('h3', {}, g.nome, g.extra ? h('small', {}, ` (${g.extra})`) : null) : null,
          h('div', { class: 'itens-questionario' }, itens.map(controleItem)));
      }).filter(Boolean));
    }

    function calcular() {
      try {
        return { r: q.calcular(respostas, modo ? { modo } : undefined), erro: null };
      } catch (e) {
        console.error(e);
        return { r: null, erro: e.message };
      }
    }

    function itensPainel(r) {
      const t = r.tela || {};
      const destaques = [];
      const gruposPainel = [];
      if (t.pontuacao) destaques.push({ chave: 'pontuacao', rotulo: 'Pontuação', valor: t.pontuacao });
      if (t.perfil) destaques.push({ chave: 'perfil', rotulo: 'Perfil', valor: t.perfil.replace(/^Perfil: /, '') });
      if (t.resultado) destaques.push({ chave: 'resultado', rotulo: 'Resultado', valor: t.resultado, estadoValor: estadoDaCor(t.cor), largo: t.resultado.length > 16 });
      if (Array.isArray(t.categorias) && t.categorias.length) {
        gruposPainel.push({ titulo: 'Por categoria', itens: r.categorias.map((c, k) => ({ chave: `cat${k}`, rotulo: c.nome, valor: `${c.soma}/${c.maximo}` })) });
      }
      if (q.id === 'cafeina') {
        gruposPainel.push({ titulo: `Fatores (versão ${modo})`, itens: r.fatores.map((f, k) => ({
          chave: `f${k}`, rotulo: f.nome, valor: t.fatores[k].media.replace('Média: ', ''), detalhe: f.nivel === 'alto' ? 'média ≥ 4' : '', estado: estadoDaCor(f.cor),
        })) });
      }
      if (q.id === 'fenotipo') {
        gruposPainel.push({ titulo: 'Subescalas', itens: r.subescalas.map((s, k) => ({
          chave: `s${k}`, rotulo: s.nome, valor: `${s.soma}/${s.maximo}`, detalhe: t.subescalas[k].escala, estado: estadoDaCor(s.cor),
        })) });
      }
      if (q.id === 'qfa') {
        gruposPainel.push({ titulo: 'Consumido × recomendado (porções/semana)', itens: r.categorias.map((c, k) => ({
          chave: `c${k}`, rotulo: c.nome, valor: `${String(parseFloat(c.consumido.toFixed(2)))} / ${c.recomendado}`,
          detalhe: c.consumido < c.recomendado ? 'abaixo' : c.consumido > c.recomendado ? 'acima' : 'igual',
        })) });
        gruposPainel.push({ titulo: 'Bebidas (porções/semana)', itens: [
          { chave: 'bAc', rotulo: 'Açucaradas', valor: String(r.bebidas.acucaradas) },
          { chave: 'bSa', rotulo: 'Saudáveis', valor: String(r.bebidas.saudaveis) },
        ] });
      }
      if (q.id === 'cronotipo' && r.conduta) {
        gruposPainel.push({ titulo: 'Distribuição das refeições', itens: r.conduta.refeicoes.map((x, k) => ({ chave: `r${k}`, rotulo: x.refeicao, valor: `${x.percentual}%` })) });
      }
      if (q.id === 'doshas' && r.contagem) {
        gruposPainel.push({ titulo: 'Respostas', itens: q.categorias.map((c) => ({ chave: c.letra, rotulo: `${c.letra} (${c.nome})`, valor: String(r.contagem[c.letra]) })) });
      }
      return { destaques, grupos: gruposPainel };
    }

    function atualizar() {
      const { r, erro } = calcular();
      const avisos = [];
      if (erro) avisos.push(`Não foi possível calcular: ${erro}`);
      if (r?.aviso) avisos.push(r.aviso);
      const total = q.itens.filter(visivel).length;
      const sem = (r?.semResposta || []).filter((n) => visivel(q.itens[n - 1])).length;
      contagem.textContent = q.tipo === 'numerico'
        ? `${total - sem} de ${total} itens preenchidos (vazio = 0).`
        : `${total - sem} de ${total} itens respondidos${q.exigeTodas ? ' (o resultado sai com todos respondidos)' : ''}.`;
      painel.atualizar({ ...(r ? itensPainel(r) : { destaques: [], grupos: [] }), avisos });
      return r;
    }

    function salvar(e) {
      e.preventDefault();
      const data = normalizarData(dataEl.value);
      if (!data) { avisar('Informe a data (dd/mm/aaaa).'); dataEl.focus(); return; }
      const r = atualizar();
      if (!r) { avisar('Não foi possível calcular este questionário.'); return; }
      const existente = registroId ? db.listarRegistros(p.id, TIPO).find((x) => x.id === registroId) : null;
      const salvo = db.salvarRegistro(p.id, TIPO, {
        ...(existente || {}),
        data,
        questionario: q.id,
        nome: q.nome,
        modo: modo ?? undefined,
        respostas: respostas.slice(),
        resumo: { texto: resumoTexto(q, r) },
        tela: r.tela,
      });
      registroId = salvo.id;
      dataEl.value = data;
      botaoSalvar.textContent = 'Salvar alterações';
      avisar(existente ? 'Questionário atualizado.' : 'Questionário salvo.');
    }

    const form = h('form', { class: 'painel-duplo', novalidate: true, 'aria-label': q.nome },
      h('div', { class: 'pilha' },
        h('div', { class: 'cartao pilha' },
          h('div', { class: 'campos' },
            campo('Data', dataEl),
            q.modos ? campo('Versão', selecao({ name: 'modo' }, q.modos.map((m) => ({ valor: m, rotulo: m === 'resumido' ? 'Resumida (21 itens)' : `Completa (${q.itens.length} itens)` })), modo)) : null),
          h('p', { class: 'legenda' }, AVISO_TEXTOS),
          q.tipo === 'escala' ? h('p', { class: 'legenda' }, `Escala de ${q.itens[0].opcoes.filter((o) => !o.oculta)[0].rotulo} a ${q.itens[0].opcoes.at(-1).rotulo}.`) : null,
          contagem),
        corpo),
      h('aside', { class: 'cartao pilha painel-fixo', 'aria-labelledby': 'quest-resultado' },
        h('h3', { id: 'quest-resultado' }, 'Resultado'),
        painel.el,
        h('div', { class: 'acoes' }, botaoSalvar, h('button', { type: 'button', class: 'botao secundario', onclick: lista }, 'Voltar')),
        h('p', { class: 'legenda' }, `Relatório §${q.secao}.`)));

    form.addEventListener('submit', salvar);
    form.addEventListener('change', (e) => {
      if (e.target.name === 'modo') { modo = e.target.value; desenharItens(); atualizar(); }
      if (e.target === dataEl) { const d = normalizarData(dataEl.value); if (d) dataEl.value = d; }
    });

    area.replaceChildren(h('h3', {}, q.nome), form);
    desenharItens();
    atualizar();
    dataEl.focus();
  }

  lista();
}

registrarAba({ id: 'questionarios', rotulo: 'Questionários', ordem: 50, montar });

