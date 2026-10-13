// Medidas caseiras do IBGE (src/dados/medidas_ibge.json, gerado por scripts/medidas-ibge.py a partir da Tabela de
// Medidas Referidas da POF 2008-2009). Confere a estrutura e que os pesos das medidas que a tela do WebDiet mostrou
// para os alimentos da evidência (docs/webdiet-evidencias/tela_planejamento_alimentos.json) são os mesmos do IBGE.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ler = (url) => JSON.parse(fs.readFileSync(new URL(url, import.meta.url), 'utf8'));
const ibge = ler('../src/dados/medidas_ibge.json');
const ev = ler('../../docs/webdiet-evidencias/tela_planejamento_alimentos.json');

const medida = (alimento, preparo, nome) =>
  ibge.alimentos.find((a) => a.nome === alimento && a.preparo === preparo)?.medidas.find((m) => m.nome === nome)?.peso;
const doWebDiet = (id, nome) => Number(ev.alimentos[id].mc.find((m) => m.nome_mc === nome).peso);

test('estrutura: alimentos com medidas em gramas, sem grama/quilo/mililitro', () => {
  assert.equal(ibge.n, ibge.alimentos.length);
  assert.ok(ibge.n > 1000);
  for (const a of ibge.alimentos) {
    assert.ok(a.nome && a.medidas.length, a.nome);
    for (const m of a.medidas) {
      assert.ok(m.peso > 0 && Number.isFinite(m.peso), `${a.nome}: ${m.nome}`);
      assert.doesNotMatch(m.nome, /^(grama|quilo|mililitro|litro)/i);
    }
    assert.equal(new Set(a.medidas.map((m) => m.nome.toLowerCase())).size, a.medidas.length, a.nome);
  }
});

test('os pesos que o WebDiet mostrou nos alimentos da evidência são os do IBGE', () => {
  const pares = [
    [40, 'Colher(es) de sopa cheia(s)', 'Arroz (polido, parboilizado)', '', 'Colher de sopa cheia'],
    [202, 'Concha(s) cheia(s)', 'Feijao (preto, mulatinho, roxo, rosinha, etc)', '', 'Concha média cheia'],
    [202, 'Colher(es) de sopa cheia(s)', 'Feijao (preto, mulatinho, roxo, rosinha, etc)', '', 'Colher de sopa cheia'],
    [46, 'Colher(es) de sopa', 'Azeite de oliva', '', 'Colher de sopa'],
    [46, 'Colher(es) de sobremesa', 'Azeite de oliva', '', 'Colher de sobremesa'],
    [46, 'Colher(es) de chá', 'Azeite de oliva', '', 'Colher de chá'],
    [348, 'Unidade(s)', 'Pao de sal', '', 'Unidade'],
    [336, 'Unidade(s) média(s)', 'Ovo de galinha', 'crozido(a)', 'Unidade média'],
  ];
  for (const [id, nomeWebDiet, alimento, preparo, nomeIbge] of pares) {
    assert.equal(medida(alimento, preparo, nomeIbge), doWebDiet(id, nomeWebDiet), `${alimento}: ${nomeIbge}`);
  }
});

test('aproximações da pesquisa ficam de fora; colher de arroz/servir entra', () => {
  const arroz = ibge.alimentos.find((a) => a.nome === 'Arroz (polido, parboilizado)' && a.preparo === '');
  assert.equal(arroz.medidas.find((m) => /caneca/i.test(m.nome)), undefined); // "caneca" = "prato fundo raso" na pesquisa
  assert.equal(medida('Arroz (polido, parboilizado)', '', 'Colher de arroz cheia'), 45);
});
