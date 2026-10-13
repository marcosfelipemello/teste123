// Acompanhamento gestacional (relatório §7). Compara, semana a semana e campo a campo, com o que o WebDiet
// mostrou na tela (docs/webdiet-evidencias/tela_gestante.json) e testa a política de divergências (§12 #18–19).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  acompanhamentoGestacional,
  avaliarSemana,
  aporteSemana,
  curvaGestacional,
  tabelaSemanal,
  classePreGestacional,
  imcPreGestacional,
  idadeGestacional,
  avaliarPesoSemana,
  percentilCMB,
  percentilDCT,
  normalizarTipo,
  DIVERGENCIAS,
  AVISO_SEM_PESO,
} from '../src/calc/gestante.js';

const evidencia = JSON.parse(
  fs.readFileSync(new URL('../../docs/webdiet-evidencias/tela_gestante.json', import.meta.url), 'utf8'),
);

// A evidência foi capturada na mesma paciente, em sequência: os pesos registrados nos testes de um cenário
// continuam salvos e aparecem na tabela base do cenário seguinte (coluna "peso" de `linhas`). Por isso os
// pesos são levados de um cenário para o outro aqui, como aconteceu na tela.
test('evidência: 5 cenários × 40 semanas + 4 semanas testadas, campo a campo', async (t) => {
  assert.equal(evidencia.length, 5);
  let pesos = {};
  for (const cen of evidencia) {
    const { ppg, alt, tipo } = cen.cenario;
    // A evidência não traz a IG/DUM nem o nascimento digitados; usa-se o que a tela mostrou.
    const dados = { ppg, alt, tipo, semanas: cen.base.semanaAtual, idade: cen.base.idade };

    await t.test(`${tipo} ${cen.base.classe} (ppg ${ppg}, alt ${alt})`, async (tc) => {
      const r = acompanhamentoGestacional({ ...dados, pesos });

      await tc.test('dados iniciais', () => {
        assert.equal(r.tela.imcPpg, cen.base.imcPpg);
        assert.equal(r.tela.classe, cen.base.classe);
        assert.equal(r.tela.semanaAtual, cen.base.semanaAtual);
        assert.equal(r.tela.idade, cen.base.idade);
      });

      assert.equal(cen.base.tabela.length, 40);
      assert.equal(cen.base.linhas.length, 40);
      for (let i = 0; i < 40; i++) {
        const sem = i + 1;
        await tc.test(`semana ${sem}`, () => {
          // Curva (dados do gráfico): números exatos, sem arredondar.
          const [s, esperado, minimo, maximo] = cen.base.tabela[i];
          assert.equal(r.tela.tabela[i][0], s, 'semana');
          assert.equal(r.tela.tabela[i][1], esperado, 'esperado');
          assert.equal(r.tela.tabela[i][2], minimo, 'mínimo');
          assert.equal(r.tela.tabela[i][3], maximo, 'máximo');

          // Linha da tabela semanal.
          const [lSem, lMin, lMax, lPeso, lKcal] = cen.base.linhas[i];
          const nossa = r.tela.linhas[i];
          assert.equal(nossa[0], lSem, 'rótulo da semana');
          assert.equal(nossa[1], lMin, 'mínimo');
          assert.equal(nossa[2], lMax, 'máximo');
          assert.equal(nossa[3], lPeso, 'peso registrado');
          if (r.linhas[i].aviso) {
            // WebDiet §12 #18: sem nenhum peso registrado o WebDiet calcula contra 0 kg ("+7431 Kcal/dia").
            // Aqui: null + aviso, tela "-". A fórmula pura com pesoUlt = 0 reproduz o número do WebDiet.
            assert.equal(r.pesoUlt, null);
            assert.equal(r.linhas[i].kcal, null);
            assert.equal(r.linhas[i].aviso, AVISO_SEM_PESO);
            assert.equal(nossa[4], '-');
            const bruto = aporteSemana({ semana: sem, esperado: r.curva[i].esperado, ult: 1, pesoUlt: 0 });
            assert.equal(bruto.tela, lKcal, 'fórmula do WebDiet com peso 0');
          } else {
            assert.equal(nossa[4], lKcal, 'kcal');
          }
        });
      }

      for (const teste of cen.testes) {
        await tc.test(`registro na semana ${teste.sem}: peso ${teste.pa}, DCT ${teste.dct}, CB ${teste.cb}`, async (tt) => {
          const a = avaliarSemana({ ...dados, pesos, semana: teste.sem, peso: teste.pa, dct: teste.dct, cb: teste.cb });
          pesos = a.pesos;
          assert.deepEqual(Object.keys(a.tela).sort(), Object.keys(teste.tela).sort(), 'mesmos campos da tela');
          for (const campo of ['semana', 'imc', 'en', 'cmb', 'proteico', 'lipidico', 'pesoTotal']) {
            assert.equal(a.tela[campo], teste.tela[campo], campo);
          }
          assert.equal(teste.tela.kcal.length, 40);
          for (let i = 0; i < 40; i++) {
            await tt.test(`kcal semana ${i + 1}`, () => {
              assert.equal(a.tela.kcal[i], teste.tela.kcal[i]);
            });
          }
          assert.deepEqual(a.avisos, []);
        });
      }
    });
  }
});

test('§7.2: classe pré-gestacional', () => {
  assert.equal(classePreGestacional(18.49), 'Baixo Peso');
  assert.equal(classePreGestacional(18.5), 'Saudável');
  assert.equal(classePreGestacional(24.99), 'Saudável');
  assert.equal(classePreGestacional(25), 'Sobrepeso');
  assert.equal(classePreGestacional(29.99), 'Sobrepeso');
  assert.equal(classePreGestacional(30), 'Obesidade');
});

test('§7.1: IMC pré salvo com 2 casas e exibido com 1', () => {
  assert.equal(imcPreGestacional(62, 163), 23.34);
  const r = acompanhamentoGestacional({ ppg: 62, altura: 163, tipo: 'Única' });
  assert.equal(r.imcPpg, 23.34);
  assert.equal(r.tela.imcPpg, '23.3 kg/m2');
  assert.equal(imcPreGestacional(0, 163), null);
});

test('§7.1: DUM = hoje − semanas; semanas = parseInt(diferença em semanas); acima de 43 → 40', () => {
  assert.deepEqual(idadeGestacional({ semanas: 20, dataReferencia: '13/10/2026' }), { semanas: 20, semanaAtual: 20, dum: '26/05/2026' });
  assert.deepEqual(idadeGestacional({ dum: '26/05/2026', dataReferencia: '13/10/2026' }), { semanas: 20, semanaAtual: 20, dum: '26/05/2026' });
  // 139 dias = 19,86 semanas → 19.
  assert.equal(idadeGestacional({ dum: '27/05/2026', dataReferencia: '13/10/2026' }).semanas, 19);
  assert.equal(idadeGestacional({ semanas: 43 }).semanaAtual, 43);
  assert.equal(idadeGestacional({ semanas: 44 }).semanaAtual, 40);
  assert.equal(idadeGestacional({ semanas: 44 }).semanas, 44);
  assert.equal(idadeGestacional({ semanas: 20 }).dum, null);
  const r = acompanhamentoGestacional({ ppg: 62, altura: 163, dum: '26/05/2026', dataReferencia: '13/10/2026', nascimento: '15/06/1991' });
  assert.equal(r.semanaAtual, 20);
  assert.equal(r.idade, 35);
});

test('§7.3: curva — pares de percentis do peso esperado e faixa', () => {
  // Semana 10, Saudável: 62 + (p10 −2,4 + p34 −0,08)/2 = 60,76; faixa 62 − 2,4 … 62 + 0.
  const c = curvaGestacional({ ppg: 62, classe: 'Saudável', tipo: 'Única' });
  assert.equal(c.length, 40);
  assert.deepEqual(c[9], { semana: 10, esperado: 60.76, minimo: 59.6, maximo: 62 });
  // Semanas 1–9: reta de ppg até o esperado da 10ª, alcançado na 9ª; mínimo = máximo = ppg.
  assert.equal(c[8].esperado, c[9].esperado);
  assert.equal(c[0].minimo, 62);
  assert.equal(c[0].maximo, 62);
  // Gemelar: p10/p50 para esperado e faixa.
  const g = curvaGestacional({ ppg: 62, classe: 'Saudável', tipo: 'Gemelar' });
  assert.deepEqual(g[9], { semana: 10, esperado: 67.65, minimo: 66.5, maximo: 68.8 });
  assert.throws(() => normalizarTipo('Trigemelar'), TypeError);
});

test('§7.4: avaliação da semana', () => {
  const c = curvaGestacional({ ppg: 62, classe: 'Saudável', tipo: 'Única' });
  assert.equal(avaliarPesoSemana(50, c[8]), 'N/D');
  assert.equal(avaliarPesoSemana(59.5, c[9]), 'Abaixo do peso');
  assert.equal(avaliarPesoSemana(59.6, c[9]), 'Saudável');
  assert.equal(avaliarPesoSemana(62, c[9]), 'Saudável');
  assert.equal(avaliarPesoSemana(62.1, c[9]), 'Acima do peso');
  assert.throws(() => avaliarSemana({ ppg: 62, altura: 163, semana: 41, peso: 70 }), RangeError);
});

test('§7.6: aporte calórico — fórmula, semana ≤ ult e antes da 10ª', () => {
  // dif = 62,142 − 61,9 = 0,242 → 0,2; 0,2 × 7700 / ((16 − 8) × 7) = 27,5 → "+28".
  assert.deepEqual(aporteSemana({ semana: 16, esperado: 62.142, ult: 8, pesoUlt: 61.9 }), { kcal: 28, tela: '+28 Kcal/dia' });
  assert.deepEqual(aporteSemana({ semana: 8, esperado: 70, ult: 8, pesoUlt: 61.9 }), { kcal: null, tela: '-' });
  assert.deepEqual(aporteSemana({ semana: 12, esperado: 70, ult: 14, pesoUlt: 61.9 }), { kcal: 0, tela: '0 Kcal/dia' });
  assert.deepEqual(aporteSemana({ semana: 20, esperado: 60, ult: 14, pesoUlt: 61.9 }), { kcal: 0, tela: '0 Kcal/dia' });
  // ult = maior semana com peso registrado.
  const c = curvaGestacional({ ppg: 62, classe: 'Saudável', tipo: 'Única' });
  const t = tabelaSemanal({ curva: c, pesos: { 14: 58.6, 8: 61.9 } });
  assert.equal(t.ult, 14);
  assert.equal(t.pesoUlt, 58.6);
  assert.equal(t.tela[14][4], '+3630 Kcal/dia');
  assert.equal(t.linhas[13].avaliacao, 'Abaixo do peso');
  assert.equal(t.linhas[7].avaliacao, 'N/D');
  assert.equal(t.linhas[20].avaliacao, null);
});

test('§12 #18: sem nenhum peso registrado → aporte null + aviso (WebDiet: "+7431 Kcal/dia")', () => {
  const r = acompanhamentoGestacional({ ppg: 62, altura: 163, tipo: 'Única', semanas: 20 });
  assert.equal(r.pesoUlt, null);
  assert.deepEqual(r.avisos, [AVISO_SEM_PESO]);
  for (let i = 0; i < 40; i++) {
    assert.equal(r.linhas[i].kcal, null);
    if (i < 9) {
      assert.equal(r.linhas[i].aviso, undefined);
    } else {
      assert.equal(r.linhas[i].aviso, AVISO_SEM_PESO);
      assert.match(r.linhas[i].aviso, /Nenhum peso registrado/);
    }
    assert.equal(r.tela.linhas[i][4], '-');
  }
  // O comportamento do WebDiet só aparece passando pesoUlt = 0 de propósito.
  assert.equal(aporteSemana({ semana: 10, esperado: 60.76, ult: 1, pesoUlt: 0 }).tela, '+7431 Kcal/dia');
  assert.equal(aporteSemana({ semana: 10, esperado: 60.76, ult: 1, pesoUlt: null }).aviso, AVISO_SEM_PESO);
  assert.match(DIVERGENCIAS.find((d) => d.item === 18).comportamento, /Corrigido/);
});

test('§7.5: CMB = CB − 0,314 × DCT e rótulos de percentil (35 anos)', () => {
  const a = avaliarSemana({ ppg: 62, altura: 163, idade: 35, semana: 8, peso: 61.9, dct: 20, cb: 27 });
  assert.equal(a.cmb, 20.7);
  assert.equal(a.tela.cmb, '20.7 cm');
  const cmb = [[18.5, 'Abaixo do p5'], [18.6, 'Entre p5 e p10'], [19.2, 'Entre p10 e p25'], [20.5, 'Entre p25 e p50'],
    [21.8, 'Entre p50 e p75'], [23.6, 'Entre p75 e p90'], [25.7, 'Entre p90 e p95'], [27.2, 'Acima do p95']];
  for (const [v, rot] of cmb) assert.equal(percentilCMB(v, 35), rot, `CMB ${v}`);
  const dct = [[10, 'Abaixo do p5'], [11, 'Entre p5 e p10'], [13, 'Entre p10 e p15'], [15.5, 'Entre p15 e p25'],
    [18, 'Entre p25 e p50'], [23.5, 'Entre p50 e p75'], [30, 'Entre p75 e p85'], [35, 'Entre p85 e p90'],
    [37, 'Entre p90 e p95'], [41, 'Acima do p95']];
  for (const [v, rot] of dct) assert.equal(percentilDCT(v, 35), rot, `DCT ${v}`);
});

test('§7.5: faixas de idade das tabelas de CMB e DCT', () => {
  // CMB: 18 anos tem linha própria; 19–24 e 25–34 compartilham.
  assert.equal(percentilCMB(17.5, 18), 'Entre p5 e p10');
  assert.equal(percentilCMB(17.5, 19), 'Abaixo do p5');
  assert.equal(percentilCMB(17.5, 24), 'Abaixo do p5');
  assert.equal(percentilCMB(18.5, 25), 'Entre p5 e p10');
  assert.equal(percentilCMB(18.5, 34), 'Entre p5 e p10');
  assert.equal(percentilCMB(18.5, 35), 'Abaixo do p5');
  // DCT: 18–24, 25–29, 30–34, 35–39, ≥ 40.
  assert.equal(percentilDCT(9.5, 18), 'Entre p5 e p10');
  assert.equal(percentilDCT(9.5, 24), 'Entre p5 e p10');
  assert.equal(percentilDCT(9.5, 25), 'Abaixo do p5');
  assert.equal(percentilDCT(10.4, 29), 'Entre p5 e p10');
  assert.equal(percentilDCT(10.4, 30), 'Abaixo do p5');
  assert.equal(percentilDCT(11.5, 39), 'Entre p5 e p10');
  assert.equal(percentilDCT(11.5, 40), 'Abaixo do p5');
  assert.equal(percentilDCT(11.5, 60), 'Abaixo do p5');
  // Menos de 12 anos: sem tabela.
  assert.equal(percentilCMB(20, 11), null);
  assert.equal(percentilDCT(20, 11), null);
  const a = avaliarSemana({ ppg: 40, altura: 150, idade: 11, semana: 12, peso: 41, dct: 15, cb: 22 });
  assert.equal(a.tela.proteico, '-');
  assert.equal(a.tela.lipidico, '-');
  assert.equal(a.avisos.length, 1);
});

test('§12 #19: DCT aos 16 anos com p5 = 1,5 (mantido)', () => {
  assert.equal(percentilDCT(1, 16), 'Abaixo do p5');
  // Por causa do p5 = 1,5, uma DCT de 5 mm aos 16 anos cai "Entre p5 e p10" (aos 15 e 17 é "Abaixo do p5").
  assert.equal(percentilDCT(5, 16), 'Entre p5 e p10');
  assert.equal(percentilDCT(5, 15), 'Abaixo do p5');
  assert.equal(percentilDCT(5, 17), 'Abaixo do p5');
  assert.match(DIVERGENCIAS.find((d) => d.item === 19).comportamento, /Mantido/);
});

test('avaliarSemana: sem CB/DCT a tela mostra "-"; ganho total com 2 casas', () => {
  const a = avaliarSemana({ ppg: 62, altura: 163, tipo: 'Única', idade: 30, semana: 20, peso: '63,7' });
  assert.equal(a.tela.cmb, '-');
  assert.equal(a.tela.proteico, '-');
  assert.equal(a.tela.lipidico, '-');
  assert.equal(a.tela.pesoTotal, '1.70');
  assert.equal(a.ganhoTotal, 1.7);
  assert.equal(a.tela.en, 'Saudável');
  assert.deepEqual(a.pesos, { 20: 63.7 });
});

test('DIVERGENCIAS: itens 18 e 19 com descrição e comportamento', () => {
  assert.deepEqual(DIVERGENCIAS.map((d) => d.item), [18, 19]);
  for (const d of DIVERGENCIAS) {
    assert.equal(typeof d.descricao, 'string');
    assert.equal(typeof d.comportamento, 'string');
    assert.ok(d.descricao.length > 0 && d.comportamento.length > 0);
  }
});
