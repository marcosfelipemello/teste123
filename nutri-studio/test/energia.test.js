// Testes do cálculo energético (relatório §4) contra a tela do WebDiet:
// docs/webdiet-evidencias/tela_energia.json (110 casos) e tela_energia_extras.json
// (programação de peso/VENTA, MET, fórmula de bolso, GET manual). Também conferem a política para os
// erros do §12 (itens 1–9) e o catálogo PROTOCOLOS usado pela interface.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  calcularBolso,
  calcularEnergia,
  calcularMet,
  converterGetManual,
  listaFatores,
  programarPeso,
  CORRECOES,
  DISPOSICAO_GESTANTE,
  DIVERGENCIAS,
  INJURIAS,
  KCAL_POR_KG,
  LISTAS_FATORES,
  MENSAGENS,
  PROTOCOLOS,
} from '../src/calc/energia.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const pastaEvidencias = path.join(aqui, '../../docs/webdiet-evidencias');
const lerJson = (nome) => JSON.parse(fs.readFileSync(path.join(pastaEvidencias, nome), 'utf8'));
const casos = lerJson('tela_energia.json');
const extras = lerJson('tela_energia_extras.json');
const fonte = fs.readFileSync(path.join(aqui, '../src/calc/energia.js'), 'utf8');

/** "Hoje" do WebDiet nas capturas (§3: a data vem do servidor; §4.8). */
const HOJE = '13/10/2026';
/** A captura cortou o campo `erro` da tela em 120 caracteres (E50). */
const CORTE_ERRO = 120;
/** Campos de `tela` conferidos em cada caso (o campo `excecao` é da captura, não da tela). */
const CAMPOS = ['tmb', 'tmbkg', 'get', 'getkg', 'erro', 'fatores'];

/**
 * Caso da evidência → entrada do módulo. `fator` é o fator que a tela de fato usou (`fatorUsado`):
 * em E03/E18 a captura pediu 1.550, que não existe na lista do Katch-McArdle, e o select ficou em
 * 1.11/1.12; em 21/22 a captura não escolheu fator e vale o selecionado.
 */
const entradaDoCaso = (c) => ({
  formula: c.formula,
  sexo: c.sexo,
  nascimento: c.nasc,
  dataReferencia: HOJE,
  peso: c.peso,
  altura: c.altura,
  mlg: c.mlg,
  fator: c.fatorUsado,
  injuria: c.injuria,
  semanas: c.semanas,
  estadoNutricional: c.estadoNut,
  dataParto: c.parto,
});

/** Inteiro de "1806 Kcal/dia" (null se a string não for desse formato). */
const kcalDaTela = (s) => {
  const m = /^(-?\d+) Kcal\/dia$/.exec(s);
  return m ? Number(m[1]) : null;
};

const proximo = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg ?? ''} ${a} ≠ ${b}`);

// =============================================================================================
// tela_energia.json — 110 casos, um subteste por caso
// =============================================================================================

test('tela_energia.json: 110 casos, campo a campo', async (t) => {
  assert.equal(casos.length, 110);
  assert.equal(new Set(casos.map((x) => x.caso.id)).size, 110, 'ids únicos');
  const anterior = new Map(casos.map((x, i) => [x.caso.id, casos[i - 1]]));

  for (const { caso, tela } of casos) {
    await t.test(caso.id, () => {
      const r = calcularEnergia(entradaDoCaso(caso));
      const campos = caso.id === 'E108' ? ['tmb', 'tmbkg', 'erro', 'fatores'] : CAMPOS;
      for (const campo of campos) {
        const esperado = tela[campo];
        if (campo === 'erro' && esperado.length === CORTE_ERRO) {
          assert.equal(r.tela.erro.slice(0, CORTE_ERRO), esperado, `${caso.id}.erro (cortado pela captura)`);
        } else {
          assert.equal(r.tela[campo], esperado, `${caso.id}.${campo}`);
        }
      }

      // Números coerentes com a tela (o GET usa a TMB inteira; os inteiros são os exibidos).
      if (kcalDaTela(r.tela.tmb) !== null) assert.equal(r.tmbArredondada, kcalDaTela(r.tela.tmb), 'tmbArredondada');
      if (kcalDaTela(r.tela.get) !== null) assert.equal(r.getArredondado, kcalDaTela(r.tela.get), 'getArredondado');
      assert.equal(r.tmbAplicavel, tela.tmb !== 'Não aplicável', 'tmbAplicavel');

      if (caso.id !== 'E108') {
        assert.equal(tela.excecao, '', 'a tela do WebDiet não deu exceção');
        assert.equal(r.corrigido, false, 'sem correção');
        return;
      }
      // E108 — §12 #1: com exatamente 36 meses a tela do WebDiet deu exceção de JS e o GET ficou com
      // o valor do caso anterior (E107). TMB, kcal/kg da TMB e lista de fatores acima são da tela.
      assert.match(tela.excecao, /Cannot read properties of undefined \(reading 'toFixed'\)/);
      const e107 = anterior.get('E108');
      assert.equal(e107.caso.id, 'E107');
      assert.equal(tela.get, e107.tela.get, 'GET da tela é o do caso anterior');
      assert.equal(tela.getkg, e107.tela.getkg, 'kcal/kg da tela é o do caso anterior');
      // nutri-studio: ramo de 3 anos ou mais. H: 88,5 − 61,9×3 + 1×1×(26,7×14,5 + 903×0,95) + 20 = 1167,8.
      assert.equal(r.idadeMeses, 36);
      proximo(r.get, 1167.8, 'GET E108');
      assert.equal(r.tela.get, '1168 Kcal/dia');
      assert.equal(r.tela.getkg, '(80.5 Kcal/kg)');
      assert.equal(r.corrigido, true);
      assert.match(r.aviso, /§12, item 1/);
    });
  }
});

test('§4.3: o GET usa a TMB arredondada — 11 dos 110 casos mudariam sem arredondar', () => {
  const mudariam = [];
  for (const { caso, tela } of casos) {
    const r = calcularEnergia(entradaDoCaso(caso));
    if (caso.id === 'E108' || r.tmb === null || r.get === null) continue;
    if (`${(r.tmb * r.fatorAtividade * r.fatorInjuria).toFixed(0)} Kcal/dia` !== tela.get) mudariam.push(caso.id);
  }
  assert.equal(mudariam.length, 11, mudariam.join(','));
  // Exemplo do relatório: HB 1919, mulher, 35 anos, 62,5 kg, 163 cm, fator 1,55 → 2156 (sem arredondar, 2155).
  assert.ok(mudariam.includes('E16'));
});

// =============================================================================================
// tela_energia_extras.json
// =============================================================================================

// Paciente dos extras: o de E02 (Harris-Benedict 1984, masculino, 80 kg, 175 cm, 35 anos → TMB
// 1801). O fator 1,550 não está no arquivo: é o único da lista padrão que reproduz os quatro GETs.
const PACIENTE_EXTRAS = Object.freeze({
  formula: 2, sexo: 'M', nascimento: '15/06/1991', dataReferencia: HOJE, peso: 80, altura: 175, fator: '1.550',
});

/** Confere os campos `depois` (tmb, get, getkg, met, venta, gest) da tela final. */
const conferirDepois = (r, depois, rotulo) => {
  for (const [campo, esperado] of Object.entries(depois)) {
    assert.equal(r.tela[campo], esperado, `${rotulo}.depois.${campo}`);
  }
};

test('extras: programação de peso (VENTA)', async (t) => {
  assert.equal(extras.venta.length, 3);
  for (const v of extras.venta) {
    await t.test(`${v.alvo} kg em ${v.dias} dias`, () => {
      const p = programarPeso({ peso: PACIENTE_EXTRAS.peso, pesoDesejado: v.alvo, dias: v.dias });
      assert.equal(p.aviso, null);
      assert.equal(p.tela.r1, v.r1, 'r1');
      assert.equal(p.tela.r2, v.r2, 'r2');
      assert.equal(p.tela.pesoPaciente, v.pesoPaciente, 'pesoPaciente');
      assert.equal(p.tela.sliderMin, v.sliderMin, 'sliderMin');
      assert.equal(p.tela.sliderMax, v.sliderMax, 'sliderMax');
      // ventaFinal = [peso desejado, dias, kcal/dia aplicadas].
      assert.deepEqual([v.alvo, p.dias, p.kcalDia], v.ventaFinal, 'ventaFinal');
      // WebDiet §12 #9: r2 mostra o arredondado; o GET recebe o truncado (difere nos três casos).
      assert.notEqual(`(${p.kcalDia > 0 ? '+' : ''}${p.kcalDia} Kcal/dia)`, v.r2);

      const r = calcularEnergia({ ...PACIENTE_EXTRAS, programacaoPeso: { pesoDesejado: v.alvo, dias: v.dias } });
      conferirDepois(r, v.depois, 'venta');
      assert.equal(r.adicionais.venta, v.ventaFinal[2]);
    });
  }
});

test('extras: adicional MET', () => {
  const atividades = extras.met.atividades.map((a, i) => ({ met: a.fator, minutos: extras.met.minutos[i] }));
  const m = calcularMet({ peso: PACIENTE_EXTRAS.peso, atividades });
  assert.equal(m.kcal, 420); // 30 × 80 × 6,0 / 60 + 45 × 80 × 3,0 / 60 = 240 + 180
  assert.equal(m.tela, extras.met.depois.met);
  const r = calcularEnergia({ ...PACIENTE_EXTRAS, atividades });
  conferirDepois(r, extras.met.depois, 'met');
  assert.equal(r.adicionais.met, 420);
});

test('extras: fórmula de bolso (11)', () => {
  // Entradas do relatório (§4.5): PTN 2 / CHO 4,5 / LIP 1 g/kg com 80 kg.
  assert.deepEqual(listaFatores(11).map((o) => o.valor), extras.fatoresBolso);
  const b = calcularBolso({ peso: 80, ptn: 2, lip: 1, cho: 4.5 });
  assert.equal(b.tela.r, extras.bolso.r);
  assert.equal(b.tela.r2, extras.bolso.r2);
  const r = calcularEnergia({ formula: 11, peso: 80, bolso: { ptn: 2, lip: 1, cho: 4.5 } });
  conferirDepois(r, extras.bolso.depois, 'bolso');
  assert.equal(r.fatorAtividade, 1);
});

test('extras: GET manual (10)', () => {
  // Entradas do relatório (§4.5): 33 kcal/kg × 80 → 2640; 2500/80 → "31.3"; com fator 1,2 → 3000.
  assert.equal(converterGetManual({ peso: 80, kcalKg: 33 }).tela.getTemp, extras.manual.getTemp);
  assert.equal(converterGetManual({ peso: 80, kcalKg: 33 }).kcal, 2640);
  assert.equal(converterGetManual({ peso: 80, kcal: 2500 }).tela.getTemp2, extras.manual.getTemp2);
  assert.equal(converterGetManual({ peso: 80, kcal: 2500 }).kcalKg, 31.3);
  const r = calcularEnergia({ formula: 10, peso: 80, getManual: { kcal: 2500 }, fator: '1.200' });
  conferirDepois(r, extras.manual.depois, 'manual');
  // Pelo campo kcal/kg: 33 × 80 = 2640 (valor do campo) × 1,2 = 3168.
  assert.equal(calcularEnergia({ formula: 10, peso: 80, getManual: { kcalKg: 33 }, fator: '1.200' }).tela.get, '3168 Kcal/dia');
});

// =============================================================================================
// Política para os erros do §12
// =============================================================================================

test('§12 #1: EER/IOM 2005 infantil com exatamente 36 meses usa o ramo de 3 anos ou mais', async (t) => {
  await t.test('menina de 36 meses: GET pela equação de 36–96 meses, TMB e lista como no WebDiet', () => {
    const r = calcularEnergia({ formula: 21, sexo: 'F', meses: 36, peso: 14, altura: 95 });
    // 135,3 − 30,8×3 + 1×1×(10×14 + 934×0,95) + 20 = 1090,2
    proximo(r.get, 1090.2);
    assert.equal(r.tela.get, '1090 Kcal/dia');
    assert.equal(r.tela.getkg, '(77.9 Kcal/kg)');
    assert.equal(r.tela.tmb, '1166 Kcal/dia'); // 89×14 − 100 + 20
    assert.equal(r.tela.fatores, '1');
    assert.equal(r.corrigido, true);
    assert.match(r.aviso, /§12, item 1/);
  });
  await t.test('injúria e VENTA entram como no ramo de 3 anos ou mais', () => {
    const r = calcularEnergia({
      formula: 21, sexo: 'M', meses: 36, peso: 14.5, altura: 95, injuria: 3,
      programacaoPeso: { pesoDesejado: 15, dias: 90 },
    });
    // 88,5 − 185,7 + 1×1,2×(387,15 + 857,85) + 20 + trunc(0,5×7700/90 = 42,78) = 1416,8 + 42
    proximo(r.get, 88.5 - 61.9 * 3 + 1.2 * (26.7 * 14.5 + 903 * 0.95) + 20 + 42);
    assert.equal(r.corrigido, true);
  });
  await t.test('35 meses: ramo da TMB, sem correção', () => {
    const r = calcularEnergia({ formula: 21, sexo: 'M', meses: 35, peso: 14.5, altura: 95 });
    assert.equal(r.tela.tmb, '1211 Kcal/dia');
    assert.equal(r.tela.get, '1211 Kcal/dia');
    assert.equal(r.corrigido, false);
    assert.equal(r.aviso, null);
  });
  await t.test('37 meses: TMB "Não aplicável", lista de mais de 36 meses, sem correção', () => {
    const r = calcularEnergia({ formula: 21, sexo: 'M', meses: 37, peso: 14.5, altura: 95, fator: '1.13' });
    assert.equal(r.tela.tmb, 'Não aplicável');
    assert.equal(r.tela.fatores, ',1.00,1.13,1.26,1.42');
    proximo(r.get, 88.5 - 61.9 * 3 + 1.13 * (26.7 * 14.5 + 903 * 0.95) + 20);
    assert.equal(r.corrigido, false);
  });
  await t.test('CORRECOES documenta o item 1', () => {
    assert.ok(CORRECOES.some((c) => c.item === 1));
  });
});

test('§12 #6: Henry & Rees abaixo de 3 anos — TMB null e aviso', async (t) => {
  await t.test('2 anos (pela idade)', () => {
    const r = calcularEnergia({ formula: 9, sexo: 'M', idade: 2, peso: 12, fator: '1.000' });
    assert.equal(r.tmb, null);
    assert.equal(r.tmbArredondada, null);
    assert.equal(r.get, null);
    assert.equal(r.tela.tmb, '');
    assert.equal(r.tela.get, '');
    assert.equal(r.aviso, MENSAGENS.henryMenor3);
  });
  await t.test('um dia antes dos 3 anos (pelo nascimento)', () => {
    const r = calcularEnergia({
      formula: 9, sexo: 'F', nascimento: '14/10/2023', dataReferencia: HOJE, peso: 14, fator: '1.000',
    });
    assert.equal(r.idadeAnos, 2);
    assert.equal(r.tmb, null);
    assert.match(r.aviso, /§12, item 6/);
  });
  await t.test('exatamente 3 anos: equação de 3–10 anos', () => {
    const r = calcularEnergia({ formula: 9, sexo: 'M', meses: 36, peso: 14, fator: '1.000' });
    proximo(r.tmb, (0.113 * 14 + 1.689) * 239);
    assert.equal(r.tela.tmb, '782 Kcal/dia');
    assert.equal(r.aviso, null);
  });
  await t.test('CORRECOES documenta o item 6', () => {
    assert.ok(CORRECOES.some((c) => c.item === 6));
  });
});

// Paciente de E46–E49 (gestante) e E53/E54 (lactante).
const GESTANTE = Object.freeze({
  formula: 28, sexo: 'F', nascimento: '15/06/1996', dataReferencia: HOJE, peso: 68, altura: 165, semanas: 24,
  estadoNutricional: 'Saudável', fator: '2',
});
const LACTANTE = Object.freeze({
  formula: 29, sexo: 'F', nascimento: '15/06/1996', dataReferencia: HOJE, peso: 66, altura: 165,
});

test('§12 #2: EER 2023 gestante — só a disposição de energia é multiplicada pela injúria', () => {
  const sem = calcularEnergia(GESTANTE);
  assert.equal(sem.tela.get, '2691 Kcal/dia'); // E47
  const com = calcularEnergia({ ...GESTANTE, injuria: 4 }); // Sepse 1,3
  // 2491,04 (equação) + 200 × 1,3
  proximo(com.get, 2491.04 + 200 * 1.3);
  assert.equal(com.tela.get, '2751 Kcal/dia');
  assert.notEqual(com.tela.get, `${(2691.04 * 1.3).toFixed(0)} Kcal/dia`);
});

test('§12 #3: EER 2023 lactante — só o 140 (0–6 m) ou o 380 (7–12 m) é multiplicado pela injúria', () => {
  const ate6 = calcularEnergia({ ...LACTANTE, dataParto: '13/07/2026', fator: '1', injuria: 4 });
  assert.equal(ate6.mesesAmamentacao, 3);
  proximo(ate6.get, 2091.26 + 540 - 140 * 1.3);
  assert.equal(ate6.tela.get, '2449 Kcal/dia');
  const de7a12 = calcularEnergia({ ...LACTANTE, dataParto: '13/01/2026', fator: '4', injuria: 4 });
  assert.equal(de7a12.mesesAmamentacao, 9);
  proximo(de7a12.get, 2627.04 + 380 * 1.3);
  assert.equal(de7a12.tela.get, '3121 Kcal/dia');
});

test('§12 #4: EER 2023 infantil de 0–2,99 anos usa a idade em anos no termo de idade', () => {
  // Menina de 23 e de 24 meses, mesmo peso e estatura (ambas na faixa 12–35,99 m, custo 15):
  // a diferença é só o termo 80 × I, com I = 1 e I = 2 anos.
  const a = calcularEnergia({ formula: 27, sexo: 'F', meses: 23, peso: 11, altura: 85 });
  const b = calcularEnergia({ formula: 27, sexo: 'F', meses: 24, peso: 11, altura: 85 });
  assert.equal(a.idadeAnos, 1);
  assert.equal(b.idadeAnos, 2);
  proximo(b.get - a.get, 80);
  // E84 (menina de 30 meses): −69,15 + 80×2 + 2,65×88 + 54,15×12,5 + 15
  proximo(calcularEnergia(entradaDoCaso(casos.find((x) => x.caso.id === 'E84').caso)).get,
    -69.15 + 80 * 2 + 2.65 * 88 + 54.15 * 12.5 + 15);
});

test('§12 #5: injúria "Queimadura 100%" mostra 2,1 e usa 2,0', () => {
  const q = INJURIAS.find((o) => o.id === 12);
  assert.equal(q.nome, 'Queimadura 100%');
  assert.equal(q.valor, 2.0);
  assert.equal(q.valorRotulo, 2.1);
  const r = calcularEnergia(entradaDoCaso(casos.find((x) => x.caso.id === 'E32').caso));
  assert.equal(r.fatorInjuria, 2.0);
  assert.equal(r.tela.get, '6844 Kcal/dia'); // 1801 × 1,9 × 2,0 (com 2,1 seria 7186)
});

test('§12 #7: Katch-McArdle usa a lista de fatores da EER 2005', () => {
  assert.equal(listaFatores(3, { sexo: 'M' }), LISTAS_FATORES.eer2005M);
  assert.equal(listaFatores(3, { sexo: 'F' }), LISTAS_FATORES.eer2005F);
  assert.equal(listaFatores(3, { sexo: 'M' }), listaFatores(5, { sexo: 'M' }));
  // E03 pediu 1.550 (lista padrão): fora da lista do Katch-McArdle, o GET não é calculado.
  const r = calcularEnergia({ ...entradaDoCaso(casos.find((x) => x.caso.id === 'E03').caso), fator: '1.550' });
  assert.equal(r.tela.tmb, '1774 Kcal/dia');
  assert.equal(r.tela.get, MENSAGENS.escolhaFator);
  assert.equal(r.aviso, MENSAGENS.fatorForaDaLista);
});

test('§12 #8: Schofield, meninas de 3–10 anos, coeficiente da estatura 161,08', () => {
  const r = calcularEnergia(entradaDoCaso(casos.find((x) => x.caso.id === 'E72').caso));
  assert.equal(r.idadeAnos, 6);
  proximo(r.tmb, 16.969 * 21 + 161.08 * 1.16 + 371.2);
  assert.equal(r.tela.tmb, '914 Kcal/dia');
  assert.notEqual(r.tela.tmb, `${(16.969 * 21 + 161.8 * 1.16 + 371.2).toFixed(0)} Kcal/dia`); // 915
});

test('§12 #9: VENTA mostra o arredondado e aplica o truncado (também com sinal negativo)', () => {
  const p = programarPeso({ peso: 80, pesoDesejado: 75, dias: 60 });
  proximo(p.kcalDiaExato, (-5 * KCAL_POR_KG) / 60);
  assert.equal(p.kcalDia, -641);
  assert.equal(p.tela.r2, '(-642 Kcal/dia)');
});

test('DIVERGENCIAS lista os itens 2, 3, 4, 5, 7, 8 e 9, todos marcados no código', () => {
  assert.deepEqual(DIVERGENCIAS.map((d) => d.item), [2, 3, 4, 5, 7, 8, 9]);
  assert.deepEqual(CORRECOES.map((d) => d.item), [1, 6]);
  for (const d of DIVERGENCIAS) {
    assert.ok(d.descricao && d.comportamento, `item ${d.item} descrito`);
    assert.ok(fonte.includes(`// WebDiet §12 #${d.item}`), `comentário "// WebDiet §12 #${d.item}" no código`);
  }
});

// =============================================================================================
// PROTOCOLOS (formulário da interface)
// =============================================================================================

test('PROTOCOLOS: catálogo completo e coerente', async (t) => {
  const ids = PROTOCOLOS.map((p) => p.id);
  assert.deepEqual(ids, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 21, 22, 23, 24, 25, 26, 27, 28, 29]);
  const ENTRADAS = new Set(['sexo', 'nascimento', 'peso', 'altura', 'mlg', 'getManual', 'bolso', 'tmbInformada',
    'semanas', 'estadoNutricional', 'dataParto']);
  const TMB = new Set(['calculada', 'informada', 'nao_aplicavel', 'ate_36_meses']);
  for (const p of PROTOCOLOS) {
    await t.test(`${p.id} ${p.nome}`, () => {
      assert.ok(typeof p.nome === 'string' && p.nome.length > 0);
      for (const e of p.entradas) assert.ok(ENTRADAS.has(e), `entrada ${e}`);
      assert.ok(TMB.has(p.tmb), `tmb ${p.tmb}`);
      assert.ok(['multiplicador', 'categoria'].includes(p.tipoFator));
      for (const a of p.adicionais) assert.ok(['met', 'venta', 'gestante'].includes(a));
      const chaves = typeof p.fatores === 'string' ? [p.fatores] : Object.entries(p.fatores)
        .filter(([k]) => k !== 'ateMeses').map(([, v]) => v);
      for (const k of chaves) assert.ok(LISTAS_FATORES[k], `lista ${k}`);
      for (const sexo of ['M', 'F']) {
        for (const idadeMeses of [12, 36, 37, 420]) {
          const l = listaFatores(p.id, { sexo, idadeMeses });
          assert.ok(Object.values(LISTAS_FATORES).includes(l), `lista resolvida ${sexo} ${idadeMeses}`);
        }
      }
      assert.deepEqual(Object.keys(p.limites).sort(),
        ['foraDaFaixa', 'idadeMaxAnos', 'idadeMinAnos', 'mesesAmamentacaoMax', 'semanasMin', 'sexo']);
      assert.ok(Object.isFrozen(p));
      // Nunca lança exceção, mesmo sem dados.
      assert.doesNotThrow(() => calcularEnergia({ formula: p.id }));
    });
  }
  const por = (campo, valor) => PROTOCOLOS.filter((p) => p[campo] === valor).map((p) => p.id);
  assert.deepEqual(por('tmb', 'nao_aplicavel'), [5, 10, 11, 26, 27, 28, 29]);
  assert.deepEqual(por('tmb', 'ate_36_meses'), [21]);
  assert.deepEqual(por('tmb', 'informada'), [14, 24]);
  assert.deepEqual(por('tipoFator', 'categoria'), [26, 27, 28, 29]);
  assert.deepEqual(PROTOCOLOS.filter((p) => p.limites.sexo === 'F').map((p) => p.id), [25, 28, 29]);
  assert.deepEqual(PROTOCOLOS.find((p) => p.id === 21).adicionais, ['venta']);
  assert.deepEqual(PROTOCOLOS.find((p) => p.id === 28).adicionais, ['venta', 'met']);
});

test('PROTOCOLOS: "Não aplicável" na TMB coincide com a tela', () => {
  for (const { caso, tela } of casos) {
    const p = PROTOCOLOS.find((x) => x.id === caso.formula);
    const naoAplicavel = p.tmb === 'nao_aplicavel' || (p.tmb === 'ate_36_meses' && tela.fatores !== '1');
    assert.equal(tela.tmb === 'Não aplicável', naoAplicavel, caso.id);
  }
});

test('PROTOCOLOS: limites de idade e sexo', async (t) => {
  await t.test('Schofield acima de 18 anos: sem cálculo', () => {
    const r = calcularEnergia({ formula: 23, sexo: 'M', idade: 19, peso: 70, altura: 175, fator: '1.000' });
    assert.equal(r.tmb, null);
    assert.equal(r.aviso, MENSAGENS.schofieldMaior18);
    assert.notEqual(calcularEnergia({ formula: 23, sexo: 'M', idade: 18, peso: 70, altura: 175 }).tmb, null);
  });
  await t.test('Min. Saúde gestante com 10 anos: sem cálculo; com 11, calcula', () => {
    assert.equal(calcularEnergia({ formula: 25, sexo: 'F', idade: 10, peso: 40 }).tmb, null);
    proximo(calcularEnergia({ formula: 25, sexo: 'F', idade: 11, peso: 40 }).tmb, 12.2 * 40 + 746);
  });
  await t.test('Min. Saúde gestante com sexo masculino: calcula e avisa', () => {
    const r = calcularEnergia({ formula: 25, sexo: 'M', idade: 30, peso: 60, fator: '1.0' });
    proximo(r.tmb, 14.7 * 60 + 496);
    assert.equal(r.aviso, MENSAGENS.somenteFeminino);
  });
  await t.test('EER 2023 adultos com 18 anos: calcula e avisa', () => {
    const r = calcularEnergia({ formula: 26, sexo: 'M', idade: 18, peso: 70, altura: 175, fator: '2' });
    proximo(r.get, 581.47 - 10.83 * 18 + 8.30 * 175 + 14.94 * 70);
    assert.equal(r.aviso, MENSAGENS.eer2023AdultoMenor19);
  });
  await t.test('EER 2023 infantil com 19 anos: sem cálculo', () => {
    const r = calcularEnergia({ formula: 27, sexo: 'M', idade: 19, peso: 70, altura: 175, fator: '2' });
    assert.equal(r.get, null);
    assert.equal(r.aviso, MENSAGENS.eer2023InfantilMaior19);
  });
});

// =============================================================================================
// Entradas, adicionais e mensagens
// =============================================================================================

test('idade por `idade`/`meses` equivale a nascimento + data', async (t) => {
  for (const [id, idade] of [['E01', { idade: 35 }], ['E89', { meses: 2 }], ['E84', { meses: 30 }],
    ['E109', { meses: 36 }], ['E58', { idade: 16, meses: 200 }]]) {
    await t.test(`${id} com ${JSON.stringify(idade)}`, () => {
      const { caso, tela } = casos.find((x) => x.caso.id === id);
      const { nascimento, dataReferencia, ...resto } = entradaDoCaso(caso);
      const r = calcularEnergia({ ...resto, ...idade });
      for (const campo of CAMPOS) assert.equal(r.tela[campo], tela[campo], `${id}.${campo}`);
    });
  }
  await t.test('só `idade` numa fórmula por meses: meses = anos × 12, com aviso', () => {
    const r = calcularEnergia({ formula: 21, sexo: 'M', idade: 1, peso: 10, altura: 75 });
    assert.equal(r.idadeMeses, 12);
    assert.equal(r.aviso, MENSAGENS.mesesEstimados);
  });
  await t.test('`dataExame` tem precedência sobre `dataReferencia` na idade', () => {
    const r = calcularEnergia({ ...entradaDoCaso(casos[0].caso), dataExame: '13/10/2020' });
    assert.equal(r.idadeAnos, 29);
  });
  await t.test('sem data, data inválida ou nascimento no futuro: aviso e nada calculado', () => {
    const base = { formula: 1, sexo: 'M', peso: 80, altura: 175, fator: '1.550' };
    assert.equal(calcularEnergia({ ...base, nascimento: '15/06/1991' }).aviso, MENSAGENS.dataReferenciaAusente);
    assert.equal(calcularEnergia({ ...base, nascimento: '31/13/1991', dataReferencia: HOJE }).aviso, MENSAGENS.nascimentoInvalido);
    assert.equal(calcularEnergia({ ...base, nascimento: '15/06/2030', dataReferencia: HOJE }).aviso, MENSAGENS.idadeNegativa);
    assert.equal(calcularEnergia(base).aviso, MENSAGENS.idadeAusente);
    assert.equal(calcularEnergia(base).get, null);
  });
});

test('fator atividade: sem fator, TMB calculada e GET "Escolha o fator atividade"', () => {
  const { fator, ...semFator } = entradaDoCaso(casos[0].caso);
  const r = calcularEnergia(semFator);
  assert.equal(r.tela.tmb, '1806 Kcal/dia');
  assert.equal(r.tela.get, 'Escolha o fator atividade');
  assert.equal(r.tela.getkg, '0.0 Kcal/kg');
  assert.equal(r.get, null);
  assert.equal(r.aviso, MENSAGENS.escolhaFator);
  // Lista de opção única dispensa o fator (fórmula 22 até 36 meses, fórmula 11).
  assert.equal(calcularEnergia({ formula: 22, sexo: 'M', meses: 30, peso: 13 }).fatorAtividade, 1);
});

test('fator injúria desconhecido e fórmula desconhecida: aviso, sem exceção', () => {
  assert.equal(calcularEnergia({ ...entradaDoCaso(casos[0].caso), injuria: 99 }).aviso, MENSAGENS.injuriaDesconhecida);
  const r = calcularEnergia({ formula: 15, peso: 80 });
  assert.equal(r.formula, null);
  assert.equal(r.aviso, MENSAGENS.formulaDesconhecida);
  assert.equal(r.tela.fatores, ',1.000,1.200,1.375,1.550,1.725,1.900'); // fórmula vazia: lista padrão
  assert.doesNotThrow(() => calcularEnergia());
  assert.equal(calcularEnergia({ ...entradaDoCaso(casos[0].caso), sexo: '' }).aviso, MENSAGENS.sexoAusente);
});

test('EER 2023 gestante: dados faltando, 1º trimestre, estado nutricional e adicional gestante', () => {
  const semSemanas = calcularEnergia({ ...GESTANTE, semanas: 0 });
  assert.equal(semSemanas.get, null);
  assert.equal(semSemanas.tela.erro, MENSAGENS.gestanteDados);
  assert.equal(semSemanas.tela.get, MENSAGENS.escolhaFator);
  const primeiro = calcularEnergia({ ...GESTANTE, semanas: 13 });
  assert.equal(primeiro.tela.erro, MENSAGENS.primeiroTrimestre);
  assert.equal(primeiro.get, null);
  assert.equal(calcularEnergia({ ...GESTANTE, semanas: 14 }).tela.erro, '');
  // Estado nutricional sem acento/caixa; as quatro disposições.
  assert.equal(calcularEnergia({ ...GESTANTE, estadoNutricional: 'saudavel' }).tela.get, '2691 Kcal/dia');
  assert.deepEqual(Object.values(DISPOSICAO_GESTANTE), [300, 200, 150, -50]);
  // §4.4.5/§4.7: o adicional gestante não entra; aviso. VENTA e MET entram.
  const comAdicional = calcularEnergia({ ...GESTANTE, adicionalGestante: 300 });
  assert.equal(comAdicional.tela.get, '2691 Kcal/dia');
  assert.equal(comAdicional.adicionais.gestante, null);
  assert.equal(comAdicional.tela.gest, '300 Kcal/dia');
  assert.equal(comAdicional.aviso, MENSAGENS.gestanteAdicional);
  const comMet = calcularEnergia({ ...GESTANTE, atividades: [{ met: 3, minutos: 60 }] });
  proximo(comMet.get, 2691.04 + 204);
});

test('EER 2023 lactante: meses de amamentação, mais de 12 meses e menor de 19 anos', () => {
  const porMeses = calcularEnergia({ ...LACTANTE, mesesAmamentacao: 3, fator: '1' });
  assert.equal(porMeses.tela.get, '2491 Kcal/dia'); // = E53
  // Meses contados sem olhar o dia (§4.4.6): 31/07 → 01/10 = (10 − 7) = 3 meses.
  assert.equal(calcularEnergia({ ...LACTANTE, dataReferencia: '01/10/2026', dataParto: '31/07/2026', fator: '1' })
    .mesesAmamentacao, 3);
  const mais12 = calcularEnergia({ ...LACTANTE, dataParto: '13/09/2025', fator: '1' });
  assert.equal(mais12.mesesAmamentacao, 13);
  assert.equal(mais12.get, null);
  assert.equal(mais12.tela.erro, MENSAGENS.lactacaoMaior12);
  // 12 meses ainda vale (faixa 7–12): 2091,26 + 380.
  const doze = calcularEnergia({ ...LACTANTE, dataParto: '13/10/2025', fator: '1' });
  assert.equal(doze.mesesAmamentacao, 12);
  assert.equal(doze.tela.get, '2471 Kcal/dia');
  assert.equal(calcularEnergia({ ...LACTANTE, fator: '1' }).tela.erro, MENSAGENS.partoAusente);
  assert.equal(calcularEnergia({ ...LACTANTE, dataParto: '13/11/2026', fator: '1' }).tela.erro, MENSAGENS.partoFuturo);
});

test('adicionais: MET, VENTA e gestante somam no GET padrão; na EER/IOM 2005 infantil só a VENTA', () => {
  const base = entradaDoCaso(casos.find((x) => x.caso.id === 'E02').caso); // TMB 1801, fator 1,55
  const r = calcularEnergia({
    ...base,
    atividades: [{ met: 4, minutos: 30 }],
    programacaoPeso: { pesoDesejado: 78 },
    adicionalGestante: 250,
  });
  // 1801 × 1,55 + 160 + trunc(−2 × 7700 / 90 = −171,1) + 250
  proximo(r.get, 1801 * 1.55 + 160 - 171 + 250);
  assert.deepEqual(r.adicionais, { met: 160, venta: -171, gestante: 250 });
  assert.equal(r.tela.met, '160 Kcal/dia');
  assert.equal(r.tela.venta, '-171 Kcal/dia');
  assert.equal(r.tela.gest, '250 Kcal/dia');

  const infantil = calcularEnergia({
    ...entradaDoCaso(casos.find((x) => x.caso.id === 'E58').caso),
    atividades: [{ met: 4, minutos: 30 }],
    adicionalGestante: 250,
  });
  assert.equal(infantil.tela.get, '2749 Kcal/dia'); // = E58
  assert.deepEqual(infantil.adicionais, { met: null, venta: null, gestante: null });
  assert.equal(infantil.aviso, MENSAGENS.eerInfantilSoVenta);
});

test('programarPeso: faixa de ±20%, prazo, sem peso e padrão de 90 dias', () => {
  assert.equal(programarPeso({ peso: 80, pesoDesejado: 63 }).aviso, MENSAGENS.ventaPesoForaDaFaixa);
  assert.equal(programarPeso({ peso: 80, pesoDesejado: 97 }).kcalDia, null);
  assert.equal(programarPeso({ peso: 80, pesoDesejado: 75, dias: 0 }).aviso, MENSAGENS.ventaDiasForaDaFaixa);
  assert.equal(programarPeso({ peso: 80, pesoDesejado: 75, dias: 181 }).aviso, MENSAGENS.ventaDiasForaDaFaixa);
  assert.equal(programarPeso({ peso: 80, pesoDesejado: 64 }).dias, 90);
  assert.equal(programarPeso({ peso: 80, pesoDesejado: 64 }).aviso, null);
  const semPeso = programarPeso({ pesoDesejado: 55 }); // sem peso, usa 50 kg
  assert.equal(semPeso.tela.r1, 'Total de +5.0 Kg em 90 dias');
  assert.equal(semPeso.tela.sliderMax, '60');
  // Peso desejado aceito nos extremos mesmo com erro de ponto flutuante (70,2 × 0,8).
  assert.equal(programarPeso({ peso: 70.2, pesoDesejado: 56.16 }).aviso, null);
  // Aviso da VENTA chega ao resultado do cálculo, e o GET sai sem ela.
  const r = calcularEnergia({ ...PACIENTE_EXTRAS, programacaoPeso: { pesoDesejado: 50 } });
  assert.equal(r.aviso, MENSAGENS.ventaPesoForaDaFaixa);
  assert.equal(r.tela.venta, 'Programar peso');
  assert.equal(r.tela.get, '2792 Kcal/dia');
});

test('fórmulas sem evidência na tela: TMB manual (14), HandyMET (24), GET manual e bolso sem dados', () => {
  // TMB digitada 1702,4: exibida 1702 (é a que entra no GET); kcal/kg com a digitada (21,28).
  const manual = calcularEnergia({ formula: 14, peso: 80, tmbInformada: 1702.4, fator: '1.200' });
  assert.equal(manual.tela.tmb, '1702 Kcal/dia');
  assert.equal(manual.tela.tmbkg, '(21.3 Kcal/kg)');
  proximo(manual.get, 1702 * 1.2);
  assert.equal(manual.tela.get, '2042 Kcal/dia');
  // HandyMET (§4.3): TMB × fator × injúria + 0,1 × TMB.
  const handy = calcularEnergia({ formula: 24, peso: 80, tmbInformada: 1700, fator: '1.5' });
  proximo(handy.get, 1700 * 1.5 + 170);
  assert.equal(handy.tela.fatores, ',1.0,1.2,1.5,1.7,2.1');
  assert.equal(calcularEnergia({ formula: 14, peso: 80, fator: '1.200' }).aviso, MENSAGENS.tmbAusente);
  assert.equal(calcularEnergia({ formula: 10, peso: 80, fator: '1.200' }).aviso, MENSAGENS.getManualAusente);
  assert.equal(calcularEnergia({ formula: 11, peso: 80 }).aviso, MENSAGENS.bolsoAusente);
  assert.equal(calcularEnergia({ formula: 11, peso: 80 }).tela.tmb, 'Não aplicável');
});

test('Katch-McArdle sem MLG e cálculo sem peso', () => {
  const k = calcularEnergia({ formula: 3, sexo: 'M', peso: 80, mlg: '', fator: '1.11' });
  assert.equal(k.tela.tmb, MENSAGENS.mlgEmBranco);
  assert.equal(k.tmb, null);
  assert.equal(k.aviso, MENSAGENS.mlgEmBranco);
  const semPeso = calcularEnergia({ formula: 4, mlg: 60, fator: '1.200' });
  assert.equal(semPeso.tela.tmb, '1820 Kcal/dia');
  assert.equal(semPeso.tela.tmbkg, '');
  assert.equal(semPeso.tela.getkg, '');
  assert.equal(semPeso.getArredondado, 2184);
  assert.equal(semPeso.aviso, MENSAGENS.pesoAusente);
});

test('calcularMet e números lidos como no WebDiet (vírgula decimal, vazio = 0)', () => {
  assert.deepEqual(calcularMet({ peso: 80 }), { kcal: 0, tela: '0 Kcal/dia' });
  assert.equal(calcularMet({ peso: '80', atividades: [{ met: '6,0', minutos: '30' }] }).kcal, 240);
  const r = calcularEnergia({ ...entradaDoCaso(casos[0].caso), peso: '80,0', altura: '175', fator: '1,55' });
  assert.equal(r.tela.get, '2799 Kcal/dia');
});
