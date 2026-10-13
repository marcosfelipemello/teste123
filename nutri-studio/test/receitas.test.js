// Receitas calculadas (relatório §8.6). Compara com o editor do WebDiet
// (docs/webdiet-evidencias/tela_receita.json) e testa §12 #28.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  calcularReceita,
  calcularIngrediente,
  gerarMedida,
  salvarReceita,
  infoReceita,
  formatarKcalIngrediente,
  NOME_PORCAO_AUTOMATICA,
  NOME_PORCAO_GERADA,
  TEXTO_INFO_PORCAO,
  AVISO_GERAR_MEDIDA,
  DIVERGENCIAS,
} from '../src/calc/receitas.js';

const ev = JSON.parse(fs.readFileSync(new URL('../../docs/webdiet-evidencias/tela_receita.json', import.meta.url), 'utf8'));

// Os ingredientes da evidência são escolhidos por nome (expressão regular) e digitados em gramas.
const ingredientes = ev.ING.map(([padrao, gramas]) => {
  const alimento = Object.values(ev.alimentos).find((a) => new RegExp(padrao).test(a.nome));
  assert.ok(alimento, padrao);
  return { alimento, quantidade: gramas, medida: 'grama(s)' };
});
// Relatório §8.6: rendimento 4 e peso final digitado 420 g.
const RENDIMENTO = 4;
const PESO_FINAL = 420;

test('evidência r1: totais, porção automática e linhas', async (t) => {
  const r = calcularReceita({ ingredientes, rendimento: RENDIMENTO });
  await t.test('campos do formulário', () => {
    for (const campo of ['peso', 'kcal', 'ptn', 'lip', 'cho', 'mc1', 'mcQnt1']) assert.equal(r.tela[campo], ev.r1[campo], campo);
    assert.equal(r.porcao.nome, NOME_PORCAO_AUTOMATICA);
    assert.equal(r.porcao.peso, 120);
  });
  await t.test('linhas: peso e PTN', () => {
    assert.equal(r.linhas.length, ev.r1.linhas.length);
    ev.r1.linhas.forEach((l, i) => {
      assert.equal(r.linhas[i].tela.peso, l.peso, `linha ${i + 1} peso`);
      assert.equal(r.linhas[i].tela.ptn, l.ptn, `linha ${i + 1} ptn`);
    });
  });
  await t.test('linhas: kcal como o WebDiet mostrou (3 redesenhadas + 1 recalculada)', () => {
    ev.r1.linhas.forEach((l, i) => {
      const modo = i < 3 ? 'redesenhada' : 'recalculada';
      assert.equal(formatarKcalIngrediente(r.linhas[i].kcal, modo), l.kcal, `linha ${i + 1}`);
    });
  });
  await t.test('§12 #28 corrigido: kcal da linha sempre com 1 casa + " Kcal"', () => {
    assert.deepEqual(r.linhas.map((l) => l.tela.kcal), ['256.0 Kcal', '114.0 Kcal', '88.4 Kcal', '117.6 Kcal']);
    assert.equal(r.linhas[3].tela.kcal, ev.r1.linhas[3].kcal);
    assert.deepEqual(DIVERGENCIAS.map((d) => d.item), [28]);
  });
});

test('evidência r2: "gerar medida" com o peso final digitado', () => {
  const g = gerarMedida({ pesoFinal: PESO_FINAL, rendimento: RENDIMENTO });
  assert.deepEqual(g.tela, { mc1: ev.r2.mc1, mcQnt1: ev.r2.mcQnt1 });
  assert.equal(g.nome, NOME_PORCAO_GERADA);
  assert.equal(g.peso, 105);
  assert.equal(gerarMedida({ pesoFinal: 425, rendimento: 4 }).peso, 106.3); // 106.25 → 1 casa
});

test('"gerar medida" sem rendimento ou peso: aviso', () => {
  assert.equal(gerarMedida({ pesoFinal: '', rendimento: 4 }).aviso, AVISO_GERAR_MEDIDA);
  assert.equal(gerarMedida({ pesoFinal: 420, rendimento: 0 }).tela, null);
});

test('totais somam os valores da base sem arredondar, não as linhas exibidas', () => {
  const al = { nome: 'X', unidade: 'g', kcal: 0, ptn: 1.5, lip: 0, cho: 0, fibras: 0 };
  const r = calcularReceita({ ingredientes: [{ alimento: al, peso: 10 }, { alimento: al, peso: 10 }] });
  assert.deepEqual(r.linhas.map((l) => l.tela.ptn), ['0.1g', '0.1g']); // 0.15 → "0.1"
  assert.equal(r.tela.ptn, '0.3');
});

test('peso do ingrediente = quantidade × medida, sem arredondar; medida personalizada', () => {
  const al = { nome: 'Farinha', unidade: 'g', mc: [{ nome_mc: 'Xícara(s)', peso: '120' }], kcal: 360, ptn: 10, lip: 1, cho: 75, fibras: 2 };
  const l = calcularIngrediente({ alimento: al, quantidade: 0.35, medida: 'Xícara(s)' });
  assert.equal(l.peso, 0.35 * 120);
  assert.equal(calcularIngrediente({ alimento: al, quantidade: 2, medida: { nome_mc: 'Punhado', peso: 15.5 } }).peso, 31);
  const r = calcularReceita({ ingredientes: [{ alimento: al, quantidade: 1.25, medida: 'Xícara(s)' }] });
  assert.equal(r.tela.peso, '150');
  assert.equal(r.tela.mc1, ''); // sem rendimento, sem porção automática
  assert.equal(r.porcao, null);
});

test('salvar: valores por 100 g a partir dos campos arredondados e do peso final', () => {
  const r = calcularReceita({ ingredientes, rendimento: RENDIMENTO });
  const micros = new Array(27).fill(0);
  micros[6] = 84.7; // Ca, soma sem arredondar
  const g = gerarMedida({ pesoFinal: PESO_FINAL, rendimento: RENDIMENTO });
  const s = salvarReceita({
    ...r.tela, ...g.tela, peso: PESO_FINAL, nome: 'Arroz com feijão', descricao: 'Misturar.', rendimento: RENDIMENTO,
    fibras: r.totais.fibras, micros,
  });
  assert.equal(s.valido, true);
  const reg = s.registro;
  assert.equal(reg.kcal, 137.1); // 576 / 420 × 100 = 137.14
  assert.equal(reg.ptn, 3.3); // 13.8 / 420 × 100
  assert.equal(reg.lip, 2.7); // 11.3 / 420 × 100
  assert.equal(reg.cho, 25.7); // 107.8 / 420 × 100
  assert.equal(reg.micros[6], 20.2); // 84.7 / 420 × 100 = 20.17
  assert.equal(reg.fibras, 4.4); // (3.2 + 12.75 + 0 + 2.4) / 420 × 100 = 4.37
  assert.deepEqual(reg.mc, [{ nome_mc: 'Porção(ões)', peso: 105 }]);
  assert.equal(reg.origem, 'Receita');
});

test('salvar exige nome, rendimento, peso, macros, descrição e medida', () => {
  const s = salvarReceita({ nome: ' ', rendimento: 0, peso: '', kcal: '', ptn: 1, lip: 1, cho: 1, descricao: '', mc1: '', mcQnt1: '' });
  assert.equal(s.valido, false);
  assert.deepEqual(s.faltando, ['nome', 'rendimento', 'peso', 'macros', 'descricao', 'medida']);
  assert.equal(s.registro, null);
});

test('ficha da receita: valor por 100 g × (peso da porção / 100)', () => {
  const reg = { kcal: 137.1, ptn: 3.3, lip: 2.7, cho: 25.7, mc: [{ nome_mc: 'Porção(ões)', peso: 105 }] };
  const i = infoReceita(reg);
  assert.equal(i.peso, 105);
  assert.deepEqual(i.tela, { kcal: '144', ptn: '3.5', lip: '2.8', cho: '27.0', texto: TEXTO_INFO_PORCAO });
  assert.equal(infoReceita(reg, 50).tela.kcal, '69'); // 68.55
});
