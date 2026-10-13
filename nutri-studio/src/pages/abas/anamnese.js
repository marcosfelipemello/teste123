// @ts-check
import { html } from '../../ui/html.js';
import { areaTexto, ligarCampos, definir } from '../../ui/form.js';
import { atualizar } from '../../store.js';

const SECOES = [
  ['Clínica', [
    ['queixa', 'Queixa principal e motivo da consulta'],
    ['patologias', 'Patologias, histórico clínico e familiar'],
    ['medicamentos', 'Medicamentos e suplementos em uso'],
    ['alergias', 'Alergias e intolerâncias alimentares'],
  ]],
  ['Hábitos', [
    ['intestino', 'Hábito intestinal (frequência, consistência)'],
    ['sono', 'Sono (horas, qualidade)'],
    ['atividade', 'Atividade física (tipo, frequência, duração)'],
    ['agua', 'Ingestão hídrica'],
    ['alcool', 'Álcool e tabagismo'],
  ]],
  ['Alimentação', [
    ['rotina', 'Rotina alimentar / recordatório habitual'],
    ['preferencias', 'Preferências alimentares'],
    ['aversoes', 'Aversões e restrições'],
    ['observacoes', 'Observações gerais'],
  ]],
];

/** @param {import('../../store.js').Paciente} p */
export function render(p) {
  return html`${SECOES.map(
    ([titulo, campos]) => html`<section class="card">
      <h2>${titulo}</h2>
      <div class="grade g2">
        ${/** @type {string[][]} */ (campos).map(([k, r]) => areaTexto({ rotulo: r, caminho: `anamnese.${k}`, valor: p.anamnese?.[k] }))}
      </div>
    </section>`,
  )}
  <p class="ref">Salvo automaticamente.</p>`;
}

/** @param {HTMLElement} root @param {import('../../store.js').Paciente} p */
export function montar(root, p) {
  ligarCampos(root, (c, v) => atualizar(() => definir(p, c, v), { silencioso: true }));
}
