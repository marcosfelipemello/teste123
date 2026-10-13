// @ts-check
import { html } from '../ui/html.js';
import { icon } from '../ui/icons.js';
import { fmt, fmtData } from '../ui/format.js';
import { getEstado } from '../store.js';
import { ultimaAvaliacao, indicadores } from '../clinica.js';
import { iniciais } from '../ui/form.js';
import { hojeISO } from '../calc/util.js';

export function render() {
  const { pacientes, profissional } = getEstado();
  const mes = hojeISO().slice(0, 7);
  const avaliacoesMes = pacientes.reduce((n, p) => n + p.avaliacoes.filter((a) => a.data.startsWith(mes)).length, 0);
  const planos = pacientes.reduce((n, p) => n + p.planos.length, 0);
  const recentes = [...pacientes]
    .map((p) => ({ p, ult: ultimaAvaliacao(p) }))
    .sort((a, b) => (b.ult?.data ?? b.p.criadoEm).localeCompare(a.ult?.data ?? a.p.criadoEm))
    .slice(0, 6);

  return html`
    <section class="cabecalho fluxo card" style="padding: 32px">
      <div class="titulo">
        <span class="rotulo">Painel</span>
        <h1>${profissional.nome ? `Olá, ${profissional.nome.split(' ')[0]}.` : 'Seu consultório, em um só lugar.'}</h1>
        <p>Avaliação, gasto energético e plano alimentar com cálculos auditáveis e referência de cada equação.</p>
      </div>
      <div class="linha-flex">
        <a class="btn" href="#/pacientes?novo">${icon('novo', 18)} Novo paciente</a>
        <a class="btn sec" href="#/calculadoras">${icon('calculadora', 18)} Calculadoras</a>
      </div>
    </section>

    <section class="grade g3 kpis" style="margin-top: 16px">
      <div class="kpi"><div class="rotulo">Pacientes</div><div class="valor">${pacientes.length}</div></div>
      <div class="kpi"><div class="rotulo">Avaliações no mês</div><div class="valor">${avaliacoesMes}</div></div>
      <div class="kpi"><div class="rotulo">Planos alimentares</div><div class="valor">${planos}</div></div>
    </section>

    <section class="card" style="margin-top: 16px">
      <div class="linha-flex entre"><h2>Atendimentos recentes</h2><a href="#/pacientes">Ver todos</a></div>
      ${
        recentes.length
          ? html`<div class="lista-pac">
              ${recentes.map(({ p, ult }) => {
                const ind = ult ? indicadores(p, ult) : null;
                return html`<a href="#/paciente/${p.id}/avaliacoes">
                  <span class="linha-flex"><span class="avatar">${iniciais(p.nome)}</span><span>${p.nome}<br /><small>${p.objetivo || 'Sem objetivo registrado'}</small></span></span>
                  <small>${ult ? html`${fmtData(ult.data)} · ${fmt(ind?.peso ?? NaN)} kg · IMC ${fmt(ind?.imc ?? NaN)}` : 'Sem avaliação'}</small>
                </a>`;
              })}
            </div>`
          : html`<p class="vazio">Nenhum paciente ainda. Cadastre o primeiro para começar.</p>`
      }
    </section>
  `;
}
