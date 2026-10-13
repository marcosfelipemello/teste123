import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check, fx, fxn, idadeAnos, idadeMeses } from '../src/calc/numeros.js';

test('check: vazio, NaN e não finito viram 0; vírgula vira ponto (§3)', () => {
  assert.equal(check(''), 0);
  assert.equal(check('abc'), 0);
  assert.equal(check(Infinity), 0);
  assert.equal(check('12,5'), 12.5);
  assert.equal(check('80'), 80);
});

test('fx usa toFixed do JS, meio-para-cima sobre o binário (§3)', () => {
  assert.equal(fx(1.005, 2), '1.00');
  assert.equal(fx(31.25, 1), '31.3');
  assert.equal(fxn(18.48, 1), 18.5);
});

test('idade na data da avaliação (§3, §5.1 conferido na tela)', () => {
  assert.equal(idadeAnos('15/06/1991', '13/10/2026'), 35);
  assert.equal(idadeAnos('15/06/1991', '13/10/2000'), 9);
  assert.equal(idadeAnos('15/06/1991', '14/06/2026'), 34);
  assert.equal(idadeAnos('15/06/1991', '15/06/2026'), 35);
  assert.equal(idadeMeses('15/06/2026', '13/10/2026'), 3);
  assert.equal(idadeMeses('15/06/2023', '15/06/2026'), 36);
});
