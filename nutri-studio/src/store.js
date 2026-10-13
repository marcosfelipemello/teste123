// @ts-check
import { ALIMENTOS_BASE } from './data/alimentos.js';

const CHAVE = 'nutri-studio:v1';

/**
 * @typedef {import('./calc/plano.js').Alimento} Alimento
 * @typedef {import('./calc/plano.js').Refeicao} Refeicao
 *
 * @typedef {Object} Avaliacao
 * @property {string} id
 * @property {string} data
 * @property {number|''} peso
 * @property {number|''} altura
 * @property {Record<string, number|''>} circ
 * @property {Record<string, number|''>} dobras
 * @property {string} protocolo
 * @property {'siri'|'brozek'} conversao
 * @property {number|''} bioGordura % de gordura informado (bioimpedância/ outro método)
 * @property {string} obs
 *
 * @typedef {Object} Plano
 * @property {string} id
 * @property {string} nome
 * @property {string} criadoEm
 * @property {Refeicao[]} refeicoes
 * @property {string} orientacoes
 *
 * @typedef {Object} Paciente
 * @property {string} id
 * @property {string} nome
 * @property {'M'|'F'} sexo
 * @property {string} nascimento
 * @property {string} telefone
 * @property {string} email
 * @property {string} objetivo
 * @property {string} criadoEm
 * @property {Record<string, string>} anamnese
 * @property {Avaliacao[]} avaliacoes
 * @property {{ equacao: string, basePeso: 'atual'|'ideal'|'ajustado', imcAlvo: number, fa: number, fi: number, ajuste: number, nivelIom: import('./calc/energia.js').NivelIom, kcalPorKg: number, mlKg: number }} energia
 * @property {{ modo: 'percentual'|'gkg', ptn: number, cho: number, lip: number, gkgPtn: number, gkgLip: number }} macros
 * @property {Plano[]} planos
 *
 * @typedef {Object} Estado
 * @property {number} versao
 * @property {{ nome: string, crn: string, contato: string }} profissional
 * @property {Paciente[]} pacientes
 * @property {Alimento[]} alimentosCustom
 * @property {Record<string, Alimento>} alimentosEditados
 */

/** @returns {Estado} */
function estadoInicial() {
  return { versao: 1, profissional: { nome: '', crn: '', contato: '' }, pacientes: [], alimentosCustom: [], alimentosEditados: {} };
}

/** @returns {Estado} */
function carregar() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return estadoInicial();
    return { ...estadoInicial(), ...JSON.parse(bruto) };
  } catch {
    return estadoInicial();
  }
}

let estado = carregar();
/** @type {Set<() => void>} */
const ouvintes = new Set();

export function getEstado() {
  return estado;
}

/**
 * Altera o estado, persiste e notifica.
 * @param {(e: Estado) => void} fn
 * @param {{ silencioso?: boolean }} [opts] silencioso = não re-renderiza a página (edição em formulários)
 */
export function atualizar(fn, opts = {}) {
  fn(estado);
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch (err) {
    console.error('Falha ao salvar no navegador', err);
  }
  if (!opts.silencioso) ouvintes.forEach((o) => o());
}

/** @param {() => void} fn */
export function inscrever(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

/** @param {string} id */
export function paciente(id) {
  return estado.pacientes.find((p) => p.id === id);
}

/** Todos os alimentos (base + edições + personalizados). */
export function alimentos() {
  const base = ALIMENTOS_BASE.map((a) => estado.alimentosEditados[a.id] ?? a);
  return [...base, ...estado.alimentosCustom];
}

/** @param {string} id */
export function alimento(id) {
  return estado.alimentosEditados[id] ?? ALIMENTOS_BASE.find((a) => a.id === id) ?? estado.alimentosCustom.find((a) => a.id === id);
}

/** @param {string} id */
export function ehAlimentoBase(id) {
  return ALIMENTOS_BASE.some((a) => a.id === id);
}

export function exportarJson() {
  return JSON.stringify(estado, null, 2);
}

/** @param {string} texto */
export function importarJson(texto) {
  const dados = JSON.parse(texto);
  if (!dados || typeof dados !== 'object' || !Array.isArray(dados.pacientes)) {
    throw new Error('Arquivo de backup inválido.');
  }
  atualizar((e) => {
    Object.assign(e, estadoInicial(), dados);
  });
}

export function limparTudo() {
  atualizar((e) => {
    Object.assign(e, estadoInicial());
  });
}

/** @param {Partial<Paciente>} dados @returns {Paciente} */
export function novoPaciente(dados) {
  return {
    id: '',
    nome: '',
    sexo: 'F',
    nascimento: '',
    telefone: '',
    email: '',
    objetivo: '',
    criadoEm: new Date().toISOString(),
    anamnese: {},
    avaliacoes: [],
    energia: { equacao: 'mifflin', basePeso: 'atual', imcAlvo: 22, fa: 1.55, fi: 1, ajuste: 0, nivelIom: 'ativo', kcalPorKg: 30, mlKg: 35 },
    macros: { modo: 'percentual', ptn: 20, cho: 50, lip: 30, gkgPtn: 1.6, gkgLip: 1 },
    planos: [],
    ...dados,
  };
}
