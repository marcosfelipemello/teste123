// Questionários de saúde (relatório §10). Compara com o que o WebDiet mostrou na tela
// (docs/webdiet-evidencias/tela_q_*.json e tela_q_fronteiras.json), testa a política de divergências
// (§12 #21–23, totais sem classificação, questionários incompletos) e as fronteiras das tabelas do relatório.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  QUESTIONARIOS,
  DIVERGENCIAS,
  MENSAGEM_INCOMPLETO,
  comTextos,
  calcularQuestionario,
  calcularRastreamento,
  classificarRastreamento,
  calcularFindrisc,
  classificarFindrisc,
  calcularSarcopenia,
  calcularCafeina,
  calcularCronotipo,
  classificarCronotipo,
  condutaCronotipo,
  calcularDisbiose,
  classificarDisbiose,
  calcularQfa,
  calcularFenotipo,
  classificarSubescala,
  calcularDoshas,
  calcularSinais,
  corSinais,
  NENHUMA_DEFICIENCIA,
  NENHUM_EXCESSO,
} from '../src/calc/questionarios/index.js';

const evidencia = (arquivo) =>
  JSON.parse(fs.readFileSync(new URL(`../../docs/webdiet-evidencias/${arquivo}`, import.meta.url), 'utf8'));

/** Respostas que somam `total`, enchendo os itens com `max` em ordem (escala 0..max). */
function comTotal(nItens, max, total) {
  const r = [];
  let resto = total;
  for (let i = 0; i < nItens; i++) {
    const v = Math.min(max, resto);
    r.push(v);
    resto -= v;
  }
  assert.equal(resto, 0, `não dá para somar ${total} com ${nItens} itens de 0 a ${max}`);
  return r;
}

const pontosDe = (id) => QUESTIONARIOS[id].itens.map((it) => it.opcoes.map((o) => o.pontos));
const repetir = (n, v) => Array.from({ length: n }, () => v);

// ---------------------------------------------------------------------------------------------------------
// Registro (API para a UI)
// ---------------------------------------------------------------------------------------------------------

test('registro: 10 questionários com a mesma forma', () => {
  assert.deepEqual(Object.keys(QUESTIONARIOS), [
    'rastreamento', 'findrisc', 'sarcopenia', 'cafeina', 'cronotipo', 'disbiose', 'qfa', 'fenotipo', 'doshas', 'sinais',
  ]);
  const nItens = { rastreamento: 66, findrisc: 8, sarcopenia: 12, cafeina: 47, cronotipo: 19, disbiose: 17, qfa: 42, fenotipo: 16, doshas: 24, sinais: 0 };
  for (const [id, q] of Object.entries(QUESTIONARIOS)) {
    assert.equal(q.id, id);
    assert.equal(typeof q.nome, 'string');
    assert.match(q.secao, /^10\.\d+$/);
    assert.ok(['escala', 'selecao', 'numerico', 'sinais'].includes(q.tipo), `${id}.tipo`);
    assert.equal(typeof q.exigeTodas, 'boolean');
    assert.equal(typeof q.calcular, 'function');
    assert.ok(Array.isArray(q.categorias), `${id}.categorias`);
    assert.equal(q.itens.length, nItens[id], `${id}: nº de itens`);
    assert.equal(q.padrao.length, q.itens.length, `${id}: um padrão por item`);
    assert.ok(Object.isFrozen(q) && Object.isFrozen(q.itens), `${id} congelado`);
    q.itens.forEach((it, i) => {
      assert.equal(it.n, i + 1, `${id}: itens numerados em ordem`);
      assert.ok('categoria' in it, `${id}.${it.n}.categoria`);
      assert.equal(it.texto, null, `${id}.${it.n}: texto da pergunta não copiado`);
      if (q.tipo === 'numerico') {
        assert.equal(it.opcoes, null);
      } else {
        assert.ok(it.opcoes.length >= 2, `${id}.${it.n}: opções`);
        for (const o of it.opcoes) {
          assert.ok(typeof o.pontos === 'number' || o.pontos === '-', `${id}.${it.n}: pontos`);
          assert.equal(typeof o.rotulo, 'string');
          assert.equal(o.texto, null);
        }
      }
    });
  }
  assert.equal(QUESTIONARIOS.cafeina.modoPadrao, 'resumido');
  assert.deepEqual([...QUESTIONARIOS.cafeina.modos], ['resumido', 'completo']);
});

test('registro: respostas padrão (§10.1 0, §10.4 0 oculto, §10.8 1; demais em branco)', () => {
  const p = (id) => [...new Set(QUESTIONARIOS[id].padrao)];
  assert.deepEqual(p('rastreamento'), [0]);
  assert.deepEqual(p('cafeina'), [0]);
  assert.deepEqual(p('fenotipo'), [1]);
  for (const id of ['findrisc', 'sarcopenia', 'cronotipo', 'disbiose', 'qfa', 'doshas']) assert.deepEqual(p(id), [null], id);
  assert.deepEqual([...QUESTIONARIOS.sinais.padrao], []);
  // A opção 0 da cafeína é a marcação oculta "não respondido".
  for (const it of QUESTIONARIOS.cafeina.itens) {
    assert.equal(it.opcoes[0].pontos, 0);
    assert.equal(it.opcoes[0].oculta, true);
    assert.ok(it.opcoes.slice(1).every((o) => !o.oculta));
  }
  // Calcular com o padrão = calcular sem respostas.
  for (const id of ['rastreamento', 'cafeina', 'fenotipo', 'findrisc', 'sarcopenia', 'disbiose', 'qfa']) {
    const q = QUESTIONARIOS[id];
    assert.deepEqual(q.calcular([...q.padrao]).tela, q.calcular([]).tela, id);
  }
});

test('registro: mapas item → categoria e pontos das opções (tabelas "Estrutura" de §10)', () => {
  // §10.1 — categorias cobrem 1..66 em ordem; máximo = 4 × nº de itens.
  const rast = QUESTIONARIOS.rastreamento;
  assert.deepEqual(rast.categorias.flatMap((c) => c.itens), Array.from({ length: 66 }, (_, i) => i + 1));
  assert.deepEqual(
    rast.categorias.map((c) => [c.nome, c.itens[0], c.itens.at(-1), c.maximo]),
    [
      ['Cabeça', 1, 4, 16], ['Olhos', 5, 8, 16], ['Ouvidos', 9, 12, 16], ['Nariz', 13, 17, 20],
      ['Boca e Garganta', 18, 22, 20], ['Pele', 23, 27, 20], ['Coração', 28, 30, 12], ['Pulmões', 31, 34, 16],
      ['Trato digestivo', 35, 41, 28], ['Articulações / Músculos', 42, 46, 20], ['Energia / Atividade', 47, 50, 16],
      ['Mente', 51, 58, 32], ['Emoções', 59, 62, 16], ['Outros', 63, 66, 16],
    ],
  );
  for (const c of rast.categorias) assert.equal(c.maximo, 4 * c.itens.length);
  assert.deepEqual(rast.itens[0].opcoes.map((o) => o.cor), ['verde', 'amarelo', 'laranja', 'vermelho', 'vermelho-escuro']);
  assert.equal(rast.itens[41].categoria, 'Articulações / Músculos');

  // §10.2
  assert.deepEqual(pontosDe('findrisc'), [[0, 2, 3, 4], [0, 1, 3], [0, 3, 4, 0, 3, 4], [0, 2], [0, 1], [2, 0], [5, 0], [0, 3, 5]]);
  // §10.3
  assert.deepEqual(pontosDe('sarcopenia'), [
    [0, 1, 2], [0, 1, 2], [0, 1, 2], [0, 1, 2], [0, 1, 2], [0, 1], [0, 1, 2], [0, 1, 2], [2, 0, 1], [5, 0], [1, 0], [3, 0],
  ]);
  // §10.4 — 7 fatores, itens "R" (3 por fator, 21 no total), máximos.
  const caf = QUESTIONARIOS.cafeina;
  assert.deepEqual(
    caf.categorias.map((c) => [c.nome, c.itens.length, c.maximo, c.itensResumido]),
    [
      ['Dependência', 12, 72, [2, 3, 8]],
      ['Energia e disposição', 8, 48, [13, 17, 20]],
      ['Supressão do apetite', 5, 30, [22, 23, 25]],
      ['Melhoras no humor', 6, 36, [27, 30, 31]],
      ['Melhoria do desempenho físico', 3, 18, [32, 33, 34]],
      ['Ansiedade e efeitos negativos', 9, 54, [37, 38, 41]],
      ['Distúrbios do sono', 4, 24, [44, 45, 46]],
    ],
  );
  assert.deepEqual(caf.categorias.flatMap((c) => c.itens), Array.from({ length: 47 }, (_, i) => i + 1));
  assert.equal(caf.itens.filter((it) => it.resumido).length, 21);
  for (const c of caf.categorias) for (const n of c.itensResumido) assert.ok(c.itens.includes(n));
  assert.deepEqual(pontosDe('cafeina')[0], [0, 1, 2, 3, 4, 5, 6]);
  // §10.5
  assert.deepEqual(pontosDe('cronotipo'), [
    [5, 4, 3, 2, 1, 0], [5, 4, 3, 2, 1, 0], [1, 2, 3, 4], [1, 2, 3, 4], [1, 2, 3, 4], [1, 2, 3, 4], [1, 2, 3, 4],
    [4, 3, 2, 1], [4, 3, 2, 1], [5, 4, 3, 2, 1], [4, 3, 2, 1], [1, 2, 3, 4], [4, 3, 2, 1], [1, 2, 3, 4],
    [4, 3, 2, 1], [4, 3, 2, 1], [5, 4, 3, 2, 1], [5, 4, 3, 2, 1], [6, 4, 2, 0],
  ]);
  // §10.6
  const d4 = [3, 2, 1, 0];
  assert.deepEqual(pontosDe('disbiose'), [
    [3, 0], [3, 0, '-'], [3, 2, 0, '-'], d4, d4, d4, d4, d4, d4, [2, 0], [3, 0], [3, 0], [0, 3], d4, [3, 0], [3, 0], [3, 0],
  ]);
  assert.equal(QUESTIONARIOS.disbiose.itens[1].opcoes[2].rotulo, 'Não sei informar');
  // §10.7
  const qfa = QUESTIONARIOS.qfa;
  assert.deepEqual(
    qfa.categorias.map((c) => [c.nome, c.itens[0], c.itens.at(-1), c.recomendado]),
    [
      ['Leites e derivados', 1, 4, 21], ['Carnes e ovos', 5, 9, 14], ['Óleos', 10, 15, 7], ['Cereais e leguminosas', 16, 23, 42],
      ['Frutas/verduras/legumes', 24, 27, 42], ['Petiscos/embutidos/enlatados', 28, 31, 7], ['Sobremesas e doces', 32, 35, 7],
      ['Bebidas', 36, 42, 7],
    ],
  );
  assert.deepEqual(qfa.itens.filter((it) => it.bebida === 'saudável').map((it) => it.n), [36, 37, 38]);
  assert.deepEqual(qfa.itens.filter((it) => it.bebida === 'açucarada').map((it) => it.n), [39, 40, 41, 42]);
  // §10.8
  const fen = QUESTIONARIOS.fenotipo;
  assert.deepEqual(
    fen.categorias.map((c) => [c.nome, c.itens, c.maximo]),
    [
      ['Desorganizado', [9, 11, 16], 15], ['Hedônico', [5, 8, 12, 14], 20], ['Compulsivo', [13, 15], 10],
      ['Emocional', [2, 4, 7, 10], 20], ['Hiperfágico', [1, 3, 6], 15],
    ],
  );
  assert.deepEqual(fen.categorias.flatMap((c) => c.itens).sort((a, b) => a - b), Array.from({ length: 16 }, (_, i) => i + 1));
  for (const c of fen.categorias) for (const n of c.itens) assert.equal(fen.itens[n - 1].categoria, c.nome);
  // §10.9
  for (const it of QUESTIONARIOS.doshas.itens) assert.deepEqual(it.opcoes.map((o) => [o.pontos, o.rotulo]), [[0, 'A'], [1, 'B'], [2, 'C']]);
  // §10.10
  assert.equal(QUESTIONARIOS.sinais.categorias.length, 16);
  assert.equal(QUESTIONARIOS.sinais.totalSinais, 289);
});

test('registro: totais mínimo e máximo pelas opções (§10.1–10.6)', () => {
  const extremo = (id, f) => pontosDe(id).reduce((s, p) => s + f(...p.filter((x) => typeof x === 'number')), 0);
  assert.equal(extremo('rastreamento', Math.max), 264);
  assert.equal(extremo('findrisc', Math.max), 26);
  assert.equal(extremo('sarcopenia', Math.max), 26);
  assert.equal(extremo('cronotipo', Math.min), 16);
  assert.equal(extremo('cronotipo', Math.max), 83);
  assert.equal(extremo('disbiose', Math.max), 50);
});

test('registro: calcularQuestionario e comTextos', () => {
  const resp = ['4', '3', '4', '2', '1', '2', '5', '5'];
  assert.deepEqual(calcularQuestionario('findrisc', resp), calcularFindrisc(resp));
  assert.throws(() => calcularQuestionario('inexistente', []), RangeError);
  assert.throws(() => calcularQuestionario('toString', []), RangeError);

  const def = comTextos(QUESTIONARIOS.doshas, { itens: { 1: 'Minha pergunta 1' }, opcoes: { 1: ['a', 'b', 'c'] } });
  assert.equal(def.itens[0].texto, 'Minha pergunta 1');
  assert.deepEqual(def.itens[0].opcoes.map((o) => o.texto), ['a', 'b', 'c']);
  assert.equal(def.itens[1].texto, null);
  assert.equal(QUESTIONARIOS.doshas.itens[0].texto, null, 'original não muda');
  assert.ok(Object.isFrozen(def));
  assert.equal(def.calcular(repetir(24, 0)).dosha, 'VATA');
  const qfa = comTextos(QUESTIONARIOS.qfa, { itens: { 42: 'x' } });
  assert.equal(qfa.itens[41].texto, 'x');
  assert.equal(qfa.itens[41].opcoes, null);
});

test('entrada inválida: valor fora das opções, respostas demais, tipo errado', () => {
  assert.throws(() => calcularRastreamento([5]), RangeError);
  assert.throws(() => calcularFindrisc(['1']), RangeError, 'idade não tem opção de 1 ponto');
  assert.throws(() => calcularDisbiose(['-']), RangeError, 'item 1 não aceita "-"');
  assert.throws(() => calcularDoshas([3]), RangeError);
  assert.throws(() => calcularCafeina([7]), RangeError);
  assert.throws(() => calcularFenotipo([0]), RangeError, 'fenótipo não tem nota 0');
  assert.throws(() => calcularCronotipo(repetir(20, '1')), RangeError);
  assert.throws(() => calcularSarcopenia('0,0'), TypeError);
  assert.throws(() => calcularFindrisc([true]), TypeError);
  // Número ou texto numérico valem o mesmo.
  assert.deepEqual(calcularFindrisc([2, ' 3 ']).tela, calcularFindrisc(['2', 3]).tela);
});

// ---------------------------------------------------------------------------------------------------------
// §10.1 Rastreamento metabólico
// ---------------------------------------------------------------------------------------------------------

test('§10.1 evidência tela_q_rastreamento.json: total, resultado e categorias', async (t) => {
  const ev = evidencia('tela_q_rastreamento.json');
  assert.equal(ev.length, 4);
  for (const { cenario, tela } of ev) {
    await t.test(cenario.nome, () => {
      const r = calcularRastreamento(cenario.resp);
      assert.equal(r.tela.pontuacao, tela['.total-pontos']);
      assert.equal(r.tela.resultado, tela['#resultadoRast']);
      assert.equal(r.tela.categorias.join(''), tela['#resultadoRastCategoria']);
      assert.equal(r.tela.categorias.length, 14);
      assert.equal(r.total, parseInt(tela['.total-pontos'], 10));
    });
  }
});

test('§10.1 evidência tela_q_fronteiras.json: fronteiras 30/31, 40/41, 100/101', async (t) => {
  const { rast } = evidencia('tela_q_fronteiras.json');
  assert.deepEqual(Object.keys(rast), ['30', '31', '40', '41', '100', '101']);
  for (const [total, [pontuacao, resultado]] of Object.entries(rast)) {
    await t.test(`total ${total}`, () => {
      const r = calcularRastreamento(comTotal(66, 4, Number(total)));
      assert.equal(r.tela.pontuacao, pontuacao);
      assert.equal(r.tela.resultado, resultado);
    });
  }
});

test('§10.1 cores do resultado e item em branco = 0', () => {
  const cor = (t) => classificarRastreamento(t).cor;
  assert.deepEqual([0, 30, 31, 40, 41, 100, 101, 264].map(cor), ['verde', 'verde', 'amarelo', 'amarelo', '#fa5423', '#fa5423', '#e61c24', '#e61c24']);
  const r = calcularRastreamento([4, null, '', undefined, 4]);
  assert.equal(r.total, 8);
  assert.deepEqual(r.semResposta.slice(0, 4), [2, 3, 4, 6]);
  assert.equal(r.tela.categorias[0], 'Cabeça 4/16');
  assert.equal(r.tela.categorias[1], 'Olhos 4/16');
  assert.equal(calcularRastreamento().tela.pontuacao, '0 pontos');
  assert.equal(r.aviso, null);
});

// ---------------------------------------------------------------------------------------------------------
// §10.2 FINDRISC
// ---------------------------------------------------------------------------------------------------------

test('§10.2 evidência tela_q_diabetes.json: pontuação e risco', async (t) => {
  const ev = evidencia('tela_q_diabetes.json');
  assert.equal(ev.length, 11);
  for (const { cenario, tela } of ev) {
    await t.test(cenario.nome, () => {
      const r = calcularFindrisc(cenario.resp);
      assert.equal(r.tela.pontuacao, tela['#pontuacaoResultado']);
      assert.equal(r.tela.resultado, tela['#resultadoRast']);
    });
  }
});

test('§10.2 fronteiras e cores; item sem resposta não soma', () => {
  const casos = [
    [0, 'RISCO BAIXO', 'verde'], [6, 'RISCO BAIXO', 'verde'],
    [7, 'RISCO DISCRETAMENTE AUMENTADO', '#f8ce4f'], [11, 'RISCO DISCRETAMENTE AUMENTADO', '#f8ce4f'],
    [12, 'RISCO MODERADO', '#FFA500'], [14, 'RISCO MODERADO', '#FFA500'],
    [15, 'RISCO ALTO', '#E53935'], [20, 'RISCO ALTO', '#E53935'],
    [21, 'RISCO MUITO ALTO', '#8B0000'], [26, 'RISCO MUITO ALTO', '#8B0000'],
  ];
  for (const [total, texto, cor] of casos) {
    assert.equal(classificarFindrisc(total).texto, texto, `total ${total}`);
    assert.equal(classificarFindrisc(total).cor, cor, `cor ${total}`);
  }
  // Primeira opção de todos os itens = 7 (itens 6 e 7 começam com "sim").
  assert.equal(calcularFindrisc(QUESTIONARIOS.findrisc.itens.map((it) => it.opcoes[0].pontos)).total, 7);
  const r = calcularFindrisc(['4', null, '4']);
  assert.equal(r.tela.pontuacao, '8 pontos de 26 possíveis');
  assert.equal(r.tela.resultado, 'RISCO DISCRETAMENTE AUMENTADO');
  assert.deepEqual(r.semResposta, [2, 4, 5, 6, 7, 8]);
  assert.equal(calcularFindrisc([]).tela.pontuacao, '0 pontos de 26 possíveis');
});

// ---------------------------------------------------------------------------------------------------------
// §10.3 Sarcopenia
// ---------------------------------------------------------------------------------------------------------

test('§10.3 evidência tela_q_sarcopenia.json: só o total, sem classificação', async (t) => {
  const ev = evidencia('tela_q_sarcopenia.json');
  assert.equal(ev.length, 3);
  for (const { cenario, tela } of ev) {
    await t.test(cenario.nome, () => {
      const r = calcularSarcopenia(cenario.resp);
      assert.equal(r.tela.pontuacao, tela['#pontuacaoSelecionados']);
      assert.equal(tela['#resultadoRast'], '');
      assert.equal(r.classe, null);
      assert.deepEqual(Object.keys(r.tela), ['pontuacao']);
    });
  }
});

test('§10.3 primeiras/segundas/últimas opções e itens em branco', () => {
  const opcao = (k) => QUESTIONARIOS.sarcopenia.itens.map((it) => it.opcoes[k === -1 ? it.opcoes.length - 1 : k].pontos);
  assert.equal(calcularSarcopenia(opcao(0)).total, 11);
  assert.equal(calcularSarcopenia(opcao(1)).total, 8);
  assert.equal(calcularSarcopenia(opcao(-1)).total, 16);
  const r = calcularSarcopenia(['2', null, '2', '', '2', '1', '2', '2', '2', '5', '1', '3']);
  assert.equal(r.tela.pontuacao, '22 pontos');
  assert.deepEqual(r.semResposta, [2, 4]);
  assert.equal(calcularSarcopenia([]).tela.pontuacao, '0 pontos');
  assert.equal(r.aviso, null);
});

// ---------------------------------------------------------------------------------------------------------
// §10.4 Cafeína (CaffEQ)
// ---------------------------------------------------------------------------------------------------------

test('§10.4 evidência tela_q_cafeina.json (modo resumido, padrão): "Fator" + "Média: x.xx"', async (t) => {
  const ev = evidencia('tela_q_cafeina.json');
  assert.equal(ev.length, 4);
  for (const { cenario, tela } of ev) {
    await t.test(cenario.nome, () => {
      const r = calcularCafeina(cenario.resp);
      assert.equal(r.modo, 'resumido');
      assert.equal(r.tela.fatores.length, 7, 'os 7 fatores sempre aparecem');
      // A evidência guardou só o começo do resultado (as primeiras linhas, sem o texto autoral).
      const linhas = tela['#resultadoRastCategoria'];
      assert.ok(linhas.length >= 2);
      linhas.forEach((linha, i) => assert.equal(`${r.tela.fatores[i].nome}${r.tela.fatores[i].media}`, linha));
      assert.equal(tela['.total-pontos'], '');
    });
  }
});

test('§10.4 evidência tela_q_fronteiras.json: média 4.00 → "alto"; item não "R" ignorado no resumido', () => {
  const fr = evidencia('tela_q_fronteiras.json');
  // cafeina_dep_392: item 1 (não "R") = 3, demais 4.
  for (const [resp, linha] of [[repetir(47, 4), fr.cafeina_tudo4], [[3, ...repetir(46, 4)], fr.cafeina_dep_392]]) {
    const r = calcularCafeina(resp);
    const f = r.tela.fatores[0];
    const prefixo = `•${f.nome}${f.media}`;
    assert.ok(linha.startsWith(prefixo), `${linha} começa com ${prefixo}`);
    assert.equal(f.media, 'Média: 4.00');
    assert.equal(r.fatores[0].nivel, 'alto');
    assert.equal(f.cor, '#f44336');
    assert.equal(f.texto, null, 'sem textos fornecidos, texto = null');
    // O texto autoral (abreviado na evidência) entra por opcoes.textos e aparece depois da média.
    const alto = linha.slice(prefixo.length).replace(/…$/, '');
    const g = calcularCafeina(resp, { textos: { Dependência: { alto, baixo: 'x' } } }).tela.fatores[0];
    assert.equal(`•${g.nome}${g.media}${g.texto}…`, linha);
  }
});

test('§10.4 média 3.67 → "baixo"; cores por fator; todos 1/3/6', () => {
  // Fronteira 3.67: item "R" 2 (índice 1) = 3, demais 4 (nota em tela_q_fronteiras.json).
  const r = calcularCafeina([4, 3, ...repetir(45, 4)]);
  assert.equal(r.tela.fatores[0].media, 'Média: 3.67');
  assert.equal(r.fatores[0].nivel, 'baixo');
  assert.equal(r.fatores[0].cor, 'verde');
  // Fatores 2–5 (desejados): ≥ 4 verde, < 4 cinza; fatores 1, 6, 7: ≥ 4 vermelho, < 4 verde.
  assert.deepEqual(tudoCor(4), ['#f44336', 'verde', 'verde', 'verde', 'verde', '#f44336', '#f44336']);
  assert.deepEqual(tudoCor(3), ['verde', '#a2a2a2', '#a2a2a2', '#a2a2a2', '#a2a2a2', 'verde', 'verde']);
  for (const [v, m] of [[1, 'Média: 1.00'], [3, 'Média: 3.00'], [6, 'Média: 6.00']]) {
    assert.ok(calcularCafeina(repetir(47, v)).tela.fatores.every((f) => f.media === m), m);
  }
  function tudoCor(v) {
    return calcularCafeina(repetir(47, v)).tela.fatores.map((f) => f.cor);
  }
});

test('§10.4 modo completo: soma / nº de itens do fator; em branco conta 0', () => {
  const resp = [3, ...repetir(46, 4)];
  const c = calcularCafeina(resp, { modo: 'completo' });
  assert.equal(c.modo, 'completo');
  assert.deepEqual(c.fatores.map((f) => f.divisor), [12, 8, 5, 6, 3, 9, 4]);
  assert.equal(c.fatores[0].soma, 47);
  assert.equal(c.tela.fatores[0].media, 'Média: 3.92');
  assert.equal(c.fatores[0].nivel, 'baixo');
  assert.equal(calcularCafeina(resp, { modo: 'resumido' }).tela.fatores[0].media, 'Média: 4.00');
  // Padrão i%6+1 da evidência no modo completo (conta de §10.4, não conferida na tela: §14).
  const padrao = Array.from({ length: 47 }, (_, i) => (i % 6) + 1);
  assert.deepEqual(
    calcularCafeina(padrao, { modo: 'completo' }).tela.fatores.map((f) => f.media),
    // 42/12 · 24/8 · 19/5 · 21/6 · 9/3 · 33/9 · 14/4
    ['Média: 3.50', 'Média: 3.00', 'Média: 3.80', 'Média: 3.50', 'Média: 3.00', 'Média: 3.67', 'Média: 3.50'],
  );
  // Sem resposta (ou 0 oculto) soma 0 e continua no divisor.
  const vazio = calcularCafeina([]);
  assert.ok(vazio.tela.fatores.every((f) => f.media === 'Média: 0.00'));
  assert.equal(vazio.semResposta.length, 21, 'resumido: só os itens "R"');
  assert.equal(calcularCafeina([], { modo: 'completo' }).semResposta.length, 47);
  // Itens "R" 2 e 3 = 6, item "R" 8 em branco: resumido 12/3; completo 12/12.
  const doisR = calcularCafeina([0, 6, 6]);
  assert.equal(doisR.tela.fatores[0].media, 'Média: 4.00');
  assert.equal(doisR.semResposta[0], 8);
  assert.equal(calcularCafeina([0, 6, 6], { modo: 'completo' }).tela.fatores[0].media, 'Média: 1.00');
  assert.throws(() => calcularCafeina([], { modo: 'longo' }), RangeError);
});

// ---------------------------------------------------------------------------------------------------------
// §10.5 Cronotipo (MEQ)
// ---------------------------------------------------------------------------------------------------------

test('§10.5 evidência tela_q_cronotipo.json: "Resultado: N pontos" e "Perfil: …"', async (t) => {
  const ev = evidencia('tela_q_cronotipo.json');
  assert.equal(ev.length, 11);
  for (const { cenario, tela } of ev) {
    await t.test(cenario.nome, () => {
      const r = calcularCronotipo(cenario.resp);
      assert.equal(r.tela.pontuacao, tela['#pontuacaoSelecionados']);
      assert.equal(r.tela.perfil, tela['#cronotipo']);
      assert.equal(r.tela.mensagem, null);
      assert.equal(r.aviso, null);
      // A conduta não sai em `tela` (#condutaNutricionalTexto ficou vazio na evidência).
      assert.equal(tela['#condutaNutricionalTexto'], '');
      assert.deepEqual(Object.keys(r.tela), ['pontuacao', 'perfil', 'mensagem']);
    });
  }
});

test('§10.5 fronteiras das faixas e extremos 16/83', () => {
  const casos = [
    [16, 'Vespertino extremo ou noturno'], [30, 'Vespertino extremo ou noturno'],
    [31, 'Moderadamente vespertino'], [41, 'Moderadamente vespertino'],
    [42, 'Intermediário'], [58, 'Intermediário'],
    [59, 'Moderadamente matutino'], [69, 'Moderadamente matutino'],
    [70, 'Matutino extremo'], [83, 'Matutino extremo'], [86, 'Matutino extremo'],
  ];
  for (const [total, perfil] of casos) assert.equal(classificarCronotipo(total), perfil, `total ${total}`);
  const min = calcularCronotipo(pontosDe('cronotipo').map((p) => Math.min(...p)));
  assert.equal(min.tela.pontuacao, 'Resultado: 16 pontos');
  assert.equal(min.tela.perfil, 'Perfil: Vespertino extremo ou noturno');
  const max = calcularCronotipo(pontosDe('cronotipo').map((p) => Math.max(...p)));
  assert.equal(max.tela.pontuacao, 'Resultado: 83 pontos');
  assert.equal(max.tela.perfil, 'Perfil: Matutino extremo');
});

test('§10.5 conduta: distribuição do VET por refeição (≤ 41 vespertinos; > 41 demais)', () => {
  const perc = (t) => condutaCronotipo(t).refeicoes.map((x) => x.percentual);
  assert.deepEqual(condutaCronotipo(41).refeicoes.map((x) => x.refeicao), ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar']);
  for (const t of [16, 30, 31, 41]) assert.deepEqual(perc(t), [20, 5, 35, 10, 30], `total ${t}`);
  for (const t of [42, 58, 59, 70, 83]) assert.deepEqual(perc(t), [30, 10, 35, 5, 20], `total ${t}`);
  for (const t of [16, 41, 42, 83]) assert.equal(perc(t).reduce((a, b) => a + b, 0), 100);
  const ev = evidencia('tela_q_cronotipo.json');
  const r41 = calcularCronotipo(ev.find((e) => e.cenario.nome === 'total 41').cenario.resp);
  assert.deepEqual(r41.conduta.refeicoes.map((x) => x.percentual), [20, 5, 35, 10, 30]);
  const r42 = calcularCronotipo(ev.find((e) => e.cenario.nome === 'total 42').cenario.resp);
  assert.deepEqual(r42.conduta.refeicoes.map((x) => x.percentual), [30, 10, 35, 5, 20]);
});

test('§10.5 política: incompleto → mensagem do WebDiet; fora das faixas → null', () => {
  const resp = evidencia('tela_q_cronotipo.json')[0].cenario.resp.slice();
  resp[11] = '';
  const r = calcularCronotipo(resp);
  assert.equal(r.total, null);
  assert.equal(r.perfil, null);
  assert.equal(r.conduta, null);
  assert.equal(r.aviso, MENSAGEM_INCOMPLETO);
  assert.deepEqual(r.tela, { pontuacao: null, perfil: null, mensagem: MENSAGEM_INCOMPLETO });
  assert.deepEqual(r.semResposta, [12]);
  assert.equal(calcularCronotipo([]).semResposta.length, 19);
  assert.equal(calcularCronotipo(resp.slice(0, 18).map((v) => v || '1')).aviso, MENSAGEM_INCOMPLETO, 'item 19 faltando');
  // Fora de todas as faixas (inalcançável com os pontos do WebDiet, 16–83).
  assert.equal(classificarCronotipo(15), null);
  assert.equal(classificarCronotipo(87), null);
  assert.equal(classificarCronotipo(0), null);
});

test('§12 #21: pontuação do WebDiet mantida (itens 3 e 12) e marcada no código', () => {
  const pts = pontosDe('cronotipo');
  assert.deepEqual(pts[2], [1, 2, 3, 4], 'item 3 invertido como no WebDiet');
  assert.deepEqual(pts[11], [1, 2, 3, 4], 'item 12 com 1/2/3/4 como no WebDiet');
  const fonte = fs.readFileSync(new URL('../src/calc/questionarios/cronotipo.js', import.meta.url), 'utf8');
  assert.equal(fonte.match(/\/\/ WebDiet §12 #21/g)?.length, 2);
  const d = DIVERGENCIAS.find((x) => x.item === 21);
  assert.equal(d.questionario, 'cronotipo');
  // "de 43 possíveis" não é exibido.
  assert.ok(!JSON.stringify(calcularCronotipo(pts.map((p) => p[0])).tela).includes('possíveis'));
});

// ---------------------------------------------------------------------------------------------------------
// §10.6 Disbiose
// ---------------------------------------------------------------------------------------------------------

test('§10.6 evidência tela_q_disbiose.json: pontuação, máximo exibido e resultado', async (t) => {
  const ev = evidencia('tela_q_disbiose.json');
  assert.equal(ev.length, 10);
  for (const { cenario, tela } of ev) {
    await t.test(cenario.nome, () => {
      const r = calcularDisbiose(cenario.resp);
      assert.equal(r.tela.pontuacao, tela['#pontuacaoResultado']);
      // Resultado vazio na tela (50 de 49) ↔ null explícito aqui.
      assert.equal(r.tela.resultado, tela['#resultadoRast'] === '' ? null : tela['#resultadoRast']);
    });
  }
});

test('§12 #22: 50 pontos de 49 possíveis → classe null + aviso, texto da pontuação mantido', () => {
  const maximo = (p) => Math.max(...p.filter((x) => x !== '-'));
  const r = calcularDisbiose(pontosDe('disbiose').map(maximo));
  assert.equal(r.total, 50);
  assert.equal(r.tela.pontuacao, '50 pontos de 49 possíveis');
  assert.equal(r.classe, null);
  assert.equal(r.tela.resultado, null);
  assert.equal(r.tela.cor, null);
  assert.match(r.aviso, /§12 #22/);
  assert.match(r.aviso, /50 pontos de 49 possíveis/);
  // Mesmo estouro pelas tabelas com "-" (não visto na tela): 47 de 46 e 44 de 43.
  const um = calcularDisbiose(pontosDe('disbiose').map((p, i) => (i === 1 ? '-' : maximo(p))));
  assert.equal(um.tela.pontuacao, '47 pontos de 46 possíveis');
  assert.equal(um.classe, null);
  assert.match(um.aviso, /§12 #22/);
  const dois = calcularDisbiose(pontosDe('disbiose').map((p, i) => (i === 1 || i === 2 ? '-' : maximo(p))));
  assert.equal(dois.tela.pontuacao, '44 pontos de 43 possíveis');
  assert.equal(dois.classe, null);
  assert.ok(DIVERGENCIAS.some((d) => d.item === 22 && d.questionario === 'disbiose'));
});

test('§10.6 fronteiras das três tabelas (0, 1 e 2 respostas "-") e cores', () => {
  const tabelas = [
    [0, [[0, 10, 'baixo risco'], [11, 23, 'médio risco'], [24, 36, 'risco alto'], [37, 49, 'risco muito alto']]],
    [1, [[0, 10, 'baixo risco'], [11, 22, 'médio risco'], [23, 34, 'risco alto'], [35, 46, 'risco muito alto']]],
    [2, [[0, 10, 'baixo risco'], [11, 21, 'médio risco'], [22, 32, 'risco alto'], [33, 43, 'risco muito alto']]],
  ];
  const cores = { 'baixo risco': 'verde', 'médio risco': '#ffcd16', 'risco alto': '#fa5423', 'risco muito alto': '#e61c24' };
  for (const [tracos, faixas] of tabelas) {
    for (const [min, max, classe] of faixas) {
      for (const total of [min, max]) {
        const c = classificarDisbiose(total, tracos);
        assert.equal(c.texto, `O paciente encontra-se com ${classe} de disbiose`, `${tracos} "-", total ${total}`);
        assert.equal(c.cor, cores[classe]);
      }
    }
    assert.equal(classificarDisbiose(faixas[3][1] + 1, tracos), null, `${tracos} "-": acima do máximo`);
  }
  assert.throws(() => classificarDisbiose(5, 3), RangeError);
});

test('§10.6 contagem de "-" escolhe a tabela; "-" não soma; em branco não soma', () => {
  // Item 3 com "-" (a evidência só tem "-" no item 2).
  const r = calcularDisbiose(['3', '3', '-', '3', '3', '3', '2']);
  assert.equal(r.naoSei, 1);
  assert.equal(r.tela.pontuacao, '17 pontos de 46 possíveis');
  assert.equal(r.tela.resultado, 'O paciente encontra-se com médio risco de disbiose');
  // 23 pontos: médio sem "-", alto com um "-" (fronteira que muda de tabela).
  const base = ['3', '3', '3', '3', '3', '3', '3', '2'];
  assert.equal(calcularDisbiose(base).tela.resultado, 'O paciente encontra-se com médio risco de disbiose');
  const comTraco = ['3', '-', '3', '3', '3', '3', '3', '3', '2'];
  assert.equal(calcularDisbiose(comTraco).total, 23);
  assert.equal(calcularDisbiose(comTraco).tela.resultado, 'O paciente encontra-se com risco alto de disbiose');
  const vazio = calcularDisbiose([]);
  assert.equal(vazio.tela.pontuacao, '0 pontos de 49 possíveis');
  assert.equal(vazio.semResposta.length, 17);
  assert.equal(vazio.tela.resultado, 'O paciente encontra-se com baixo risco de disbiose');
});

// ---------------------------------------------------------------------------------------------------------
// §10.7 QFA
// ---------------------------------------------------------------------------------------------------------

test('§10.7 evidência tela_q_qfa.json: consumido, recomendado e bebidas', () => {
  const ev = evidencia('tela_q_qfa.json');
  assert.equal(ev.length, 1);
  for (const { cenario, tela } of ev) {
    const r = calcularQfa(cenario.resp);
    assert.deepEqual(r.tela.consumido, tela.consumido);
    assert.deepEqual(r.tela.recomendado, tela.recomendado);
    assert.deepEqual(r.tela.bebidas, tela.bebidas);
    assert.deepEqual(r.bebidas, { acucaradas: 22, saudaveis: 6 });
  }
});

test('§10.7 campo vazio = 0, vírgula decimal, soma 0 vira 1 só no gráfico de bebidas', () => {
  const resp = repetir(42, null);
  resp[0] = '2,5';
  resp[1] = '1.5';
  resp[36] = 'abc';
  const r = calcularQfa(resp);
  assert.equal(r.tela.consumido[0], 4);
  assert.deepEqual(r.tela.consumido.slice(1), [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(r.bebidas, { acucaradas: 0, saudaveis: 0 });
  assert.deepEqual(r.tela.bebidas, [1, 1]);
  assert.equal(r.semResposta.length, 39, '"abc" foi digitado (vale 0, mas não está em branco)');
  const s = repetir(42, 0);
  s[35] = 7;
  assert.deepEqual(calcularQfa(s).tela.bebidas, [1, 7]);
  s[41] = 3;
  assert.deepEqual(calcularQfa(s).tela.bebidas, [3, 7]);
  assert.deepEqual(calcularQfa([]).tela.recomendado, [21, 14, 7, 42, 42, 7, 7, 7]);
});

// ---------------------------------------------------------------------------------------------------------
// §10.8 Fenótipo
// ---------------------------------------------------------------------------------------------------------

test('§10.8 evidência tela_q_fenotipo.json: "Subescala X Escala: …"', async (t) => {
  const ev = evidencia('tela_q_fenotipo.json');
  assert.equal(ev.length, 4);
  for (const { cenario, tela } of ev) {
    await t.test(cenario.nome, () => {
      const r = calcularFenotipo(cenario.resp);
      assert.equal(r.tela.subescalas.length, 5);
      // A captura guardou só os primeiros 400 caracteres: Desorganizado e Hedônico.
      const linhas = tela['#resultadoRastCategoria'];
      assert.equal(linhas.length, 2);
      linhas.forEach((linha, i) => assert.equal(r.tela.subescalas[i].linha, linha));
    });
  }
});

test('§10.8 fronteiras das 5 subescalas (soma, não média) e cores', () => {
  const tabela = [
    ['Desorganizado', 4, 6, 3, 15], ['Hedônico', 11, 14, 4, 20], ['Compulsivo', 3, 6, 2, 10],
    ['Emocional', 8, 12, 4, 20], ['Hiperfágico', 5, 8, 3, 15],
  ];
  for (const [nome, baixo, medio, min, max] of tabela) {
    assert.equal(classificarSubescala(nome, min), 'BAIXO', `${nome} ${min}`);
    assert.equal(classificarSubescala(nome, baixo), 'BAIXO', `${nome} ${baixo}`);
    assert.equal(classificarSubescala(nome, baixo + 1), 'MÉDIO', `${nome} ${baixo + 1}`);
    assert.equal(classificarSubescala(nome, medio), 'MÉDIO', `${nome} ${medio}`);
    assert.equal(classificarSubescala(nome, medio + 1), 'ALTO', `${nome} ${medio + 1}`);
    assert.equal(classificarSubescala(nome, max), 'ALTO', `${nome} ${max}`);
  }
  assert.throws(() => classificarSubescala('Outra', 3), RangeError);
  // Pelo cálculo completo: tudo 3 → somas 9, 12, 6, 12, 9 (o código não divide).
  const r = calcularFenotipo(repetir(16, 3));
  assert.deepEqual(r.subescalas.map((s) => [s.soma, s.classe]), [[9, 'ALTO'], [12, 'MÉDIO'], [6, 'MÉDIO'], [12, 'MÉDIO'], [9, 'ALTO']]);
  assert.deepEqual(r.subescalas.map((s) => s.cor), ['#006639', '#00985E', '#00985E', '#00985E', '#006639']);
  assert.equal(calcularFenotipo(repetir(16, 1)).subescalas.every((s) => s.cor === '#2eca9a'), true);
  // Compulsivo (itens 13 e 15): 3 BAIXO · 4 MÉDIO · 6 MÉDIO · 7 ALTO.
  const compulsivo = (a, b) => {
    const resp = repetir(16, 1);
    resp[12] = a;
    resp[14] = b;
    return calcularFenotipo(resp).tela.subescalas[2].linha;
  };
  assert.equal(compulsivo(2, 1), 'Subescala Compulsivo Escala: BAIXO');
  assert.equal(compulsivo(2, 2), 'Subescala Compulsivo Escala: MÉDIO');
  assert.equal(compulsivo(3, 3), 'Subescala Compulsivo Escala: MÉDIO');
  assert.equal(compulsivo(4, 3), 'Subescala Compulsivo Escala: ALTO');
});

test('§10.8 item em branco vale 1; textos de conduta por opcoes.textos', () => {
  assert.deepEqual(calcularFenotipo([]).tela, calcularFenotipo(repetir(16, 1)).tela);
  const r = calcularFenotipo([null, 5, null, 5, null, null, 5, null, null, 5]);
  assert.equal(r.subescalas[3].soma, 20);
  assert.equal(r.tela.subescalas[3].escala, 'Escala: ALTO');
  assert.equal(r.tela.subescalas[3].titulo, 'Subescala Emocional');
  assert.equal(r.tela.subescalas[3].texto, null);
  const t = calcularFenotipo(r.notas, { textos: { Emocional: { ALTO: 'meu texto' } } });
  assert.equal(t.tela.subescalas[3].texto, 'meu texto');
  assert.equal(t.tela.subescalas[0].texto, null);
});

// ---------------------------------------------------------------------------------------------------------
// §10.9 Doshas
// ---------------------------------------------------------------------------------------------------------

test('§10.9 evidência tela_q_doshas.json: "Predomínio de respostas X corresponde ao Dosha Y"', async (t) => {
  const ev = evidencia('tela_q_doshas.json');
  assert.equal(ev.length, 3);
  for (const { cenario, tela } of ev) {
    await t.test(cenario.nome, () => {
      const r = calcularDoshas(cenario.resp);
      assert.equal(r.tela.resultado, tela['#condutaNutricionalTexto']);
      assert.equal(r.aviso, null);
      // A mensagem de incompleto que ficou em #cronotipo na evidência não é reproduzida (DIVERGENCIAS).
      assert.equal(tela['#cronotipo'], MENSAGEM_INCOMPLETO);
      assert.equal(r.tela.mensagem, null);
    });
  }
  assert.ok(DIVERGENCIAS.some((d) => d.questionario === 'doshas' && /#cronotipo/.test(d.descricao)));
});

test('§12 #23: empate → sem resultado (null + aviso); maioria simples define o dosha', () => {
  const resp = (a, b, c) => [...repetir(a, 0), ...repetir(b, 1), ...repetir(c, 2)];
  for (const [a, b, c] of [[8, 8, 8], [12, 12, 0], [10, 4, 10], [0, 12, 12]]) {
    const r = calcularDoshas(resp(a, b, c));
    assert.equal(r.dosha, null, `${a}/${b}/${c}`);
    assert.equal(r.letra, null);
    assert.equal(r.tela.resultado, null);
    assert.equal(r.tela.mensagem, null);
    assert.match(r.aviso, /§12 #23/);
    assert.deepEqual(r.contagem, { A: a, B: b, C: c });
  }
  assert.equal(calcularDoshas(resp(12, 6, 6)).tela.resultado, 'Predomínio de respostas A corresponde ao Dosha VATA');
  assert.equal(calcularDoshas(resp(7, 9, 8)).tela.resultado, 'Predomínio de respostas B corresponde ao Dosha PITTA');
  assert.equal(calcularDoshas(resp(8, 7, 9)).tela.resultado, 'Predomínio de respostas C corresponde ao Dosha KAPHA');
  assert.ok(DIVERGENCIAS.some((d) => d.item === 23));
});

test('§10.9 incompleto → mensagem do WebDiet (mesma do cronotipo)', () => {
  const resp = repetir(24, '0');
  resp[23] = null;
  const r = calcularDoshas(resp);
  assert.equal(r.dosha, null);
  assert.equal(r.contagem, null);
  assert.equal(r.aviso, MENSAGEM_INCOMPLETO);
  assert.deepEqual(r.tela, { resultado: null, mensagem: MENSAGEM_INCOMPLETO });
  assert.deepEqual(r.semResposta, [24]);
  assert.equal(calcularDoshas([]).aviso, MENSAGEM_INCOMPLETO);
});

// ---------------------------------------------------------------------------------------------------------
// §10.10 Sinais e sintomas
// ---------------------------------------------------------------------------------------------------------

// Base SINTÉTICA, só para testar o motor: a base real (289 sinais → nutrientes) é conteúdo autoral do
// WebDiet e não foi copiada (§1.2, §10.10). IDs e listas foram montados para reproduzir as contagens
// que a evidência mostra para os sinais marcados 0 / 0,1,2 / 2,5,9,14,20,33. Os IDs seguem a ordem em
// que os nutrientes aparecem na tela (ordem crescente de ID).
const NUTRIENTES = {
  1: 'Ácido Fólico', 2: 'Biotina', 3: 'Chumbo', 4: 'Cobre', 5: 'Cromo', 6: 'Ferro', 7: 'Fósforo', 8: 'Magnésio',
  9: 'Niacina', 10: 'Proteína', 11: 'Selênio', 12: 'Vanádio', 13: 'Vitamina A', 14: 'Vitamina B1',
  15: 'Vitamina B12', 16: 'Vitamina C', 17: 'Vitamina D', 18: 'Zinco',
};
const BASE_SINTETICA = {
  0: { deficiencia: [13], excesso: [6] },
  1: { deficiencia: [6, 18], excesso: [] },
  2: { deficiencia: [13, 16, 18], excesso: [] },
  5: { deficiencia: [1, 2, 18], excesso: [3] },
  9: { deficiencia: [4, 5, 7], excesso: [6] },
  14: { deficiencia: [8, 9, 10], excesso: [11] },
  20: { deficiencia: [14, 15], excesso: [12] },
  33: { deficiencia: [17, 18], excesso: [] },
};

// Formato da evidência: "Nome@marcação", com a classe "microNut amareloRastreamento" para 1 sinal e
// "background: #cor" para 2 ou mais (§10.10).
const marcacao = ({ nome, cor }) => `${nome}@${cor === 'amarelo' ? 'microNut amareloRastreamento' : `background: ${cor}`}`;

test('§10.10 evidência tela_q_sinais.json: contagem, cor e ordem dos nutrientes', async (t) => {
  const ev = evidencia('tela_q_sinais.json');
  assert.equal(ev.length, 3);
  for (const { cenario, tela } of ev) {
    await t.test(cenario.nome, () => {
      const indices = cenario.nome.replace('marcados ', '').split(',').map(Number);
      const r = calcularSinais(indices.map((i) => BASE_SINTETICA[i]), { nutrientes: NUTRIENTES });
      assert.deepEqual(r.tela.deficiencia.map(marcacao), tela.def);
      assert.deepEqual(r.tela.excesso.map(marcacao), tela.exc);
      // defTxt/excTxt: a captura cortou textos longos (cenário 3), então compara o que existe.
      assert.equal(r.tela.deficienciaTexto.slice(0, tela.defTxt.length), tela.defTxt);
      assert.equal(r.tela.excessoTexto, tela.excTxt);
    });
  }
});

test('§10.10 cores por contagem (1 amarelo · 2 #ffa425 · 3 #fa5423 · ≥ 4 #e61c24) e listas vazias', () => {
  assert.deepEqual([1, 2, 3, 4, 7].map(corSinais), ['amarelo', '#ffa425', '#fa5423', '#e61c24', '#e61c24']);
  assert.throws(() => corSinais(0), RangeError);
  const quatro = calcularSinais(repetir(4, { deficiencia: [18], excesso: [18] }), { nutrientes: NUTRIENTES });
  assert.deepEqual(quatro.deficiencia, [{ id: '18', nome: 'Zinco', contagem: 4, cor: '#e61c24' }]);
  assert.equal(quatro.excesso[0].contagem, 4, 'contagem separada para excesso');
  const vazio = calcularSinais([], { nutrientes: NUTRIENTES });
  assert.equal(vazio.tela.deficienciaTexto, NENHUMA_DEFICIENCIA);
  assert.equal(vazio.tela.excessoTexto, NENHUM_EXCESSO);
  assert.equal(NENHUMA_DEFICIENCIA, 'Nenhuma deficiência associada aos sinais');
  assert.equal(NENHUM_EXCESSO, 'Nenhum excesso associado aos sinais');
  const soDef = calcularSinais([{ deficiencia: [6] }], { nutrientes: NUTRIENTES });
  assert.equal(soDef.tela.deficienciaTexto, 'Ferro ');
  assert.equal(soDef.tela.excessoTexto, NENHUM_EXCESSO);
});

test('§10.10 ordem por ID numérico crescente, ID repetido conta de novo, Map aceito, erros', () => {
  const nomes = new Map([[2, 'B'], [10, 'J'], [33, 'X'], ['k', 'K']]);
  const r = calcularSinais([{ deficiencia: [33, 'k', 10] }, { deficiencia: [2, 10, 10] }], { nutrientes: nomes });
  assert.deepEqual(r.deficiencia.map((x) => [x.nome, x.contagem]), [['B', 1], ['J', 3], ['X', 1], ['K', 1]]);
  assert.throws(() => calcularSinais([{ deficiencia: [99] }], { nutrientes: NUTRIENTES }), RangeError);
  assert.throws(() => calcularSinais([{ deficiencia: [1] }]), TypeError);
  assert.throws(() => calcularSinais([{ deficiencia: '1,2' }], { nutrientes: NUTRIENTES }), TypeError);
  assert.equal(calcularSinais([{ deficiencia: [1, null, ''] }], { nutrientes: NUTRIENTES }).deficiencia.length, 1);
  assert.equal(calcularQuestionario('sinais', [BASE_SINTETICA[0]], { nutrientes: NUTRIENTES }).tela.deficienciaTexto, 'Vitamina A ');
});

// ---------------------------------------------------------------------------------------------------------
// Divergências
// ---------------------------------------------------------------------------------------------------------

test('DIVERGENCIAS: §12 #21–23 e casos sem resultado documentados', () => {
  assert.deepEqual(DIVERGENCIAS.filter((d) => d.item !== null).map((d) => d.item), [21, 22, 23]);
  for (const d of DIVERGENCIAS) {
    assert.equal(typeof d.questionario, 'string');
    assert.ok(d.descricao.length > 20 && d.comportamento.length > 20);
  }
  assert.ok(DIVERGENCIAS.some((d) => d.questionario === 'cronotipo' && /fora das faixas|fora de todas as faixas/i.test(d.descricao)));
  assert.ok(DIVERGENCIAS.some((d) => d.descricao.includes(MENSAGEM_INCOMPLETO)));
  assert.ok(Object.isFrozen(DIVERGENCIAS));
});
