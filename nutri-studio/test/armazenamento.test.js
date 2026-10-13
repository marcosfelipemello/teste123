import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarArmazenamento } from '../src/ui/armazenamento.js';

function backendMemoria() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
}

test('pacientes e registros persistem no backend', () => {
  const b = backendMemoria();
  const a = criarArmazenamento(b);
  const p = a.salvarPaciente({ nome: 'Zeca', sexo: 'M', nascimento: '15/06/1991' });
  a.salvarPaciente({ nome: 'Ana', sexo: 'F', nascimento: '01/01/1990' });
  a.salvarRegistro(p.id, 'energia', { formula: 1 });
  const outra = criarArmazenamento(b);
  assert.deepEqual(outra.listarPacientes().map((x) => x.nome), ['Ana', 'Zeca']);
  assert.equal(outra.listarRegistros(p.id, 'energia')[0].formula, 1);
});

test('importação sempre cria pacientes novos e o backup devolve tudo', () => {
  const a = criarArmazenamento(backendMemoria());
  a.salvarPaciente({ id: 'fixo', nome: 'Original' });
  assert.equal(a.importarPacientes([{ id: 'fixo', nome: 'Importado', avisosImportacao: [] }]), 1);
  assert.equal(a.obterPaciente('fixo').nome, 'Original');
  assert.equal(a.exportarBackup().pacientes.length, 2);
});

test('coleções gerais: salvar, salvarVarios (uma gravação) e excluir', () => {
  const b = backendMemoria();
  let gravacoes = 0;
  const contando = { getItem: b.getItem, setItem: (k, v) => { gravacoes++; b.setItem(k, v); } };
  const a = criarArmazenamento(contando);
  const r = a.salvarVarios('alimentos', [{ nome: 'Arroz' }, { nome: 'Feijão' }, { id: 'x', nome: 'Ovo' }]);
  assert.equal(r.gravado, true);
  assert.equal(gravacoes, 1);
  assert.equal(r.itens.length, 3);
  assert.equal(r.itens[2].id, 'x');
  a.salvar('receitas', { nome: 'Bolo' });
  a.excluir('alimentos', 'x');
  const outra = criarArmazenamento(b);
  assert.deepEqual(outra.listar('alimentos').map((x) => x.nome).sort(), ['Arroz', 'Feijão']);
  assert.equal(outra.listar('receitas')[0].nome, 'Bolo');
  const cheio = criarArmazenamento({ getItem: () => null, setItem() { throw new Error('cheio'); } });
  assert.equal(cheio.salvarVarios('alimentos', [{ nome: 'X' }]).gravado, false);
});

test('backend com erro não derruba o app', () => {
  const a = criarArmazenamento({ getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('cheio'); } });
  assert.equal(a.salvarPaciente({ nome: 'X' }).nome, 'X');
  assert.equal(a.listarPacientes().length, 1);
});
