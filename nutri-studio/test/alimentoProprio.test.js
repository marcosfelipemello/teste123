// Alimento próprio por rótulo (relatório §8.7). Compara com o envio que o WebDiet montou
// (docs/webdiet-evidencias/tela_alimento_rotulo.json; envio bloqueado) e testa §12 #27.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cadastrarAlimento, kcalAutomatica, CAMPOS_MICROS_ENVIO, DIVERGENCIAS } from '../src/calc/alimentoProprio.js';

const ev = JSON.parse(fs.readFileSync(new URL('../../docs/webdiet-evidencias/tela_alimento_rotulo.json', import.meta.url), 'utf8'));

// Campos da tela → entrada do módulo. A evidência não registra a unidade escolhida; o envio diz "ml".
const e = ev.entrada;
const entrada = {
  nome: e.nomeNovoAlimento,
  medida: e.mcNovoAlimento,
  quantidadeMedidas: e.mcquantidadeNovoAlimento,
  peso: e.pesoNovoAlimento,
  cho: e.choNovoAlimento,
  ptn: e.ptnNovoAlimento,
  lip: e.lipNovoAlimento,
  fibras: e.fibrasNovoAlimento,
  unidade: ev.enviado_bloqueado.unidade,
};

test('evidência: kcal automática', () => {
  const k = kcalAutomatica(entrada);
  assert.deepEqual(k.tela, { kcalAuto: ev.kcalAuto });
  assert.ok(Math.abs(k.kcal - 181.4) < 1e-9); // 27,3×4 + 6,1×4 + 4,6×9 + 3,2×2
});

test('evidência: campos enviados (todos), mais gorduratrans "0" (§12 #27 corrigido)', () => {
  const r = cadastrarAlimento(entrada);
  assert.equal(r.valido, true);
  for (const [campo, valor] of Object.entries(ev.enviado_bloqueado)) assert.equal(r.envio[campo], valor, campo);
  const { gorduratrans, ...semTrans } = r.envio;
  assert.deepEqual(semTrans, ev.enviado_bloqueado);
  assert.equal(gorduratrans, '0');
  assert.equal('gorduratrans' in ev.enviado_bloqueado, false); // o WebDiet não envia
  assert.deepEqual(Object.keys(r.envio), [...Object.keys(ev.enviado_bloqueado).slice(0, 13), 'gorduratrans', ...Object.keys(ev.enviado_bloqueado).slice(13)]);
});

test('relatório §8.7: valores por 100 g e medida', () => {
  const r = cadastrarAlimento(entrada);
  assert.equal(r.kcalPorcao, '181');
  assert.deepEqual(r.porCem, { kcal: 402, ptn: 13.6, lip: 10.2, cho: 60.7, fibras: 7.1 });
  assert.deepEqual(r.medida, { nome_mc: 'Unidade(s)', peso: 22.5 });
  // a kcal convertida é a do campo (181), não a sem arredondar (181,4 → 403)
  assert.equal(((181.4 / 45) * 100).toFixed(0), '403');
});

test('§12 #27 mantido: kcal automática soma fibras × 2; campo vazio = 0', () => {
  assert.equal(kcalAutomatica({ cho: 10, fibras: 5 }).kcal, 50);
  assert.equal(kcalAutomatica({ cho: '', ptn: undefined, lip: '1,5', fibras: null }).kcal, 13.5);
  assert.deepEqual(DIVERGENCIAS.map((d) => d.item), [27]);
  assert.ok(CAMPOS_MICROS_ENVIO.includes('gorduratrans'));
  assert.equal(CAMPOS_MICROS_ENVIO.length, 26);
});

test('kcal digitada substitui a automática; unidade padrão "g"', () => {
  const r = cadastrarAlimento({ ...entrada, kcal: '190', unidade: undefined });
  assert.equal(r.kcalPorcao, '190');
  assert.equal(r.envio.kcal, '422'); // 190 / 45 × 100 = 422,2
  assert.equal(r.envio.unidade, 'g');
});

test('validação: nome, peso, medida e quantidade de medidas', () => {
  const r = cadastrarAlimento({ nome: '', peso: 0, medida: '', quantidadeMedidas: '' });
  assert.equal(r.valido, false);
  assert.deepEqual(r.faltando, ['nome', 'peso', 'medida', 'quantidadeMedidas']);
  assert.equal(r.envio, null);
});
