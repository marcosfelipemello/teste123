// Totais, metas e adequação do planejamento como o código do WebDiet: graficoMacros() e mostrarReferencias(),
// lidos na conta em 13/10/2026 nas duas páginas de plano (metodoPlanning.php e metodoWebdiet.php), e o que os
// planos do paciente de teste mostraram ao abrir (docs/webdiet-evidencias/tela_planejamento_metas_conta.json).
// Os textos esperados dos casos de borda saíram da transcrição literal dessas duas funções.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analisarTotal, calcularMetas, calcularPlanejamento, CORES } from '../src/calc/planejamento.js';
import { calcularTotaisEquivalentes } from '../src/calc/equivalentes.js';

const ler = (url) => JSON.parse(fs.readFileSync(new URL(url, import.meta.url), 'utf8'));
const conta = ler('../../docs/webdiet-evidencias/tela_planejamento_metas_conta.json');
const evAlimentos = ler('../../docs/webdiet-evidencias/tela_planejamento_alimentos.json');
const evEquivalentes = ler('../../docs/webdiet-evidencias/tela_planejamento_equivalentes.json');

const so = (tela, campos) => Object.fromEntries(campos.map((c) => [c, tela[c]]));

test('método por alimentos sem peso nas metas: sem g/kg, gramas como número ("58g"), CHO da análise com 1 casa', () => {
  const t = analisarTotal([58, 20, 100, 900, 18, 400], 0).tela;
  assert.deepEqual(t, {
    ptnPrescrita: '58g', lipPrescrita: '20g', choPrescrita: '100g', choDisponivelPrescrita: '82.0g',
    fibrasPrescrita: '18g', kcalPrescrita: '900 Kcal', gNPrescrita: '62.5 Kcal', densidadePrescrita: '2.25 Kcal/g',
    ptnTotalanalise: '232 Kcal - 25.8%', lipTotalanalise: '180 Kcal - 20.0%', choTotalanalise: '488.0 Kcal - 54.2%',
    kcalTotalanalise: '900 Kcal', ptnResumo: '58g', lipResumo: '20g', choResumo: '100g', kcalResumo: '900 Kcal',
  });
});

test('método por alimentos com peso 80: g/kg em PTN, LIP, CHO, CHO disponível e kcal (fibras sem g/kg)', () => {
  const t = analisarTotal([58, 20, 100, 900, 18, 400], 80).tela;
  assert.equal(t.ptnPrescrita, '58g (0.7g/Kg)');
  assert.equal(t.lipPrescrita, '20g (0.3g/Kg)');
  assert.equal(t.choPrescrita, '100g (1.3g/Kg)');
  assert.equal(t.choDisponivelPrescrita, '82.0g (1.0g/Kg)');
  assert.equal(t.fibrasPrescrita, '18g');
  assert.equal(t.kcalPrescrita, '900 Kcal (11.3 Kcal/Kg)');
  assert.equal(t.kcalResumo, '900 Kcal (11.3 Kcal/Kg)');
});

test('plano vazio: o WebDiet mostra CHO 100.0% na análise (§12 #32), e nada de NaN', () => {
  const t = analisarTotal([0, 0, 0, 0, 0, 0], 0).tela;
  assert.equal(t.ptnPrescrita, '0g'); // o mesmo texto inicial do HTML
  assert.equal(t.gNPrescrita, '0 Kcal');
  assert.equal(t.densidadePrescrita, '0.00 Kcal/g');
  assert.equal(t.ptnTotalanalise, '0 Kcal - 0.0%');
  assert.equal(t.choTotalanalise, '0.0 Kcal - 100.0%');
  assert.doesNotMatch(JSON.stringify(t), /NaN|Infinity/);
});

test('kcal não proteica/g N: LIP×9 e CHO×4 arredondados (1 casa) antes de dividir; texto em forma de número', () => {
  // equivalentes (totais sem arredondar): LIP 0,05 g → 0,45 kcal → 0.5; 0.5 / (1/6,25) = 3,125 → 3.1 (sem arredondar daria 2.8)
  const r = calcularTotaisEquivalentes({ refeicoes: [{ porcoes: { g4: 1 } }], macrosGrupo: { g4: [1, 0.05, 0, 0.85, 0] } });
  assert.equal(r.tela.gNPrescrita, '3.1 Kcal');
  // valor inteiro: "57 Kcal", não "57.0 Kcal" (prescrita e planejada)
  const total = analisarTotal([100, 0, 228, 912, 0, 300], 100);
  assert.equal(total.tela.gNPrescrita, '57 Kcal');
  const metas = calcularMetas({ tipo: 'gkg', peso: 100, ptn: 1, lip: 0.03, cho: 0 }); // (100×9 + 3×4)/16 = 57
  assert.equal(metas.tela.gNPlanejada, '57 Kcal');
});

test('metas sem peso: sem g/kg; plano sem metas salvas = g/kg com tudo 0', () => {
  const pct = calcularMetas({ tipo: 'percentual', get: 2000, ptn: 20, lip: 30, cho: 50, peso: 0 }).tela;
  assert.deepEqual(pct, { ptnPlanejada: '100.0g', lipPlanejada: '66.7g', choPlanejada: '250.0g', kcalPlanejada: '2000 Kcal', gNPlanejada: '72.9 Kcal' });
  for (const vazio of [{}, { tipo: null }, { tipo: 'bolso' }]) {
    const m = calcularMetas(vazio);
    assert.equal(m.tipo, 'gkg');
    assert.deepEqual(m.tela, { ptnPlanejada: '0.0g', lipPlanejada: '0.0g', choPlanejada: '0.0g', kcalPlanejada: '0 Kcal', gNPlanejada: '0 Kcal' });
  }
});

test('equivalentes com metas: g/kg também em fibras, adequação sobre os totais sem arredondar, neutro cinza', () => {
  // 2 porções de g4 + 1 de g9; metas 2000 kcal, 20/30/50 %, peso 70
  const r = calcularTotaisEquivalentes({
    refeicoes: [{ porcoes: { g4: 2, g9: 1 } }],
    macrosGrupo: { g4: [15, 5, 0, 105, 0], g9: [1, 0.3, 14.7, 61.2, 2.1] },
    metas: { tipo: 'percentual', get: 2000, ptn: 20, lip: 30, cho: 50, peso: 70 },
  });
  assert.deepEqual(r.totalMacros, [31, 10.3, 14.7, 271.2, 2.1]);
  assert.deepEqual(so(r.tela, Object.keys(r.tela).filter((k) => k !== 'cores')), {
    ptnPrescrita: '31g (0.4g/Kg)', lipPrescrita: '10.3g (0.1g/Kg)', choPrescrita: '14.7g (0.2g/Kg)',
    choDisponivelPrescrita: '12.6g (0.2g/Kg)', fibrasPrescrita: '2.1g (0.0g/Kg)', kcalPrescrita: '271 Kcal (3.9 Kcal/Kg)',
    gNPrescrita: '30.5 Kcal', ptnTotalanalise: '124 Kcal - 45.7%', lipTotalanalise: '92.7 Kcal - 34.2%',
    choTotalanalise: '54.5 Kcal - 20.1%', kcalTotalanalise: '271 Kcal', ptnResumo: '31g (0.4g/Kg)',
    lipResumo: '10.3g (0.1g/Kg)', choResumo: '14.7g (0.2g/Kg)', kcalResumo: '271 Kcal (3.9 Kcal/Kg)',
    ptnPlanejada: '100.0g (1.4g/Kg)', lipPlanejada: '66.7g (1.0g/Kg)', choPlanejada: '250.0g (3.6g/Kg)',
    kcalPlanejada: '2000 Kcal (28.6 Kcal/Kg)', gNPlanejada: '72.9 Kcal', ptnAdequacao: '-69.0g', lipAdequacao: '-56.4g',
    choAdequacao: '-235.3g', kcalAdequacao: '-1729 Kcal', gNAdequacao: '-42 Kcal',
  });
  assert.deepEqual(['ptn', 'lip', 'cho', 'kcal', 'gN'].map((c) => r.adequacao[c].percentual), [31, 15, 6, 14, 42]);
  assert.ok(Object.values(r.tela.cores).every((c) => c === CORES.neutroEquivalentes));
  assert.equal(CORES.neutroEquivalentes, 'rgb(142, 142, 146)'); // #8E8E92
});

test('equivalentes: a cor da adequação sai do total sem arredondar (2109,5 kcal / 2000 = 105% → verde)', () => {
  const r = calcularTotaisEquivalentes({
    refeicoes: [{ porcoes: { g5: 1 } }],
    macrosGrupo: { g5: [0, 0, 0, 2109.5, 0] },
    metas: { tipo: 'percentual', get: 2000, ptn: 0, lip: 0, cho: 100, peso: 0 },
  });
  assert.equal(r.tela.kcalPrescrita, '2110 Kcal');
  assert.equal(r.tela.kcalAdequacao, '110 Kcal');
  assert.equal(r.adequacao.kcal.percentual, 105); // 2110/2000 daria 106 (vermelho)
  assert.equal(r.tela.cores.kcalAdequacao, CORES.verde);
});

test('conta: plano por equivalentes do paciente de teste, sem metas salvas, igual ao que o WebDiet mostra', () => {
  const r1 = evEquivalentes.r1;
  const refeicoes = r1.calculado.map((c, i) => ({ porcoes: evEquivalentes.PORCOES[i] ?? {}, calculada: c }));
  const r = calcularTotaisEquivalentes({ refeicoes, macrosGrupo: r1.macrosGrupo, metas: {} });
  assert.deepEqual(r.totalMacros, conta.equivalentes.totalMacros);
  for (const [campo, valor] of Object.entries(conta.equivalentes.tela)) {
    if (campo === 'fibrasPlanejada' || campo === 'fibrasAdequacao') continue; // "-" fixo no HTML
    assert.equal(r.tela[campo], valor, campo);
  }
  const { fibrasAdequacao, ...cores } = conta.equivalentes.cores; // eslint-disable-line no-unused-vars
  assert.deepEqual(r.tela.cores, cores);
});

test('conta: plano por alimentos ao abrir — adequação do gN com o texto anterior "0 Kcal" (§12 #30)', async (t) => {
  const [, gkg] = evAlimentos.refs;
  const refeicoes = evAlimentos.refeicoes.map((r, i) => ({
    ativo: gkg.tela.ativos[i],
    itens: r.linhas.map((l) => ({ alimento: evAlimentos.alimentos[l.id], quantidade: l.qtd, medida: l.medida })),
  }));
  const [ptn, lip, cho, get, peso, tipo] = conta.alimentos.referencias; // tipo null → g/kg
  const metas = { tipo, ptn, lip, cho, get, peso };
  await t.test('ao abrir (gNAnterior 0): "-72 Kcal", cor neutra; o resto igual ao da conta', () => {
    const r = calcularPlanejamento({ refeicoes, metas }, { gNAnterior: 0 });
    assert.deepEqual(r.totalMacros, conta.alimentos.totalMacros);
    for (const [campo, valor] of Object.entries(conta.alimentos.tela)) assert.equal(r.tela[campo], valor, campo);
    assert.deepEqual(r.tela.cores, conta.alimentos.cores);
  });
  await t.test('depois de recalcular (gNAnterior = o atual): "26 Kcal", vermelho, como na evidência', () => {
    const r = calcularPlanejamento({ refeicoes, metas }, { gNAnterior: 98.3 });
    assert.equal(r.tela.gNAdequacao, gkg.tela.gNAdequacao);
    assert.equal(r.tela.cores.gNAdequacao, gkg.tela.cores.gNAdequacao);
  });
  await t.test('{ corrigir: true } ignora o valor anterior', () => {
    const r = calcularPlanejamento({ refeicoes, metas }, { gNAnterior: 0, corrigir: true });
    assert.equal(r.tela.gNAdequacao, '1 Kcal'); // 98.3 − 97.7 (kcal não proteica/g N planejada corrigida)
  });
});
