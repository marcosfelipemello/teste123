// @ts-check
import { html } from './ui/html.js';
import { icon } from './ui/icons.js';
import { inscrever } from './store.js';
import * as inicio from './pages/inicio.js';
import * as pacientes from './pages/pacientes.js';
import * as paciente from './pages/paciente.js';
import * as alimentos from './pages/alimentos.js';
import * as calculadoras from './pages/calculadoras.js';
import * as config from './pages/config.js';
import * as imprimir from './pages/imprimir.js';

/**
 * @typedef {{ render: (params: string[]) => import('./ui/html.js').Raw, montar?: (root: HTMLElement, params: string[]) => void }} Pagina
 */

/** @type {Array<[RegExp, Pagina, string]>} */
const ROTAS = [
  [/^\/?$/, inicio, 'inicio'],
  [/^\/pacientes\/?$/, pacientes, 'pacientes'],
  [/^\/paciente\/([^/]+)(?:\/([^/]+))?$/, paciente, 'pacientes'],
  [/^\/alimentos\/?$/, alimentos, 'alimentos'],
  [/^\/calculadoras\/?$/, calculadoras, 'calculadoras'],
  [/^\/config\/?$/, config, 'config'],
  [/^\/imprimir\/([^/]+)\/([^/]+)$/, imprimir, ''],
];

const MENU = [
  ['inicio', '#/', 'Início'],
  ['pacientes', '#/pacientes', 'Pacientes'],
  ['alimentos', '#/alimentos', 'Alimentos'],
  ['calculadoras', '#/calculadoras', 'Calculadoras'],
  ['config', '#/config', 'Configurações'],
];

const simbolo = html`<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path fill="#6A00FF" d="M4 3h4v7.2L15.6 3H21l-8.4 8.1L21 21h-5.3l-6-7.1L8 15.5V21H4z"/></svg>`;

function layout(/** @type {string} */ ativo, /** @type {import('./ui/html.js').Raw} */ conteudo) {
  return html`<div class="app">
    <aside class="lateral">
      <a class="marca" href="#/" aria-label="Nutri Studio, início">
        ${simbolo}
        <div><strong>Nutri Studio</strong><small>CONSULTÓRIO DIGITAL</small></div>
      </a>
      <nav class="menu" aria-label="Principal">
        ${MENU.map(([id, href, nome]) => html`<a href="${href}" class="${ativo === id ? 'ativo' : ''}" title="${nome}">${icon(id)}<span>${nome}</span></a>`)}
      </nav>
      <div class="rodape">Dados salvos neste navegador.<br />Faça backup em Configurações.</div>
    </aside>
    <main class="conteudo" id="pagina">${conteudo}</main>
  </div>`;
}

const raiz = /** @type {HTMLElement} */ (document.getElementById('app'));

function renderizar() {
  const caminho = decodeURI(location.hash.replace(/^#/, '')).split('?')[0] || '/';
  for (const [re, pagina, menu] of ROTAS) {
    const m = caminho.match(re);
    if (!m) continue;
    const params = m.slice(1).map((s) => s ?? '');
    const scrollY = window.scrollY;
    const foco = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.foco : undefined;
    const corpo = pagina.render(params);
    raiz.innerHTML = menu === '' ? corpo.s : layout(menu, corpo).s;
    pagina.montar?.(raiz, params);
    window.scrollTo(0, scrollY);
    if (foco) /** @type {HTMLElement|null} */ (raiz.querySelector(`[data-foco="${foco}"]`))?.focus();
    return;
  }
  location.hash = '#/';
}

let rotaAnterior = location.hash;
window.addEventListener('hashchange', () => {
  const mudouPagina = location.hash.split('/').slice(0, 3).join('/') !== rotaAnterior.split('/').slice(0, 3).join('/');
  rotaAnterior = location.hash;
  renderizar();
  if (mudouPagina) window.scrollTo(0, 0);
});
inscrever(renderizar);
renderizar();
