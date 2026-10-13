// Aba "Gestação" da ficha (só pacientes do sexo feminino): acompanhamento gestacional de
// calc/gestante.js (relatório §7) — classe pelo IMC pré-gestacional, curvas brasileiras de ganho de
// peso (Kac et al., 2021), avaliação de cada semana, percentis de CMB/DCT e aporte calórico.
//
// Um acompanhamento ativo por paciente, salvo como registro do tipo "gestacao":
// { ppg, altura, tipo, dum, idade, pesos: {semana: kg}, medidas: {semana: {dct, cb}}, encerradoEm? }.
// A idade gestacional fica guardada como DUM, para avançar sozinha; "hoje" é a data do aparelho.
import { h, campo, selecao, lerFormulario, avisar } from '../dom.js';
import { registrarAba } from '../paginas/pacientes.js';
import { normalizarData } from '../importacao.js';
import { check, fx, hojeTexto, partesData } from '../../calc/numeros.js';
import { acompanhamentoGestacional, avaliarSemana, idadeGestacional } from '../../calc/gestante.js';
import { criarPainel, estadoClasse } from './painel-resultados.js';

const TIPO = 'gestacao';

const numero = (nome, rotulo, extra = {}) =>
  campo(rotulo, h('input', { name: nome, inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', ...extra }));

const temTexto = (x) => String(x ?? '').trim() !== '';

function montar(raiz, { db, paciente: p, recarregar }) {
  const hoje = hojeTexto();
  const temNascimento = !!partesData(p.nascimento);
  const registros = () => db.listarRegistros(p.id, TIPO);
  let registro = registros().find((r) => !r.encerradoEm) || null;
  let pesos = { ...(registro?.pesos || {}) }; // { semana: kg }
  let medidas = { ...(registro?.medidas || {}) }; // { semana: { dct, cb } }
  let semanaAberta = null; // semana cuja avaliação aparece no painel
  let origemIG = 'dum'; // campo de idade gestacional digitado por último
  let alterado = false;

  // ---- Formulários ----------------------------------------------------------------------------
  const formBase = h('form', { class: 'cartao pilha', novalidate: true, 'aria-labelledby': 'gest-dados' },
    h('h3', { id: 'gest-dados' }, 'Dados da gestação'),
    h('div', { class: 'campos alinhados' },
      numero('ppg', 'Peso pré-gestacional (kg)'),
      numero('altura', 'Estatura (cm)'),
      campo('Tipo de gestação', selecao({ name: 'tipo' }, [{ valor: 'Única', rotulo: 'Única' }, { valor: 'Gemelar', rotulo: 'Gemelar' }], 'Única')),
      numero('semanas', 'Idade gestacional hoje (semanas)', { inputmode: 'numeric' }),
      campo('Última menstruação (DUM)', h('input', { name: 'dum', placeholder: 'dd/mm/aaaa', inputmode: 'numeric', autocomplete: 'off' })),
      temNascimento ? null : numero('idade', 'Idade da paciente (anos)', { inputmode: 'numeric' })),
    h('p', { class: 'legenda' }, `Informe as semanas ou a DUM: um preenche o outro. A referência é a data de hoje (${hoje}); nas próximas consultas a semana avança sozinha.`));

  const formSemana = h('form', { class: 'cartao pilha', novalidate: true, 'aria-labelledby': 'gest-registrar' },
    h('h3', { id: 'gest-registrar' }, 'Registrar peso da semana'),
    h('div', { class: 'campos compactos' },
      numero('semana', 'Semana (1 a 40)', { inputmode: 'numeric' }),
      numero('peso', 'Peso atual (kg)'),
      numero('dct', 'Dobra tricipital, DCT (mm)'),
      numero('cb', 'Circunferência do braço, CB (cm)')),
    h('p', { class: 'legenda' }, 'DCT e CB são opcionais: com elas saem a CMB e os percentis (estado proteico e lipídico). Registrar de novo a mesma semana substitui o peso.'),
    h('div', { class: 'acoes' }, h('button', { class: 'botao', type: 'submit' }, 'Registrar peso')));

  // ---- Painel ---------------------------------------------------------------------------------
  const painel = criarPainel();
  const estadoSalvo = h('p', { class: 'legenda' });
  const aside = h('aside', { class: 'cartao pilha painel-fixo', 'aria-labelledby': 'gest-resultados' },
    h('h3', { id: 'gest-resultados' }, 'Resultados'),
    painel.el,
    h('div', { class: 'acoes' },
      h('button', { class: 'botao', type: 'button', onclick: salvar }, 'Salvar acompanhamento'),
      registro ? h('button', { class: 'botao discreto', type: 'button', onclick: encerrar }, 'Encerrar gestação') : null),
    estadoSalvo);

  const corpoTabela = h('div', {});
  const secTabela = h('div', { class: 'cartao pilha' },
    h('h3', {}, 'Semana a semana'),
    h('p', { class: 'legenda' }, 'Faixa recomendada e peso esperado pelas curvas brasileiras de ganho de peso gestacional (Kac et al., 2021), a partir da 10ª semana. O aporte calórico é o adicional diário para chegar ao peso esperado de cada semana, a partir do último peso registrado.'),
    corpoTabela);

  const encerrados = registros().filter((r) => r.encerradoEm);
  const secEncerrados = encerrados.length ? h('div', { class: 'cartao pilha' }, h('h3', {}, 'Gestações encerradas'), tabelaEncerrados(encerrados)) : null;

  // O conteúdo da aba fica fora do aria-live da ficha (só o painel de resultados anuncia mudanças).
  raiz.append(h('div', { class: 'pilha', 'aria-live': 'off' },
    h('h2', {}, 'Acompanhamento gestacional'),
    h('div', { class: 'painel-duplo' }, h('div', { class: 'pilha' }, formBase, formSemana), aside),
    secTabela,
    secEncerrados));

  // ---- Cálculo --------------------------------------------------------------------------------
  function dadosBase() {
    const v = lerFormulario(formBase);
    const d = { ppg: v.ppg, altura: v.altura, tipo: v.tipo, dataReferencia: hoje, pesos };
    if (temNascimento) d.nascimento = p.nascimento;
    else if (temTexto(v.idade)) d.idade = v.idade;
    const dum = normalizarData(v.dum);
    if (dum && (origemIG === 'dum' || !temTexto(v.semanas))) d.dum = dum;
    else if (temTexto(v.semanas)) d.semanas = v.semanas;
    const valido = check(v.ppg) > 0 && check(v.altura) > 0;
    return { v, d, valido };
  }

  function calcular() {
    const { v, d, valido } = dadosBase();
    const avisos = [];
    let r = null;
    let sem = null;
    if (!valido) {
      avisos.push('Informe o peso pré-gestacional e a estatura.');
      return { v, d, r, sem, avisos };
    }
    try {
      r = acompanhamentoGestacional(d);
      if (r.semanas === null) avisos.push('Informe a idade gestacional (semanas) ou a DUM.');
      else if (r.semanas < 0) avisos.push('A DUM informada está no futuro.');
      else if (r.semanas > 43) avisos.push(`${r.semanas} semanas desde a DUM: acima de 43, a semana atual é tratada como 40. Confira a DUM.`);
      avisos.push(...r.avisos);
    } catch (e) {
      avisos.push('Não foi possível calcular: ' + e.message);
      return { v, d, r: null, sem, avisos };
    }
    if (semanaAberta && pesos[semanaAberta]) {
      try {
        sem = avaliarSemana({ ...d, semana: semanaAberta, peso: pesos[semanaAberta], ...(medidas[semanaAberta] || {}) });
        avisos.push(...sem.avisos);
      } catch (e) {
        avisos.push(`Semana ${semanaAberta}: ${e.message}`);
      }
    }
    return { v, d, r, sem, avisos };
  }

  function itensPainel({ r, sem, v }) {
    if (!r) return { destaques: [], grupos: [] };
    const i = r.semanaAtual >= 1 && r.semanaAtual <= 40 ? r.semanaAtual - 1 : null;
    const linha = i === null ? null : r.linhas[i];
    const ultimaLinha = r.pesoUlt === null ? null : r.linhas[r.ult - 1];
    const grupos = [{
      titulo: 'Situação atual',
      itens: [
        { chave: 'tipo', rotulo: 'Gestação', valor: r.tipo },
        { chave: 'idade', rotulo: 'Idade da paciente', valor: r.idade === null ? '-' : `${r.idade} anos` },
        { chave: 'ultimo', rotulo: 'Último peso', valor: r.pesoUlt === null ? '-' : `${fx(r.pesoUlt, 1)} Kg (semana ${r.ult})`, detalhe: ultimaLinha?.avaliacao || '' },
        { chave: 'ganho', rotulo: 'Ganho de peso', valor: r.pesoUlt === null ? '-' : `${fx(r.pesoUlt - check(v.ppg), 2)} Kg` },
        { chave: 'faixa', rotulo: 'Faixa recomendada hoje', valor: linha && linha.semana >= 10 ? `${fx(linha.minimo, 1)} a ${fx(linha.maximo, 1)} Kg` : '-' },
        { chave: 'esperado', rotulo: 'Peso esperado hoje', valor: linha ? `${fx(linha.esperado, 1)} Kg` : '-' },
        { chave: 'aporte', rotulo: 'Aporte calórico hoje', valor: i === null ? '-' : r.tela.linhas[i][4] },
      ],
    }];
    if (sem) {
      grupos.push({
        titulo: `Avaliação da semana ${sem.semana}`,
        itens: [
          { chave: 'sPeso', rotulo: 'Peso', valor: `${fx(sem.peso, 1)} Kg` },
          { chave: 'sImc', rotulo: 'IMC atual', valor: sem.tela.imc },
          { chave: 'sSituacao', rotulo: 'Situação na curva', valor: sem.tela.en, estadoValor: estadoClasse(sem.tela.en) },
          { chave: 'sGanho', rotulo: 'Ganho total', valor: `${sem.tela.pesoTotal} Kg` },
          { chave: 'sCmb', rotulo: 'CMB', valor: sem.tela.cmb },
          { chave: 'sProteico', rotulo: 'Percentil da CMB', valor: sem.tela.proteico },
          { chave: 'sLipidico', rotulo: 'Percentil da DCT', valor: sem.tela.lipidico },
        ],
      });
    }
    return {
      destaques: [
        { chave: 'imcPpg', rotulo: 'IMC pré-gestacional', valor: r.tela.imcPpg, detalhe: r.classe },
        { chave: 'semana', rotulo: 'Semana atual', valor: r.semanaAtual === null ? '-' : `${r.semanaAtual} semanas`, detalhe: r.dum ? `DUM ${r.dum}` : '' },
      ],
      grupos,
    };
  }

  function desenharTabela(r) {
    if (!r) {
      corpoTabela.replaceChildren(h('p', { class: 'legenda' }, 'Preencha o peso pré-gestacional e a estatura para ver as semanas.'));
      return;
    }
    const tela = r.tela.linhas;
    corpoTabela.replaceChildren(h('div', { class: 'tabela-rolagem' }, h('table', { class: 'medidas' },
      h('caption', { class: 'oculto-visual' }, 'Curva de ganho de peso, pesos registrados e aporte calórico por semana de gestação'),
      h('thead', {}, h('tr', {},
        h('th', { scope: 'col' }, 'Semana'),
        h('th', { scope: 'col', class: 'num' }, 'Esperado'),
        h('th', { scope: 'col', class: 'num' }, 'Mínimo'),
        h('th', { scope: 'col', class: 'num' }, 'Máximo'),
        h('th', { scope: 'col', class: 'num' }, 'Peso registrado'),
        h('th', { scope: 'col' }, 'Situação'),
        h('th', { scope: 'col', class: 'num' }, 'Aporte calórico'),
        h('th', { scope: 'col' }, h('span', { class: 'oculto-visual' }, 'Ações')))),
      h('tbody', {}, r.linhas.map((l, i) => {
        const atual = l.semana === r.semanaAtual;
        return h('tr', { 'aria-current': atual ? 'true' : null },
          h('th', { scope: 'row' }, String(l.semana), atual ? [' ', h('span', { class: 'etiqueta' }, 'hoje')] : null),
          h('td', { class: 'num' }, `${fx(l.esperado, 1)} Kg`),
          h('td', { class: 'num' }, tela[i][1]),
          h('td', { class: 'num' }, tela[i][2]),
          h('td', { class: 'num' }, l.peso === null
            ? h('button', { type: 'button', class: 'botao discreto', 'aria-label': `Registrar peso da semana ${l.semana}`, onclick: () => prepararRegistro(l.semana) }, 'registrar peso')
            : tela[i][3]),
          h('td', {}, l.avaliacao ? h('span', { class: estadoClasse(l.avaliacao) || null }, l.avaliacao) : ''),
          h('td', { class: 'num' }, tela[i][4]),
          h('td', {}, l.peso === null ? null : h('div', { class: 'acoes', style: 'flex-wrap:nowrap' },
            h('button', { type: 'button', class: 'botao discreto', 'aria-label': `Abrir a avaliação da semana ${l.semana}`, onclick: () => abrirSemana(l.semana) }, 'Abrir'),
            h('button', { type: 'button', class: 'botao discreto', 'aria-label': `Remover o peso da semana ${l.semana}`, onclick: () => removerSemana(l.semana) }, 'Remover'))));
      })))));
  }

  function tabelaEncerrados(lista) {
    return h('div', { class: 'tabela-rolagem' }, h('table', { class: 'medidas' },
      h('thead', {}, h('tr', {},
        h('th', { scope: 'col' }, 'DUM'),
        h('th', { scope: 'col' }, 'Gestação'),
        h('th', { scope: 'col' }, 'Classe pré-gestacional'),
        h('th', { scope: 'col', class: 'num' }, 'Último peso'),
        h('th', { scope: 'col' }, 'Encerrada em'),
        h('th', { scope: 'col' }, h('span', { class: 'oculto-visual' }, 'Ações')))),
      h('tbody', {}, lista.map((g) => {
        let r = null;
        try { r = acompanhamentoGestacional({ ppg: g.ppg, altura: g.altura, tipo: g.tipo, pesos: g.pesos }); } catch { r = null; }
        return h('tr', {},
          h('th', { scope: 'row' }, g.dum || '-'),
          h('td', {}, g.tipo || 'Única'),
          h('td', {}, r ? `${r.classe} (${r.tela.imcPpg})` : '-'),
          h('td', { class: 'num' }, r && r.pesoUlt !== null ? `${fx(r.pesoUlt, 1)} Kg (sem. ${r.ult})` : '-'),
          h('td', {}, g.encerradoEm),
          h('td', {}, h('button', { type: 'button', class: 'botao discreto', 'aria-label': `Excluir a gestação encerrada em ${g.encerradoEm}`, onclick: () => {
            if (!confirm('Excluir este acompanhamento encerrado? Esta ação não pode ser desfeita.')) return;
            db.excluirRegistro(p.id, TIPO, g.id);
            recarregar();
          } }, 'Excluir')));
      }))));
  }

  function atualizarEstadoSalvo() {
    if (!registro) estadoSalvo.textContent = 'Ainda não salvo.';
    else if (alterado) estadoSalvo.textContent = 'Há alterações não salvas.';
    else estadoSalvo.textContent = `Salvo em ${new Date(registro.atualizadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.`;
  }

  function atualizar() {
    const c = calcular();
    painel.atualizar({ ...itensPainel(c), avisos: c.avisos });
    desenharTabela(c.r);
    atualizarEstadoSalvo();
    return c;
  }

  // ---- Ações ----------------------------------------------------------------------------------
  function persistir() {
    const { v, d } = dadosBase();
    let dum = d.dum || null;
    if (!dum && d.semanas !== undefined) dum = idadeGestacional({ semanas: d.semanas, dataReferencia: hoje }).dum;
    registro = db.salvarRegistro(p.id, TIPO, {
      ...(registro || {}),
      ppg: v.ppg, altura: v.altura, tipo: v.tipo, dum, idade: v.idade ?? '', pesos, medidas,
    });
    alterado = false;
  }

  function salvar() {
    if (!dadosBase().valido) {
      avisar('Informe o peso pré-gestacional e a estatura antes de salvar.');
      formBase.elements.ppg.focus();
      return;
    }
    const novo = !registro;
    persistir();
    avisar('Acompanhamento salvo.');
    if (novo) recarregar(); // mostra o botão "Encerrar gestação"
    else atualizar();
  }

  function encerrar() {
    if (!registro) return;
    if (!confirm('Encerrar este acompanhamento? Ele vai para "Gestações encerradas" e a aba fica livre para uma nova gestação.')) return;
    persistir();
    db.salvarRegistro(p.id, TIPO, { ...registro, encerradoEm: hoje });
    avisar('Gestação encerrada.');
    recarregar();
  }

  function preencherRegistro(semana) {
    const el = formSemana.elements;
    el.semana.value = semana;
    el.peso.value = pesos[semana] ?? '';
    el.dct.value = medidas[semana]?.dct ?? '';
    el.cb.value = medidas[semana]?.cb ?? '';
  }

  function prepararRegistro(semana) {
    preencherRegistro(semana);
    formSemana.elements.peso.focus();
  }

  function abrirSemana(semana) {
    semanaAberta = semana;
    prepararRegistro(semana);
    atualizar();
  }

  function removerSemana(semana) {
    if (!confirm(`Remover o peso registrado na semana ${semana}?`)) return;
    delete pesos[semana];
    delete medidas[semana];
    if (semanaAberta === semana) semanaAberta = null;
    if (dadosBase().valido) persistir();
    atualizar();
    avisar(`Peso da semana ${semana} removido.`);
  }

  function registrar(e) {
    e.preventDefault();
    const v = lerFormulario(formSemana);
    const semana = parseInt(String(v.semana).trim(), 10);
    if (!(semana >= 1 && semana <= 40)) {
      avisar('Informe a semana, de 1 a 40.');
      formSemana.elements.semana.focus();
      return;
    }
    if (!(check(v.peso) > 0)) {
      avisar('Informe o peso da semana.');
      formSemana.elements.peso.focus();
      return;
    }
    const base = dadosBase();
    if (!base.valido) {
      avisar('Preencha antes o peso pré-gestacional e a estatura.');
      formBase.elements.ppg.focus();
      return;
    }
    try {
      avaliarSemana({ ...base.d, semana, peso: v.peso, dct: v.dct, cb: v.cb });
    } catch (erro) {
      avisar(erro.message);
      return;
    }
    pesos[semana] = check(v.peso);
    if (temTexto(v.dct) || temTexto(v.cb)) medidas[semana] = { dct: v.dct.trim(), cb: v.cb.trim() };
    else delete medidas[semana];
    semanaAberta = semana;
    const novo = !registro;
    persistir();
    avisar(`Peso da semana ${semana} registrado.`);
    if (novo) recarregar();
    else atualizar();
  }

  // ---- Eventos e estado inicial ---------------------------------------------------------------
  formBase.addEventListener('submit', (e) => { e.preventDefault(); salvar(); });
  formBase.addEventListener('input', (e) => {
    if (e.target.name === 'semanas') origemIG = 'semanas';
    if (e.target.name === 'dum') origemIG = 'dum';
    alterado = true;
    atualizar();
  });
  formBase.addEventListener('change', (e) => {
    // Semanas e DUM se preenchem um ao outro (referência: hoje).
    if (e.target.name === 'semanas' && temTexto(e.target.value)) {
      formBase.elements.dum.value = idadeGestacional({ semanas: e.target.value, dataReferencia: hoje }).dum;
    } else if (e.target.name === 'dum') {
      const dum = normalizarData(e.target.value);
      if (dum) {
        e.target.value = dum;
        formBase.elements.semanas.value = idadeGestacional({ dum, dataReferencia: hoje }).semanas;
      }
    }
    atualizar();
  });
  formSemana.addEventListener('submit', registrar);

  const el = formBase.elements;
  if (registro) {
    el.ppg.value = registro.ppg ?? '';
    el.altura.value = registro.altura ?? '';
    el.tipo.value = registro.tipo || 'Única';
    if (el.idade) el.idade.value = registro.idade ?? '';
    if (registro.dum) {
      el.dum.value = registro.dum;
      el.semanas.value = idadeGestacional({ dum: registro.dum, dataReferencia: hoje }).semanas;
    }
    // Abre a avaliação do último peso registrado.
    const semanas = Object.keys(pesos).map(Number).filter((s) => pesos[s] > 0);
    if (semanas.length) semanaAberta = Math.max(...semanas);
  } else {
    // Estatura da última avaliação antropométrica, se houver.
    const ultimaAntropo = db.listarRegistros(p.id, 'antropometria')[0];
    if (ultimaAntropo?.entrada?.estatura) el.altura.value = ultimaAntropo.entrada.estatura;
  }
  const inicial = atualizar();
  const atual = inicial.r?.semanaAtual;
  if (semanaAberta) preencherRegistro(semanaAberta);
  else if (atual >= 1 && atual <= 40) formSemana.elements.semana.value = atual;
}

registrarAba({ id: 'gestacao', rotulo: 'Gestação', ordem: 25, disponivel: (p) => p.sexo === 'F', montar });
