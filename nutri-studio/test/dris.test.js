// Referências de micronutrientes por perfil (relatório §8.3 e §8.10). Compara com os 15 perfis vistos na tela
// (docs/webdiet-evidencias/tela_dris.json) e com o homem de 35 anos do planejamento
// (tela_planejamento_alimentos.json); confere as faixas não observadas contra a tabela oficial (NASEM) e
// testa §12 #24.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  referenciasMicros,
  validarDris,
  NUTRIENTES,
  CHAVES_MICROS,
  FONTES,
  AVISO_DADOS_INVALIDOS,
  AVISO_SEM_FAIXA,
  DIVERGENCIAS,
} from '../src/calc/dris.js';
import DRIS from '../src/dados/dris.json' with { type: 'json' };

const ler = (nome) => JSON.parse(fs.readFileSync(new URL(`../../docs/webdiet-evidencias/${nome}`, import.meta.url), 'utf8'));
const evDris = ler('tela_dris.json');
const evPlan = ler('tela_planejamento_alimentos.json');

// Data em que as referências foram lidas (data da análise, relatório: 13/10/2026).
const DATA = '13/10/2026';

/** Estágio esperado para cada perfil da evidência (sexo, nascimento, condição). */
const ESPERADO = {
  'F|15/06/1991|nao_gestante': 'F_31-50a',
  'F|15/06/1991|gestante': 'gestante_31-50a',
  'F|15/06/1991|lactante': 'lactante_31-50a',
  'M|15/06/2010|': 'M_14-18a',
  'F|15/06/2010|nao_gestante': 'F_14-18a',
  'M|15/06/2016|': 'M_9-13a',
  'F|15/06/2016|nao_gestante': 'F_9-13a',
  'M|15/06/2021|': 'crianca_4-8a',
  'M|15/06/2024|': 'crianca_1-3a',
  'M|15/06/2026|': 'lactente_0-6m',
  'M|15/06/1971|': 'M_51-70a',
  'F|15/06/1971|nao_gestante': 'F_51-70a',
  'M|15/06/1951|': 'M_71+a',
  'F|15/06/1951|nao_gestante': 'F_71+a',
  'F|15/06/2008|gestante': 'gestante_<=18a',
};

test('evidência: os 15 perfis de tela_dris.json, 27 referências cada', async (t) => {
  assert.equal(evDris.length, 15);
  for (const caso of evDris) {
    const [sexo, nascimento, condicao] = caso.perfil;
    await t.test(caso.perfil.join(' '), () => {
      const r = referenciasMicros({ sexo, nascimento, condicao, dataReferencia: DATA });
      assert.equal(r.estagio, ESPERADO[caso.perfil.join('|')]);
      assert.equal(r.fonte, FONTES.webdiet);
      assert.equal(r.aviso, null);
      assert.equal(Object.keys(caso.refs).length, 27);
      for (const [campo, texto] of Object.entries(caso.refs)) {
        if (r.estagio === 'lactente_0-6m' && campo === 'micro15') {
          // §12 #24: o WebDiet mostra "15 mg"; o valor (15) é o mesmo e o rótulo sai em mcg.
          assert.equal(texto, '15 mg');
          assert.equal(r.valores[14], parseFloat(texto));
          assert.equal(r.tela.micro15, '15 mcg');
          continue;
        }
        assert.equal(r.tela[campo], texto, campo);
      }
    });
  }
});

test('evidência: homem de 35 anos (coluna de referência do planejamento por alimentos)', () => {
  const r = referenciasMicros({ sexo: 'M', nascimento: '15/06/1991', dataReferencia: DATA });
  assert.equal(r.estagio, 'M_31-50a');
  assert.equal(r.idadeAnos, 35);
  for (const meta of evPlan.refs) {
    meta.tela.micros.forEach(([, , ref], i) => assert.equal(r.tela[`micro${i + 1}`], ref, `micro${i + 1}`));
  }
  // relatório §8.3: tabela do homem de 35 anos
  const tabela = { fibras: 38, ca: 1000, mg: 420, p: 700, fe: 8, na: 1500, k: 3400, co: 0.9, zn: 11, se: 55,
    rea: 900, vitb9: 400, vitb12: 2.4, tiamina: 1.2, riboflavina: 1.3, piridoxina: 1.3, niacina: 16, vitc: 90, vitd: 15, vite: 15 };
  for (const [chave, valor] of Object.entries(tabela)) assert.equal(r.valores[CHAVES_MICROS.indexOf(chave)], valor, chave);
});

test('fixos em todos os perfis: mono/poli/saturada sem referência, trans e álcool "0", colesterol e retinol "N/D"', () => {
  for (const e of DRIS.estagios) {
    const r = referenciasMicros({ sexo: e.sexo ?? 'F', idadeAnos: e.idade.unidade === 'anos' ? e.idade.max ?? 80 : 0,
      idadeMeses: e.idade.unidade === 'meses' ? e.idade.min : undefined, condicao: e.condicao });
    assert.equal(r.estagio, e.id);
    assert.deepEqual([r.tela.micro1, r.tela.micro2, r.tela.micro3], ['', '', '']);
    assert.deepEqual([r.tela.micro4, r.tela.micro27], ['0', '0']);
    assert.deepEqual([r.tela.micro5, r.tela.micro16], ['N/D', 'N/D']);
    assert.deepEqual([r.valores[0], r.valores[3], r.valores[4]], [null, 0, 'N/D']);
  }
});

// Valores oficiais (NASEM; Na/K NASEM 2019 via Health Canada; fibras Health Canada) das faixas que o WebDiet
// não mostrou. Ordem: fibras; Ca; Mg; P; Fe; Na; K; Cu; Zn; Se; RAE; folato; B12; B1; B2; B6; niacina; C; D; E.
const ORDEM_OFICIAL = ['fibras', 'ca', 'mg', 'p', 'fe', 'na', 'k', 'co', 'zn', 'se', 'rea', 'vitb9', 'vitb12',
  'tiamina', 'riboflavina', 'piridoxina', 'niacina', 'vitc', 'vitd', 'vite'];
const OFICIAIS = [
  ['7–12 meses (M)', { sexo: 'M', idadeMeses: 9 }, 'lactente_7-12m', ['N/D', 260, 75, 275, 11, 370, 860, 0.22, 3, 20, 500, 80, 0.5, 0.3, 0.4, 0.3, 4, 50, 10, 5]],
  ['7–12 meses (F)', { sexo: 'F', idadeMeses: 7 }, 'lactente_7-12m', ['N/D', 260, 75, 275, 11, 370, 860, 0.22, 3, 20, 500, 80, 0.5, 0.3, 0.4, 0.3, 4, 50, 10, 5]],
  ['meninas 1–3 anos', { sexo: 'F', idadeAnos: 2 }, 'crianca_1-3a', [19, 700, 80, 460, 7, 800, 2000, 0.34, 3, 20, 300, 150, 0.9, 0.5, 0.5, 0.5, 6, 15, 15, 6]],
  ['meninas 4–8 anos', { sexo: 'F', idadeAnos: 5 }, 'crianca_4-8a', [25, 1000, 130, 500, 10, 1000, 2300, 0.44, 5, 30, 400, 200, 1.2, 0.6, 0.6, 0.6, 8, 25, 15, 7]],
  ['homens 19–30', { sexo: 'M', idadeAnos: 25 }, 'M_19-30a', [38, 1000, 400, 700, 8, 1500, 3400, 0.9, 11, 55, 900, 400, 2.4, 1.2, 1.3, 1.3, 16, 90, 15, 15]],
  ['mulheres 19–30', { sexo: 'F', idadeAnos: 25 }, 'F_19-30a', [25, 1000, 310, 700, 18, 1500, 2600, 0.9, 8, 55, 700, 400, 2.4, 1.1, 1.1, 1.3, 14, 75, 15, 15]],
  ['gestante 19–30', { sexo: 'F', idadeAnos: 25, condicao: 'gestante' }, 'gestante_19-30a', [28, 1000, 350, 700, 27, 1500, 2900, 1.0, 11, 60, 770, 600, 2.6, 1.4, 1.4, 1.9, 18, 85, 15, 15]],
  ['lactante ≤ 18', { sexo: 'F', idadeAnos: 17, condicao: 'lactante' }, 'lactante_<=18a', [29, 1300, 360, 1250, 10, 1500, 2500, 1.3, 13, 70, 1200, 500, 2.8, 1.4, 1.6, 2.0, 17, 115, 15, 19]],
  ['lactante 19–30', { sexo: 'F', idadeAnos: 25, condicao: 'lactante' }, 'lactante_19-30a', [29, 1000, 310, 700, 9, 1500, 2800, 1.3, 12, 70, 1300, 500, 2.8, 1.4, 1.6, 2.0, 17, 120, 15, 19]],
];

test('faixas não observadas no WebDiet: valores oficiais NASEM e fonte "nasem-oficial"', async (t) => {
  for (const [nome, perfil, estagio, valores] of OFICIAIS) {
    await t.test(nome, () => {
      const r = referenciasMicros(perfil);
      assert.equal(r.estagio, estagio);
      assert.equal(r.fonte, FONTES.nasem);
      ORDEM_OFICIAL.forEach((chave, i) => assert.equal(r.valores[CHAVES_MICROS.indexOf(chave)], valores[i], chave));
    });
  }
});

test('textos da tela: número como String + unidade; "N/D" sem unidade', () => {
  const bebe = referenciasMicros({ sexo: 'M', idadeMeses: 9 });
  assert.equal(bebe.tela.micro6, 'N/D');
  assert.equal(bebe.tela.micro10, '11 mg');
  assert.equal(bebe.tela.micro13, '0.22 mg');
  assert.equal(bebe.tela.micro15, '20 mcg');
  assert.equal(referenciasMicros({ sexo: 'F', idadeAnos: 25, condicao: 'gestante' }).tela.micro13, '1 mg');
  assert.equal(referenciasMicros({ sexo: 'M', idadeMeses: 3 }).tela.micro10, '0.27 mg');
});

test('cada um dos 22 estágios de vida do IOM, com a fonte certa', () => {
  const W = FONTES.webdiet, N = FONTES.nasem;
  const casos = [
    [{ sexo: 'F', idadeMeses: 3 }, 'lactente_0-6m', W],
    [{ sexo: 'M', idadeMeses: 8 }, 'lactente_7-12m', N],
    [{ sexo: 'M', idadeAnos: 1 }, 'crianca_1-3a', W],
    [{ sexo: 'F', idadeAnos: 3 }, 'crianca_1-3a', N],
    [{ sexo: 'M', idadeAnos: 8 }, 'crianca_4-8a', W],
    [{ sexo: 'F', idadeAnos: 4 }, 'crianca_4-8a', N],
    [{ sexo: 'M', idadeAnos: 9 }, 'M_9-13a', W],
    [{ sexo: 'M', idadeAnos: 14 }, 'M_14-18a', W],
    [{ sexo: 'M', idadeAnos: 19 }, 'M_19-30a', N],
    [{ sexo: 'M', idadeAnos: 31 }, 'M_31-50a', W],
    [{ sexo: 'M', idadeAnos: 51 }, 'M_51-70a', W],
    [{ sexo: 'M', idadeAnos: 71 }, 'M_71+a', W],
    [{ sexo: 'F', idadeAnos: 13 }, 'F_9-13a', W],
    [{ sexo: 'F', idadeAnos: 18 }, 'F_14-18a', W],
    [{ sexo: 'F', idadeAnos: 30 }, 'F_19-30a', N],
    [{ sexo: 'F', idadeAnos: 50 }, 'F_31-50a', W],
    [{ sexo: 'F', idadeAnos: 70 }, 'F_51-70a', W],
    [{ sexo: 'F', idadeAnos: 99 }, 'F_71+a', W],
    [{ sexo: 'F', idadeAnos: 15, condicao: 'gestante' }, 'gestante_<=18a', W],
    [{ sexo: 'F', idadeAnos: 19, condicao: 'gestante' }, 'gestante_19-30a', N],
    [{ sexo: 'F', idadeAnos: 50, condicao: 'gestante' }, 'gestante_31-50a', W],
    [{ sexo: 'F', idadeAnos: 18, condicao: 'lactante' }, 'lactante_<=18a', N],
    [{ sexo: 'F', idadeAnos: 30, condicao: 'lactante' }, 'lactante_19-30a', N],
    [{ sexo: 'F', idadeAnos: 31, condicao: 'lactante' }, 'lactante_31-50a', W],
  ];
  for (const [perfil, estagio, fonte] of casos) {
    const r = referenciasMicros(perfil);
    assert.equal(r.estagio, estagio, JSON.stringify(perfil));
    assert.equal(r.fonte, fonte, JSON.stringify(perfil));
  }
  assert.equal(new Set(casos.map((c) => c[1])).size, 22);
  assert.equal(DRIS.estagios.length, 22);
});

test('limites de faixa: idade completa na data de referência (troca no aniversário)', () => {
  const est = (nascimento, sexo = 'M') => referenciasMicros({ sexo, nascimento, dataReferencia: DATA }).estagio;
  assert.equal(est('14/04/2026'), 'lactente_0-6m'); // 5 meses
  assert.equal(est('13/04/2026'), 'lactente_0-6m'); // 6 meses
  assert.equal(est('13/03/2026'), 'lactente_7-12m'); // 7 meses
  assert.equal(est('14/10/2025'), 'lactente_7-12m'); // 11 meses
  assert.equal(est('13/10/2025'), 'crianca_1-3a'); // 1 ano
  assert.equal(est('14/10/2022'), 'crianca_1-3a'); // 3 anos (faz 4 amanhã)
  assert.equal(est('13/10/2022'), 'crianca_4-8a'); // 4 anos
  assert.equal(est('14/10/2007'), 'M_14-18a'); // 18 anos
  assert.equal(est('13/10/2007'), 'M_19-30a'); // 19 anos
  assert.equal(est('14/10/1955', 'F'), 'F_51-70a'); // 70 anos
  assert.equal(est('13/10/1955', 'F'), 'F_71+a'); // 71 anos
});

test('condição: só vale para o sexo F; acima de 50 anos não há faixa', () => {
  assert.equal(referenciasMicros({ sexo: 'M', idadeAnos: 35, condicao: 'gestante' }).estagio, 'M_31-50a');
  assert.equal(referenciasMicros({ sexo: 'F', idadeAnos: 35, condicao: 'nao_gestante' }).estagio, 'F_31-50a');
  const r = referenciasMicros({ sexo: 'F', idadeAnos: 51, condicao: 'lactante' });
  assert.equal(r.estagio, null);
  assert.equal(r.valores, null);
  assert.equal(r.aviso, AVISO_SEM_FAIXA);
});

test('dados inválidos: aviso, sem valores', () => {
  assert.equal(referenciasMicros({ sexo: 'X', idadeAnos: 30 }).aviso, AVISO_DADOS_INVALIDOS);
  assert.equal(referenciasMicros({ sexo: 'F', nascimento: '31/02', dataReferencia: DATA }).aviso, AVISO_DADOS_INVALIDOS);
  assert.equal(referenciasMicros({ sexo: 'F', idadeAnos: 0 }).aviso, AVISO_DADOS_INVALIDOS);
  assert.equal(referenciasMicros({ sexo: 'masculino', idadeAnos: 30 }).estagio, 'M_19-30a');
});

test('estrutura de dris.json e §12 #24', () => {
  assert.deepEqual(validarDris(), []);
  assert.equal(NUTRIENTES.length, 27);
  assert.equal(NUTRIENTES[14].unidade, 'mcg');
  assert.deepEqual(validarDris({ ...DRIS, estagios: [{ ...DRIS.estagios[0], fonte: 'outra' }] }), [`${DRIS.estagios[0].id}: fonte inválida`]);
  // os 15 perfis + o homem de 35 anos são "webdiet-conferido"; as 8 faixas da tabela oficial são "nasem-oficial"
  const fontes = DRIS.estagios.flatMap((e) => (typeof e.fonte === 'string' ? [e.fonte] : [e.fonte.M, e.fonte.F]));
  assert.equal(fontes.filter((f) => f === FONTES.webdiet).length, 16);
  assert.equal(fontes.filter((f) => f === FONTES.nasem).length, 8);
  assert.deepEqual(DIVERGENCIAS.map((d) => d.item), [24]);
});
