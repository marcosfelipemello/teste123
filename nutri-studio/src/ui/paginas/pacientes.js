// Lista de pacientes, cadastro e ficha do paciente (com abas das ferramentas).
import { h, campo, selecao, lerFormulario, avisar } from '../dom.js';
import { idadeAnos, idadeMeses, hojeTexto } from '../../calc/numeros.js';
import { normalizarData } from '../importacao.js';

/** Abas da ficha: cada ferramenta se registra aqui com {id, rotulo, disponivel(paciente), montar(raiz, ctx)}. */
export const ABAS = [];
export function registrarAba(aba) {
  ABAS.push(aba);
  ABAS.sort((a, b) => (a.ordem ?? 50) - (b.ordem ?? 50));
}

export function descreverIdade(p, referencia = hojeTexto()) {
  if (!p.nascimento) return 'idade não informada';
  const anos = idadeAnos(p.nascimento, referencia);
  if (anos < 2) return `${idadeMeses(p.nascimento, referencia)} meses`;
  return `${anos} anos`;
}

export function paginaPacientes(raiz, db) {
  let filtro = '';
  const lista = h('ul', { class: 'lista-pacientes' });
  const busca = h('input', { type: 'search', placeholder: 'Buscar por nome', 'aria-label': 'Buscar paciente', oninput: (e) => { filtro = e.target.value; desenhar(); } });

  function desenhar() {
    const termo = filtro.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const pacientes = db.listarPacientes().filter((p) => p.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(termo));
    lista.replaceChildren(...(pacientes.length ? pacientes.map((p) => h('li', {}, h('a', { href: `#/paciente/${encodeURIComponent(p.id)}` },
      h('span', {}, p.nome),
      h('small', {}, [p.sexo === 'F' ? 'Feminino' : p.sexo === 'M' ? 'Masculino' : '', descreverIdade(p)].filter(Boolean).join(' · '))))) :
      [h('li', { class: 'vazio' }, filtro ? 'Nenhum paciente com esse nome.' : 'Nenhum paciente ainda. Cadastre o primeiro ou importe uma lista em "Dados e backup".')]));
  }

  raiz.append(
    h('div', { class: 'cabecalho-pagina' },
      h('div', {}, h('p', { class: 'rotulo' }, 'Consultório'), h('h1', {}, 'Pacientes')),
      h('div', { class: 'acoes' }, h('button', { class: 'botao', onclick: () => formularioPaciente(raiz, db, null) }, 'Novo paciente'))),
    h('div', { class: 'pilha' }, busca, lista),
  );
  desenhar();
}

/** Formulário de cadastro/edição. */
export function formularioPaciente(raiz, db, paciente) {
  const p = paciente || { sexo: '', condicao: '' };
  const form = h('form', { class: 'cartao pilha', novalidate: true },
    h('h2', {}, paciente ? 'Editar paciente' : 'Novo paciente'),
    h('div', { class: 'campos' },
      campo('Nome', h('input', { name: 'nome', value: p.nome || '', required: true, autocomplete: 'off' })),
      campo('Sexo', selecao({ name: 'sexo' }, [{ valor: '', rotulo: 'Selecione' }, { valor: 'F', rotulo: 'Feminino' }, { valor: 'M', rotulo: 'Masculino' }], p.sexo)),
      campo('Nascimento', h('input', { name: 'nascimento', value: p.nascimento || '', placeholder: 'dd/mm/aaaa', inputmode: 'numeric' })),
      campo('Condição', selecao({ name: 'condicao' }, [{ valor: '', rotulo: 'Nenhuma' }, { valor: 'gestante', rotulo: 'Gestante' }, { valor: 'lactante', rotulo: 'Lactante' }], p.condicao), 'Só para sexo feminino.'),
      campo('Telefone', h('input', { name: 'telefone', value: p.telefone || '', inputmode: 'tel' })),
      campo('E-mail', h('input', { name: 'email', value: p.email || '', type: 'email' })),
    ),
    campo('Observações', h('textarea', { name: 'observacoes' }, p.observacoes || '')),
    h('div', { class: 'acoes' },
      h('button', { class: 'botao', type: 'submit' }, 'Salvar'),
      h('button', { class: 'botao secundario', type: 'button', onclick: () => history.back() }, 'Cancelar')),
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = lerFormulario(form);
    if (!d.nome.trim()) { avisar('Informe o nome.'); return; }
    const nascimento = d.nascimento ? normalizarData(d.nascimento) : '';
    if (d.nascimento && !nascimento) { avisar('Data de nascimento inválida. Use dd/mm/aaaa.'); return; }
    const salvo = db.salvarPaciente({ ...(paciente || {}), ...d, nome: d.nome.trim(), nascimento, condicao: d.sexo === 'F' ? d.condicao : '' });
    location.hash = `#/paciente/${encodeURIComponent(salvo.id)}`;
  });
  raiz.replaceChildren(form);
  form.querySelector('[name=nome]').focus();
}

export function paginaPaciente(raiz, db, id, abaAtual) {
  const p = db.obterPaciente(id);
  if (!p) { raiz.append(h('div', { class: 'vazio' }, 'Paciente não encontrado. ', h('a', { href: '#/pacientes' }, 'Voltar'))); return; }
  const abas = [{ id: 'perfil', rotulo: 'Perfil', ordem: 0 }, ...ABAS.filter((a) => !a.disponivel || a.disponivel(p))];
  const atual = abas.find((a) => a.id === abaAtual) || abas[0];
  const conteudo = h('section', { 'aria-live': 'polite' });

  raiz.append(
    h('div', { class: 'cabecalho-pagina' },
      h('div', {}, h('p', { class: 'rotulo' }, [p.sexo === 'F' ? 'Feminino' : p.sexo === 'M' ? 'Masculino' : 'Sexo não informado', descreverIdade(p), p.condicao].filter(Boolean).join(' · ')), h('h1', {}, p.nome)),
      h('div', { class: 'acoes' }, h('a', { class: 'botao secundario', href: '#/pacientes' }, 'Pacientes'))),
    h('nav', { class: 'abas', role: 'tablist', 'aria-label': 'Ferramentas do paciente' }, abas.map((a) =>
      h('button', { role: 'tab', 'aria-selected': a.id === atual.id ? 'true' : 'false', onclick: () => { location.hash = `#/paciente/${encodeURIComponent(id)}/${a.id}`; } }, a.rotulo))),
    conteudo,
  );

  if (atual.id === 'perfil') {
    conteudo.append(h('div', { class: 'grade' },
      h('div', { class: 'resultado' }, h('span', { class: 'rotulo' }, 'Nascimento'), h('span', { class: 'valor' }, p.nascimento || '—')),
      h('div', { class: 'resultado' }, h('span', { class: 'rotulo' }, 'Telefone'), h('span', { class: 'valor' }, p.telefone || '—')),
      h('div', { class: 'resultado' }, h('span', { class: 'rotulo' }, 'E-mail'), h('span', { class: 'valor' }, p.email || '—'))),
      p.observacoes ? h('p', { class: 'bloco', style: 'margin-top:16px;white-space:pre-wrap' }, p.observacoes) : null,
      h('div', { class: 'acoes', style: 'margin-top:24px' },
        h('button', { class: 'botao', onclick: () => formularioPaciente(raiz, db, p) }, 'Editar dados'),
        h('button', { class: 'botao discreto', onclick: () => {
          if (confirm(`Excluir ${p.nome} e todos os registros? Esta ação não pode ser desfeita.`)) { db.excluirPaciente(p.id); location.hash = '#/pacientes'; }
        } }, 'Excluir paciente')));
    return;
  }
  atual.montar(conteudo, { db, paciente: p, recarregar: () => paginaPacienteRecarregar(raiz, db, id, atual.id) });
}

function paginaPacienteRecarregar(raiz, db, id, aba) {
  raiz.replaceChildren();
  paginaPaciente(raiz, db, id, aba);
}
