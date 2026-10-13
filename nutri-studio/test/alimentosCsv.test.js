// Importação/exportação de "Meus alimentos" em CSV (src/ui/alimentosCsv.js). Usa os alimentos TACO da
// evidência do planejamento (docs/webdiet-evidencias/tela_planejamento_alimentos.json) para conferir que
// um CSV com esses valores reproduz o almoço do relatório §8.4.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  importarAlimentosCsv,
  exportarAlimentosCsv,
  planejarImportacao,
  lerNumero,
  lerMedidas,
  formatarMedidas,
  modeloCsv,
  cabecalhoCsv,
  normalizarColuna,
  chaveNome,
  COLUNAS,
  COLUNAS_MICROS,
  MICROS,
  ORIGEM_PADRAO,
} from '../src/ui/alimentosCsv.js';
import { CHAVES_MICROS } from '../src/calc/dris.js';
import { calcularRefeicao } from '../src/calc/planejamento.js';

const ev = JSON.parse(
  fs.readFileSync(new URL('../../docs/webdiet-evidencias/tela_planejamento_alimentos.json', import.meta.url), 'utf8'),
);

test('números: vírgula ou ponto, milhar, marcadores de tabela e erros', () => {
  assert.deepEqual(lerNumero('2,5'), { valor: 2.5, vazio: false, erro: null });
  assert.equal(lerNumero('2.5').valor, 2.5);
  assert.equal(lerNumero('1.234,5').valor, 1234.5);
  assert.equal(lerNumero('1,234.5').valor, 1234.5);
  assert.equal(lerNumero(' 7 ').valor, 7);
  for (const m of ['', 'Tr', 'NA', 'N/D', '*', '-']) assert.deepEqual(lerNumero(m), { valor: 0, vazio: true, erro: null }, m);
  assert.match(lerNumero('abc').erro, /não é um número/);
  assert.match(lerNumero('-1').erro, /negativo/);
  assert.match(lerNumero('1,2,3').erro, /não é um número/);
});

test('medidas: "nome:peso|nome:peso", peso depois do último ":", peso 0 aceito', () => {
  assert.deepEqual(lerMedidas('Colher(es) de sopa:25|Xícara(s) de chá: 130,5|À vontade:0'), {
    mc: [{ nome_mc: 'Colher(es) de sopa', peso: 25 }, { nome_mc: 'Xícara(s) de chá', peso: 130.5 }, { nome_mc: 'À vontade', peso: 0 }],
    erros: [],
  });
  assert.deepEqual(lerMedidas('Prato: raso:300').mc, [{ nome_mc: 'Prato: raso', peso: 300 }]);
  assert.deepEqual(lerMedidas('').mc, []);
  const r = lerMedidas('sem peso|:30|Copo:x|Copo:200|copo:240');
  assert.equal(r.mc.length, 1);
  assert.equal(r.erros.length, 4);
  assert.equal(formatarMedidas([{ nome_mc: 'Colher', peso: 12.5 }, { nome_mc: 'Unidade', peso: '50' }]), 'Colher:12,5|Unidade:50');
});

test('cabeçalho: colunas obrigatórias, nomes alternativos, micronutrientes pela chave ou pelo nome', () => {
  const csv = 'Alimento;Unidade;Energia (kcal);Proteína (g);Lipídios (g);Carboidratos (g);Fibra alimentar;Cálcio;fe;Coluna estranha\n' +
    'Tomate;g;15;1,1;0,2;3,1;1,2;7;0,2;x\n';
  const r = importarAlimentosCsv(csv);
  assert.equal(r.erro, null);
  assert.deepEqual(r.colunas.ignoradas, ['Coluna estranha']);
  assert.equal(r.colunas.reconhecidas['Cálcio'], 'ca');
  assert.equal(r.alimentos.length, 1);
  const a = r.alimentos[0].alimento;
  assert.deepEqual([a.nome, a.unidade, a.kcal, a.ptn, a.lip, a.cho, a.fibras], ['Tomate', 'g', 15, 1.1, 0.2, 3.1, 1.2]);
  assert.equal(a.micros.length, 27);
  assert.equal(a.micros[CHAVES_MICROS.indexOf('ca')], 7);
  assert.equal(a.micros[CHAVES_MICROS.indexOf('fe')], 0.2);
  assert.equal(a.micros[CHAVES_MICROS.indexOf('fibras')], 1.2); // a coluna fibras também é o micronutriente
  assert.equal(a.origem, ORIGEM_PADRAO);
  assert.deepEqual(a.mc, []);

  const semCho = importarAlimentosCsv('nome;unidade;kcal;ptn;lip;fibras\nX;g;1;1;1;1\n');
  assert.match(semCho.erro, /cho/);
  assert.equal(semCho.alimentos.length, 0);
  assert.equal(importarAlimentosCsv('').erro, 'Arquivo vazio.');
});

test('linhas recusadas: sem nome, unidade, número inválido, kcal vazia, medida inválida, nome repetido', () => {
  const csv = [
    'nome,unidade,kcal,ptn,lip,cho,fibras,medidas',
    'Bom,ml,10,1,1,1,Tr,"Copo:200"',
    ',g,10,1,1,1,1,',
    'Unidade errada,kg,10,1,1,1,1,',
    'Texto,g,10,abc,1,1,1,',
    'Sem kcal,g,,1,1,1,1,',
    'Medida ruim,g,10,1,1,1,1,Copo',
    'bom,g,5,1,1,1,1,',
  ].join('\n');
  const r = importarAlimentosCsv(csv);
  assert.equal(r.erro, null);
  assert.deepEqual(r.alimentos.map((x) => [x.linha, x.alimento.nome, x.alimento.unidade, x.alimento.fibras]), [[2, 'Bom', 'ml', 0]]);
  assert.deepEqual(r.alimentos[0].alimento.mc, [{ nome_mc: 'Copo', peso: 200 }]);
  assert.deepEqual(r.rejeitados.map((x) => x.linha), [3, 4, 5, 6, 7, 8]);
  assert.deepEqual(r.rejeitados[0].erros, ['sem nome']);
  assert.match(r.rejeitados[1].erros[0], /unidade "kg"/);
  assert.match(r.rejeitados[2].erros[0], /^ptn: "abc"/);
  assert.deepEqual(r.rejeitados[3].erros, ['kcal vazio']);
  assert.match(r.rejeitados[4].erros[0], /medida "Copo" sem nome/);
  assert.match(r.rejeitados[5].erros[0], /nome repetido na planilha \(linha 2\)/);
});

test('alimentos TACO da evidência: exportar → importar devolve os mesmos valores e reproduz o almoço do §8.4', () => {
  const originais = Object.values(ev.alimentos).map((a) => ({
    ...a,
    nome: a.nome.trim(),
    mc: a.mc.map((m) => ({ nome_mc: m.nome_mc, peso: Number(m.peso) })),
  }));
  const csv = exportarAlimentosCsv(originais);
  assert.ok(csv.startsWith('﻿'));
  assert.equal(csv.split('\r\n')[0].replace('﻿', ''), cabecalhoCsv().join(';'));
  const r = importarAlimentosCsv(csv);
  assert.equal(r.erro, null);
  assert.equal(r.rejeitados.length, 0);
  assert.equal(r.alimentos.length, originais.length);
  r.alimentos.forEach(({ alimento }, i) => {
    const o = originais[i];
    for (const k of ['nome', 'unidade', 'kcal', 'ptn', 'lip', 'cho', 'fibras', 'origem']) assert.equal(alimento[k], o[k], `${o.nome} ${k}`);
    assert.deepEqual(alimento.micros, o.micros, `${o.nome} micros`);
    assert.deepEqual(alimento.mc, o.mc, `${o.nome} medidas`);
  });
  const porId = Object.fromEntries(r.alimentos.map(({ alimento }, i) => [originais[i].id, alimento]));
  const almoco = calcularRefeicao({
    itens: [
      { alimento: porId['40'], quantidade: 4, medida: 'Colher(es) de arroz rasa(s)' },
      { alimento: porId['202'], quantidade: 150, medida: 'grama(s)' },
      { alimento: porId['215'], quantidade: 120, medida: 'grama(s)' },
      { alimento: porId['46'], quantidade: 1, medida: 'Colher(es) de sopa' },
    ],
  });
  assert.deepEqual(
    [almoco.tela.peso, almoco.tela.ptn, almoco.tela.lip, almoco.tela.cho, almoco.tela.kcal],
    ['398g', '37.1g', '23.5g', '54.8g', '587 Kcal'],
  );
  assert.deepEqual(almoco.tela, ev.refeicoes[1].tot);
});

test('exportação: campos com ";" ou aspas vão entre aspas e voltam iguais', () => {
  const a = { nome: 'Pão "caseiro"; integral', unidade: 'g', kcal: 250, ptn: 9, lip: 3, cho: 45, fibras: 6, mc: [{ nome_mc: 'Fatia; fina', peso: 20 }], compras: 'Pão', origem: 'Rótulo', micros: new Array(27).fill(0) };
  const r = importarAlimentosCsv(exportarAlimentosCsv([a]));
  assert.equal(r.rejeitados.length, 0);
  assert.equal(r.alimentos[0].alimento.nome, a.nome);
  assert.deepEqual(r.alimentos[0].alimento.mc, a.mc);
  assert.equal(r.alimentos[0].alimento.compras, 'Pão');
});

test('modelo: importa sem recusas e documenta todas as colunas', () => {
  const r = importarAlimentosCsv(modeloCsv());
  assert.equal(r.erro, null);
  assert.equal(r.rejeitados.length, 0);
  assert.equal(r.alimentos.length, 2);
  assert.equal(r.alimentos[1].alimento.unidade, 'ml');
  assert.equal(cabecalhoCsv().length, 10 + 26);
  assert.equal(COLUNAS_MICROS.length, 26);
  assert.equal(COLUNAS.filter((c) => c.obrigatoria).length, 7);
  assert.equal(MICROS.length, 27);
  assert.ok(MICROS.every((m) => m.unidadeValor));
  assert.equal(normalizarColuna('Proteína (g)'), 'proteinag');
});

test('planejar importação: mesmo nome atualiza (ou é ignorado); nomes novos entram', () => {
  const lidos = importarAlimentosCsv('nome;unidade;kcal;ptn;lip;cho;fibras\nArroz Cozido;g;128;2,5;0,2;28,1;1,6\nFeijão;g;76;4,8;0,5;13,6;8,5\n').alimentos;
  const existentes = [{ id: 'a1', nome: 'arroz cozido' }];
  const p = planejarImportacao(lidos, existentes);
  assert.deepEqual(p.novos.map((a) => a.nome), ['Feijão']);
  assert.deepEqual(p.atualizados.map((x) => [x.id, x.alimento.nome]), [['a1', 'Arroz Cozido']]);
  const q = planejarImportacao(lidos, existentes, { atualizar: false });
  assert.deepEqual(q.ignorados.map((a) => a.nome), ['Arroz Cozido']);
  assert.equal(chaveNome('  Feijão   Carioca '), 'feijao carioca');
});
