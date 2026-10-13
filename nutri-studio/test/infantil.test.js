// Antropometria infantil (relatório §6). Compara, campo a campo, com o que o WebDiet mostrou na tela
// (docs/webdiet-evidencias/tela_antropometria_infantil.json) e testa a política de divergências (§12 #15–17).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  avaliarInfantil,
  zEscoreLMS,
  lms,
  classificarPesoIdade,
  classificarEstaturaIdade,
  classificarImcIdade,
  classificarGorduraInfantil,
  slaughter,
  DIVERGENCIAS,
  EXCECAO_IDADE,
} from '../src/calc/infantil.js';

const evidencia = JSON.parse(
  fs.readFileSync(new URL('../../docs/webdiet-evidencias/tela_antropometria_infantil.json', import.meta.url), 'utf8'),
);

test('evidência: 35 casos, todos os campos iguais à tela do WebDiet', async (t) => {
  assert.equal(evidencia.length, 35);
  for (const { caso, tela } of evidencia) {
    await t.test(`${caso.id} (${caso.sexo}, ${caso.meses} meses)`, () => {
      const r = avaliarInfantil(caso);
      assert.deepEqual(Object.keys(r.tela).sort(), Object.keys(tela).sort(), 'mesmos campos da tela');
      for (const campo of Object.keys(tela)) {
        assert.equal(r.tela[campo], tela[campo], `${caso.id}.${campo}`);
      }
      // Os números devolvidos batem com o texto da tela.
      const num = (s) => (s === '-' ? null : parseFloat(s));
      if (r.zPeso !== 0) assert.equal(r.zPeso, num(tela.peso), `${caso.id} zPeso`);
      assert.equal(r.zAltura, num(tela.altura), `${caso.id} zAltura`);
      assert.equal(r.zImc, num(tela.imcz), `${caso.id} zImc`);
      assert.equal(r.imc, num(tela.imc), `${caso.id} imc`);
      assert.equal(r.gc, num(tela.gc), `${caso.id} gc`);
    });
  }
});

test('§6.1: idade em meses e anos na data da avaliação', () => {
  const r = avaliarInfantil({ sexo: 'M', nascimento: '15/06/1991', dataAvaliacao: '15/12/1999', peso: 26, altura: 128 });
  assert.equal(r.meses, 102);
  assert.equal(r.anos, 8);
  // Mesmo resultado que informar os meses direto (caso I12 da evidência).
  assert.deepEqual(r.tela, avaliarInfantil({ sexo: 'M', meses: 102, peso: 26, altura: 128 }).tela);
});

test('§6.1: acima de 228 meses → "Idade incompatível com protocolos infantis"', () => {
  const ok = avaliarInfantil({ sexo: 'M', meses: 228, peso: 70, altura: 176 });
  assert.equal(ok.tela.excecao, '');
  const r = avaliarInfantil({ sexo: 'M', meses: 229, peso: 70, altura: 176 });
  assert.equal(r.excecao, EXCECAO_IDADE);
  assert.equal(r.tela.excecao, 'Idade incompatível com protocolos infantis');
  assert.equal(r.zImc, null);
  assert.equal(r.tela.imcz, '-');
});

test('§6.2: peso/idade só até 120 meses; acima mostra "-"', () => {
  assert.notEqual(avaliarInfantil({ sexo: 'F', meses: 120, peso: 32, altura: 138.6 }).tela.peso, '-');
  const r = avaliarInfantil({ sexo: 'F', meses: 121, peso: 32, altura: 138.6 });
  assert.equal(r.zPeso, null);
  assert.equal(r.tela.peso, '-');
  assert.equal(lms('peso', 'M', 121), null);
  assert.notEqual(lms('altura', 'M', 228), null);
  assert.equal(lms('imc', 'F', 229), null);
});

test('§6.2/§6.3: z arredondado com toFixed(3); z = 0 aparece como "-"', () => {
  // Peso igual à mediana M (meninos, 3 meses: M = 6.3762) → z = 0 → "-".
  const r = avaliarInfantil({ sexo: 'M', meses: 3, peso: 6.3762, altura: 61.4 });
  assert.equal(r.zPeso, 0);
  assert.equal(r.tela.peso, '-');
  // Zeros à direita somem (o z vira número antes de virar texto): 0.010 → "0.01".
  assert.equal(avaliarInfantil({ sexo: 'M', meses: 72, peso: 20.5, altura: 116 }).tela.altura, '0.01 (Estatura adequada)');
});

test('§6.2: o z do IMC usa o IMC arredondado em 1 casa', () => {
  // 6.4 / 0.614² = 16.976… → 17.0; o z usa 17.0.
  const r = avaliarInfantil({ sexo: 'M', meses: 3, peso: 6.4, altura: 61.4 });
  assert.equal(r.imc, 17.0);
  assert.equal(r.zImc, zEscoreLMS(17.0, lms('imc', 'M', 3)));
});

test('§6.3: faixas de peso/idade', () => {
  assert.equal(classificarPesoIdade(2.001), 'Peso elevado');
  assert.equal(classificarPesoIdade(2), 'Eutrófico');
  assert.equal(classificarPesoIdade(1.001), 'Eutrófico');
  assert.equal(classificarPesoIdade(1), 'Adequado');
  assert.equal(classificarPesoIdade(-0.999), 'Adequado');
  assert.equal(classificarPesoIdade(-1), 'Eutrófico');
  assert.equal(classificarPesoIdade(-2), 'Baixo peso');
  assert.equal(classificarPesoIdade(-2.999), 'Baixo peso');
  assert.equal(classificarPesoIdade(-3), 'Muito baixo peso');
});

test('§6.3: faixas de estatura/idade', () => {
  assert.equal(classificarEstaturaIdade(-1.999), 'Estatura adequada');
  assert.equal(classificarEstaturaIdade(-2), 'Baixa estatura');
  assert.equal(classificarEstaturaIdade(-2.999), 'Baixa estatura');
  assert.equal(classificarEstaturaIdade(-3), 'Muito baixa estatura');
});

test('§6.3: faixas de IMC/idade por idade (< 5, 5–9, ≥ 10 anos)', () => {
  const linhas = [
    // z, <5, 5–9, ≥10
    [3.001, 'Obesidade', 'Obesidade grave', 'Obesidade grave'],
    [3, 'Sobrepeso', 'Obesidade', 'Obesidade'],
    [2, 'Eutrófico', 'Sobrepeso', 'Sobrepeso'],
    [1, 'Adequado', 'Adequado', 'Eutrófico'],
    [-0.999, 'Adequado', 'Adequado', 'Eutrófico'],
    [-1, 'Eutrófico', 'Eutrófico', 'Eutrófico'],
    [-2, 'Magreza', 'Magreza', 'Magreza'],
    [-3, 'Magreza severa', 'Magreza severa', 'Magreza severa'],
  ];
  for (const [z, a4, a5, a10] of linhas) {
    assert.equal(classificarImcIdade(z, 4), a4, `z ${z}, 4 anos`);
    assert.equal(classificarImcIdade(z, 5), a5, `z ${z}, 5 anos`);
    assert.equal(classificarImcIdade(z, 9), a5, `z ${z}, 9 anos`);
    assert.equal(classificarImcIdade(z, 10), a10, `z ${z}, 10 anos`);
  }
});

test('§12 #17: "Obesidade" (5 anos ou mais, z em (2; 3]) sai sem o TAB', () => {
  // Menina de 90 meses (7 anos) com IMC 22,0 → z ≈ 2,5.
  const r = avaliarInfantil({ sexo: 'F', meses: 90, peso: 34.9, altura: 126 });
  assert.equal(r.imc, 22.0);
  assert.ok(r.zImc > 2 && r.zImc <= 3, `z ${r.zImc} em (2; 3]`);
  assert.equal(r.classeImc, 'Obesidade');
  assert.equal(r.tela.imcz, `${r.zImc} (Obesidade)`);
  assert.ok(!r.tela.imcz.includes('\t'));
  assert.equal(classificarImcIdade(2.5, 12), 'Obesidade');
});

test('§12 #15: meninas 25–60 meses usam os LMS dos meninos (mantido; sem dados para corrigir)', () => {
  for (let m = 25; m <= 60; m++) {
    assert.deepEqual(lms('imc', 'F', m), lms('imc', 'M', m), `mês ${m}`);
  }
  // Fora da faixa, as tabelas são diferentes.
  assert.notDeepEqual(lms('imc', 'F', 24), lms('imc', 'M', 24));
  assert.notDeepEqual(lms('imc', 'F', 61), lms('imc', 'M', 61));
  // Exemplo do relatório: menina de 30 meses com IMC 15,0 → z WebDiet −0,666.
  assert.equal(zEscoreLMS(15.0, lms('imc', 'F', 30)), -0.666);
  const div = DIVERGENCIAS.find((d) => d.item === 15);
  assert.match(div.comportamento, /Mantido/);
});

test('§6.4: Slaughter — protocolos e prioridade de TR + PA', () => {
  // Meninos TR + SE: 0,783Σ + 1,6 (I27, I29).
  assert.deepEqual(slaughter({ sexo: 'M', dct: 8, dcse: 6 }), { gc: 12.56, protocolo: 'TR+SE', soma: 14 });
  assert.equal(slaughter({ sexo: 'M', dct: 25, dcse: 20 }).gc, 36.84);
  // Meninas TR + SE: Σ > 35 → 0,546Σ + 9,7; senão 1,33Σ − 0,013Σ² − 2,5 (I31, I30).
  assert.equal(slaughter({ sexo: 'F', dct: 20, dcse: 18 }).gc, 30.45);
  assert.equal(slaughter({ sexo: 'F', dct: 10, dcse: 8 }).gc, 17.23);
  // Σ = 35 exato fica na equação quadrática.
  assert.equal(slaughter({ sexo: 'F', dct: 20, dcse: 15 }).gc, Number((1.33 * 35 - 0.013 * 35 * 35 - 2.5).toFixed(2)));
  // TR + PA tem prioridade, mesmo com SE (I35).
  assert.deepEqual(slaughter({ sexo: 'M', dct: 14, dcse: 10, dcp: 12 }), { gc: 20.11, protocolo: 'TR+PA', soma: 26 });
  assert.equal(slaughter({ sexo: 'F', dct: 14, dcp: 15 }).gc, 22.79);
  // Sem o par de dobras: sem %G.
  assert.equal(slaughter({ sexo: 'M', dct: 10 }), null);
  assert.equal(slaughter({ sexo: 'M', dcse: 10, dcp: 10 }), null);
  const r = avaliarInfantil({ sexo: 'M', meses: 120, peso: 32, altura: 138, dct: 10 });
  assert.equal(r.tela.gc, '-');
  assert.equal(r.tela.gcClas, '-');
});

test('§12 #16: meninos TR + SE usam 0,783Σ + 1,6 também com Σ ≤ 35 (mantido)', () => {
  for (const s of [10, 20, 35, 36, 50]) {
    assert.equal(slaughter({ sexo: 'M', dct: s / 2, dcse: s / 2 }).gc, Number((0.783 * s + 1.6).toFixed(2)), `Σ ${s}`);
  }
  assert.match(DIVERGENCIAS.find((d) => d.item === 16).comportamento, /Mantido/);
});

test('§6.4: classificação do %G', () => {
  const m = [[5.99, 'Muito baixo'], [6, 'Baixo'], [10, 'Ótimo'], [19.99, 'Ótimo'], [20, 'Elevado'], [25, 'Alto'], [30.99, 'Alto'], [31, 'Muito alto']];
  for (const [gc, c] of m) assert.equal(classificarGorduraInfantil(gc, 'M'), c, `M ${gc}`);
  const f = [[11.99, 'Muito baixo'], [12, 'Baixo'], [15, 'Ótimo'], [25, 'Elevado'], [30, 'Alto'], [34.99, 'Alto'], [35, 'Muito alto']];
  for (const [gc, c] of f) assert.equal(classificarGorduraInfantil(gc, 'F'), c, `F ${gc}`);
});

test('DIVERGENCIAS: itens 15, 16 e 17 com descrição e comportamento', () => {
  assert.deepEqual(DIVERGENCIAS.map((d) => d.item), [15, 16, 17]);
  for (const d of DIVERGENCIAS) {
    assert.equal(typeof d.descricao, 'string');
    assert.equal(typeof d.comportamento, 'string');
    assert.ok(d.descricao.length > 0 && d.comportamento.length > 0);
  }
});
