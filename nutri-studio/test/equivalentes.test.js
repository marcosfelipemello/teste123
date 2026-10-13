// Método por equivalentes (relatório §8.5). Compara com o que o WebDiet mostrou
// (docs/webdiet-evidencias/tela_planejamento_equivalentes.json): totais SEM arredondar (bit a bit, o que só
// a ordem g1→g15 reproduz) e todos os campos da tela.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  calcularTotaisEquivalentes,
  calcularGrupos,
  estatisticasGrupo,
  mediaDesvio,
  calcularAvulso,
  normalizarGrupo,
  refeicaoCalculada,
  porcoesDoGrupo,
  GRUPOS,
  DIVERGENCIAS,
} from '../src/calc/equivalentes.js';
import { referenciasMicros } from '../src/calc/dris.js';

const ev = JSON.parse(
  fs.readFileSync(new URL('../../docs/webdiet-evidencias/tela_planejamento_equivalentes.json', import.meta.url), 'utf8'),
);

/**
 * Refeições da evidência: PORCOES traz 3 refeições com porções e `calculado` traz 4 (a 4ª não tem porções).
 */
function refeicoesDaEvidencia(calculado) {
  return calculado.map((c, i) => ({ porcoes: ev.PORCOES[i] ?? {}, calculada: c }));
}

test('evidência: totais sem arredondar e tela, nos 2 cenários', async (t) => {
  for (const chave of ['r1', 'r2']) {
    const cen = ev[chave];
    await t.test(`${chave} (calculado: ${cen.calculado.join(', ')})`, () => {
      const r = calcularTotaisEquivalentes({ refeicoes: refeicoesDaEvidencia(cen.calculado), macrosGrupo: cen.macrosGrupo });
      assert.deepEqual(r.totalMacros, cen.totalMacros); // floats exatos, ex.: 41.599999999999994
      for (const [campo, valor] of Object.entries(cen.tela)) assert.equal(r.tela[campo], valor, campo);
      assert.deepEqual(r.tela, cen.tela);
      assert.equal(r.micros, null);
    });
  }
});

test('a ordem da soma importa: por refeição e depois por grupo dá outra última casa', () => {
  const cen = ev.r1;
  const porRefeicao = [0, 0, 0, 0, 0];
  ev.PORCOES.forEach((m) => {
    for (let g = 1; g <= 15; g++) cen.macrosGrupo[`g${g}`].forEach((v, j) => (porRefeicao[j] += (m[g] || 0) * v));
  });
  assert.notDeepEqual(porRefeicao, cen.totalMacros);
  const r = calcularTotaisEquivalentes({ refeicoes: refeicoesDaEvidencia(cen.calculado), macrosGrupo: cen.macrosGrupo });
  assert.equal(r.totalMacros[2], 101.65000000000002);
  assert.equal(porRefeicao[2], 101.65);
});

test('porções por grupo somam só as refeições calculadas', () => {
  const r1 = calcularTotaisEquivalentes({ refeicoes: refeicoesDaEvidencia(ev.r1.calculado), macrosGrupo: ev.r1.macrosGrupo });
  assert.equal(r1.porcoesGrupo.g5, 7); // 2 + 3 + 2
  assert.equal(r1.porcoesGrupo.g4, 2.5); // 1,5 + 1
  const r2 = calcularTotaisEquivalentes({ refeicoes: refeicoesDaEvidencia(ev.r2.calculado), macrosGrupo: ev.r2.macrosGrupo });
  assert.equal(r2.porcoesGrupo.g5, 5); // a 3ª refeição não é calculada
  assert.equal(r2.porcoesGrupo.g12, 0);
});

test('desvio-padrão populacional em torno da média sem arredondar (fibras do g4 da evidência, bit a bit)', () => {
  // Reconstrução: média 0 e dp 0.013733… com n = 52 (relatório §8.5) só é possível com um único alimento com
  // 0,1 g de fibras e os outros 51 com 0 (valores de 1 casa). A lista real não foi copiada.
  const fibras = new Array(52).fill(0);
  fibras[0] = 0.1;
  const r = mediaDesvio(fibras);
  assert.equal(r.media, ev.r1.macrosGrupo.g4[4]);
  assert.equal(r.dp, ev.r1.macros_desvp.g4[4]);
  // em torno da média ARREDONDADA (0) daria outro valor
  assert.notEqual(Math.sqrt(0.01 / 52), ev.r1.macros_desvp.g4[4]);
});

test('média: cada valor com 1 casa antes, média com 1 casa', () => {
  const r = mediaDesvio([1.04, 1.26, 2.0]); // → 1.0, 1.3, 2.0
  const m = (1.0 + 1.3 + 2.0) / 3;
  assert.equal(r.media, 1.4);
  assert.equal(r.dp, Math.sqrt(((1.0 - m) ** 2 + (1.3 - m) ** 2 + (2.0 - m) ** 2) / 3));
  assert.deepEqual(mediaDesvio([]), { media: 0, dp: 0 });
});

test('grupos: só alimentos selecionados, grupo normalizado, desvio na tela', () => {
  const alimentos = [
    { grupo: 'g7', ptn: 0, lip: 10, cho: 0, kcal: 90, fibras: 0 },
    { grupo: 7, ptn: 0, lip: 8, cho: 0, kcal: 72, fibras: 0 },
    { grupo: 'g7', ptn: 9, lip: 9, cho: 9, kcal: 999, fibras: 9, selecionado: false },
    { grupo: 'G15', ptn: 0.12, lip: 0, cho: 10, kcal: 40, fibras: 0, micros: new Array(27).fill(1) },
  ];
  const g = calcularGrupos(alimentos);
  assert.equal(g.n.g7, 2);
  assert.deepEqual(g.macrosGrupo.g7, [0, 9, 0, 81, 0]);
  assert.deepEqual(g.macros_desvp.g7, [0, 1, 0, 9, 0]);
  assert.deepEqual(g.tela.g7, ['± 0.0', '± 1.0', '± 0.0', '± 9', '± 0.0']);
  assert.deepEqual(g.macrosGrupo.g15, [0.1, 0, 10, 40, 0]);
  assert.equal(g.microsGrupo.g15.length, 27);
  assert.equal(g.microsGrupo.g7, null);
  assert.deepEqual(g.macrosGrupo.g1, [0, 0, 0, 0, 0]);
  assert.equal(Object.keys(g.macrosGrupo).length, 15);
  assert.equal(estatisticasGrupo([]).n, 0);
});

test('avulsos: por 100 g, cada valor com 1 casa, somados depois dos grupos e só nas refeições calculadas', () => {
  const arroz = { nome: 'Arroz', unidade: 'g', mc: [{ nome_mc: 'Colher(es) de arroz rasa(s)', peso: '30' }], kcal: 128, ptn: 2.5, lip: 0.2, cho: 28.1, fibras: 1.6 };
  const a = calcularAvulso({ alimento: arroz, quantidade: 1.5, medida: 'Colher(es) de arroz rasa(s)' });
  assert.equal(a.peso, 45);
  assert.deepEqual([a.ptn, a.lip, a.cho, a.kcal, a.fibras], [1.1, 0.1, 12.6, 57.6, 0.7]); // 1.125, 0.09, 12.645, 57.6, 0.72
  assert.equal(calcularAvulso({ alimento: arroz, peso: 100 }).kcal, 128);

  const macrosGrupo = { g5: [0.7, 0.3, 6.9, 32.2, 0.6] };
  const r = calcularTotaisEquivalentes({
    refeicoes: [
      { porcoes: { g5: 2 }, avulsos: [{ alimento: arroz, peso: 100 }] },
      { porcoes: { 5: 1 }, calculada: 'nao', avulsos: [{ alimento: arroz, peso: 100 }] },
    ],
    macrosGrupo,
  });
  assert.deepEqual(r.totalMacros, [2 * 0.7 + 2.5, 2 * 0.3 + 0.2, 2 * 6.9 + 28.1, 2 * 32.2 + 128, 2 * 0.6 + 1.6]);
});

test('micronutrientes somados quando os grupos têm médias de micros (tabela com referências)', () => {
  const g = calcularGrupos([{ grupo: 'g13', ptn: 6.8, lip: 5.3, cho: 5.4, kcal: 96.9, fibras: 0, micros: [0, 0, 0, 0, 0, 0, 240] }]);
  const refs = referenciasMicros({ sexo: 'M', idadeAnos: 35 });
  const r = calcularTotaisEquivalentes({ refeicoes: [{ porcoes: { g13: 2 } }], macrosGrupo: g.macrosGrupo, microsGrupo: g.microsGrupo, referencias: refs });
  assert.equal(r.micros[6], 480);
  assert.deepEqual(r.tela.micros[6], ['480.0', '48.0%', '1000 mg']);
});

test('auxiliares', () => {
  assert.equal(normalizarGrupo('g4'), 'g4');
  assert.equal(normalizarGrupo(4), 'g4');
  assert.equal(normalizarGrupo('16'), null);
  assert.equal(normalizarGrupo('x'), null);
  assert.equal(refeicaoCalculada({ calculada: 'sim' }), true);
  assert.equal(refeicaoCalculada({ calculada: 'nao' }), false);
  assert.equal(refeicaoCalculada({}), true);
  assert.equal(porcoesDoGrupo({ 5: '2,5' }, 'g5'), 2.5);
  assert.equal(GRUPOS.length, 15);
  assert.deepEqual(DIVERGENCIAS, []);
});
