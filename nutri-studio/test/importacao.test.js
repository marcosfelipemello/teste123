import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerCsv, importarCsv, importarJson, exportarCsv, normalizarData, normalizarSexo } from '../src/ui/importacao.js';

test('lerCsv: ponto e vírgula, aspas e quebra de linha dentro de aspas', () => {
  const l = lerCsv('nome;obs\r\n"Silva; Ana";"linha 1\nlinha 2"\r\n\r\nJoão;"diz ""oi"""\n');
  assert.deepEqual(l, [['nome', 'obs'], ['Silva; Ana', 'linha 1\nlinha 2'], ['João', 'diz "oi"']]);
});

test('normalização de data e sexo', () => {
  assert.equal(normalizarData('5/3/1990'), '05/03/1990');
  assert.equal(normalizarData('1990-03-05'), '05/03/1990');
  assert.equal(normalizarData('31/02/1990'), '');
  assert.equal(normalizarSexo('Feminino'), 'F');
  assert.equal(normalizarSexo('masc'), 'M');
  assert.equal(normalizarSexo('x'), '');
});

test('importarCsv reconhece colunas com acento e rejeita linha sem nome', () => {
  const r = importarCsv('Nome,Gênero,Data de nascimento,E-mail\nAna Teste,F,1990-03-05,ana@exemplo.com\n,M,01/01/2000,\nBia,?,32/01/2000,\n');
  assert.equal(r.pacientes.length, 2);
  assert.deepEqual(r.pacientes[0], { nome: 'Ana Teste', sexo: 'F', nascimento: '05/03/1990', telefone: '', email: 'ana@exemplo.com', cpf: '', condicao: '', observacoes: '', avisosImportacao: [] });
  assert.deepEqual(r.pacientes[1].avisosImportacao, ['sexo não reconhecido: "?"', 'data de nascimento inválida: "32/01/2000"']);
  assert.deepEqual(r.rejeitados, [{ linha: 3, erros: ['sem nome'] }]);
});

test('importarJson aceita array ou backup e mantém registros', () => {
  const r = importarJson(JSON.stringify({ app: 'nutri-studio', pacientes: [{ nome: 'Caio', sexo: 'M', nascimento: '15/06/1991', registros: { energia: [{ id: 'x' }] } }] }));
  assert.equal(r.pacientes.length, 1);
  assert.deepEqual(r.pacientes[0].registros, { energia: [{ id: 'x' }] });
  assert.equal(importarJson('{').pacientes.length, 0);
});

test('exportarCsv volta a ser importável', () => {
  const csv = exportarCsv([{ nome: 'Ana; Maria', sexo: 'F', nascimento: '05/03/1990', observacoes: 'diz "oi"' }]);
  const r = importarCsv(csv);
  assert.equal(r.pacientes[0].nome, 'Ana; Maria');
  assert.equal(r.pacientes[0].observacoes, 'diz "oi"');
});
