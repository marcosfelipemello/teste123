// Aba "Antropometria" da ficha do paciente.
// - Adultos e idosos: calc/antropometria.js (relatório §5).
// - Crianças e adolescentes: calc/infantil.js (§6, z-escores da OMS e Slaughter).
// A referência é escolhida pela idade na DATA DA AVALIAÇÃO (anos completos): abaixo de 19 anos
// (228 meses, limite dos protocolos infantis) a avaliação é infantil; senão, de adulto. A pessoa pode
// forçar uma das duas. Os textos dos resultados são os do módulo de cálculo (iguais aos do WebDiet).
//
// Cada avaliação salva é um registro do tipo "antropometria":
// { data, modo, entrada (campos do formulário, como texto), resumo (números para o histórico), tela }.
import { h, campo, selecao, lerFormulario, avisar } from '../dom.js';
import { registrarAba } from '../paginas/pacientes.js';
import { normalizarData } from '../importacao.js';
import { check, fx, fxn, idadeAnos, idadeMeses, hojeTexto, partesData } from '../../calc/numeros.js';
import {
  calcularAntropometria,
  preencherBioimpedancia,
  PROTOCOLOS_DOBRAS,
  EQUACOES_GORDURA,
  DOBRAS,
  MEDIDAS,
  CAMPOS_BIOIMPEDANCIA,
} from '../../calc/antropometria.js';
import { avaliarInfantil, IDADE_MAXIMA_MESES } from '../../calc/infantil.js';
import { criarPainel, estadoClasse } from './painel-resultados.js';

const TIPO = 'antropometria';
/** A partir desta idade (anos completos na avaliação) vale a avaliação de adultos. */
const IDADE_ADULTO = IDADE_MAXIMA_MESES / 12;
/** Dobras usadas na avaliação infantil (Slaughter). */
const DOBRAS_INFANTIS = ['tricipital', 'subescapular', 'panturrilha'];
/** Campos de bioimpedância que disparam o preenchimento automático dos campos ligados. */
const ORIGENS_BIO = ['percentualGordura', 'massaGordura', 'percentualMagra', 'massaMagra'];
const PADROES = { modo: 'auto', protocolo: 'nenhuma', equacaoGordura: 'brozek', ladoBraco: 'esquerdo' };

const ROTULOS_CURTOS = {
  bracoEsquerdo: 'Braço relaxado esquerdo',
  bracoDireito: 'Braço relaxado direito',
  punho: 'Punho',
  femur: 'Fêmur',
  umero: 'Úmero',
};

/** Medidas da §5.1 que não entram em nenhum cálculo: só ficam registradas. */
const OUTRAS_MEDIDAS = [
  ['estaturaSentado', 'Estatura sentado (cm)'],
  ['pescoco', 'Pescoço (cm)'],
  ['torax', 'Tórax (cm)'],
  ['ombro', 'Ombro (cm)'],
  ['abdomen', 'Abdômen (cm)'],
  ['bracoContraido', 'Braço contraído (cm)'],
  ['antebraco', 'Antebraço (cm)'],
  ['coxaProximal', 'Coxa proximal (cm)'],
  ['coxaMedial', 'Coxa medial (cm)'],
  ['coxaDistal', 'Coxa distal (cm)'],
  ['gorduraVisceral', 'Gordura visceral (nível)'],
  ['aguaCorporal', 'Água corporal (%)'],
  ['pesoOsseoBio', 'Peso ósseo na bioimpedância (kg)'],
  ['idadeMetabolica', 'Idade metabólica (anos)'],
];

const numero = (nome, rotulo, extra = {}) =>
  campo(rotulo, h('input', { name: nome, inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', ...extra }));

/** Marca um elemento como exclusivo de um modo ("adulto" ou "infantil"). */
function so(modo, el) {
  el.dataset.modo = modo;
  return el;
}

/** Campos "grupo.chave" do formulário → { chave: valor }. */
function grupo(v, prefixo) {
  const o = {};
  for (const [k, x] of Object.entries(v)) if (k.startsWith(prefixo + '.')) o[k.slice(prefixo.length + 1)] = x;
  return o;
}

/** "dd/mm/aaaa" → "aaaammdd" (para ordenar). */
function chaveData(d) {
  const p = partesData(d);
  return p ? `${p.a}${String(p.m).padStart(2, '0')}${String(p.d).padStart(2, '0')}` : '';
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

function textoIdade(anos, meses) {
  if (anos === null) return 'não informada';
  if (meses !== null && anos < 2) return plural(meses, 'mês', 'meses');
  if (meses !== null && anos < IDADE_ADULTO) {
    const resto = meses - anos * 12;
    return `${plural(anos, 'ano', 'anos')}${resto ? ' e ' + plural(resto, 'mês', 'meses') : ''} (${meses} meses)`;
  }
  return plural(anos, 'ano', 'anos');
}

const semTexto = (x) => (x && x !== '-' ? x : '');

function variacaoTexto(x) {
  if (x > 0) return `+${fx(x, 1)} kg`;
  if (x < 0) return `-${fx(-x, 1)} kg`;
  return '0.0 kg';
}

function montar(raiz, { db, paciente: p }) {
  if (p.sexo !== 'M' && p.sexo !== 'F') {
    raiz.append(h('div', { class: 'aviso' }, 'Informe o sexo do paciente no perfil (aba Perfil, "Editar dados") para calcular a antropometria.'));
    return;
  }
  const sexoLongo = p.sexo === 'M' ? 'masculino' : 'feminino';
  const temNascimento = !!partesData(p.nascimento);
  let atualId = null; // registro em edição (null = avaliação nova)
  let avisoEstimativa = null; // erro da última estimativa de Chumlea, até a próxima digitação
  let seq = 0;

  function grupoCampos(titulo, ...filhos) {
    const id = `antropo-grupo-${++seq}`;
    return h('div', { class: 'cartao pilha', role: 'group', 'aria-labelledby': id }, h('h3', { id }, titulo), ...filhos);
  }

  // ---- Formulário -----------------------------------------------------------------------------
  const idadeLegenda = h('p', { class: 'legenda' });
  const textoProtocolo = h('p', { class: 'legenda' });
  const camposDobras = DOBRAS.map((d) => {
    const c = numero(`dobras.${d.chave}`, d.rotulo);
    c.dataset.dobra = d.chave;
    return c;
  });
  const medidasDe = (g) => MEDIDAS.filter((m) => m.grupo === g);

  const colunaCampos = h('div', { class: 'pilha' },
    grupoCampos('Avaliação',
      h('div', { class: 'campos' },
        campo('Data da avaliação', h('input', { name: 'data', value: hojeTexto(), placeholder: 'dd/mm/aaaa', inputmode: 'numeric', autocomplete: 'off' })),
        campo('Referência', selecao({ name: 'modo' }, [
          { valor: 'auto', rotulo: 'Pela idade na avaliação' },
          { valor: 'adulto', rotulo: 'Adulto e idoso' },
          { valor: 'infantil', rotulo: 'Criança e adolescente (OMS)' },
        ], PADROES.modo)),
        temNascimento ? null : numero('idade', 'Idade na avaliação (anos)', { inputmode: 'numeric' }),
        temNascimento ? null : so('infantil', numero('meses', 'Idade na avaliação (meses)', { inputmode: 'numeric' }))),
      idadeLegenda,
      temNascimento ? null : h('p', { class: 'legenda' }, 'Sem data de nascimento no cadastro: informe a idade. Com o nascimento, a idade é calculada na data da avaliação.')),

    grupoCampos('Peso e estatura',
      h('div', { class: 'campos compactos' },
        numero('peso', 'Peso (kg)'),
        numero('estatura', 'Estatura (cm)'),
        so('adulto', numero('alturaJoelho', 'Altura do joelho (cm)'))),
      so('adulto', h('div', { class: 'pilha' },
        h('div', { class: 'acoes' },
          h('button', { type: 'button', class: 'botao secundario', onclick: () => estimar('estimarEstatura') }, 'Estimar estatura (Chumlea)'),
          h('button', { type: 'button', class: 'botao secundario', onclick: () => estimar('estimarPeso') }, 'Estimar peso (Chumlea)')),
        h('p', { class: 'legenda' }, 'Estatura: pela altura do joelho. Peso: altura do joelho, braço relaxado esquerdo, panturrilha e dobra subescapular. O valor estimado vai para o campo.')))),

    grupoCampos('Dobras cutâneas (mm)',
      so('adulto', h('div', { class: 'campos' },
        campo('Protocolo', selecao({ name: 'protocolo' }, Object.entries(PROTOCOLOS_DOBRAS).map(([k, x]) => ({ valor: k, rotulo: x.nome })), PADROES.protocolo)),
        campo('Densidade → % de gordura', selecao({ name: 'equacaoGordura' }, Object.entries(EQUACOES_GORDURA).map(([k, x]) => ({ valor: k, rotulo: x.nome })), PADROES.equacaoGordura)))),
      textoProtocolo,
      h('div', { class: 'campos compactos' }, camposDobras)),

    so('adulto', grupoCampos('Circunferências (cm)',
      h('div', { class: 'campos compactos' }, medidasDe('circunferencias').map((m) => numero(`circunferencias.${m.chave}`, ROTULOS_CURTOS[m.chave] || m.rotulo))),
      h('div', { class: 'campos' },
        campo('Braço usado na CMB', selecao({ name: 'ladoBraco' }, [{ valor: 'esquerdo', rotulo: 'Esquerdo' }, { valor: 'direito', rotulo: 'Direito' }], PADROES.ladoBraco))))),

    so('adulto', grupoCampos('Diâmetros ósseos (cm)',
      h('div', { class: 'campos compactos' }, medidasDe('diametros').map((m) => numero(`diametros.${m.chave}`, ROTULOS_CURTOS[m.chave] || m.rotulo))))),

    so('adulto', grupoCampos('Bioimpedância',
      h('div', { class: 'campos compactos' }, CAMPOS_BIOIMPEDANCIA.map((c) => numero(`bioimpedancia.${c.chave}`, c.unidade === '%' ? c.rotulo : `${c.rotulo} (${c.unidade})`))),
      h('p', { class: 'legenda' }, 'Ao digitar % de gordura, massa gorda, % de massa magra ou massa magra, os campos ligados são preenchidos a partir do peso.'))),

    so('adulto', h('details', { class: 'cartao pilha dobravel' },
      h('summary', {}, 'Outras medidas (só registro, sem cálculo)'),
      h('div', { class: 'campos compactos' }, OUTRAS_MEDIDAS.map(([k, r]) => numero(`outras.${k}`, r))))),
  );

  // ---- Painel de resultados -------------------------------------------------------------------
  const painel = criarPainel();
  const resumoPainel = h('p', { class: 'legenda' });
  const estadoEdicao = h('p', { class: 'legenda' });
  const botaoSalvar = h('button', { class: 'botao', type: 'submit' }, 'Salvar avaliação');
  const aside = h('aside', { class: 'cartao pilha painel-fixo', 'aria-labelledby': 'antropo-resultados' },
    h('h3', { id: 'antropo-resultados' }, 'Resultados'),
    resumoPainel,
    painel.el,
    h('div', { class: 'acoes' }, botaoSalvar, h('button', { type: 'button', class: 'botao secundario', onclick: nova }, 'Nova avaliação')),
    estadoEdicao);

  const form = h('form', { class: 'painel-duplo', novalidate: true, 'aria-label': 'Avaliação antropométrica' }, colunaCampos, aside);

  // ---- Histórico ------------------------------------------------------------------------------
  const corpoLista = h('div', {});
  const secLista = h('div', { class: 'cartao pilha' }, h('h3', {}, 'Avaliações salvas'), corpoLista);

  // O conteúdo da aba fica fora do aria-live da ficha (só o painel de resultados anuncia mudanças).
  raiz.append(h('div', { class: 'pilha', 'aria-live': 'off' },
    h('h2', {}, 'Antropometria'),
    form,
    secLista));

  // ---- Cálculo --------------------------------------------------------------------------------
  function calcular() {
    const v = lerFormulario(form);
    const avisos = [];
    const data = normalizarData(v.data);
    let anos = null;
    let meses = null;
    if (!data) {
      avisos.push('Informe a data da avaliação no formato dd/mm/aaaa.');
    } else if (temNascimento) {
      anos = idadeAnos(p.nascimento, data);
      meses = idadeMeses(p.nascimento, data);
      if (meses < 0) {
        avisos.push('A data da avaliação é anterior ao nascimento.');
        anos = meses = null;
      }
    } else {
      if (String(v.idade ?? '').trim() !== '') anos = Math.trunc(check(v.idade));
      if (String(v.meses ?? '').trim() !== '') meses = Math.trunc(check(v.meses));
      if (meses === null && anos !== null) meses = anos * 12;
      if (anos === null && meses !== null) anos = Math.floor(meses / 12);
      if (anos === null) avisos.push('Informe a idade na avaliação (ou cadastre a data de nascimento no perfil).');
    }
    const modo = v.modo === 'adulto' || v.modo === 'infantil' ? v.modo : anos !== null && anos < IDADE_ADULTO ? 'infantil' : 'adulto';
    const c = { v, data, anos, meses, modo, avisos, r: null };
    if (anos === null) return c;
    try {
      if (modo === 'adulto') calcularAdulto(c);
      else calcularInfantil(c);
    } catch (e) {
      console.error(e);
      avisos.push('Não foi possível calcular: ' + e.message);
      c.r = null;
    }
    return c;
  }

  function calcularAdulto(c) {
    const { v } = c;
    const dobras = grupo(v, 'dobras');
    let protocolo = PROTOCOLOS_DOBRAS[v.protocolo] ? v.protocolo : PADROES.protocolo;
    const prot = PROTOCOLOS_DOBRAS[protocolo];
    // Sem nenhuma dobra do protocolo, o %G sairia sem sentido (ex.: log10(0)); mostra só o somatório.
    if (prot.tipo !== 'nenhum' && prot.dobras[sexoLongo].every((k) => !(check(dobras[k]) > 0))) {
      c.avisos.push(`Preencha as dobras do protocolo ${prot.nome} para calcular o % de gordura.`);
      protocolo = 'nenhuma';
    }
    c.r = calcularAntropometria({
      sexo: p.sexo,
      ...(temNascimento ? { nascimento: p.nascimento, dataAvaliacao: c.data } : { idade: c.anos }),
      peso: v.peso,
      estatura: v.estatura,
      alturaJoelho: v.alturaJoelho,
      dobras,
      circunferencias: grupo(v, 'circunferencias'),
      diametros: grupo(v, 'diametros'),
      bioimpedancia: grupo(v, 'bioimpedancia'),
      protocolo,
      equacaoGordura: v.equacaoGordura,
      ladoBraco: v.ladoBraco,
    });
    c.avisos.push(...c.r.avisos);
  }

  function calcularInfantil(c) {
    const { v } = c;
    const r = avaliarInfantil({
      sexo: p.sexo,
      meses: c.meses,
      peso: v.peso,
      altura: v.estatura,
      dct: v['dobras.tricipital'],
      dcse: v['dobras.subescapular'],
      dcp: v['dobras.panturrilha'],
    });
    c.r = r;
    if (r.excecao) c.avisos.push(r.excecao);
    else {
      if (r.meses > 120 && check(v.peso) > 0) c.avisos.push('Peso/idade: a referência da OMS vai só até 10 anos (120 meses).');
      if (r.gc === null && DOBRAS_INFANTIS.some((k) => check(v[`dobras.${k}`]) > 0)) {
        c.avisos.push('Para o % de gordura (Slaughter), informe tricipital + panturrilha ou tricipital + subescapular.');
      }
    }
  }

  function itensAdulto(r) {
    const t = r.tela;
    return {
      destaques: [
        { chave: 'imc', rotulo: 'IMC', valor: t.imc, detalhe: semTexto(t.class_imc) },
        { chave: 'gc', rotulo: '% gordura (dobras)', valor: t.gc, detalhe: semTexto(t.class_gc) },
      ],
      grupos: [
        { titulo: 'Peso', itens: [
          { chave: 'massa', rotulo: 'Peso', valor: t.massa },
          { chave: 'estatura', rotulo: 'Estatura', valor: t.estatura },
          { chave: 'pesoIdeal', rotulo: 'Peso ideal', valor: t.peso_ideal },
        ] },
        { titulo: 'Composição corporal', itens: [
          { chave: 'formula', rotulo: 'Fórmula', valor: t.formula_escolhida },
          { chave: 'somatorio', rotulo: 'Somatório', valor: t.somatorio },
          { chave: 'densidade', rotulo: 'Densidade', valor: t.densidade },
          { chave: 'refGc', rotulo: '%G de referência', valor: semTexto(t.gc_ideal1) },
          { chave: 'pesoGordo', rotulo: 'Massa gorda', valor: t.peso_g },
          { chave: 'mlg', rotulo: 'Massa livre de gordura', valor: t.mlg },
        ] },
        { titulo: 'Fracionamento', itens: [
          { chave: 'pesoOsseo', rotulo: 'Peso ósseo', valor: t.peso_o },
          { chave: 'pesoResidual', rotulo: 'Peso residual', valor: t.peso_r },
          { chave: 'pesoMuscular', rotulo: 'Peso muscular', valor: t.peso_m },
        ] },
        { titulo: 'Índices', itens: [
          { chave: 'cmb', rotulo: 'CMB (adequação)', valor: t.cmb, detalhe: semTexto(t.class_cmb) },
          { chave: 'rcq', rotulo: 'Cintura/quadril', valor: t.razao, detalhe: semTexto(t.risco) },
        ] },
        { titulo: 'Bioimpedância', itens: [
          {
            chave: 'bioGc', rotulo: '% de gordura', valor: t.bioimpedancia_gordura_rel,
            detalhe: [semTexto(t.class_gc_bio), semTexto(t.gc_ideal2) && `referência ${t.gc_ideal2}`].filter(Boolean).join(' · '),
            estado: estadoClasse(t.class_gc_bio),
          },
        ] },
      ],
    };
  }

  function itensInfantil(r, c) {
    const t = r.tela;
    const z = (texto, valor) => (texto === '-' ? '-' : `z ${valor}`);
    const kg = check(c.v.peso), cm = check(c.v.estatura);
    return {
      destaques: [
        { chave: 'imc', rotulo: 'IMC', valor: t.imc, detalhe: r.classeImc ? `IMC/idade: ${r.classeImc}` : '', estado: estadoClasse(r.classeImc) },
        { chave: 'gc', rotulo: '% gordura (Slaughter)', valor: t.gc, detalhe: semTexto(t.gcClas) },
      ],
      grupos: [
        { titulo: 'Z-escores (OMS)', itens: [
          { chave: 'zPeso', rotulo: 'Peso/idade', valor: z(t.peso, r.zPeso), detalhe: t.peso === '-' ? '' : r.classePeso },
          { chave: 'zAltura', rotulo: 'Estatura/idade', valor: z(t.altura, r.zAltura), detalhe: t.altura === '-' ? '' : r.classeAltura },
          { chave: 'zImc', rotulo: 'IMC/idade', valor: z(t.imcz, r.zImc), detalhe: t.imcz === '-' ? '' : r.classeImc },
        ] },
        { titulo: 'Dados', itens: [
          { chave: 'idade', rotulo: 'Idade', valor: textoIdade(c.anos, c.meses) },
          { chave: 'massa', rotulo: 'Peso', valor: kg > 0 ? `${kg} Kg` : '-' },
          { chave: 'estatura', rotulo: 'Estatura', valor: cm > 0 ? `${cm} cm` : '-' },
          { chave: 'protGc', rotulo: 'Dobras do %G', valor: r.protocoloGc === 'TR+PA' ? 'Tricipital + panturrilha' : r.protocoloGc === 'TR+SE' ? 'Tricipital + subescapular' : '-' },
        ] },
      ],
    };
  }

  function aplicarModo(modo, v) {
    form.querySelectorAll('[data-modo]').forEach((el) => el.classList.toggle('oculto', el.dataset.modo !== modo));
    if (modo === 'infantil') {
      camposDobras.forEach((c) => {
        c.classList.toggle('oculto', !DOBRAS_INFANTIS.includes(c.dataset.dobra));
        c.toggleAttribute('data-usada', DOBRAS_INFANTIS.includes(c.dataset.dobra));
      });
      textoProtocolo.textContent = 'Slaughter (1988): tricipital + panturrilha ou, sem a panturrilha, tricipital + subescapular.';
      return;
    }
    const prot = PROTOCOLOS_DOBRAS[v.protocolo] || PROTOCOLOS_DOBRAS[PADROES.protocolo];
    const usadas = prot.tipo === 'nenhum' ? [] : prot.dobras[sexoLongo];
    camposDobras.forEach((c) => {
      c.classList.remove('oculto');
      c.toggleAttribute('data-usada', usadas.includes(c.dataset.dobra));
    });
    const nome = (k) => DOBRAS.find((d) => d.chave === k).rotulo.toLowerCase();
    textoProtocolo.textContent = prot.tipo === 'nenhum'
      ? 'Sem protocolo: mostra só a soma das dobras preenchidas, sem % de gordura.'
      : `${prot.rotulo[sexoLongo]}: ${usadas.map(nome).join(', ')}.${prot.tipo === 'direto' ? ' % de gordura direto, sem densidade.' : ''}`;
    form.elements.equacaoGordura.disabled = prot.tipo !== 'densidade';
  }

  function atualizar() {
    const c = calcular();
    aplicarModo(c.modo, c.v);
    const referencia = c.modo === 'adulto' ? 'adulto e idoso' : 'criança e adolescente (OMS)';
    idadeLegenda.textContent = `Idade na avaliação: ${textoIdade(c.anos, c.meses)}. Referência: ${referencia}.`;
    resumoPainel.textContent = `${c.modo === 'adulto' ? 'Adulto e idoso' : 'Criança e adolescente'} · ${textoIdade(c.anos, c.meses)}`;
    const itens = !c.r ? { destaques: [], grupos: [] } : c.modo === 'adulto' ? itensAdulto(c.r) : itensInfantil(c.r, c);
    painel.atualizar({ ...itens, avisos: [...c.avisos, avisoEstimativa] });
    return c;
  }

  function estimar(acao) {
    const c = calcular();
    if (!c.r || c.modo !== 'adulto') {
      avisar('Informe a data e a idade para estimar.');
      return;
    }
    const v = c.v;
    const r = calcularAntropometria({
      sexo: p.sexo,
      idade: c.r.idade,
      peso: v.peso,
      estatura: v.estatura,
      alturaJoelho: v.alturaJoelho,
      dobras: grupo(v, 'dobras'),
      circunferencias: grupo(v, 'circunferencias'),
      acao,
    });
    if (r.estimativa?.erro) {
      avisoEstimativa = `${acao === 'estimarEstatura' ? 'Estatura' : 'Peso'} estimado: ${r.estimativa.erro}`;
      avisar(avisoEstimativa);
    } else if (acao === 'estimarEstatura') {
      form.elements.estatura.value = r.tela.campos.alturaInput;
      avisoEstimativa = null;
      avisar(`Estatura estimada (Chumlea): ${r.estimativa.texto} cm.`);
    } else {
      form.elements.peso.value = r.tela.campos.pesoInput;
      avisoEstimativa = null;
      avisar(`Peso estimado (Chumlea): ${r.estimativa.texto} kg.`);
    }
    atualizar();
  }

  // ---- Persistência ---------------------------------------------------------------------------
  function ordenados() {
    return db.listarRegistros(p.id, TIPO).sort((a, b) =>
      chaveData(b.data).localeCompare(chaveData(a.data)) || (b.criadoEm || '').localeCompare(a.criadoEm || ''));
  }

  function resumo(c) {
    const r = c.r;
    if (!r) return { modo: c.modo, idade: c.anos, meses: c.meses, peso: check(c.v.peso) || null };
    if (c.modo === 'adulto') {
      const gDobras = r.dobras.percentualGordura;
      const gBio = r.bioimpedancia ? r.bioimpedancia.percentualGordura : null;
      const porDobras = gDobras !== null && Number.isFinite(gDobras);
      return {
        modo: 'adulto', idade: r.idade, meses: c.meses, peso: r.peso, estatura: r.estatura,
        imc: r.imc ? r.imc.arredondado : null, classeImc: r.imc?.classificacao ?? null,
        gc: porDobras ? fxn(gDobras, 1) : gBio,
        origemGc: porDobras ? 'dobras' : gBio !== null ? 'bioimpedancia' : null,
        classeGc: porDobras ? r.dobras.classificacao?.rotulo ?? null : r.bioimpedancia?.classificacao?.rotulo ?? null,
      };
    }
    return {
      modo: 'infantil', idade: r.anos, meses: r.meses, peso: check(c.v.peso) || null, estatura: check(c.v.estatura) || null,
      imc: r.imc, classeImc: r.classeImc, gc: r.gc, origemGc: r.gc !== null ? 'slaughter' : null, classeGc: r.classeGc,
      zPeso: r.zPeso, zAltura: r.zAltura, zImc: r.zImc,
    };
  }

  function salvar(e) {
    e.preventDefault();
    const c = atualizar();
    if (!c.data) {
      avisar('Informe a data da avaliação (dd/mm/aaaa).');
      form.elements.data.focus();
      return;
    }
    if (!(check(c.v.peso) > 0) && !(check(c.v.estatura) > 0)) {
      avisar('Informe ao menos o peso ou a estatura.');
      form.elements.peso.focus();
      return;
    }
    const existente = atualId ? db.listarRegistros(p.id, TIPO).find((r) => r.id === atualId) : null;
    const salvo = db.salvarRegistro(p.id, TIPO, {
      ...(existente || {}),
      data: c.data,
      modo: c.modo,
      entrada: { ...c.v, data: c.data },
      resumo: resumo(c),
      tela: c.r?.tela ?? null,
    });
    form.elements.data.value = c.data;
    atualId = salvo.id;
    desenharLista();
    atualizarEstado();
    avisar(existente ? 'Avaliação atualizada.' : 'Avaliação salva.');
  }

  function preencher(valores) {
    form.querySelectorAll('[name]').forEach((el) => {
      el.value = valores[el.name] ?? (el.name === 'data' ? hojeTexto() : PADROES[el.name] ?? '');
    });
  }

  function nova() {
    atualId = null;
    avisoEstimativa = null;
    const base = ordenados()[0]?.entrada || {};
    preencher({ protocolo: base.protocolo, equacaoGordura: base.equacaoGordura, ladoBraco: base.ladoBraco });
    atualizar();
    desenharLista();
    atualizarEstado();
  }

  function abrir(r) {
    atualId = r.id;
    avisoEstimativa = null;
    preencher(r.entrada || {});
    atualizar();
    desenharLista();
    atualizarEstado();
    form.elements.data.focus();
    avisar(`Avaliação de ${r.data} aberta para edição.`);
  }

  function excluir(r) {
    if (!confirm(`Excluir a avaliação de ${r.data}? Esta ação não pode ser desfeita.`)) return;
    db.excluirRegistro(p.id, TIPO, r.id);
    if (atualId === r.id) atualId = null;
    desenharLista();
    atualizarEstado();
    avisar('Avaliação excluída.');
  }

  function atualizarEstado() {
    const r = atualId ? db.listarRegistros(p.id, TIPO).find((x) => x.id === atualId) : null;
    botaoSalvar.textContent = r ? 'Salvar alterações' : 'Salvar avaliação';
    estadoEdicao.textContent = r ? `Editando a avaliação de ${r.data}.` : 'Avaliação nova, ainda não salva.';
  }

  function desenharLista() {
    const regs = ordenados();
    if (!regs.length) {
      corpoLista.replaceChildren(h('p', { class: 'legenda' }, 'Nenhuma avaliação salva ainda.'));
      return;
    }
    // Variação de peso em relação à avaliação anterior (em ordem cronológica).
    const variacao = new Map();
    let anterior = null;
    for (const r of regs.slice().reverse()) {
      const peso = r.resumo?.peso;
      if (peso > 0) {
        if (anterior !== null) variacao.set(r.id, peso - anterior);
        anterior = peso;
      }
    }
    const nota = (texto) => (texto ? h('div', {}, h('small', {}, texto)) : null);
    const origem = { dobras: 'dobras', bioimpedancia: 'bioimpedância', slaughter: 'Slaughter' };
    corpoLista.replaceChildren(h('div', { class: 'tabela-rolagem' }, h('table', {},
      h('caption', { class: 'legenda', style: 'text-align:left;padding-bottom:8px' }, 'Peso, IMC e % de gordura por data de avaliação, da mais recente para a mais antiga.'),
      h('thead', {}, h('tr', {},
        h('th', { scope: 'col' }, 'Data'),
        h('th', { scope: 'col' }, 'Referência'),
        h('th', { scope: 'col', class: 'num' }, 'Peso'),
        h('th', { scope: 'col', class: 'num' }, 'Variação'),
        h('th', { scope: 'col', class: 'num' }, 'IMC'),
        h('th', { scope: 'col', class: 'num' }, '% gordura'),
        h('th', { scope: 'col' }, h('span', { class: 'oculto-visual' }, 'Ações')))),
      h('tbody', {}, regs.map((r) => {
        const s = r.resumo || {};
        const temGc = s.gc !== null && s.gc !== undefined && Number.isFinite(s.gc);
        return h('tr', { 'aria-current': r.id === atualId ? 'true' : null },
          h('th', { scope: 'row' }, r.data || '-'),
          h('td', {}, r.modo === 'infantil' ? 'Infantil' : 'Adulto'),
          h('td', { class: 'num' }, s.peso > 0 ? `${fx(s.peso, 1)} kg` : '-'),
          h('td', { class: 'num' }, variacao.has(r.id) ? variacaoTexto(variacao.get(r.id)) : '-'),
          h('td', { class: 'num' }, s.imc > 0 ? fx(s.imc, 1) : '-', nota(s.classeImc)),
          h('td', { class: 'num' }, temGc ? `${fx(s.gc, 1)}%` : '-', nota(temGc ? [origem[s.origemGc], s.classeGc].filter(Boolean).join(' · ') : '')),
          h('td', {}, h('div', { class: 'acoes', style: 'flex-wrap:nowrap' },
            h('button', { type: 'button', class: 'botao discreto', 'aria-label': `Abrir a avaliação de ${r.data}`, onclick: () => abrir(r) }, 'Abrir'),
            h('button', { type: 'button', class: 'botao discreto', 'aria-label': `Excluir a avaliação de ${r.data}`, onclick: () => excluir(r) }, 'Excluir'))));
      })))));
  }

  // ---- Eventos --------------------------------------------------------------------------------
  form.addEventListener('submit', salvar);
  form.addEventListener('input', () => {
    avisoEstimativa = null;
    atualizar();
  });
  form.addEventListener('change', (e) => {
    const nome = e.target.name || '';
    if (nome === 'data') {
      const d = normalizarData(e.target.value);
      if (d) e.target.value = d;
      atualizar();
      return;
    }
    if (!nome.startsWith('bioimpedancia.')) return;
    const origemBio = nome.slice('bioimpedancia.'.length);
    if (!ORIGENS_BIO.includes(origemBio) || String(e.target.value).trim() === '') return;
    const v = lerFormulario(form);
    const preenchidos = preencherBioimpedancia(origemBio, { peso: v.peso, ...grupo(v, 'bioimpedancia') });
    if (!preenchidos) {
      avisar('Informe o peso para preencher a bioimpedância automaticamente.');
      return;
    }
    for (const [k, x] of Object.entries(preenchidos)) form.elements[`bioimpedancia.${k}`].value = x;
    atualizar();
  });

  nova();
}

registrarAba({ id: 'antropometria', rotulo: 'Antropometria', ordem: 20, montar });
