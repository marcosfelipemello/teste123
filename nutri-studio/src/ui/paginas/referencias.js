// Página "Referências" (#/referencias): as DRIs de micronutrientes usadas no planejamento (calc/dris.js,
// relatório §8.3 e §8.10) por sexo, idade e condição, com a fonte de cada faixa; e a lista das divergências
// do WebDiet (relatório §12) com o comportamento adotado em cada módulo.
import { h, campo, selecao } from '../dom.js';
import { registrarRota, db } from '../app.js';
import { referenciasMicros, NUTRIENTES, FONTES, AVISO_DADOS_INVALIDOS } from '../../calc/dris.js';
import DRIS from '../../dados/dris.json' with { type: 'json' };
import { DIVERGENCIAS as DIV_ENERGIA, CORRECOES as COR_ENERGIA } from '../../calc/energia.js';
import { DIVERGENCIAS as DIV_ANTROPO } from '../../calc/antropometria.js';
import { DIVERGENCIAS as DIV_INFANTIL } from '../../calc/infantil.js';
import { DIVERGENCIAS as DIV_GESTANTE } from '../../calc/gestante.js';
import { DIVERGENCIAS as DIV_PLANEJAMENTO } from '../../calc/planejamento.js';
import { DIVERGENCIAS as DIV_COMPRAS } from '../../calc/listaCompras.js';
import { DIVERGENCIAS as DIV_RECEITAS } from '../../calc/receitas.js';
import { DIVERGENCIAS as DIV_ALIMENTO } from '../../calc/alimentoProprio.js';
import { DIVERGENCIAS as DIV_DRIS } from '../../calc/dris.js';
import { DIVERGENCIAS as DIV_QUESTIONARIOS } from '../../calc/questionarios/index.js';
import { idadeAnos, idadeMeses, hojeTexto, partesData } from '../../calc/numeros.js';

const NOME_FONTE = {
  [FONTES.webdiet]: 'Conferido na tela do WebDiet',
  [FONTES.nasem]: 'Tabelas oficiais das DRIs (NASEM; Na e K de 2019; fibras pela Health Canada)',
};

/** Divergências por módulo, na ordem das ferramentas. */
const MODULOS = [
  ['Cálculo energético', [...DIV_ENERGIA, ...COR_ENERGIA.map((c) => ({ ...c, corrigido: true }))]],
  ['Antropometria (adultos)', DIV_ANTROPO],
  ['Antropometria (crianças)', DIV_INFANTIL],
  ['Gestação', DIV_GESTANTE],
  ['Planejamento', DIV_PLANEJAMENTO],
  ['Lista de compras', DIV_COMPRAS],
  ['Receitas', DIV_RECEITAS],
  ['Alimento pelo rótulo', DIV_ALIMENTO],
  ['Referências (DRIs)', DIV_DRIS],
  ['Questionários', DIV_QUESTIONARIOS],
];

/** "Corrigido" ou "Mantido igual ao WebDiet", pelo texto do comportamento. */
function situacao(d) {
  const t = String(d.comportamento ?? '');
  if (d.corrigido || /^Corrigido/i.test(t)) return 'Corrigido';
  if (/^Não reproduzido/i.test(t)) return 'Não reproduzido';
  if (/^Padrão igual|^Mantido|^Igual|^Pontuação igual/i.test(t)) return 'Igual ao WebDiet';
  return 'Ver nota';
}

const fonteTexto = (fonte, sexo) => (typeof fonte === 'string' ? NOME_FONTE[fonte] : `${NOME_FONTE[fonte?.[sexo]] ?? '-'}`);

export function paginaReferencias(raiz, banco = db) {
  const pacientes = banco.listarPacientes();
  const estado = { sexo: 'F', anos: '35', meses: '', condicao: '' };
  const resultado = h('div', { class: 'pilha', 'aria-live': 'polite' });

  const paciente = selecao({ 'aria-label': 'Preencher com um paciente' }, [{ valor: '', rotulo: 'Preencher com um paciente…' }, ...pacientes.map((p) => ({ valor: p.id, rotulo: p.nome }))], '');
  const sexo = selecao({ name: 'sexo' }, [{ valor: 'F', rotulo: 'Feminino' }, { valor: 'M', rotulo: 'Masculino' }], estado.sexo);
  const anos = h('input', { name: 'anos', inputmode: 'numeric', autocomplete: 'off', value: estado.anos });
  const meses = h('input', { name: 'meses', inputmode: 'numeric', autocomplete: 'off', value: estado.meses });
  const condicao = selecao({ name: 'condicao' }, [{ valor: '', rotulo: 'Nenhuma' }, { valor: 'gestante', rotulo: 'Gestante' }, { valor: 'lactante', rotulo: 'Lactante' }], estado.condicao);

  paciente.addEventListener('change', () => {
    const p = banco.obterPaciente(paciente.value);
    if (!p) return;
    if (p.sexo === 'M' || p.sexo === 'F') sexo.value = p.sexo;
    if (partesData(p.nascimento)) {
      const a = idadeAnos(p.nascimento, hojeTexto());
      anos.value = String(a);
      meses.value = a < 1 ? String(idadeMeses(p.nascimento, hojeTexto())) : '';
    }
    condicao.value = p.sexo === 'F' ? p.condicao || '' : '';
    desenhar();
  });

  function desenhar() {
    const a = anos.value.trim() === '' ? null : Math.trunc(Number(anos.value));
    const m = meses.value.trim() === '' ? null : Math.trunc(Number(meses.value));
    const r = referenciasMicros({
      sexo: sexo.value,
      condicao: sexo.value === 'F' ? condicao.value : '',
      idadeAnos: a ?? (m !== null ? Math.floor(m / 12) : null),
      idadeMeses: m ?? (a !== null ? a * 12 : null),
    });
    condicao.disabled = sexo.value !== 'F';
    if (r.aviso) {
      resultado.replaceChildren(h('p', { class: 'aviso' }, r.aviso === AVISO_DADOS_INVALIDOS ? 'Informe a idade (anos; para menores de 1 ano, os meses).' : `${r.aviso}.`));
      return;
    }
    resultado.replaceChildren(
      h('div', { class: 'destaques' },
        h('div', { class: 'resultado' }, h('span', { class: 'rotulo' }, 'Faixa'), h('span', { class: 'valor' }, r.rotulo)),
        h('div', { class: 'resultado largo' }, h('span', { class: 'rotulo' }, 'Fonte'), h('span', { class: 'valor' }, NOME_FONTE[r.fonte] ?? r.fonte))),
      h('div', { class: 'tabela-rolagem' }, h('table', { class: 'medidas' },
        h('caption', { class: 'oculto-visual' }, `Referências de micronutrientes: ${r.rotulo}`),
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Nutriente'), h('th', { scope: 'col', class: 'num' }, 'Referência'))),
        h('tbody', {}, NUTRIENTES.map((n) => h('tr', {},
          h('th', { scope: 'row' }, n.nome),
          h('td', { class: 'num' }, r.tela[`micro${n.n}`] || 'sem referência')))))),
      h('p', { class: 'legenda' }, 'Mono, poli e saturada: sem referência. Trans e álcool: "0". Colesterol e retinol: "N/D" (como na tela do WebDiet). Idade em anos (ou meses) completos; limites de faixa inclusivos.'));
  }

  [sexo, condicao].forEach((el) => el.addEventListener('change', desenhar));
  [anos, meses].forEach((el) => el.addEventListener('input', desenhar));

  const linhasFaixas = DRIS.estagios.map((e) => h('tr', {},
    h('th', { scope: 'row' }, e.rotulo),
    h('td', {}, typeof e.fonte === 'string' ? NOME_FONTE[e.fonte] : h('span', {}, `Meninos: ${fonteTexto(e.fonte, 'M')}.`, h('br'), `Meninas: ${fonteTexto(e.fonte, 'F')}.`))));

  raiz.append(
    h('div', { class: 'cabecalho-pagina' }, h('div', {}, h('p', { class: 'rotulo' }, 'Consultório'), h('h1', {}, 'Referências'))),
    h('div', { class: 'pilha' },
      h('section', { class: 'cartao pilha', 'aria-labelledby': 'ref-dris' },
        h('h2', { id: 'ref-dris' }, 'Micronutrientes (DRIs)'),
        h('p', {}, 'As mesmas referências do planejamento alimentar: RDA ou AI do estágio de vida do IOM/NASEM.'),
        pacientes.length ? campo('Paciente', paciente) : null,
        h('div', { class: 'campos compactos' },
          campo('Sexo', sexo),
          campo('Idade (anos)', anos),
          campo('Meses (menores de 1 ano)', meses),
          campo('Condição', condicao)),
        resultado),
      h('section', { class: 'cartao pilha', 'aria-labelledby': 'ref-faixas' },
        h('h2', { id: 'ref-faixas' }, 'Faixas e fontes'),
        h('div', { class: 'tabela-rolagem' }, h('table', { class: 'medidas' },
          h('caption', { class: 'oculto-visual' }, 'Fonte de cada faixa de referência'),
          h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Faixa'), h('th', { scope: 'col' }, 'Fonte'))),
          h('tbody', {}, linhasFaixas)))),
      h('section', { class: 'cartao pilha', 'aria-labelledby': 'ref-divergencias' },
        h('h2', { id: 'ref-divergencias' }, 'Divergências do WebDiet'),
        h('p', {}, 'Erros e inconsistências encontrados no WebDiet (relatório §12) e o que o app faz em cada um. As divergências científicas ficam iguais ao WebDiet até a decisão da nutricionista.'),
        ...MODULOS.filter(([, lista]) => lista.length).map(([nome, lista]) => h('details', { class: 'dobravel pilha' },
          h('summary', {}, `${nome} (${lista.length})`),
          h('ul', { class: 'lista-divergencias' }, lista.map((d) => h('li', {},
            h('p', {}, h('span', { class: 'etiqueta' }, situacao(d)), ' ', d.item ? `§12, item ${d.item}${d.questionario ? ` (${d.questionario})` : ''}: ` : `${d.questionario ? `${d.questionario}: ` : ''}`, d.descricao),
            h('p', { class: 'legenda' }, d.comportamento)))))))));
  desenhar();
}

registrarRota(/^#\/referencias$/, (raiz) => paginaReferencias(raiz, db));
