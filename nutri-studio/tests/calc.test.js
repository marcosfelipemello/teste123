// Valores esperados calculados de forma independente (Python) a partir das equações publicadas.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { imc, classificarImc, rcq, rcest, riscoCintura, pesoIdeal, pesoAjustado, cmb, ambCorrigida } from '../src/calc/antropometria.js';
import { composicaoPorDobras } from '../src/calc/composicao.js';
import { calcularGasto, equacaoPorId } from '../src/calc/energia.js';
import { distribuirMacros } from '../src/calc/macros.js';
import { nutrientesDaPorcao, totaisDoPlano, distribuicaoPercentual } from '../src/calc/plano.js';
import { ganhoEsperadoAteSemana, recomendacaoGestacional } from '../src/calc/gestacao.js';
import { idadeEmAnos, num } from '../src/calc/util.js';

const perto = (real, esperado, tol = 1e-6) =>
  assert.ok(Math.abs(real - esperado) <= tol, `esperado ${esperado}, obtido ${real}`);

test('util: idade e números com vírgula', () => {
  assert.equal(idadeEmAnos('1990-06-15', '2026-06-14'), 35);
  assert.equal(idadeEmAnos('1990-06-15', '2026-06-15'), 36);
  assert.equal(num('72,5'), 72.5);
  assert.ok(Number.isNaN(num('')));
});

test('IMC e classificação', () => {
  perto(imc(70, 175), 22.857142857, 1e-6);
  assert.equal(classificarImc(22.86, 30).rotulo, 'Eutrofia');
  assert.equal(classificarImc(24.99, 30).rotulo, 'Eutrofia');
  assert.equal(classificarImc(25, 30).rotulo, 'Sobrepeso (pré-obesidade)');
  assert.equal(classificarImc(40, 30).rotulo, 'Obesidade grau III');
  assert.equal(classificarImc(17.2, 30).rotulo, 'Magreza grau I');
  // idoso (Lipschitz)
  assert.equal(classificarImc(21.9, 70).rotulo, 'Baixo peso');
  assert.equal(classificarImc(27, 70).rotulo, 'Eutrofia');
  assert.equal(classificarImc(27.1, 70).rotulo, 'Sobrepeso');
});

test('Circunferências e relações', () => {
  perto(rcq(90, 100, 'M').valor, 0.9);
  assert.equal(rcq(90, 100, 'M').rotulo, 'Risco aumentado');
  assert.equal(rcq(84, 100, 'F').rotulo, 'Adequado');
  perto(rcest(85, 170).valor, 0.5);
  assert.equal(riscoCintura(94, 'M').rotulo, 'Risco elevado');
  assert.equal(riscoCintura(88, 'F').rotulo, 'Risco muito elevado');
  perto(pesoIdeal(175, 22), 67.375);
  perto(pesoAjustado(110, 67.375), 78.03125);
  perto(cmb(30, 15), 25.287611019615312);
  perto(ambCorrigida(30, 15, 'M'), 40.88687025899717);
});

test('Gasto energético: equações de TMB', () => {
  const M = { sexo: 'M', peso: 70, altura: 175, idade: 30 };
  const F = { sexo: 'F', peso: 60, altura: 165, idade: 30 };
  perto(equacaoPorId('mifflin').calc(M), 1648.75);
  perto(equacaoPorId('mifflin').calc(F), 1320.25);
  perto(equacaoPorId('hb1919').calc(M), 1702.0125);
  perto(equacaoPorId('hb1919').calc(F), 1393.8155);
  perto(equacaoPorId('hb1984').calc(M), 1695.667);
  perto(equacaoPorId('fao1985').calc(M), 1691); // 30 anos → faixa 30–60
  perto(equacaoPorId('fao1985').calc({ ...M, idade: 29 }), 1750);
  perto(equacaoPorId('fao1985').calc({ sexo: 'F', peso: 60, idade: 45 }), 1351);
  perto(equacaoPorId('schofield').calc({ sexo: 'F', peso: 60, idade: 25 }), 1375.68);
  perto(equacaoPorId('cunningham').calc({ mlg: 60 }), 1820);
  perto(equacaoPorId('katch').calc({ mlg: 60 }), 1666);
  perto(equacaoPorId('tinsleyPeso').calc({ peso: 80 }), 1994);
  perto(equacaoPorId('tinsleyMlg').calc({ mlg: 70 }), 2097);
});

test('Gasto energético: DRI/IOM 2005', () => {
  const eer = equacaoPorId('iom2005');
  perto(eer.calc({ sexo: 'M', peso: 70, altura: 175, idade: 30, nivelIom: 'ativo' }), 2948.6);
  perto(eer.calc({ sexo: 'F', peso: 60, altura: 165, idade: 40, nivelIom: 'poucoAtivo' }), 2048.24);
  perto(eer.calc({ sexo: 'M', peso: 35, altura: 140, idade: 10, nivelIom: 'ativo' }), 2264.862);
});

test('GET e VET', () => {
  const r = calcularGasto({
    equacao: 'mifflin',
    entrada: { sexo: 'M', peso: 70, altura: 175, idade: 30 },
    fatorAtividade: 1.55,
    fatorInjuria: 1,
    ajusteKcal: -500,
  });
  perto(r.tmb, 1648.75);
  perto(r.get, 2555.5625);
  perto(r.vet, 2055.5625);
  const falta = calcularGasto({ equacao: 'cunningham', entrada: { sexo: 'M', peso: 70, altura: 175, idade: 30 } });
  assert.deepEqual(falta.faltando, ['mlg']);
  const eer = calcularGasto({
    equacao: 'iom2005',
    entrada: { sexo: 'M', peso: 70, altura: 175, idade: 30, nivelIom: 'ativo' },
    fatorAtividade: 1.55,
  });
  perto(eer.get, 2948.6); // EER não multiplica pelo FA
});

test('Composição corporal por dobras', () => {
  const jp3M = composicaoPorDobras({ protocolo: 'jp3', sexo: 'M', idade: 30, peso: 80, dobras: { peitoral: 15, abdominal: 25, coxa: 20 } });
  perto(jp3M.densidade, 1.057816);
  perto(jp3M.percentualGordura, 17.94527592700428);
  perto(jp3M.massaGorda, 80 * 0.1794527592700428);
  const brozek = composicaoPorDobras({ protocolo: 'jp3', sexo: 'M', idade: 30, peso: 80, dobras: { peitoral: 15, abdominal: 25, coxa: 20 }, conversao: 'brozek' });
  perto(brozek.percentualGordura, 17.82220423967873);

  const jp3F = composicaoPorDobras({ protocolo: 'jp3', sexo: 'F', idade: 25, peso: 60, dobras: { triceps: 10, suprailiaca: 15, coxa: 12 } });
  perto(jp3F.percentualGordura, 15.915898885896329);

  const jp7M = composicaoPorDobras({
    protocolo: 'jp7', sexo: 'M', idade: 35, peso: 80,
    dobras: { peitoral: 10, axilarMedia: 12, triceps: 8, subescapular: 15, abdominal: 20, suprailiaca: 14, coxa: 12 },
  });
  perto(jp7M.percentualGordura, 13.969114616455602);

  const dw = { biceps: 6, triceps: 12, subescapular: 14, suprailiaca: 10 };
  perto(composicaoPorDobras({ protocolo: 'durnin', sexo: 'F', idade: 25, peso: 60, dobras: dw }).percentualGordura, 24.35919602756229);
  perto(composicaoPorDobras({ protocolo: 'durnin', sexo: 'M', idade: 55, peso: 60, dobras: dw }).percentualGordura, 23.662054801035026);

  perto(
    composicaoPorDobras({ protocolo: 'petroski', sexo: 'M', idade: 30, peso: 80, dobras: { subescapular: 14, triceps: 12, suprailiaca: 16, panturrilha: 10 } }).percentualGordura,
    17.754122239120207,
  );
  perto(
    composicaoPorDobras({ protocolo: 'petroski', sexo: 'F', idade: 30, peso: 60, dobras: { axilarMedia: 12, suprailiaca: 16, coxa: 20, panturrilha: 15 } }).percentualGordura,
    22.34802075494473,
  );
  perto(
    composicaoPorDobras({ protocolo: 'faulkner', sexo: 'M', idade: 30, peso: 80, dobras: { triceps: 12, subescapular: 14, suprailiaca: 16, abdominal: 20 } }).percentualGordura,
    15.269,
  );

  const incompleto = composicaoPorDobras({ protocolo: 'jp3', sexo: 'M', idade: 30, peso: 80, dobras: { peitoral: 15 } });
  assert.deepEqual(incompleto.faltando, ['abdominal', 'coxa']);
});

test('Distribuição de macronutrientes', () => {
  const pct = distribuirMacros({ vet: 2000, peso: 70, modo: 'percentual', valores: { ptn: 20, cho: 50, lip: 30 } });
  perto(pct.linhas.ptn.g, 100);
  perto(pct.linhas.cho.g, 250);
  perto(pct.linhas.lip.g, 2000 * 0.3 / 9);
  perto(pct.linhas.ptn.gkg, 100 / 70);
  assert.equal(pct.alerta, null);

  const gkg = distribuirMacros({ vet: 2000, peso: 70, modo: 'gkg', valores: { ptn: 2, lip: 1 } });
  perto(gkg.linhas.ptn.g, 140);
  perto(gkg.linhas.lip.g, 70);
  perto(gkg.linhas.cho.g, (2000 - 560 - 630) / 4);
  perto(gkg.somaPct, 100);

  const errado = distribuirMacros({ vet: 2000, peso: 70, modo: 'percentual', valores: { ptn: 20, cho: 50, lip: 20 } });
  assert.ok(errado.alerta);
});

test('Plano alimentar: totais', () => {
  const arroz = { id: 'a', nome: 'Arroz', grupo: '', kcal: 128, ptn: 2.5, cho: 28.1, lip: 0.2, fibra: 1.6 };
  const frango = { id: 'f', nome: 'Frango', grupo: '', kcal: 159, ptn: 32, cho: 0, lip: 2.5, fibra: 0 };
  const p = nutrientesDaPorcao(arroz, 150);
  perto(p.kcal, 192);
  perto(p.cho, 42.15);
  const db = { a: arroz, f: frango };
  const t = totaisDoPlano(
    [
      { id: 'r1', nome: 'Almoço', itens: [{ alimentoId: 'a', gramas: 150 }, { alimentoId: 'f', gramas: 100 }] },
      { id: 'r2', nome: 'Jantar', itens: [{ alimentoId: 'f', gramas: 50 }, { alimentoId: 'inexistente', gramas: 50 }] },
    ],
    (id) => db[id],
  );
  perto(t.porRefeicao[0].total.kcal, 351);
  perto(t.dia.kcal, 351 + 79.5);
  perto(t.dia.ptn, 3.75 + 32 + 16);
  const d = distribuicaoPercentual({ ptn: 25, cho: 50, lip: 10 });
  perto(d.ptn + d.cho + d.lip, 100);
  perto(d.lip, 90 / 390 * 100);
});

test('Ganho de peso gestacional (IOM 2009)', () => {
  assert.equal(recomendacaoGestacional(22).totalMin, 11.5);
  assert.equal(recomendacaoGestacional(30).faixa, 'Obesidade (≥ 30,0)');
  const g = ganhoEsperadoAteSemana(22, 20);
  perto(g.min, 0.5 + 7 * 0.35);
  perto(g.max, 2 + 7 * 0.5);
  const g40 = ganhoEsperadoAteSemana(22, 40);
  perto(g40.min, 0.5 + 27 * 0.35); // 9,95 kg
  perto(g40.max, 2 + 27 * 0.5); // 15,5 kg
});
