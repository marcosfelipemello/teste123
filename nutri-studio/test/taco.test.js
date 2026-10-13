// Base TACO (src/dados/taco.json, gerada por scripts/converter-taco.py a partir da planilha oficial do
// NEPA/UNICAMP). Compara com os alimentos de origem TACO que a tela do WebDiet mostrou
// (docs/webdiet-evidencias/tela_planejamento_alimentos.json) e refaz o almoço do relatório §8.4.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CHAVES_MICROS } from '../src/calc/dris.js';
import { calcularRefeicao } from '../src/calc/planejamento.js';

const ler = (url) => JSON.parse(fs.readFileSync(new URL(url, import.meta.url), 'utf8'));
const taco = ler('../src/dados/taco.json');
const ev = ler('../../docs/webdiet-evidencias/tela_planejamento_alimentos.json');
const porNome = (nome) => taco.alimentos.find((a) => a.nome === nome);

/** Alimento da evidência (id) → nome na TACO. O leite integral da evidência não tem valores na TACO ("*"). */
const PARES = {
  40: 'Arroz, tipo 1, cozido',
  46: 'Azeite, de dendê',
  59: 'Banana, prata, crua',
  202: 'Feijão, carioca, cozido',
  215: 'Frango, coração, grelhado',
  336: 'Ovo, de galinha, inteiro, cozido/10minutos',
  348: 'Pão, trigo, francês',
};

/** Valores em que o dado do WebDiet difere da TACO oficial (erro de dado do WebDiet, não de conversão). */
const DIFERENCAS_CONHECIDAS = {
  40: { gordurasat: [0, 0.2] }, // WebDiet sem os ácidos graxos do arroz
  46: { gorduramono: [4.01, 40.1], gordurapoli: [16.1, 16.6] }, // dendê: mono com a vírgula deslocada
};

test('estrutura: 593 alimentos, 15 grupos, 27 micronutrientes, valores numéricos ≥ 0', () => {
  assert.equal(taco.n, 593);
  assert.equal(taco.alimentos.length, 593);
  assert.equal(new Set(taco.alimentos.map((a) => a.id)).size, 593);
  assert.equal(new Set(taco.alimentos.map((a) => a.nome)).size, 593);
  assert.equal(new Set(taco.alimentos.map((a) => a.grupo)).size, 15);
  for (const a of taco.alimentos) {
    assert.equal(a.origem, 'TACO');
    assert.equal(a.unidade, 'g');
    assert.equal(a.micros.length, 27, a.nome);
    for (const v of [a.kcal, a.ptn, a.lip, a.cho, a.fibras, ...a.micros]) assert.ok(Number.isFinite(v) && v >= 0, a.nome);
    assert.equal(a.micros[CHAVES_MICROS.indexOf('fibras')], a.fibras, a.nome);
  }
  // Itens sem análise na TACO ("*" na energia) ficam de fora, para não entrarem com 0 kcal.
  assert.deepEqual(taco._excluidos.map((x) => x.nome), ['Iogurte, sabor abacaxi', 'Leite, de vaca, desnatado, UHT', 'Leite, de vaca, integral', 'Coco,  verde, cru']);
});

test('evidência: os alimentos TACO do WebDiet têm os mesmos valores (fora 3 erros de dado do WebDiet)', async (t) => {
  for (const [id, nome] of Object.entries(PARES)) {
    await t.test(nome, () => {
      const w = ev.alimentos[id];
      const a = porNome(nome);
      assert.ok(a, nome);
      for (const k of ['kcal', 'ptn', 'lip', 'cho', 'fibras']) assert.equal(a[k], Number(w[k]), k);
      CHAVES_MICROS.forEach((c, i) => {
        const conhecida = DIFERENCAS_CONHECIDAS[id]?.[c];
        if (conhecida) assert.deepEqual([w.micros[i], a.micros[i]], conhecida, c);
        else assert.equal(a.micros[i], Number(w.micros[i]), c);
      });
    });
  }
});

test('§8.4 com os alimentos da TACO (em gramas): almoço igual ao da tela do WebDiet', () => {
  const g = (nome, peso) => ({ alimento: porNome(nome), quantidade: peso, medida: 'grama(s)' });
  const r = calcularRefeicao({
    itens: [g('Arroz, tipo 1, cozido', 120), g('Feijão, carioca, cozido', 150), g('Frango, coração, grelhado', 120), g('Azeite, de dendê', 8)],
  });
  const almoco = ev.refeicoes[1].tot;
  for (const campo of ['peso', 'ptn', 'lip', 'cho', 'kcal', 'dens', 'classe', 'gptn', 'glip', 'gcho']) assert.equal(r.tela[campo], almoco[campo], campo);
});
