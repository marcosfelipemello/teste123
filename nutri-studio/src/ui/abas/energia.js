// Aba "Cálculo energético" da ficha do paciente: TMB e GET de calc/energia.js (relatório §4).
// O formulário é montado a partir de PROTOCOLOS: cada fórmula mostra só os dados de que precisa
// (`entradas`), a lista de fator atividade da fórmula (`listaFatores`, por sexo e idade) e os adicionais
// que ela soma (`adicionais`). Os textos de TMB e GET são os do módulo de cálculo (iguais aos do WebDiet).
//
// Peso, altura e MLG vêm pré-preenchidos da última antropometria; semanas e estado nutricional da EER
// 2023 gestante vêm do acompanhamento gestacional ativo. A idade é calculada na data do cálculo.
//
// Cada cálculo salvo é um registro do tipo "energia":
// { data, formula, protocolo, entrada (campos do formulário, como texto), atividades, resumo, tela }.
// O planejamento alimentar usa o GET (resumo.get) do cálculo mais recente como meta.
import { h, campo, selecao, lerFormulario, avisar } from '../dom.js';
import { registrarAba } from '../paginas/pacientes.js';
import { normalizarData } from '../importacao.js';
import { check, fx, idadeAnos, idadeMeses, hojeTexto, partesData } from '../../calc/numeros.js';
import {
  calcularEnergia, calcularMet, converterGetManual, listaFatores, PROTOCOLOS, INJURIAS, DISPOSICAO_GESTANTE,
} from '../../calc/energia.js';
import { acompanhamentoGestacional } from '../../calc/gestante.js';
import { criarPainel } from './painel-resultados.js';
import { porData, dadosAntropometria, textoNumero } from './comum.js';

const TIPO = 'energia';
const PADROES = { formula: '', injuria: '0', dias: '90' };
/** Fórmulas em que o peso só serve ao kcal/kg (GET manual, TMB manual, HandyMET). */
const SEM_PESO_OBRIGATORIO = [10, 14, 24];
/** Id da injúria "Queimadura 100%" (rótulo 2,1; a conta usa 2,0 — relatório §12, item 5). */
const INJURIA_ROTULO_DIVERGENTE = 12;

const numero = (nome, rotulo, extra = {}, ajuda) =>
  campo(rotulo, h('input', { name: nome, inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', ...extra }), ajuda);

const informado = (x) => String(x ?? '').trim() !== '';
const virgula = (n, casas) => fx(n, casas).replace('.', ',');

/** Texto de uma opção de fator atividade. */
function rotuloFator(o) {
  if (o.valor === '') return 'Selecione';
  if (o.rotulo === o.valor || /\d/.test(o.rotulo)) return o.rotulo;
  return `${o.rotulo} (${o.valor})`;
}

/** <select> de fator injúria agrupado como na tela (Harris-Benedict 1919 e Long 1979). */
function selecaoInjuria() {
  const grupos = new Map();
  for (const o of INJURIAS) {
    if (!grupos.has(o.grupo)) grupos.set(o.grupo, []);
    grupos.get(o.grupo).push(h('option', { value: o.id }, o.grupo ? `${o.nome} (${virgula(o.valorRotulo, 2)})` : o.nome));
  }
  return h('select', { name: 'injuria' }, [...grupos].map(([g, ops]) => (g ? h('optgroup', { label: g }, ops) : ops)));
}

function montar(raiz, { db, paciente: p }) {
  const temNascimento = !!partesData(p.nascimento);
  const sexo = p.sexo === 'M' || p.sexo === 'F' ? p.sexo : '';
  let atualId = null; // registro em edição (null = cálculo novo)
  let atividades = []; // [{descricao, met, minutos}]
  let origemGet = 'kcal'; // campo do GET manual digitado por último
  let chaveFatores = null;

  const gestacao = (() => {
    const g = db.listarRegistros(p.id, 'gestacao').find((x) => !x.encerradoEm);
    if (!g || !(check(g.ppg) > 0) || !(check(g.altura) > 0)) return null;
    try {
      const d = { ppg: g.ppg, altura: g.altura, tipo: g.tipo, dataReferencia: hojeTexto(), pesos: g.pesos || {} };
      if (temNascimento) d.nascimento = p.nascimento; else if (informado(g.idade)) d.idade = g.idade;
      if (g.dum) d.dum = g.dum;
      const r = acompanhamentoGestacional(d);
      if (r.semanaAtual === null || r.semanaAtual < 1) return null;
      const linha = r.linhas[Math.min(r.semanaAtual, 40) - 1];
      // Sem peso registrado o aporte segue o WebDiet (contra 0 kg, §12 #18): não é oferecido como adicional.
      return { semanas: r.semanaAtual, classe: r.classe, aporte: r.pesoUlt === null ? null : linha?.kcal ?? null };
    } catch {
      return null;
    }
  })();

  // ---- Formulário -----------------------------------------------------------------------------
  let seq = 0;
  function grupoCampos(titulo, ...filhos) {
    const id = `energia-grupo-${++seq}`;
    return h('div', { class: 'cartao pilha', role: 'group', 'aria-labelledby': id }, h('h3', { id }, titulo), ...filhos);
  }
  /** Marca um elemento como exclusivo das fórmulas que pedem a entrada `chave`. */
  const pede = (chave, el) => { el.dataset.entrada = chave; return el; };
  /** Marca um elemento como exclusivo das fórmulas que somam o adicional `chave`. */
  const soma = (chave, el) => { el.dataset.adicional = chave; return el; };

  const legendaIdade = h('p', { class: 'legenda' });
  const legendaOrigem = h('div', { class: 'pilha' });
  const legendaFormula = h('p', { class: 'legenda' });
  const seletorFator = h('select', { name: 'fator' });
  const rotuloFatorEl = h('span', {}, 'Fator atividade');
  const campoFator = h('label', { class: 'campo' }, rotuloFatorEl, seletorFator);
  const notaInjuria = h('p', { class: 'legenda oculto' },
    'No WebDiet o rótulo desta opção mostra 2,1, mas a conta usa 2,0 (relatório §12, item 5). Mantido igual ao WebDiet até decisão.');
  const legendaVenta = h('p', { class: 'legenda' });
  const corpoMet = h('div', { class: 'pilha' });
  const legendaAdicionais = h('p', { class: 'legenda' });
  const botaoAporte = gestacao && gestacao.aporte !== null
    ? h('button', { type: 'button', class: 'botao secundario', onclick: () => { form.elements.adicionalGestante.value = String(gestacao.aporte); atualizar(); } },
      `Usar aporte da gestação (semana ${gestacao.semanas}: +${gestacao.aporte} kcal/dia)`)
    : null;

  const colunaCampos = h('div', { class: 'pilha' },
    grupoCampos('Fórmula',
      h('div', { class: 'campos' },
        campo('Data do cálculo', h('input', { name: 'data', value: hojeTexto(), placeholder: 'dd/mm/aaaa', inputmode: 'numeric', autocomplete: 'off' })),
        campo('Fórmula', selecao({ name: 'formula' }, [{ valor: '', rotulo: 'Escolha a fórmula' }, ...PROTOCOLOS.map((x) => ({ valor: x.id, rotulo: x.nome }))], PADROES.formula)),
        temNascimento ? null : numero('idade', 'Idade (anos)', { inputmode: 'numeric' }),
        temNascimento ? null : numero('meses', 'Idade (meses)', { inputmode: 'numeric' }, 'Para crianças pequenas.')),
      legendaFormula,
      legendaIdade),

    grupoCampos('Dados do paciente',
      h('div', { class: 'campos compactos' },
        pede('peso', numero('peso', 'Peso (kg)')),
        pede('altura', numero('altura', 'Altura (cm)')),
        pede('mlg', numero('mlg', 'Massa livre de gordura (kg)')),
        pede('tmbInformada', numero('tmbInformada', 'TMB (kcal/dia)'))),
      legendaOrigem),

    pede('getManual', grupoCampos('GET manual',
      h('div', { class: 'campos compactos' },
        numero('getKcal', 'GET (kcal/dia)'),
        numero('getKcalKg', 'GET (kcal/kg)')),
      h('p', { class: 'legenda' }, 'Digite um dos dois: o outro é calculado pelo peso.'))),

    pede('bolso', grupoCampos('Fórmula de bolso (g/kg de peso)',
      h('div', { class: 'campos compactos' },
        numero('bolsoPtn', 'Proteína (g/kg)'),
        numero('bolsoLip', 'Lipídio (g/kg)'),
        numero('bolsoCho', 'Carboidrato (g/kg)')),
      h('p', { class: 'legenda' }, 'GET = PTN × peso × 4 + LIP × peso × 9 + CHO × peso × 4.'))),

    pede('semanas', grupoCampos('Gestação',
      h('div', { class: 'campos' },
        numero('semanas', 'Idade gestacional (semanas)', { inputmode: 'numeric' }),
        campo('Estado nutricional', selecao({ name: 'estadoNutricional' }, [{ valor: '', rotulo: 'Selecione' }, ...Object.keys(DISPOSICAO_GESTANTE)], ''))),
      h('p', { class: 'legenda' }, gestacao
        ? `Do acompanhamento gestacional: semana ${gestacao.semanas}, ${gestacao.classe}.`
        : 'Sem acompanhamento gestacional ativo: informe as semanas e o estado nutricional pré-gestacional.'))),

    pede('dataParto', grupoCampos('Lactação',
      h('div', { class: 'campos' },
        campo('Data do parto', h('input', { name: 'dataParto', placeholder: 'dd/mm/aaaa', inputmode: 'numeric', autocomplete: 'off' })),
        numero('mesesAmamentacao', 'Ou meses de amamentação', { inputmode: 'numeric' })),
      h('p', { class: 'legenda' }, 'Com a data do parto, os meses são contados até a data do cálculo (mês a mês, sem olhar o dia, como no WebDiet).'))),

    grupoCampos('Fatores',
      h('div', { class: 'campos' }, campoFator, campo('Fator injúria', selecaoInjuria())),
      notaInjuria),

    grupoCampos('Adicionais',
      legendaAdicionais,
      soma('met', h('div', { class: 'pilha' },
        h('h4', { class: 'titulo-grupo' }, 'Atividade física (MET)'),
        corpoMet,
        h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'botao secundario', onclick: () => { atividades.push({ descricao: '', met: '', minutos: '' }); desenharMet(); atualizar(); corpoMet.querySelector('tr:last-child input')?.focus(); } }, 'Adicionar atividade')),
        h('p', { class: 'legenda' }, 'kcal = minutos por dia × peso × MET / 60, somadas. Os valores de MET estão no Compendium de Atividades Físicas.'))),
      soma('venta', h('div', { class: 'pilha' },
        h('h4', { class: 'titulo-grupo' }, 'Programação de peso'),
        h('div', { class: 'campos compactos' },
          numero('pesoDesejado', 'Peso desejado (kg)'),
          numero('dias', 'Prazo (dias)', { inputmode: 'numeric', value: PADROES.dias })),
        legendaVenta)),
      soma('gestante', h('div', { class: 'pilha' },
        h('h4', { class: 'titulo-grupo' }, 'Adicional gestante'),
        h('div', { class: 'campos compactos' }, numero('adicionalGestante', 'kcal/dia')),
        botaoAporte ? h('div', { class: 'acoes' }, botaoAporte) : null))),
  );

  // ---- Painel de resultados -------------------------------------------------------------------
  const painel = criarPainel();
  const estadoEdicao = h('p', { class: 'legenda' });
  const botaoSalvar = h('button', { class: 'botao', type: 'submit' }, 'Salvar cálculo');
  const aside = h('aside', { class: 'cartao pilha painel-fixo', 'aria-labelledby': 'energia-resultados' },
    h('h3', { id: 'energia-resultados' }, 'Resultados'),
    painel.el,
    h('div', { class: 'acoes' }, botaoSalvar, h('button', { type: 'button', class: 'botao secundario', onclick: nova }, 'Novo cálculo')),
    estadoEdicao);

  const form = h('form', { class: 'painel-duplo', novalidate: true, 'aria-label': 'Cálculo energético' }, colunaCampos, aside);

  // ---- Histórico ------------------------------------------------------------------------------
  const corpoLista = h('div', {});
  const secLista = h('div', { class: 'cartao pilha' },
    h('h3', { id: 'energia-historico' }, 'Cálculos salvos'),
    h('p', { class: 'legenda' }, 'O mais recente é a meta de energia do planejamento alimentar.'),
    corpoLista);

  raiz.append(h('div', { class: 'pilha', 'aria-live': 'off' },
    h('h2', {}, 'Cálculo energético'),
    form,
    secLista));

  // ---- MET ------------------------------------------------------------------------------------
  function desenharMet() {
    if (!atividades.length) {
      corpoMet.replaceChildren(h('p', { class: 'legenda' }, 'Nenhuma atividade.'));
      return;
    }
    const linha = (a, i) => {
      const entrada = (chave, rotulo, extra) => {
        const el = h('input', { value: a[chave] ?? '', autocomplete: 'off', 'aria-label': `${rotulo} da atividade ${i + 1}`, ...extra });
        el.addEventListener('input', () => { a[chave] = el.value; });
        return el;
      };
      return h('tr', {},
        h('td', {}, entrada('descricao', 'Descrição', { placeholder: 'Ex.: corrida' })),
        h('td', { class: 'num' }, entrada('met', 'MET', { inputmode: 'decimal', class: 'qtd-linha' })),
        h('td', { class: 'num' }, entrada('minutos', 'Minutos por dia', { inputmode: 'decimal', class: 'qtd-linha' })),
        h('td', { class: 'num', 'data-kcal': i }, '-'),
        h('td', {}, h('button', { type: 'button', class: 'botao discreto', 'aria-label': `Remover a atividade ${i + 1}`, onclick: () => { atividades.splice(i, 1); desenharMet(); atualizar(); } }, 'Remover')));
    };
    corpoMet.replaceChildren(h('div', { class: 'tabela-rolagem' }, h('table', { class: 'medidas tabela-met' },
      h('caption', { class: 'oculto-visual' }, 'Atividades físicas'),
      h('thead', {}, h('tr', {},
        h('th', { scope: 'col' }, 'Atividade'), h('th', { scope: 'col', class: 'num' }, 'MET'),
        h('th', { scope: 'col', class: 'num' }, 'Min/dia'), h('th', { scope: 'col', class: 'num' }, 'kcal'),
        h('th', { scope: 'col' }, h('span', { class: 'oculto-visual' }, 'Ações')))),
      h('tbody', {}, atividades.map(linha)))));
  }

  // ---- Cálculo --------------------------------------------------------------------------------
  function idade(v, data) {
    if (temNascimento) {
      if (!data) return { anos: null, meses: null };
      const meses = idadeMeses(p.nascimento, data);
      return meses < 0 ? { anos: null, meses: null } : { anos: idadeAnos(p.nascimento, data), meses };
    }
    const anos = informado(v.idade) ? Math.trunc(check(v.idade)) : null;
    const meses = informado(v.meses) ? Math.trunc(check(v.meses)) : null;
    return { anos: anos ?? (meses !== null ? Math.floor(meses / 12) : null), meses: meses ?? (anos !== null ? anos * 12 : null) };
  }

  /** Atualiza a lista de fator atividade quando a fórmula, o sexo ou a idade mudam a lista. */
  function atualizarFatores(prot, meses) {
    const opcoes = listaFatores(prot ? prot.id : '', { sexo, idadeMeses: meses ?? 0 });
    const chave = `${prot?.id ?? ''}|${opcoes.map((o) => `${o.valor}:${o.rotulo}`).join(',')}`;
    rotuloFatorEl.textContent = prot?.tipoFator === 'categoria' ? 'Categoria de atividade' : 'Fator atividade';
    if (chave === chaveFatores) return;
    chaveFatores = chave;
    const anterior = seletorFator.value;
    seletorFator.replaceChildren(...opcoes.map((o) => h('option', { value: o.valor }, rotuloFator(o))));
    seletorFator.value = opcoes.some((o) => o.valor === anterior) ? anterior : opcoes.length === 1 ? opcoes[0].valor : '';
    seletorFator.disabled = opcoes.length === 1;
  }

  function entradaCalculo(v, data, prot) {
    const e = {
      formula: v.formula,
      sexo,
      dataExame: data || '',
      dataReferencia: data || '',
      peso: v.peso,
      altura: v.altura,
      mlg: v.mlg,
      fator: v.fator,
      injuria: v.injuria,
      tmbInformada: v.tmbInformada,
      semanas: v.semanas,
      estadoNutricional: v.estadoNutricional,
    };
    if (temNascimento) e.nascimento = p.nascimento;
    else { e.idade = v.idade; e.meses = v.meses; }
    if (prot?.id === 10) e.getManual = { kcal: v.getKcal };
    if (prot?.id === 11) e.bolso = { ptn: v.bolsoPtn, lip: v.bolsoLip, cho: v.bolsoCho };
    if (prot?.id === 29) {
      if (informado(v.mesesAmamentacao)) e.mesesAmamentacao = v.mesesAmamentacao;
      else e.dataParto = normalizarData(v.dataParto) || v.dataParto;
    }
    const ativas = atividades.filter((a) => check(a.minutos) > 0 && check(a.met) > 0);
    if (ativas.length) e.atividades = ativas.map((a) => ({ met: a.met, minutos: a.minutos }));
    if (informado(v.pesoDesejado)) e.programacaoPeso = { pesoDesejado: v.pesoDesejado, dias: v.dias };
    if (informado(v.adicionalGestante)) e.adicionalGestante = v.adicionalGestante;
    return e;
  }

  function calcular() {
    const v = lerFormulario(form);
    const data = normalizarData(v.data);
    const prot = PROTOCOLOS.find((x) => String(x.id) === String(v.formula)) || null;
    const { anos, meses } = idade(v, data);
    atualizarFatores(prot, meses);
    v.fator = seletorFator.value;
    const avisos = [];
    if (!data) avisos.push('Informe a data do cálculo no formato dd/mm/aaaa.');
    // Campo vazio vale 0 no cálculo (como no WebDiet), o que daria TMB negativa: sem peso ou altura
    // a tela não calcula. O peso é dispensável onde só serve ao kcal/kg (GET manual, TMB informada).
    const faltam = !prot ? [] : [
      prot.entradas.includes('peso') && !SEM_PESO_OBRIGATORIO.includes(prot.id) && !(check(v.peso) > 0) ? 'o peso' : null,
      prot.entradas.includes('altura') && !(check(v.altura) > 0) ? 'a altura' : null,
    ].filter(Boolean);
    if (faltam.length) avisos.push(`Informe ${faltam.join(' e ')}.`);
    const r = prot && !faltam.length ? calcularEnergia(entradaCalculo(v, data, prot)) : null;
    if (r) avisos.push(...r.avisos);
    return { v, data, prot, anos, meses, r, avisos };
  }

  function aplicarVisibilidade(prot) {
    const entradas = new Set(prot ? prot.entradas : ['peso', 'altura']);
    const adicionais = new Set(prot ? prot.adicionais : []);
    form.querySelectorAll('[data-entrada]').forEach((el) => el.classList.toggle('oculto', !entradas.has(el.dataset.entrada)));
    form.querySelectorAll('[data-adicional]').forEach((el) => el.classList.toggle('oculto', !adicionais.has(el.dataset.adicional)));
    const faltam = prot ? ['met', 'venta', 'gestante'].filter((a) => !adicionais.has(a)) : [];
    const nomes = { met: 'atividade física (MET)', venta: 'programação de peso', gestante: 'adicional gestante' };
    legendaAdicionais.textContent = !prot ? 'Escolha a fórmula.' : faltam.length ? `Esta fórmula não soma: ${faltam.map((a) => nomes[a]).join(', ')}.` : 'Somados ao GET.';
  }

  function textoIdade(anos, meses) {
    if (anos === null) return 'não informada';
    if (meses !== null && anos < 3) return `${anos} ${anos === 1 ? 'ano' : 'anos'} (${meses} meses)`;
    return `${anos} anos`;
  }

  function itens(c) {
    const r = c.r;
    const t = r?.tela;
    const fator = r?.fatorAtividade;
    const injuria = INJURIAS.find((o) => String(o.id) === String(c.v.injuria));
    const venta = r?.programacaoPeso;
    return {
      destaques: [
        { chave: 'tmb', rotulo: 'TMB', valor: t?.tmb || '-', detalhe: t?.tmbkg || '' },
        { chave: 'get', rotulo: 'GET', valor: t?.get || '-', detalhe: t?.getkg || '' },
      ],
      grupos: [
        { titulo: 'Cálculo', itens: [
          { chave: 'formula', rotulo: 'Fórmula', valor: c.prot?.nome ?? '-' },
          { chave: 'idade', rotulo: 'Idade na data', valor: textoIdade(c.anos, c.meses) },
          { chave: 'fator', rotulo: c.prot?.tipoFator === 'categoria' ? 'Categoria' : 'Fator atividade', valor: fator === null || fator === undefined ? '-' : String(fator) },
          { chave: 'injuria', rotulo: 'Fator injúria', valor: injuria ? `${fx(injuria.valor, 2)}` : '-', detalhe: injuria && injuria.id !== 0 ? injuria.nome : '' },
          { chave: 'meses', rotulo: 'Meses de amamentação', valor: r?.mesesAmamentacao ?? '-' },
        ] },
        { titulo: 'Adicionais', itens: [
          { chave: 'met', rotulo: 'MET', valor: t?.met ?? '-', detalhe: r && r.adicionais.met === null && t?.met !== 'Programar MET' ? 'não somado' : '' },
          { chave: 'venta', rotulo: 'Programação de peso', valor: t?.venta ?? '-', detalhe: venta?.kcalDia !== null && venta?.kcalDia !== undefined ? `${venta.tela.r1} ${venta.tela.r2}` : '' },
          { chave: 'gest', rotulo: 'Adicional gestante', valor: t?.gest ?? '-', detalhe: r && r.adicionais.gestante === null && t?.gest !== 'Incluir adicional' ? 'não somado' : '' },
        ] },
      ],
    };
  }

  function atualizar() {
    const c = calcular();
    aplicarVisibilidade(c.prot);
    notaInjuria.classList.toggle('oculto', String(c.v.injuria) !== String(INJURIA_ROTULO_DIVERGENTE));
    legendaFormula.textContent = c.prot ? descricaoFormula(c.prot) : 'O formulário mostra só os dados que a fórmula usa.';
    legendaIdade.textContent = temNascimento
      ? `Idade na data do cálculo: ${textoIdade(c.anos, c.meses)}.`
      : 'Sem data de nascimento no cadastro: informe a idade.';
    const peso = check(c.v.peso) || 50;
    legendaVenta.textContent = `Entre ${textoNumero(peso * 0.8, 1)} e ${textoNumero(peso * 1.2, 1)} kg (±20% do peso${check(c.v.peso) > 0 ? '' : '; sem peso, vale 50 kg'}), em 1 a 180 dias. 1 kg = 7700 kcal.`;
    // kcal de cada atividade (o total vem do cálculo)
    corpoMet.querySelectorAll('[data-kcal]').forEach((td) => {
      const a = atividades[Number(td.dataset.kcal)];
      const k = calcularMet({ peso: c.v.peso, atividades: [a] }).kcal;
      td.textContent = k > 0 ? fx(k, 0) : '-';
    });
    painel.atualizar({ ...itens(c), avisos: c.avisos });
    return c;
  }

  function descricaoFormula(prot) {
    const partes = [];
    if (prot.tmb === 'nao_aplicavel') partes.push('A equação dá o GET direto (TMB não aplicável).');
    if (prot.limites.sexo === 'F') partes.push('Só para o sexo feminino.');
    if (prot.limites.idadeMinAnos !== null) partes.push(`A partir de ${prot.limites.idadeMinAnos} anos.`);
    if (prot.limites.idadeMaxAnos !== null) partes.push(`Até ${prot.limites.idadeMaxAnos} anos.`);
    if (prot.limites.semanasMin) partes.push(`A partir da ${prot.limites.semanasMin}ª semana de gestação.`);
    if (prot.limites.mesesAmamentacaoMax) partes.push(`Até ${prot.limites.mesesAmamentacaoMax} meses de amamentação.`);
    return partes.join(' ') || 'GET = TMB × fator atividade × fator injúria + adicionais.';
  }

  // ---- Origem dos dados (antropometria) -------------------------------------------------------
  function mostrarOrigem() {
    const a = dadosAntropometria(db, p.id);
    if (!a) {
      legendaOrigem.replaceChildren(h('p', { class: 'legenda' }, ordenados().length
        ? 'Nenhuma antropometria salva: os dados vêm do cálculo anterior.'
        : 'Nenhuma antropometria salva: digite peso e altura (ou registre uma avaliação na aba Antropometria).'));
      return;
    }
    const usar = (mlg) => {
      if (a.peso) form.elements.peso.value = textoNumero(a.peso, 2);
      if (a.altura) form.elements.altura.value = textoNumero(a.altura, 2);
      if (mlg) form.elements.mlg.value = textoNumero(mlg, 1);
      atualizar();
      avisar(`Dados da antropometria de ${a.data} aplicados.`);
    };
    const partes = [a.peso ? `${textoNumero(a.peso, 2)} kg` : null, a.altura ? `${textoNumero(a.altura, 2)} cm` : null].filter(Boolean).join(', ');
    const botoes = [];
    if (a.mlgDobras && a.mlgBio) {
      botoes.push(h('button', { type: 'button', class: 'botao discreto', onclick: () => usar(a.mlgDobras) }, `Usar MLG das dobras (${textoNumero(a.mlgDobras, 1)} kg)`));
      botoes.push(h('button', { type: 'button', class: 'botao discreto', onclick: () => usar(a.mlgBio) }, `Usar MLG da bioimpedância (${textoNumero(a.mlgBio, 1)} kg)`));
    } else {
      botoes.push(h('button', { type: 'button', class: 'botao discreto', onclick: () => usar(a.mlgDobras || a.mlgBio) }, 'Importar de novo'));
    }
    legendaOrigem.replaceChildren(
      h('p', { class: 'legenda' }, `Última antropometria: ${a.data} (${partes || 'sem peso'}${a.mlgDobras || a.mlgBio ? `; MLG ${[a.mlgDobras && `${textoNumero(a.mlgDobras, 1)} kg por dobras`, a.mlgBio && `${textoNumero(a.mlgBio, 1)} kg por bioimpedância`].filter(Boolean).join(', ')}` : ''}).`),
      h('div', { class: 'acoes' }, botoes));
  }

  // ---- Persistência ---------------------------------------------------------------------------
  const ordenados = () => porData(db.listarRegistros(p.id, TIPO));

  function salvar(e) {
    e.preventDefault();
    const c = atualizar();
    if (!c.data) { avisar('Informe a data do cálculo (dd/mm/aaaa).'); form.elements.data.focus(); return; }
    if (!c.prot) { avisar('Escolha a fórmula.'); form.elements.formula.focus(); return; }
    if (!c.r || c.r.get === null) { avisar(`GET não calculado: ${c.avisos[0] || 'confira os dados.'}`); return; }
    const existente = atualId ? db.listarRegistros(p.id, TIPO).find((r) => r.id === atualId) : null;
    const salvo = db.salvarRegistro(p.id, TIPO, {
      ...(existente || {}),
      data: c.data,
      formula: c.prot.id,
      protocolo: c.prot.nome,
      entrada: { ...c.v, data: c.data },
      atividades: atividades.map((a) => ({ ...a })),
      resumo: {
        tmb: c.r.tmbArredondada, get: c.r.getArredondado, getPorKg: c.r.getPorKg, peso: check(c.v.peso) || null,
        fator: c.r.fatorAtividade, injuria: c.r.fatorInjuria, adicionais: c.r.adicionais, idade: c.anos,
      },
      tela: c.r.tela,
    });
    form.elements.data.value = c.data;
    atualId = salvo.id;
    desenharLista();
    atualizarEstado();
    avisar(existente ? 'Cálculo atualizado.' : `Cálculo salvo: GET ${c.r.tela.get}.`);
  }

  function preencher(valores) {
    form.querySelectorAll('[name]').forEach((el) => {
      if (el === seletorFator) return;
      el.value = valores[el.name] ?? (el.name === 'data' ? hojeTexto() : PADROES[el.name] ?? '');
    });
    chaveFatores = null;
    seletorFator.replaceChildren(h('option', { value: valores.fator ?? '' }));
    seletorFator.value = valores.fator ?? '';
    origemGet = informado(valores.getKcal) ? 'kcal' : 'kcalKg';
  }

  function nova() {
    atualId = null;
    const anterior = ordenados()[0]?.entrada || {};
    const a = dadosAntropometria(db, p.id);
    const base = {
      formula: anterior.formula ?? PADROES.formula,
      fator: anterior.fator,
      injuria: anterior.injuria ?? PADROES.injuria,
      // Sem antropometria, repete os dados do cálculo anterior.
      peso: a?.peso ? textoNumero(a.peso, 2) : anterior.peso ?? '',
      altura: a?.altura ? textoNumero(a.altura, 2) : anterior.altura ?? '',
      mlg: a?.mlgDobras || a?.mlgBio ? textoNumero(a.mlgDobras || a.mlgBio, 1) : anterior.mlg ?? '',
      dias: PADROES.dias,
    };
    if (gestacao) {
      base.semanas = String(gestacao.semanas);
      base.estadoNutricional = Object.keys(DISPOSICAO_GESTANTE).find((k) => k.toLowerCase() === String(gestacao.classe).toLowerCase()) ?? '';
    }
    atividades = [];
    preencher(base);
    desenharMet();
    mostrarOrigem();
    atualizar();
    desenharLista();
    atualizarEstado();
  }

  function abrir(r) {
    atualId = r.id;
    atividades = (r.atividades || []).map((a) => ({ ...a }));
    preencher(r.entrada || {});
    desenharMet();
    atualizar();
    desenharLista();
    atualizarEstado();
    form.elements.data.focus();
    avisar(`Cálculo de ${r.data} aberto para edição.`);
  }

  function excluir(r) {
    if (!confirm(`Excluir o cálculo de ${r.data}? Esta ação não pode ser desfeita.`)) return;
    db.excluirRegistro(p.id, TIPO, r.id);
    if (atualId === r.id) atualId = null;
    desenharLista();
    atualizarEstado();
    avisar('Cálculo excluído.');
  }

  function atualizarEstado() {
    const r = atualId ? db.listarRegistros(p.id, TIPO).find((x) => x.id === atualId) : null;
    botaoSalvar.textContent = r ? 'Salvar alterações' : 'Salvar cálculo';
    estadoEdicao.textContent = r ? `Editando o cálculo de ${r.data}.` : 'Cálculo novo, ainda não salvo.';
  }

  function desenharLista() {
    const regs = ordenados();
    if (!regs.length) {
      corpoLista.replaceChildren(h('p', { class: 'legenda' }, 'Nenhum cálculo salvo ainda.'));
      return;
    }
    corpoLista.replaceChildren(h('div', { class: 'tabela-rolagem' }, h('table', { class: 'medidas', 'aria-labelledby': 'energia-historico' },
      h('thead', {}, h('tr', {},
        h('th', { scope: 'col' }, 'Data'),
        h('th', { scope: 'col' }, 'Fórmula'),
        h('th', { scope: 'col', class: 'num' }, 'TMB'),
        h('th', { scope: 'col', class: 'num' }, 'GET'),
        h('th', { scope: 'col', class: 'num' }, 'kcal/kg'),
        h('th', { scope: 'col' }, h('span', { class: 'oculto-visual' }, 'Ações')))),
      h('tbody', {}, regs.map((r, i) => {
        const s = r.resumo || {};
        return h('tr', { 'aria-current': r.id === atualId ? 'true' : null },
          h('th', { scope: 'row' }, r.data || '-', i === 0 ? h('div', {}, h('small', {}, 'meta do planejamento')) : null),
          h('td', {}, r.protocolo || '-'),
          h('td', { class: 'num' }, s.tmb !== null && s.tmb !== undefined ? `${s.tmb} kcal` : '-'),
          h('td', { class: 'num' }, s.get !== null && s.get !== undefined ? `${s.get} kcal` : '-'),
          h('td', { class: 'num' }, s.getPorKg ? fx(s.getPorKg, 1) : '-'),
          h('td', {}, h('div', { class: 'acoes', style: 'flex-wrap:nowrap' },
            h('button', { type: 'button', class: 'botao discreto', 'aria-label': `Abrir o cálculo de ${r.data}`, onclick: () => abrir(r) }, 'Abrir'),
            h('button', { type: 'button', class: 'botao discreto', 'aria-label': `Excluir o cálculo de ${r.data}`, onclick: () => excluir(r) }, 'Excluir'))));
      })))));
  }

  // ---- Eventos --------------------------------------------------------------------------------
  form.addEventListener('submit', salvar);
  form.addEventListener('input', (e) => {
    const nome = e.target.name;
    if (nome === 'getKcal' || nome === 'getKcalKg' || nome === 'peso') {
      // GET manual: o campo digitado por último manda; o outro é convertido pelo peso (§4.5).
      if (nome !== 'peso') origemGet = nome === 'getKcal' ? 'kcal' : 'kcalKg';
      const el = form.elements;
      const conv = origemGet === 'kcalKg'
        ? converterGetManual({ peso: el.peso.value, kcalKg: el.getKcalKg.value })
        : converterGetManual({ peso: el.peso.value, kcal: el.getKcal.value });
      if (origemGet === 'kcalKg' && informado(el.getKcalKg.value)) el.getKcal.value = conv.tela.getTemp;
      if (origemGet === 'kcal' && informado(el.getKcal.value)) el.getKcalKg.value = conv.tela.getTemp2;
    }
    atualizar();
  });
  form.addEventListener('change', (e) => {
    if (e.target.name === 'data' || e.target.name === 'dataParto') {
      const d = normalizarData(e.target.value);
      if (d) e.target.value = d;
    }
    atualizar();
  });

  nova();
}

registrarAba({ id: 'energia', rotulo: 'Cálculo energético', ordem: 30, montar });
