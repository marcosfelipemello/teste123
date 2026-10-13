// Ponto de entrada: roteamento por hash e montagem das páginas.
import { criarArmazenamento } from './armazenamento.js';
import { paginaPacientes, paginaPaciente } from './paginas/pacientes.js';
import { paginaDados } from './paginas/dados.js';
import { h } from './dom.js';

export const db = criarArmazenamento();

/** Rotas: padrão → função que monta a página em `raiz`. Outras páginas se registram com `registrarRota`. */
const rotas = [
  [/^#\/pacientes$/, (raiz) => paginaPacientes(raiz, db)],
  [/^#\/paciente\/([^/]+)(?:\/([^/]+))?$/, (raiz, id, aba) => paginaPaciente(raiz, db, id, aba)],
  [/^#\/dados$/, (raiz) => paginaDados(raiz, db)],
];

export function registrarRota(padrao, montar) {
  rotas.push([padrao, montar]);
}

async function carregarExtras() {
  // Páginas de ferramentas gerais; cada módulo chama registrarRota ao ser importado.
  await Promise.allSettled([
    import('./paginas/alimentos.js'),
    import('./paginas/receitas.js'),
    import('./paginas/referencias.js'),
  ]);
}

function render() {
  const raiz = document.getElementById('app');
  const hash = location.hash || '#/pacientes';
  document.querySelectorAll('.nav a').forEach((a) => {
    const ativo = hash === a.getAttribute('href') || (a.getAttribute('href') === '#/pacientes' && hash.startsWith('#/paciente/'));
    if (ativo) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  for (const [padrao, montar] of rotas) {
    const m = padrao.exec(hash);
    if (m) {
      raiz.replaceChildren();
      try {
        montar(raiz, ...m.slice(1).map((x) => (x === undefined ? x : decodeURIComponent(x))));
      } catch (e) {
        console.error(e);
        raiz.replaceChildren(h('div', { class: 'aviso' }, 'Erro ao abrir esta página: ' + e.message));
      }
      return;
    }
  }
  location.hash = '#/pacientes';
}

window.addEventListener('hashchange', render);
carregarExtras().then(render);
