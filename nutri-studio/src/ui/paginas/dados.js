// Backup e importação de pacientes (CSV/JSON).
import { h, baixar, lerArquivo, avisar } from '../dom.js';
import { importarCsv, importarJson, exportarCsv, CAMPOS_PACIENTE } from '../importacao.js';

export function paginaDados(raiz, db) {
  const relatorio = h('div', { class: 'pilha' });
  const entrada = h('input', { type: 'file', accept: '.csv,.json,text/csv,application/json', 'aria-label': 'Arquivo para importar' });
  let previa = null;

  entrada.addEventListener('change', async () => {
    const arq = entrada.files?.[0];
    if (!arq) return;
    const texto = await lerArquivo(arq);
    previa = /\.json$/i.test(arq.name) || texto.trim().startsWith('{') || texto.trim().startsWith('[') ? importarJson(texto) : importarCsv(texto);
    const comAviso = previa.pacientes.filter((p) => p.avisosImportacao?.length);
    relatorio.replaceChildren(
      h('div', { class: 'bloco' },
        h('p', {}, `${previa.pacientes.length} paciente(s) prontos para importar; ${previa.rejeitados.length} linha(s) recusada(s).`),
        previa.colunas ? h('p', { class: 'legenda' }, 'Colunas reconhecidas: ' + (Object.entries(previa.colunas).map(([c, n]) => `${n} → ${c}`).join(', ') || 'nenhuma')) : null,
        comAviso.length ? h('details', {}, h('summary', {}, `${comAviso.length} paciente(s) com campos ignorados`),
          h('ul', {}, comAviso.map((p) => h('li', {}, `${p.nome}: ${p.avisosImportacao.join('; ')}`)))) : null,
        previa.rejeitados.length ? h('details', {}, h('summary', {}, 'Linhas recusadas'),
          h('ul', {}, previa.rejeitados.map((r) => h('li', {}, `linha ${r.linha}: ${r.erros.join('; ') || 'sem nome'}`)))) : null,
        h('div', { class: 'acoes' }, h('button', { class: 'botao', disabled: previa.pacientes.length ? null : true, onclick: () => {
          const n = db.importarPacientes(previa.pacientes);
          avisar(`${n} paciente(s) importado(s).`);
          relatorio.replaceChildren();
          entrada.value = '';
        } }, 'Importar'))));
  });

  raiz.append(
    h('div', { class: 'cabecalho-pagina' }, h('div', {}, h('p', { class: 'rotulo' }, 'Consultório'), h('h1', {}, 'Dados e backup'))),
    h('div', { class: 'grade' },
      h('section', { class: 'cartao pilha' },
        h('h2', {}, 'Backup'),
        h('p', {}, 'Os dados ficam só neste navegador. Baixe um backup com frequência e guarde em local seguro: ele contém dados de saúde dos pacientes.'),
        h('div', { class: 'acoes' },
          h('button', { class: 'botao', onclick: () => baixar(`nutri-studio-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(db.exportarBackup(), null, 1)) }, 'Baixar backup (JSON)'),
          h('button', { class: 'botao secundario', onclick: () => baixar('pacientes.csv', exportarCsv(db.listarPacientes()), 'text/csv;charset=utf-8') }, 'Exportar pacientes (CSV)'))),
      h('section', { class: 'cartao pilha' },
        h('h2', {}, 'Importar pacientes'),
        h('p', {}, 'Aceita CSV com cabeçalho ou JSON (lista de pacientes ou backup deste app). Os pacientes entram sempre como novos; nada é sobrescrito.'),
        h('p', { class: 'legenda' }, 'Colunas do CSV: ' + Object.entries(CAMPOS_PACIENTE).map(([c, nomes]) => `${c} (${nomes.slice(0, 2).join(', ')})`).join(' · ')),
        entrada, relatorio)),
  );
}
