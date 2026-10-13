// @ts-check
import { html } from '../ui/html.js';
import { icon } from '../ui/icons.js';
import { paciente } from '../store.js';
import { iniciais } from '../ui/form.js';
import { idadeEmAnos } from '../calc/util.js';
import * as dados from './abas/dados.js';
import * as anamnese from './abas/anamnese.js';
import * as avaliacoes from './abas/avaliacoes.js';
import * as energia from './abas/energia.js';
import * as plano from './abas/plano.js';
import * as evolucao from './abas/evolucao.js';

/**
 * @typedef {{ render: (p: import('../store.js').Paciente) => import('../ui/html.js').Raw, montar?: (root: HTMLElement, p: import('../store.js').Paciente) => void }} Aba
 */

/** @type {Array<[string, string, string, Aba]>} */
const ABAS = [
  ['avaliacoes', 'Avaliação', 'avaliacao', avaliacoes],
  ['energia', 'Energia e macros', 'energia', energia],
  ['plano', 'Plano alimentar', 'plano', plano],
  ['evolucao', 'Evolução', 'evolucao', evolucao],
  ['anamnese', 'Anamnese', 'anamnese', anamnese],
  ['dados', 'Cadastro', 'pacientes', dados],
];

/** @param {string[]} params */
function aba(params) {
  return ABAS.find(([id]) => id === params[1]) ?? ABAS[0];
}

/** @param {string[]} params */
export function render(params) {
  const p = paciente(params[0]);
  if (!p) return html`<div class="card"><h2>Paciente não encontrado</h2><p><a href="#/pacientes">Voltar para a lista</a></p></div>`;
  const [abaId, , , mod] = aba(params);
  const idade = p.nascimento ? idadeEmAnos(p.nascimento) : NaN;
  return html`
    <div class="cabecalho">
      <div class="linha-flex">
        <a class="btn fantasma" href="#/pacientes" aria-label="Voltar">${icon('voltar')}</a>
        <span class="avatar" style="width: 48px; height: 48px; font-size: 16px">${iniciais(p.nome)}</span>
        <div class="titulo">
          <span class="rotulo">Paciente</span>
          <h1>${p.nome}</h1>
          <p style="font-size: 13px">${p.sexo === 'M' ? 'Masculino' : 'Feminino'}${Number.isFinite(idade) ? ` · ${idade} anos` : ''}${p.objetivo ? ` · ${p.objetivo}` : ''}</p>
        </div>
      </div>
    </div>
    <nav class="abas" aria-label="Seções do paciente">
      ${ABAS.map(([id, nome, ic]) => html`<a href="#/paciente/${p.id}/${id}" class="${id === abaId ? 'ativo' : ''}">${icon(ic, 18)}${nome}</a>`)}
    </nav>
    <div id="aba">${mod.render(p)}</div>
  `;
}

/** @param {HTMLElement} root @param {string[]} params */
export function montar(root, params) {
  const p = paciente(params[0]);
  if (!p) return;
  const mod = aba(params)[3];
  const el = /** @type {HTMLElement} */ (root.querySelector('#aba'));
  mod.montar?.(el, p);
}
