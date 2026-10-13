// @ts-check
import { html } from '../../ui/html.js';
import { icon } from '../../ui/icons.js';
import { campo, selecao, ligarCampos, definir } from '../../ui/form.js';
import { atualizar } from '../../store.js';

/** @param {import('../../store.js').Paciente} p */
export function render(p) {
  return html`
    <section class="card">
      <h2>Dados cadastrais</h2>
      <div class="grade g4">
        <div style="grid-column: span 2">${campo({ rotulo: 'Nome completo', caminho: 'nome', valor: p.nome })}</div>
        ${selecao({ rotulo: 'Sexo biológico', caminho: 'sexo', valor: p.sexo, opcoes: [['F', 'Feminino'], ['M', 'Masculino']] })}
        ${campo({ rotulo: 'Data de nascimento', caminho: 'nascimento', valor: p.nascimento, tipo: 'data' })}
        <div style="grid-column: span 2">${campo({ rotulo: 'Objetivo', caminho: 'objetivo', valor: p.objetivo })}</div>
        ${campo({ rotulo: 'Telefone', caminho: 'telefone', valor: p.telefone, tipo: 'tel' })}
        ${campo({ rotulo: 'E-mail', caminho: 'email', valor: p.email, tipo: 'email' })}
      </div>
      <p class="ref" style="margin-top: 12px">O sexo biológico e a data de nascimento entram em todas as equações. Alterações são salvas automaticamente.</p>
    </section>
    <section class="card">
      <h3>Excluir paciente</h3>
      <p style="margin-bottom: 12px">Remove o cadastro, avaliações e planos deste navegador. Não pode ser desfeito.</p>
      <button class="btn perigo" id="excluir">${icon('lixo', 18)} Excluir paciente</button>
    </section>
  `;
}

/** @param {HTMLElement} root @param {import('../../store.js').Paciente} p */
export function montar(root, p) {
  ligarCampos(
    root,
    (c, v) => atualizar(() => definir(p, c, v), { silencioso: true }),
    (c, v) => atualizar(() => definir(p, c, v)),
  );
  root.querySelector('#excluir')?.addEventListener('click', () => {
    if (!confirm(`Excluir ${p.nome} e todos os dados associados?`)) return;
    atualizar((e) => {
      e.pacientes = e.pacientes.filter((x) => x.id !== p.id);
    }, { silencioso: true });
    location.hash = '#/pacientes';
  });
}
