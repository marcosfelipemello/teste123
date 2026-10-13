// @ts-check
import { html, uid } from '../../ui/html.js';
import { icon } from '../../ui/icons.js';
import { fmt, fmtData } from '../../ui/format.js';
import { campo, selecao, areaTexto, ligarCampos, definir } from '../../ui/form.js';
import { atualizar } from '../../store.js';
import { avaliacoesOrdenadas, indicadores } from '../../clinica.js';
import { PROTOCOLOS, DOBRAS, CONVERSOES, protocoloPorId } from '../../calc/composicao.js';
import { hojeISO } from '../../calc/util.js';

/** @type {Record<string, string>} paciente → avaliação selecionada */
const selecionada = {};

const CIRCUNFERENCIAS = [
  ['cintura', 'Cintura'],
  ['quadril', 'Quadril'],
  ['abdomen', 'Abdômen'],
  ['braco', 'Braço relaxado'],
  ['coxa', 'Coxa'],
  ['panturrilha', 'Panturrilha'],
];

/** @param {import('../../store.js').Paciente} p */
function atual(p) {
  const lista = avaliacoesOrdenadas(p);
  return lista.find((a) => a.id === selecionada[p.id]) ?? lista[lista.length - 1];
}

/**
 * @param {string} rotulo
 * @param {string} valor
 * @param {string} [unidade]
 * @param {import('../../ui/html.js').Raw | string} [det]
 */
const kpi = (rotulo, valor, unidade = '', det = '') =>
  html`<div class="kpi"><div class="rotulo">${rotulo}</div><div class="valor">${valor}${unidade ? html`<small>${unidade}</small>` : ''}</div>${det ? html`<div class="det">${det}</div>` : ''}</div>`;

/** @param {{ rotulo: string, nivel: string } | null | undefined} c */
const selo = (c) => (c ? html`<span class="selo ${c.nivel}">${c.rotulo}</span>` : '');

/**
 * Painel de resultados — re-renderizado a cada digitação.
 * @param {import('../../store.js').Paciente} p
 * @param {import('../../store.js').Avaliacao} a
 */
function resultados(p, a) {
  const r = indicadores(p, a);
  const prot = protocoloPorId(a.protocolo);
  const cd = r.composicaoDobras;
  return html`
    <div class="grade g4 kpis">
      ${kpi('IMC', fmt(r.imc), 'kg/m²', selo(r.imc ? r.classificacaoImc : null))}
      ${kpi('% Gordura', r.composicao ? fmt(r.composicao.percentualGordura) : '—', '%', r.composicao ? `por ${r.composicao.origem}` : 'informe dobras ou %')}
      ${kpi('Massa gorda', r.composicao ? fmt(r.composicao.massaGorda) : '—', 'kg')}
      ${kpi('Massa livre de gordura', r.composicao ? fmt(r.composicao.massaMagra) : '—', 'kg')}
    </div>
    <div class="tabela-wrap" style="margin-top: 16px">
      <table>
        <tbody>
          <tr><td>Classificação do IMC</td><td>${selo(r.classificacaoImc)} <span class="ref">${r.classificacaoImc.referencia}</span></td></tr>
          <tr><td>Faixa de peso para IMC 18,5–24,9</td><td class="mono">${fmt(r.faixaSaudavel.min)} a ${fmt(r.faixaSaudavel.max)} kg</td></tr>
          <tr><td>Circunferência da cintura</td><td>${r.riscoCintura ? selo(r.riscoCintura) : '—'} <span class="ref">OMS: ≥ ${p.sexo === 'M' ? '94/102' : '80/88'} cm</span></td></tr>
          <tr><td>Relação cintura/quadril</td><td class="mono">${r.rcq ? html`${fmt(r.rcq.valor, 2)} ${selo(r.rcq)}` : '—'} <span class="ref">OMS: ≥ ${p.sexo === 'M' ? '0,90' : '0,85'}</span></td></tr>
          <tr><td>Relação cintura/estatura</td><td class="mono">${r.rcest ? html`${fmt(r.rcest.valor, 2)} ${selo(r.rcest)}` : '—'} <span class="ref">ponto de corte 0,50</span></td></tr>
          <tr><td>Circunferência muscular do braço</td><td class="mono">${fmt(r.cmb)} cm <span class="ref">CB − π × DCT</span></td></tr>
          <tr><td>Área muscular do braço corrigida</td><td class="mono">${fmt(r.amb)} cm² <span class="ref">Heymsfield et al., 1982</span></td></tr>
          <tr><td>Densidade corporal</td><td class="mono">${cd?.densidade ? fmt(cd.densidade, 4) + ' g/mL' : '—'} ${cd?.densidade ? html`<span class="ref">${CONVERSOES[a.conversao || 'siri'].nome}</span>` : ''}</td></tr>
          <tr><td>Soma das dobras do protocolo</td><td class="mono">${cd && Number.isFinite(cd.somaDobras) ? `${fmt(cd.somaDobras)} mm` : '—'}</td></tr>
        </tbody>
      </table>
    </div>
    ${cd && cd.faltando.length ? html`<div class="aviso warning" style="margin-top: 12px">Para ${prot?.nome}, faltam: ${cd.faltando.map((d) => DOBRAS[d]).join(', ')}.</div>` : ''}
    ${prot ? html`<p class="ref" style="margin-top: 12px">${prot.nome} · ${prot.publico}. ${prot.referencia}</p>` : ''}
  `;
}

/** @param {import('../../store.js').Paciente} p */
export function render(p) {
  const lista = avaliacoesOrdenadas(p);
  const a = atual(p);
  const necessarias = a ? protocoloPorId(a.protocolo)?.dobras(p.sexo) ?? [] : [];
  if (!p.nascimento) {
    return html`<div class="aviso warning">Informe a data de nascimento na aba <a href="#/paciente/${p.id}/dados">Cadastro</a> para calcular os indicadores.</div>${render2()}`;
  }
  return render2();

  function render2() {
    return html`
      <section class="card">
        <div class="linha-flex entre">
          <div><h2>Avaliações antropométricas</h2></div>
          <div class="linha-flex">
            ${lista.length ? html`<button class="btn sec peq" id="duplicar">${icon('copiar', 16)} Nova a partir desta</button>` : ''}
            <button class="btn peq" id="nova">${icon('novo', 16)} Nova avaliação</button>
          </div>
        </div>
        ${
          lista.length
            ? html`<div class="linha-flex" style="margin-top: 8px">
                ${[...lista].reverse().map((x) => html`<button class="btn ${x.id === a?.id ? '' : 'sec'} peq" data-sel-av="${x.id}">${fmtData(x.data)}</button>`)}
              </div>`
            : html`<p class="vazio">Nenhuma avaliação registrada. Crie a primeira para calcular IMC, composição corporal e gasto energético.</p>`
        }
      </section>

      ${
        a
          ? html`
        <section class="card">
          <div class="linha-flex entre"><h2>Medidas · ${fmtData(a.data)}</h2><button class="btn perigo peq" id="excluir-av">${icon('lixo', 16)} Excluir</button></div>
          <div class="grade g4">
            ${campo({ rotulo: 'Data', caminho: 'data', valor: a.data, tipo: 'data' })}
            ${campo({ rotulo: 'Peso', caminho: 'peso', valor: a.peso, tipo: 'numero', unidade: 'kg' })}
            ${campo({ rotulo: 'Estatura', caminho: 'altura', valor: a.altura, tipo: 'numero', unidade: 'cm' })}
            ${campo({ rotulo: '% gordura informado', caminho: 'bioGordura', valor: a.bioGordura, tipo: 'numero', unidade: 'bioimpedância/ outro' })}
          </div>
          <h3 style="margin-top: 24px">Circunferências <span class="ref">(cm)</span></h3>
          <div class="grade g3">
            ${CIRCUNFERENCIAS.map(([k, r]) => campo({ rotulo: r, caminho: `circ.${k}`, valor: a.circ?.[k], tipo: 'numero' }))}
          </div>
          <h3 style="margin-top: 24px">Dobras cutâneas <span class="ref">(mm · campos destacados = exigidos pelo protocolo)</span></h3>
          <div class="grade g2" style="margin-bottom: 12px">
            ${selecao({ rotulo: 'Protocolo', caminho: 'protocolo', valor: a.protocolo, opcoes: [['', 'Nenhum (usar % informado)'], ...PROTOCOLOS.map((x) => /** @type {[string, string]} */ ([x.id, x.nome]))] })}
            ${selecao({ rotulo: 'Conversão densidade → % gordura', caminho: 'conversao', valor: a.conversao, opcoes: [['siri', 'Siri (1961)'], ['brozek', 'Brozek (1963)']] })}
          </div>
          <div class="grade g3">
            ${Object.entries(DOBRAS).map(([k, r]) =>
              campo({ rotulo: r, caminho: `dobras.${k}`, valor: a.dobras?.[k], tipo: 'numero', destaque: necessarias.includes(/** @type {any} */ (k)) }),
            )}
          </div>
          <div style="margin-top: 16px">${areaTexto({ rotulo: 'Observações', caminho: 'obs', valor: a.obs })}</div>
        </section>
        <section class="card">
          <h2>Resultados</h2>
          <div id="resultados">${resultados(p, a)}</div>
        </section>`
          : ''
      }
    `;
  }
}

/** @param {HTMLElement} root @param {import('../../store.js').Paciente} p */
export function montar(root, p) {
  const a = atual(p);
  const slot = /** @type {HTMLElement|null} */ (root.querySelector('#resultados'));

  /** @param {Partial<import('../../store.js').Avaliacao>} base */
  const criar = (base) => {
    const id = uid('av');
    selecionada[p.id] = id;
    atualizar(() => {
      p.avaliacoes.push({
        data: hojeISO(),
        peso: '',
        altura: '',
        circ: {},
        dobras: {},
        protocolo: 'jp7',
        conversao: 'siri',
        bioGordura: '',
        obs: '',
        ...base,
        id,
      });
    });
  };

  root.querySelector('#nova')?.addEventListener('click', () => {
    const ult = avaliacoesOrdenadas(p).at(-1);
    criar({ altura: ult?.altura ?? '', protocolo: ult?.protocolo ?? 'jp7', conversao: ult?.conversao ?? 'siri' });
  });
  root.querySelector('#duplicar')?.addEventListener('click', () => {
    if (!a) return;
    criar({ ...structuredClone(a), data: hojeISO(), obs: '' });
  });
  root.querySelectorAll('[data-sel-av]').forEach((b) =>
    b.addEventListener('click', () => {
      selecionada[p.id] = /** @type {HTMLElement} */ (b).dataset.selAv ?? '';
      atualizar(() => {});
    }),
  );
  root.querySelector('#excluir-av')?.addEventListener('click', () => {
    if (!a || !confirm(`Excluir a avaliação de ${fmtData(a.data)}?`)) return;
    atualizar(() => {
      p.avaliacoes = p.avaliacoes.filter((x) => x.id !== a.id);
    });
  });

  if (!a) return;
  ligarCampos(
    root,
    (c, v) => {
      atualizar(() => definir(a, c, v), { silencioso: true });
      if (slot) slot.innerHTML = resultados(p, a).s;
    },
    (c, v) => atualizar(() => definir(a, c, v)),
  );
}
