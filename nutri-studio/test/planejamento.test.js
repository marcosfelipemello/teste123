// Planejamento por alimentos (relatório §8.3–8.4). Compara linha a linha, refeição a refeição e campo a campo
// com o que o WebDiet mostrou (docs/webdiet-evidencias/tela_planejamento_alimentos.json) e testa §12 #20.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  calcularPlanejamento,
  calcularLinha,
  calcularRefeicao,
  calcularMetas,
  adequar,
  classificarDensidade,
  tabelaMicros,
  ajustarSubstitutos,
  medidaDoAlimento,
  refeicaoAtiva,
  CORES,
  DIVERGENCIAS,
} from '../src/calc/planejamento.js';
import { referenciasMicros } from '../src/calc/dris.js';

const ev = JSON.parse(
  fs.readFileSync(new URL('../../docs/webdiet-evidencias/tela_planejamento_alimentos.json', import.meta.url), 'utf8'),
);
// Os mesmos planos abertos na conta em 13/10/2026 (só leitura): campos que a evidência acima não registrou.
const conta = JSON.parse(
  fs.readFileSync(new URL('../../docs/webdiet-evidencias/tela_planejamento_metas_conta.json', import.meta.url), 'utf8'),
);
const RESUMO = Object.fromEntries(Object.entries(conta.alimentos.tela).filter(([k]) => /Resumo$/.test(k)));

// Paciente de teste do relatório: masculino, nascido em 15/06/1991, data da análise 13/10/2026 (35 anos).
const REFS_H35 = referenciasMicros({ sexo: 'M', nascimento: '15/06/1991', dataReferencia: '13/10/2026' });

/** Monta as refeições da evidência no formato de entrada do módulo. */
function refeicoesDaEvidencia(ativos) {
  return ev.refeicoes.map((r, i) => ({
    nome: `Refeição ${i + 1}`,
    ativo: ativos[i],
    itens: r.linhas.map((l) => ({ alimento: ev.alimentos[l.id], quantidade: l.qtd, medida: l.medida })),
  }));
}

test('evidência: linhas, totais das refeições e tela do dia (2 tipos de meta), campo a campo', async (t) => {
  assert.equal(ev.refs.length, 2);
  for (const meta of ev.refs) {
    await t.test(`meta ${meta.tipo}`, async (tm) => {
      const r = calcularPlanejamento(
        { refeicoes: refeicoesDaEvidencia(meta.tela.ativos), metas: meta, referencias: REFS_H35 },
      );
      assert.equal(r.refeicoes.length, ev.refeicoes.length);
      for (const [i, refeicao] of ev.refeicoes.entries()) {
        await tm.test(`refeição ${i + 1}`, () => {
          assert.equal(r.refeicoes[i].linhas.length, refeicao.linhas.length);
          refeicao.linhas.forEach((linha, j) => {
            for (const [campo, valor] of Object.entries(linha)) {
              assert.equal(r.refeicoes[i].linhas[j].tela[campo], valor, `linha ${j + 1} ${campo}`);
            }
            assert.deepEqual(r.refeicoes[i].linhas[j].tela, linha);
          });
          for (const [campo, valor] of Object.entries(refeicao.tot)) {
            assert.equal(r.refeicoes[i].tela[campo], valor, `total ${campo}`);
          }
          assert.deepEqual(r.refeicoes[i].tela, refeicao.tot);
        });
      }
      await tm.test('tela do dia: prescrito, análise, metas, adequação, cores', () => {
        for (const [campo, valor] of Object.entries(meta.tela)) {
          if (['cores', 'micros', 'ativos', 'totalMacros'].includes(campo)) continue;
          assert.equal(r.tela[campo], valor, campo);
        }
        assert.deepEqual(r.tela.cores, meta.tela.cores);
        assert.deepEqual(r.tela.ativos, meta.tela.ativos);
        assert.deepEqual(r.tela.totalMacros, meta.tela.totalMacros);
        assert.deepEqual(r.totalMacros, meta.tela.totalMacros);
      });
      await tm.test('27 micronutrientes: valor, % e referência', () => {
        assert.equal(meta.tela.micros.length, 27);
        meta.tela.micros.forEach((linha, k) => assert.deepEqual(r.tela.micros[k], linha, `micro ${k + 1}`));
      });
      // + os 4 campos "Resumo" (barra do topo), vistos na conta com os mesmos totais e peso 80
      await tm.test('tela inteira igual à evidência', () => assert.deepEqual(r.tela, { ...meta.tela, ...RESUMO }));
    });
  }
});

test('§8.4 exemplo conferido (almoço): números do relatório', () => {
  const r = calcularRefeicao({ itens: refeicoesDaEvidencia(['true', 'true', 'false'])[1].itens });
  assert.equal(r.linhas.map((l) => l.peso).join(','), '120,150,120,8');
  assert.equal(Number(r.tela.peso.replace('g', '')), 398);
  assert.equal(r.tela.ptn, '37.1g');
  assert.equal(r.tela.lip, '23.5g');
  assert.equal(r.tela.cho, '54.8g');
  assert.equal(r.tela.kcal, '587 Kcal');
  assert.equal(r.total.densidade, 1.47);
  assert.equal(r.total.classe, 'baixa');
  assert.deepEqual(r.total.percentuais, { ptn: 25.3, lip: 36.1, cho: 38.6 });
});

test('regras de arredondamento que a evidência fixa', async (t) => {
  const refeicoes = refeicoesDaEvidencia(['true', 'true', 'false']);
  await t.test('peso da linha guardado com 1 casa (1,5 × 165 = 247,5 mL)', () => {
    const l = calcularLinha(refeicoes[0].itens[1]);
    assert.equal(l.peso, 247.5);
    assert.equal(l.tela.peso, '247.5ml');
  });
  await t.test('%CHO da refeição = 100 − %PTN − %LIP arredondados (65.3, não 65.4)', () => {
    const r = calcularRefeicao(refeicoes[0]);
    assert.equal(r.total.percentuais.cho, 65.3);
    const direto = 100 - (r.total.ptn * 4 / r.total.kcal) * 100 - (r.total.lip * 9 / r.total.kcal) * 100;
    assert.equal(direto.toFixed(1), '65.4');
  });
  await t.test('densidade usa a kcal sem arredondar (259.4/190 = 1.37, não 259/190 = 1.36)', () => {
    const r = calcularRefeicao(refeicoes[2]);
    assert.equal(r.tela.dens, '1.37');
    assert.equal((259 / 190).toFixed(2), '1.36');
  });
  await t.test('total do dia soma sem arredondar (peso 805.5, não 408 + 398 = 806)', () => {
    const r = calcularPlanejamento({ refeicoes });
    assert.equal(r.totalMacros[5], 805.5);
  });
  await t.test('CHO da última linha de cada refeição sem espaço ("28.6g"), das outras com espaço ("29.3 g")', () => {
    const r = calcularRefeicao(refeicoes[0]);
    assert.deepEqual(r.linhas.map((l) => l.tela.cho), ['29.3 g', '11.2 g', '28.6g']);
  });
});

test('só as refeições ativas entram no total do dia', () => {
  const todas = calcularPlanejamento({ refeicoes: refeicoesDaEvidencia(['true', 'true', 'true']) });
  const duas = calcularPlanejamento({ refeicoes: refeicoesDaEvidencia(['true', 'true', 'false']) });
  assert.equal(duas.totalMacros[5], 805.5);
  assert.equal(todas.totalMacros[5], 995.5); // + 90 g de ovo + 100 g de arroz
  assert.deepEqual(todas.tela.ativos, ['true', 'true', 'true']);
  assert.equal(refeicaoAtiva({}), true);
  assert.equal(refeicaoAtiva({ ativo: 'false' }), false);
  assert.equal(refeicaoAtiva({ ativo: false }), false);
});

test('§12 #20: kcal não proteica/g N planejada — padrão WebDiet, { corrigir: true } corrigida', async (t) => {
  const refeicoes = refeicoesDaEvidencia(['true', 'true', 'false']);
  const [pct, gkg] = ev.refs;
  await t.test('padrão = WebDiet: (gPTN×9 + gLIP×4)/(gPTN/6,25)', () => {
    assert.equal(calcularMetas(pct).gN, 72.9); // (125×9 + 83.3×4)/(125/6.25)
    assert.equal(calcularMetas(gkg).gN, 71.9); // (128×9 + 80×4)/(128/6.25)
    assert.equal(calcularPlanejamento({ refeicoes, metas: pct }).tela.gNPlanejada, pct.tela.gNPlanejada);
  });
  await t.test('corrigido: (gLIP×9 + gCHO×4)/(gPTN/6,25)', () => {
    const a = calcularPlanejamento({ refeicoes, metas: pct, referencias: REFS_H35 }, { corrigir: true });
    assert.equal(a.metas.gN, 100); // (83.3×9 + 312.5×4)/20 = 99.985
    assert.equal(a.tela.gNPlanejada, '100 Kcal'); // forma de número, como a tela mostra kcalnp
    assert.equal(a.tela.gNAdequacao, '-2 Kcal'); // 98.3 − 100
    assert.equal(a.adequacao.gN.percentual, 98);
    assert.equal(a.tela.cores.gNAdequacao, CORES.verde);
    const b = calcularPlanejamento({ refeicoes, metas: gkg }, { corrigir: true });
    assert.equal(b.tela.gNPlanejada, '97.7 Kcal'); // (80×9 + 320×4)/20.48 = 97.66
    assert.equal(b.tela.gNAdequacao, '1 Kcal');
    // o resto da tela não muda
    for (const campo of ['ptnPlanejada', 'lipPlanejada', 'choPlanejada', 'kcalPlanejada', 'gNPrescrita', 'ptnAdequacao']) {
      assert.equal(a.tela[campo], pct.tela[campo], campo);
      assert.equal(b.tela[campo], gkg.tela[campo], campo);
    }
  });
  await t.test('DIVERGENCIAS documenta os itens 20, 30, 31 e 32', () => {
    assert.deepEqual(DIVERGENCIAS.map((d) => d.item), [20, 30, 31, 32]);
  });
});

test('metas: usa o que o modal guardou (CHO% e GET); sem CHO% ou sem GET, calcula como o modal', () => {
  // mostrarReferencias() lê referencias[2] (CHO%) e referencias[3] (GET); o modal é que os preenche.
  const m = calcularMetas({ tipo: 'percentual', get: 2500, peso: 80, ptn: 20, lip: 30, cho: 99 });
  assert.deepEqual(m.percentuais, { ptn: 20, lip: 30, cho: 99 });
  assert.equal(m.cho, 618.8);
  const auto = calcularMetas({ tipo: 'percentual', get: 2500, peso: 80, ptn: 20, lip: 30 });
  assert.deepEqual(auto.percentuais, { ptn: 20, lip: 30, cho: 50 });
  assert.equal(auto.cho, 312.5);
  const g = calcularMetas({ tipo: 'gkg', peso: 80, ptn: 1.6, lip: 1, cho: 4, get: 9999 });
  assert.equal(g.get, 9999); // GET antigo guardado (§12 #31)
  assert.deepEqual([g.ptn, g.lip, g.cho], [128, 80, 320]);
  assert.equal(calcularMetas({ tipo: 'gkg', peso: 80, ptn: 1.6, lip: 1, cho: 4 }).get, 2512);
  assert.equal(calcularMetas({ tipo: 'gkg', peso: 80, ptn: 0, lip: 0, cho: 0, get: '-' }).get, 0); // "-" do modal
});

test('adequação: % arredondado e cores (> 105 vermelho, 95–105 verde, senão neutro)', () => {
  assert.equal(adequar(105, 100).cor, CORES.verde);
  assert.equal(adequar(105.4, 100).cor, CORES.verde); // 105 depois de arredondar
  assert.equal(adequar(105.6, 100).cor, CORES.vermelho);
  assert.equal(adequar(95, 100).cor, CORES.verde);
  assert.equal(adequar(94.4, 100).cor, CORES.neutro);
  assert.deepEqual(adequar(10, 0), { diferenca: 10, percentual: null, cor: CORES.neutro });
  assert.equal(CORES.vermelho, 'rgb(238, 9, 29)'); // #EE091D
  assert.equal(CORES.verde, 'rgb(131, 198, 136)'); // #83C688
});

test('classes de densidade (limites do relatório)', () => {
  const c = (d) => classificarDensidade(d).classe;
  assert.equal(c(0), 'muito baixa');
  assert.equal(c(0.6), 'muito baixa');
  assert.equal(c(0.61), 'baixa');
  assert.equal(c(1.5), 'baixa');
  assert.equal(c(1.51), 'média');
  assert.equal(c(3.9), 'média');
  assert.equal(c(3.91), 'alta');
  assert.equal(classificarDensidade(1).texto, 'Refeição com densidade baixa(0.6 até 1.5 Kcal/g)');
  assert.equal(classificarDensidade(5).texto, 'Refeição com densidade alta(3.9 até 9.0 Kcal/g)');
});

test('micronutrientes: % só com referência numérica > 0; sem referências, colunas vazias', () => {
  const valores = new Array(27).fill(0);
  valores[5] = 19; // fibras
  valores[3] = 1.23; // trans (referência "0")
  const comRef = tabelaMicros(valores, REFS_H35);
  assert.deepEqual(comRef[5].tela, ['19.0', '50.0%', '38 g']);
  assert.deepEqual(comRef[3].tela, ['1.2', '', '0']);
  assert.deepEqual(comRef[4].tela, ['0.0', '', 'N/D']);
  valores[6] = 2500; // Ca 250% → barra limitada a 200
  assert.equal(tabelaMicros(valores, REFS_H35)[6].barra, 200);
  assert.deepEqual(tabelaMicros(valores)[5].tela, ['19.0', '', '']);
});

test('medidas: nome da base, "grama(s)" sem cadastro, personalizada e medida inexistente', () => {
  const arroz = ev.alimentos['40'];
  assert.deepEqual(medidaDoAlimento(arroz, 'Xícara(s) de chá'), { nome: 'Xícara(s) de chá', peso: 130, pesoTexto: '130' });
  assert.equal(medidaDoAlimento({ nome: 'x', mc: [] }, 'grama(s)').peso, 1);
  assert.equal(medidaDoAlimento(arroz, { nome_mc: 'Prato', peso: 210 }).peso, 210);
  assert.throws(() => medidaDoAlimento(arroz, 'Concha(s)'), /não encontrada/);
});

test('planejamento vazio não gera NaN nem Infinity', () => {
  const r = calcularPlanejamento({ refeicoes: [{ itens: [] }], metas: { tipo: 'percentual', get: 0, peso: 0, ptn: 0, lip: 0 } });
  const texto = JSON.stringify(r.tela) + JSON.stringify(r.refeicoes[0].tela);
  assert.doesNotMatch(texto, /NaN|Infinity/);
  assert.equal(r.refeicoes[0].tela.dens, '0.00');
  assert.equal(r.refeicoes[0].tela.gcho, 'Carbo - 0.0g (0.0%)');
});

test('substitutos: fator = novo/antigo, quantidade e peso × fator com 1 casa', () => {
  const r = ajustarSubstitutos([{ id: 'a', quantidade: 2, peso: 90 }, { id: 'b', quantidade: '1.5', peso: '33.3' }], 120, 180);
  assert.equal(r.fator, 1.5);
  assert.deepEqual(r.substitutos, [
    { id: 'a', quantidade: 3, peso: 135 },
    { id: 'b', quantidade: 2.3, peso: 49.9 }, // 2.25 → 2.3; 33.3 × 1.5 = 49.9499… → 49.9 (toFixed sobre o binário, §3)
  ]);
  const s = ajustarSubstitutos([{ quantidade: 1, peso: 10 }], 0, 50);
  assert.equal(s.fator, null);
  assert.deepEqual(s.substitutos, [{ quantidade: 1, peso: 10 }]);
});
