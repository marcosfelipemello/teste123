// Simulação dos questionários na conta do WebDiet (docs/webdiet-evidencias/tela_q_simulacao.json): 40 cenários por
// questionário (mínimo, máximo e 38 sorteados), marcados pelas funções da própria página no paciente de teste.
// Cada texto que o WebDiet mostrou tem de sair igual do cálculo do app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  calcularRastreamento, calcularFindrisc, calcularDisbiose, calcularCafeina, calcularFenotipo, calcularSarcopenia,
  calcularCronotipo, calcularQfa,
} from '../src/calc/questionarios/index.js';

const sim = JSON.parse(
  fs.readFileSync(new URL('../../docs/webdiet-evidencias/tela_q_simulacao.json', import.meta.url), 'utf8'),
).questionarios;

const fatores = (r) => r.tela.fatores.map((f) => `${f.nome}${f.media}`);

/** Para cada questionário: [nome do campo, texto do app, texto do WebDiet]. */
const CAMPOS = {
  rastreamento: (resp, t) => {
    const r = calcularRastreamento(resp);
    return [['pontuação', r.tela.pontuacao, t.pontuacao], ['resultado', r.tela.resultado, t.resultado], ['categorias', r.tela.categorias.join(''), t.categorias]];
  },
  diabetes: (resp, t) => {
    const r = calcularFindrisc(resp);
    return [['pontuação', r.tela.pontuacao, t.pontuacao], ['resultado', r.tela.resultado, t.resultado]];
  },
  disbiose: (resp, t) => {
    const r = calcularDisbiose(resp);
    // Sem classificação (50 de 49, §12 #22): null aqui, vazio na tela.
    return [['pontuação', r.tela.pontuacao, t.pontuacao], ['resultado', r.tela.resultado ?? '', t.resultado]];
  },
  cafeina_resumido: (resp, t) => [['médias', fatores(calcularCafeina(resp, { modo: 'resumido' })), t.medias]],
  cafeina_completo: (resp, t) => [['médias', fatores(calcularCafeina(resp, { modo: 'completo' })), t.medias]],
  fenotipo: (resp, t) => [['subescalas', calcularFenotipo(resp).tela.subescalas.map((s) => s.linha), t.subescalas]],
  sarcopenia: (resp, t) => [['pontuação', calcularSarcopenia(resp).tela.pontuacao, t.pontuacao]],
  cronotipo: (resp, t) => {
    const r = calcularCronotipo(resp);
    return [['pontuação', r.tela.pontuacao, t.pontuacao], ['perfil', r.tela.perfil, t.perfil]];
  },
  qfa: (resp, t) => {
    const r = calcularQfa(resp);
    const [barras, rosca] = t.graficos;
    return [['recomendado', r.tela.recomendado, barras.datasets[0]], ['consumido', r.tela.consumido, barras.datasets[1]], ['bebidas', r.tela.bebidas, rosca.datasets[0]]];
  },
};

test('simulação na conta: os 9 conjuntos de cenários estão na evidência', () => {
  assert.deepEqual(Object.keys(sim).sort(), Object.keys(CAMPOS).sort());
  for (const [nome, lista] of Object.entries(sim)) assert.equal(lista.length, 40, nome);
});

for (const [nome, campos] of Object.entries(CAMPOS)) {
  test(`simulação na conta: ${nome}, 40 cenários iguais ao WebDiet`, () => {
    sim[nome].forEach(({ resp, tela }, k) => {
      for (const [campo, app, webdiet] of campos(resp, tela)) assert.deepEqual(app, webdiet, `cenário ${k}, ${campo}`);
    });
  });
}

test('simulação na conta: cobre todas as faixas de resultado', () => {
  const distintos = (nome, f) => new Set(sim[nome].flatMap(({ tela }) => f(tela))).size;
  assert.equal(distintos('rastreamento', (t) => [t.resultado]), 4);
  assert.equal(distintos('diabetes', (t) => [t.resultado]), 5);
  assert.equal(distintos('cronotipo', (t) => [t.perfil]), 5);
  assert.equal(distintos('fenotipo', (t) => t.subescalas), 15); // 5 subescalas × BAIXO/MÉDIO/ALTO
  for (const modo of ['cafeina_resumido', 'cafeina_completo']) {
    // 7 fatores × (média < 4, média ≥ 4)
    assert.equal(distintos(modo, (t) => t.medias.map((l) => `${l.split('Média')[0]}${parseFloat(l.split('Média: ')[1]) >= 4}`)), 14, modo);
  }
  assert.ok(sim.disbiose.some(({ tela }) => tela.pontuacao === '50 pontos de 49 possíveis' && tela.resultado === ''), '§12 #22');
});
