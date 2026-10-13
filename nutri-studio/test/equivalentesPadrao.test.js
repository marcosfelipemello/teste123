// Médias padrão dos grupos de equivalentes (src/dados/equivalentes_padrao.json), usadas pela aba de
// planejamento nos grupos sem lista do consultório: são as médias que o WebDiet mostra (relatório §8.5) e
// reproduzem os totais da evidência docs/webdiet-evidencias/tela_planejamento_equivalentes.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calcularTotaisEquivalentes, GRUPOS } from '../src/calc/equivalentes.js';

const ler = (url) => JSON.parse(fs.readFileSync(new URL(url, import.meta.url), 'utf8'));
const padrao = ler('../src/dados/equivalentes_padrao.json');
const ev = ler('../../docs/webdiet-evidencias/tela_planejamento_equivalentes.json');

test('médias padrão = médias da tela do WebDiet, nos 15 grupos', () => {
  assert.deepEqual(Object.keys(padrao.macrosGrupo), GRUPOS.map((g) => g.id));
  assert.deepEqual(padrao.macrosGrupo, ev.r1.macrosGrupo);
  assert.deepEqual(padrao.macros_desvp, ev.r1.macros_desvp);
  assert.deepEqual(Object.keys(padrao.n), GRUPOS.map((g) => g.id));
});

test('com as médias padrão, os totais saem iguais aos do WebDiet (r1 e r2)', () => {
  for (const cen of [ev.r1, ev.r2]) {
    const refeicoes = cen.calculado.map((c, i) => ({ porcoes: ev.PORCOES[i] ?? {}, calculada: c }));
    const r = calcularTotaisEquivalentes({ refeicoes, macrosGrupo: padrao.macrosGrupo });
    assert.deepEqual(r.totalMacros, cen.totalMacros);
    for (const [campo, valor] of Object.entries(cen.tela)) assert.equal(r.tela[campo], valor, campo);
  }
});
