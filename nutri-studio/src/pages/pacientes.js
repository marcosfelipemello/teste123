// @ts-check
import { html, uid } from '../ui/html.js';
import { icon } from '../ui/icons.js';
import { fmt, fmtData } from '../ui/format.js';
import { getEstado, atualizar, novoPaciente } from '../store.js';
import { ultimaAvaliacao, indicadores } from '../clinica.js';
import { iniciais } from '../ui/form.js';
import { idadeEmAnos } from '../calc/util.js';

let filtro = '';

export function render() {
  const { pacientes } = getEstado();
  const abrirNovo = location.hash.includes('?novo');
  const termo = filtro.trim().toLowerCase();
  const lista = pacientes.filter((p) => !termo || p.nome.toLowerCase().includes(termo)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return html`
    <div class="cabecalho">
      <div class="titulo"><span class="rotulo">Cadastro</span><h1>Pacientes</h1></div>
      <a class="btn" href="#/pacientes?novo">${icon('novo', 18)} Novo paciente</a>
    </div>

    ${
      abrirNovo
        ? html`<form class="card" id="form-novo" autocomplete="off">
            <h2>Novo paciente</h2>
            <div class="grade g4">
              <label class="campo" style="grid-column: span 2"><span>Nome completo</span><input name="nome" required data-foco="novo-nome" /></label>
              <label class="campo"><span>Sexo biológico</span><select name="sexo"><option value="F">Feminino</option><option value="M">Masculino</option></select></label>
              <label class="campo"><span>Data de nascimento</span><input type="date" name="nascimento" required /></label>
              <label class="campo" style="grid-column: span 2"><span>Objetivo</span><input name="objetivo" placeholder="Ex.: emagrecimento, hipertrofia, controle glicêmico" /></label>
              <label class="campo"><span>Telefone</span><input type="tel" name="telefone" /></label>
              <label class="campo"><span>E-mail</span><input type="email" name="email" /></label>
            </div>
            <div class="linha-flex" style="margin-top: 16px">
              <button class="btn" type="submit">Cadastrar e abrir</button>
              <a class="btn sec" href="#/pacientes">Cancelar</a>
            </div>
          </form>`
        : ''
    }

    <section class="card">
      <label class="campo" style="max-width: 420px; margin-bottom: 12px">
        <span>Buscar</span>
        <input id="busca-pac" data-foco="busca-pac" value="${filtro}" placeholder="Nome do paciente" />
      </label>
      ${
        lista.length
          ? html`<div class="tabela-wrap"><table>
              <thead><tr><th>Paciente</th><th>Idade</th><th>Última avaliação</th><th class="n">Peso</th><th class="n">IMC</th><th class="n">% Gordura</th></tr></thead>
              <tbody>
                ${lista.map((p) => {
                  const ult = ultimaAvaliacao(p);
                  const ind = ult ? indicadores(p, ult) : null;
                  return html`<tr>
                    <td><a href="#/paciente/${p.id}/avaliacoes" class="linha-flex" style="color: var(--texto)"><span class="avatar">${iniciais(p.nome)}</span>${p.nome}</a></td>
                    <td>${p.nascimento ? `${idadeEmAnos(p.nascimento)} anos` : '—'}</td>
                    <td>${ult ? fmtData(ult.data) : '—'}</td>
                    <td class="n">${ind ? fmt(ind.peso) : '—'}</td>
                    <td class="n">${ind ? fmt(ind.imc) : '—'}</td>
                    <td class="n">${ind?.composicao ? fmt(ind.composicao.percentualGordura) : '—'}</td>
                  </tr>`;
                })}
              </tbody>
            </table></div>`
          : html`<p class="vazio">${pacientes.length ? 'Nenhum paciente encontrado.' : 'Nenhum paciente cadastrado.'}</p>`
      }
    </section>
  `;
}

/** @param {HTMLElement} root */
export function montar(root) {
  const busca = /** @type {HTMLInputElement|null} */ (root.querySelector('#busca-pac'));
  busca?.addEventListener('input', () => {
    filtro = busca.value;
    atualizar(() => {});
  });
  const form = /** @type {HTMLFormElement|null} */ (root.querySelector('#form-novo'));
  if (form) {
    /** @type {HTMLInputElement} */ (form.elements.namedItem('nome')).focus();
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const id = uid('pac');
      atualizar((e) => {
        e.pacientes.push(
          novoPaciente({
            id,
            nome: String(fd.get('nome') || '').trim(),
            sexo: fd.get('sexo') === 'M' ? 'M' : 'F',
            nascimento: String(fd.get('nascimento') || ''),
            objetivo: String(fd.get('objetivo') || ''),
            telefone: String(fd.get('telefone') || ''),
            email: String(fd.get('email') || ''),
          }),
        );
      }, { silencioso: true });
      location.hash = `#/paciente/${id}/avaliacoes`;
    });
  }
}
