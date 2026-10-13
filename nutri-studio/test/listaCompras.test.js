// Lista de compras (relatório §8.8). Não há evidência de tela para esta parte (o relatório a leu no código);
// os casos abaixo seguem as regras do relatório e testam §12 #25–26.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  importarComprasAlimentos,
  importarComprasEquivalentes,
  calcularQuantidadeCompra,
  calcularQuantidadeGrupoEquivalente,
  montarListaComQuantidades,
  ehReceita,
  nomeDeCompra,
  PERIODO_PADRAO,
  PERIODOS,
  DIVERGENCIAS,
} from '../src/calc/listaCompras.js';

const arroz = { nome: 'Arroz cozido', compras: 'Arroz', unidade: 'g' };
const feijao = { nome: 'Feijão carioca cozido', compras: 'Feijão carioca', unidade: 'g' };
const frango = { nome: 'Frango grelhado', compras: 'Frango', unidade: 'g' };
const tomate = { nome: 'Tomate', compras: 'Tomate', unidade: 'g' };
const azeite = { nome: 'Azeite', compras: 'Azeite', unidade: 'ml' };
const ovo = { nome: 'Ovo cozido', compras: 'Ovos', unidade: 'g' };
const salada = { nome: 'Salada caprese', compras: 'Salada caprese', tipo: 'receita', origem: 'Receita', ingredientes: [{ alimento: tomate }, { alimento: azeite }] };
const omelete = { nome: 'Omelete', compras: 'Omelete', origem: 'Receita', ingredientes: [ovo, azeite] };

test('método por alimentos: principais e substitutos, sem repetidos, em ordem alfabética', () => {
  const refeicoes = [
    { itens: [{ alimento: frango, subs: [{ alimento: ovo }] }, { alimento: arroz }] },
    { itens: [{ alimento: arroz, subs: [{ alimento: feijao }] }] },
  ];
  assert.deepEqual(importarComprasAlimentos(refeicoes), ['Arroz', 'Feijão carioca', 'Frango', 'Ovos']);
});

test('método por alimentos com receitas: igual ao WebDiet, só a principal vira ingredientes (§12 #25)', () => {
  const refeicoes = [{ itens: [{ alimento: salada, subs: [{ alimento: omelete }] }, { alimento: arroz }] }];
  // Como no WebDiet, a omelete substituta entra como "Omelete" e seus ingredientes são descartados.
  assert.deepEqual(importarComprasAlimentos(refeicoes, { comReceitas: true }), ['Arroz', 'Azeite', 'Omelete', 'Tomate']);
  assert.deepEqual(importarComprasAlimentos(refeicoes), ['Arroz', 'Azeite', 'Omelete', 'Tomate']);
  // Com corrigir, principal e substituta viram ingredientes.
  assert.deepEqual(importarComprasAlimentos(refeicoes, { comReceitas: true, corrigir: true }), ['Arroz', 'Azeite', 'Ovos', 'Tomate']);
  assert.deepEqual(importarComprasAlimentos(refeicoes, { comReceitas: false }), ['Arroz', 'Omelete', 'Salada caprese']);
  assert.deepEqual(DIVERGENCIAS.map((d) => d.item), [25, 26]);
  assert.match(DIVERGENCIAS[0].comportamento, /^Padrão igual ao WebDiet/);
});

test('método por equivalentes: alimentos dos grupos com porção > 0 + avulsos; com/sem receitas vale (§12 #26 corrigido)', () => {
  const alimentos = [
    { grupo: 'g5', ...arroz },
    { grupo: 'g5', nome: 'Batata', compras: 'Batata' },
    { grupo: 'g5', nome: 'Inhame', compras: 'Inhame', selecionado: false },
    { grupo: 'g4', ...frango },
    { grupo: 'g2', ...salada },
  ];
  const refeicoes = [
    { porcoes: { g5: 2, g4: 0 } },
    { porcoes: { 2: 1 }, avulsos: [{ alimento: omelete, peso: 100 }] },
  ];
  assert.deepEqual(importarComprasEquivalentes({ refeicoes, alimentos }, { comReceitas: false }), ['Arroz', 'Batata', 'Omelete', 'Salada caprese']);
  assert.deepEqual(importarComprasEquivalentes({ refeicoes, alimentos }, { comReceitas: true }), ['Arroz', 'Azeite', 'Batata', 'Ovos', 'Tomate']);
});

test('nome de compra: campo `compras`, senão o nome; receita por tipo ou origem', () => {
  assert.equal(nomeDeCompra({ nome: 'Pão de forma', compras: '' }), 'Pão de forma');
  assert.equal(ehReceita({ origem: 'Receita' }), true);
  assert.equal(ehReceita({ tipo: 'alimento', origem: 'TACO' }), false);
});

test('calcularQuantidadeCompra: todos os casos da tabela do relatório', () => {
  assert.equal(calcularQuantidadeCompra(2, 'Unidade(s) média(s)', 90, 'g', 15), '30 Unidade(s)');
  assert.equal(calcularQuantidadeCompra(0.5, 'unidade(s)', 25, 'g', 7), '4 Unidade(s)'); // 3,5 → Math.round = 4
  assert.equal(calcularQuantidadeCompra(1, 'Copo(s)', 240, 'ml', 15), '3,60 Litros');
  assert.equal(calcularQuantidadeCompra(1, 'Colher(es) de sopa', 50, 'ml', 15), '750 ml');
  assert.equal(calcularQuantidadeCompra(1, 'Colher(es) de sopa', 0, 'ml', 15), '');
  assert.equal(calcularQuantidadeCompra(4, 'Colher(es) de arroz', 120, 'g', 15), '1,80 Kg');
  assert.equal(calcularQuantidadeCompra(1, 'Colher(es) de arroz', 30, 'g', 15), '450 g');
  assert.equal(calcularQuantidadeCompra(1, 'grama(s)', 0, 'g', 15), '');
  assert.equal(calcularQuantidadeCompra(1, 'grama(s)', 100, 'g', 10), '1000 g'); // > 1000 vira Kg; 1000 não
  assert.equal(calcularQuantidadeCompra(1, 'grama(s)', 100.4, 'g', 10), '1,00 Kg');
});

test('calcularQuantidadeCompra: período vazio ou inválido vale 1', () => {
  assert.equal(calcularQuantidadeCompra(1, 'grama(s)', 30, 'g', ''), '30 g');
  assert.equal(calcularQuantidadeCompra(1, 'grama(s)', 30, 'g', 'abc'), '30 g');
  assert.equal(calcularQuantidadeCompra(1, 'grama(s)', 30, 'g', -7), '30 g');
  assert.equal(PERIODO_PADRAO, 15);
  assert.deepEqual(PERIODOS, [7, 15, 30, 45, 60]);
});

test('calcularQuantidadeGrupoEquivalente: porções × quantidade e × peso; plural quando qtd > 1', () => {
  const pao = { quantidade: 1, medida: 'Fatia', medidaPlural: 'Fatias', peso: 25 };
  assert.deepEqual(calcularQuantidadeGrupoEquivalente(2, pao), { qtd: 2, medida: 'Fatias', peso: 50 });
  assert.deepEqual(calcularQuantidadeGrupoEquivalente(1, pao), { qtd: 1, medida: 'Fatia', peso: 25 });
  assert.deepEqual(calcularQuantidadeGrupoEquivalente(3, { quantidade: 0.5, medida: 'Unidade(s)', peso: 30 }), { qtd: 1.5, medida: 'Unidade(s)', peso: 90 });
});

test('lista com quantidades: uma entrada por refeição e grupo (sem somar refeições) e por avulso', () => {
  const alimentos = [
    { grupo: 'g5', nome: 'Arroz cozido', compras: 'Arroz', unidade: 'g', quantidade: 2, medida: 'Colher(es) de sopa', peso: 50 },
    { grupo: 'g5', nome: 'Batata', compras: 'Batata', unidade: 'g', quantidade: 1, medida: 'Unidade(s) pequena(s)', peso: 60 },
    { grupo: 'g13', nome: 'Leite', compras: 'Leite', unidade: 'ml', quantidade: 1, medida: 'Copo(s)', peso: 200 },
  ];
  const refeicoes = [
    { porcoes: { g5: 2, g13: 1 } },
    { porcoes: { g5: 1 }, avulsos: [{ alimento: { nome: 'Azeite', compras: 'Azeite', unidade: 'ml', mc: [{ nome_mc: 'Colher(es) de sopa', peso: 8 }] }, quantidade: 1, medida: 'Colher(es) de sopa' }] },
  ];
  const lista = montarListaComQuantidades({ refeicoes, alimentos });
  assert.equal(lista.length, 4);
  assert.deepEqual(lista.map((x) => [x.refeicao, x.grupo]), [[0, 'g5'], [0, 'g13'], [1, 'g5'], [1, null]]);
  assert.deepEqual(lista[0].principal, { nome: 'Arroz', qtd: 4, medida: 'Colher(es) de sopa', peso: 100, unidade: 'g', compra: '1,50 Kg' });
  assert.equal(lista[0].opcoes[0].compra, '30 Unidade(s)'); // 2 porções × 1 unidade × 15 dias
  assert.equal(lista[1].principal.compra, '3,00 Litros');
  assert.equal(lista[2].principal.compra, '750 g'); // a 2ª refeição não é somada à 1ª
  assert.deepEqual(lista[3].principal, { nome: 'Azeite', qtd: 1, medida: 'Colher(es) de sopa', peso: 8, unidade: 'ml', compra: '120 ml' });

  const semExtras = montarListaComQuantidades({ refeicoes, alimentos }, { periodo: 7, comQuantidades: false, comSubstitutos: false });
  assert.equal(semExtras[0].principal.compra, null);
  assert.deepEqual(semExtras[0].opcoes, []);
  assert.equal(montarListaComQuantidades({ refeicoes, alimentos }, { periodo: 7 })[0].principal.compra, '700 g');
});
