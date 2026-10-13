// Importação e exportação de pacientes (CSV e JSON). Funções puras: não acessam o navegador.

/** Campos do paciente aceitos pelo app, com os nomes de coluna reconhecidos na importação. */
export const CAMPOS_PACIENTE = {
  nome: ['nome', 'paciente', 'nome completo', 'name'],
  sexo: ['sexo', 'genero', 'gênero', 'sex'],
  nascimento: ['nascimento', 'data de nascimento', 'data nascimento', 'dn', 'birthdate'],
  telefone: ['telefone', 'celular', 'whatsapp', 'fone', 'phone'],
  email: ['email', 'e-mail'],
  cpf: ['cpf'],
  condicao: ['condicao', 'condição', 'condicao biologica', 'condição biológica'],
  observacoes: ['observacoes', 'observações', 'obs', 'notas'],
};

const semAcento = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Lê um CSV (separador "," ou ";", aspas duplas com "" escapado, quebras de linha dentro de aspas).
 * @param {string} texto
 * @returns {string[][]} linhas × colunas
 */
export function lerCsv(texto) {
  const t = String(texto).replace(/^﻿/, '');
  const primeira = t.split(/\r?\n/, 1)[0] || '';
  const sep = (primeira.match(/;/g) || []).length > (primeira.match(/,/g) || []).length ? ';' : ',';
  const linhas = [];
  let linha = [], campo = '', aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      linha.push(campo); campo = '';
      if (linha.some((x) => x.trim() !== '')) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((x) => x.trim() !== '')) linhas.push(linha);
  return linhas;
}

/** Normaliza o sexo para "M" ou "F" (ou "" se não reconhecido). */
export function normalizarSexo(v) {
  const s = semAcento(v);
  if (['m', 'masc', 'masculino', 'homem', 'male'].includes(s)) return 'M';
  if (['f', 'fem', 'feminino', 'mulher', 'female'].includes(s)) return 'F';
  return '';
}

/** Normaliza datas "dd/mm/aaaa", "dd-mm-aaaa" ou "aaaa-mm-dd" para "dd/mm/aaaa" (ou "" se inválida). */
export function normalizarData(v) {
  const s = String(v || '').trim();
  let d, m, a;
  let r = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (r) [d, m, a] = [+r[1], +r[2], +r[3]];
  else if ((r = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) [a, m, d] = [+r[1], +r[2], +r[3]];
  else return '';
  const dt = new Date(a, m - 1, d);
  if (dt.getFullYear() !== a || dt.getMonth() !== m - 1 || dt.getDate() !== d) return '';
  const p = (x) => String(x).padStart(2, '0');
  return `${p(d)}/${p(m)}/${a}`;
}

/** Normaliza a condição biológica: "gestante", "lactante" ou "". */
export function normalizarCondicao(v) {
  const s = semAcento(v);
  if (s.startsWith('gest')) return 'gestante';
  if (s.startsWith('lact')) return 'lactante';
  return '';
}

/**
 * Converte um registro solto em paciente válido do app. Devolve {paciente, erros}.
 * @param {Record<string, unknown>} bruto
 */
export function normalizarPaciente(bruto) {
  const erros = [];
  const nome = String(bruto.nome ?? '').trim();
  if (!nome) erros.push('sem nome');
  const sexo = normalizarSexo(bruto.sexo ?? '');
  if (bruto.sexo && !sexo) erros.push(`sexo não reconhecido: "${bruto.sexo}"`);
  const nascimento = normalizarData(bruto.nascimento ?? '');
  if (bruto.nascimento && !nascimento) erros.push(`data de nascimento inválida: "${bruto.nascimento}"`);
  const paciente = {
    nome,
    sexo,
    nascimento,
    telefone: String(bruto.telefone ?? '').trim(),
    email: String(bruto.email ?? '').trim(),
    cpf: String(bruto.cpf ?? '').trim(),
    condicao: sexo === 'F' ? normalizarCondicao(bruto.condicao ?? '') : '',
    observacoes: String(bruto.observacoes ?? '').trim(),
  };
  return { paciente, erros };
}

/**
 * Importa pacientes de um CSV com cabeçalho. As colunas são reconhecidas pelos nomes de CAMPOS_PACIENTE.
 * @param {string} texto
 * @returns {{pacientes: object[], rejeitados: {linha:number, erros:string[]}[], colunas: Record<string,string>}}
 */
export function importarCsv(texto) {
  const linhas = lerCsv(texto);
  if (!linhas.length) return { pacientes: [], rejeitados: [], colunas: {} };
  const cab = linhas[0].map(semAcento);
  const indice = {}, colunas = {};
  for (const [campo, nomes] of Object.entries(CAMPOS_PACIENTE)) {
    const i = cab.findIndex((c) => nomes.map(semAcento).includes(c));
    if (i >= 0) { indice[campo] = i; colunas[campo] = linhas[0][i]; }
  }
  const pacientes = [], rejeitados = [];
  linhas.slice(1).forEach((l, k) => {
    const bruto = Object.fromEntries(Object.entries(indice).map(([campo, i]) => [campo, l[i] ?? '']));
    const { paciente, erros } = normalizarPaciente(bruto);
    if (!paciente.nome) rejeitados.push({ linha: k + 2, erros });
    else pacientes.push({ ...paciente, avisosImportacao: erros });
  });
  return { pacientes, rejeitados, colunas };
}

/**
 * Importa pacientes de JSON: aceita um array de pacientes ou um backup do app ({app:"nutri-studio", pacientes:[...]}).
 * Em um backup, os registros (avaliações, cálculos etc.) de cada paciente são mantidos.
 * @param {string} texto
 */
export function importarJson(texto) {
  let dados;
  try { dados = JSON.parse(texto); } catch (e) { return { pacientes: [], rejeitados: [{ linha: 0, erros: ['JSON inválido: ' + e.message] }] }; }
  const lista = Array.isArray(dados) ? dados : Array.isArray(dados?.pacientes) ? dados.pacientes : null;
  if (!lista) return { pacientes: [], rejeitados: [{ linha: 0, erros: ['esperado um array de pacientes ou um backup do nutri-studio'] }] };
  const pacientes = [], rejeitados = [];
  lista.forEach((bruto, k) => {
    const { paciente, erros } = normalizarPaciente(bruto || {});
    if (!paciente.nome) { rejeitados.push({ linha: k + 1, erros }); return; }
    const registros = bruto && typeof bruto.registros === 'object' && bruto.registros ? bruto.registros : {};
    pacientes.push({ ...paciente, registros, avisosImportacao: erros });
  });
  return { pacientes, rejeitados };
}

/** Gera o CSV de pacientes (só dados cadastrais), com ";" e BOM para abrir certo no Excel. */
export function exportarCsv(pacientes) {
  const campos = Object.keys(CAMPOS_PACIENTE);
  const esc = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return '﻿' + [campos.join(';'), ...pacientes.map((p) => campos.map((c) => esc(p[c])).join(';'))].join('\r\n') + '\r\n';
}
