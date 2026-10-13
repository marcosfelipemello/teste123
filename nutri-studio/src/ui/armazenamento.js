// Armazenamento local dos dados do consultório. Os dados ficam só neste navegador (localStorage);
// por isso o app oferece backup em JSON. A interface é pequena para poder trocar por um servidor depois.

const CHAVE = 'nutri-studio:v1';

/** Cria um armazenamento sobre um backend {getItem, setItem} (localStorage no navegador; um objeto nos testes). */
export function criarArmazenamento(backend = globalThis.localStorage) {
  let cache = null;

  function carregar() {
    if (cache) return cache;
    try {
      const bruto = backend?.getItem(CHAVE);
      cache = bruto ? JSON.parse(bruto) : null;
    } catch {
      cache = null;
    }
    if (!cache || typeof cache !== 'object') cache = { versao: 1, pacientes: {}, alimentos: {}, receitas: {} };
    for (const k of ['pacientes', 'alimentos', 'receitas']) cache[k] ||= {};
    return cache;
  }

  function gravar() {
    try {
      backend?.setItem(CHAVE, JSON.stringify(cache));
      return true;
    } catch {
      return false; // armazenamento cheio ou bloqueado: a interface avisa e sugere backup
    }
  }

  const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  return {
    /** Lista os pacientes em ordem alfabética. */
    listarPacientes() {
      return Object.values(carregar().pacientes).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    },
    obterPaciente(id) {
      return carregar().pacientes[id] || null;
    },
    /** Cria ou atualiza um paciente. Devolve o paciente salvo. */
    salvarPaciente(p) {
      const dados = carregar();
      const id = p.id || novoId();
      const antigo = dados.pacientes[id] || { registros: {} };
      dados.pacientes[id] = { ...antigo, ...p, id, registros: p.registros || antigo.registros || {}, atualizadoEm: new Date().toISOString() };
      gravar();
      return dados.pacientes[id];
    },
    excluirPaciente(id) {
      delete carregar().pacientes[id];
      gravar();
    },
    /** Registros de um tipo (ex.: "energia", "antropometria") do paciente, do mais novo para o mais antigo. */
    listarRegistros(idPaciente, tipo) {
      const p = carregar().pacientes[idPaciente];
      return (p?.registros?.[tipo] || []).slice().sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
    },
    salvarRegistro(idPaciente, tipo, registro) {
      const p = carregar().pacientes[idPaciente];
      if (!p) throw new Error('paciente não encontrado');
      p.registros ||= {};
      const lista = (p.registros[tipo] ||= []);
      const id = registro.id || novoId();
      const i = lista.findIndex((r) => r.id === id);
      const salvo = { ...registro, id, criadoEm: registro.criadoEm || new Date().toISOString(), atualizadoEm: new Date().toISOString() };
      if (i >= 0) lista[i] = salvo; else lista.push(salvo);
      gravar();
      return salvo;
    },
    excluirRegistro(idPaciente, tipo, idRegistro) {
      const p = carregar().pacientes[idPaciente];
      if (!p?.registros?.[tipo]) return;
      p.registros[tipo] = p.registros[tipo].filter((r) => r.id !== idRegistro);
      gravar();
    },
    /** Coleções gerais do consultório: "alimentos" (meus alimentos) e "receitas". */
    listar(colecao) {
      return Object.values(carregar()[colecao] || {});
    },
    salvar(colecao, item) {
      const dados = carregar();
      const id = item.id || novoId();
      dados[colecao][id] = { ...item, id };
      gravar();
      return dados[colecao][id];
    },
    excluir(colecao, id) {
      delete carregar()[colecao][id];
      gravar();
    },
    /**
     * Salva vários itens de uma coleção gravando uma vez só (importação de tabelas de alimentos).
     * Devolve {itens, gravado}; gravado = false se o navegador recusou (armazenamento cheio).
     */
    salvarVarios(colecao, itens) {
      const dados = carregar();
      const salvos = itens.map((item) => {
        const id = item.id || novoId();
        dados[colecao][id] = { ...item, id };
        return dados[colecao][id];
      });
      return { itens: salvos, gravado: gravar() };
    },
    /** Backup completo (para baixar em JSON). */
    exportarBackup() {
      const d = carregar();
      return { app: 'nutri-studio', versao: 1, exportadoEm: new Date().toISOString(), pacientes: Object.values(d.pacientes), alimentos: Object.values(d.alimentos), receitas: Object.values(d.receitas) };
    },
    /** Acrescenta pacientes importados (sempre como novos, sem sobrescrever). Devolve quantos entraram. */
    importarPacientes(lista) {
      let n = 0;
      for (const p of lista) {
        const { avisosImportacao, id, ...resto } = p; // eslint-disable-line no-unused-vars
        this.salvarPaciente({ ...resto, registros: resto.registros || {} });
        n++;
      }
      return n;
    },
  };
}
