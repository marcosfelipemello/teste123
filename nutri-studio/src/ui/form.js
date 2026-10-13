// @ts-check
import { html } from './html.js';
import { val } from './format.js';
import { num } from '../calc/util.js';

/**
 * Campo de entrada. `caminho` identifica a propriedade editada (ex.: "circ.cintura").
 * @param {Object} p
 * @param {string} p.rotulo
 * @param {string} p.caminho
 * @param {unknown} p.valor
 * @param {'texto'|'numero'|'data'|'email'|'tel'} [p.tipo]
 * @param {string} [p.unidade]
 * @param {string} [p.placeholder]
 * @param {boolean} [p.destaque]
 */
export function campo({ rotulo, caminho, valor, tipo = 'texto', unidade, placeholder = '', destaque = false }) {
  const attrs =
    tipo === 'numero'
      ? html`type="text" inputmode="decimal" autocomplete="off" data-num="1"`
      : tipo === 'data'
        ? html`type="date"`
        : tipo === 'email'
          ? html`type="email"`
          : tipo === 'tel'
            ? html`type="tel"`
            : html`type="text"`;
  return html`<label class="campo">
    <span>${rotulo}${unidade ? html` <em>(${unidade})</em>` : ''}</span>
    <input ${attrs} data-campo="${caminho}" data-foco="${caminho}" value="${tipo === 'numero' ? val(valor) : String(valor ?? '')}" placeholder="${placeholder}" ${destaque ? html`style="border-color: var(--violet-500)"` : ''} />
  </label>`;
}

/**
 * @param {Object} p
 * @param {string} p.rotulo
 * @param {string} p.caminho
 * @param {unknown} p.valor
 * @param {Array<[string|number, string]>} p.opcoes
 */
export function selecao({ rotulo, caminho, valor, opcoes }) {
  return html`<label class="campo">
    <span>${rotulo}</span>
    <select data-campo="${caminho}" data-foco="${caminho}" data-sel="1">
      ${opcoes.map(([v, r]) => html`<option value="${v}" ${String(v) === String(valor) ? 'selected' : ''}>${r}</option>`)}
    </select>
  </label>`;
}

/**
 * @param {Object} p
 * @param {string} p.rotulo
 * @param {string} p.caminho
 * @param {unknown} p.valor
 * @param {string} [p.placeholder]
 */
export function areaTexto({ rotulo, caminho, valor, placeholder = '' }) {
  return html`<label class="campo">
    <span>${rotulo}</span>
    <textarea data-campo="${caminho}" data-foco="${caminho}" placeholder="${placeholder}">${String(valor ?? '')}</textarea>
  </label>`;
}

/**
 * Escreve valor em caminho "a.b.c" criando objetos intermediários.
 * @param {any} alvo
 * @param {string} caminho
 * @param {unknown} valor
 */
export function definir(alvo, caminho, valor) {
  const partes = caminho.split('.');
  let o = alvo;
  for (const p of partes.slice(0, -1)) {
    if (typeof o[p] !== 'object' || o[p] === null) o[p] = {};
    o = o[p];
  }
  o[partes[partes.length - 1]] = valor;
}

/**
 * Converte o valor do elemento: campos numéricos viram número (ou '' se vazio).
 * @param {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} el
 */
export function lerValor(el) {
  if (el.dataset.num) {
    const n = num(el.value);
    return Number.isFinite(n) ? n : '';
  }
  return el.value;
}

/**
 * Liga os campos [data-campo] de um contêiner.
 * Digitação → onEdicao(caminho, valor, el) (salvar sem re-renderizar).
 * Seleções → onEscolha(caminho, valor, el) (geralmente re-renderiza, pois mudam a tela).
 * @param {HTMLElement} root
 * @param {(caminho: string, valor: unknown, el: HTMLElement) => void} onEdicao
 * @param {(caminho: string, valor: unknown, el: HTMLElement) => void} [onEscolha]
 */
export function ligarCampos(root, onEdicao, onEscolha = onEdicao) {
  root.addEventListener('input', (ev) => {
    const el = /** @type {HTMLInputElement} */ (ev.target);
    if (!el.dataset?.campo || el.dataset.sel) return;
    onEdicao(el.dataset.campo, lerValor(el), el);
  });
  root.addEventListener('change', (ev) => {
    const el = /** @type {HTMLInputElement} */ (ev.target);
    if (!el.dataset?.campo) return;
    if (el.dataset.sel || el.type === 'date') onEscolha(el.dataset.campo, lerValor(el), el);
  });
}

/** @param {string} nome */
export function iniciais(nome) {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '?';
  return ((p[0][0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}
