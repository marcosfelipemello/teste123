// Testes da antropometria de adultos e idosos (relatório §5) contra a tela do WebDiet
// (docs/webdiet-evidencias/tela_antropometria_adultos.json, 73 casos).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  calcularAntropometria,
  calcularDobras,
  classificarGordura,
  classificarRcq,
  deCamposWebDiet,
  estimarPesoChumlea,
  p50Cmb,
  preencherBioimpedancia,
  AVISO_SEM_REFERENCIA,
  CONSTANTE_POLLOCK3_FEMININO,
  DIVERGENCIAS,
  DOBRAS,
  EQUACOES_GORDURA,
  PROTOCOLOS_DOBRAS,
} from '../src/calc/antropometria.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const casos = JSON.parse(
  fs.readFileSync(path.join(aqui, '../../docs/webdiet-evidencias/tela_antropometria_adultos.json'), 'utf8'),
);

// Nomes das ações da captura → entrada deste módulo.
const ACAO = { estimarAltura: 'estimarEstatura', estimarPeso: 'estimarPeso' };
// Funções de preenchimento automático do WebDiet → campo digitado que as dispara (A70–A73).
const PREENCHER = {
  'calculoAutomatico,gordura': 'percentualGordura',
  'calculoAutomatico,magra': 'percentualMagra',
  'calculoAutomatico2,gordura': 'massaGordura',
  'calculoAutomatico2,magra': 'massaMagra',
};

/** Monta a entrada do módulo a partir de um caso da evidência. */
function entradaDoCaso(caso) {
  return deCamposWebDiet(caso.v, {
    sexo: caso.sexo,
    idade: caso.idade,
    protocolo: caso.protocolo,
    equacaoGordura: caso.ref,
    ladoBraco: caso.lado,
    acao: caso.acao ? ACAO[caso.acao] : undefined,
    preencherBio: caso.auto ? PREENCHER[caso.auto.join(',')] : undefined,
  });
}

// Campos em que a tela do WebDiet mostra um texto ANTIGO, deixado pelo caso anterior da captura: para
// essas idades o WebDiet não escreve nada no campo. Pela política do projeto (4b), o app nunca repete
// um valor antigo: a tela fica '' e a classificação/referência é null, com aviso. O teste confere que o
// valor da evidência é mesmo o do caso anterior (prova de que é texto antigo) e afirma '' + null + aviso.
//  - A41–A44 (68 e 72 anos), gc_ideal1/gc_ideal2: §12 #12 (%G acima de 65 anos). "Entre 18% e 26%" é
//    a referência FEMININA de 56–65 anos deixada pelo A40 — aparece até nos homens A41 e A43.
//  - A43–A44 (72 anos), risco: §12 #13 (RCQ a partir de 70 anos). "Risco baixo" vem do caso anterior.
//  - A60–A63 (8 e 14 anos), gc_ideal2: abaixo de 16 anos o WebDiet escreve "N/D Verif. Idade mínima"
//    na classe, mas não mexe na referência. "Entre 8% e 15%" é a referência masculina de 26–35 anos
//    deixada pelo A59 — aparece até nas meninas A60 e A62. Não consta do §12; tratado do mesmo jeito.
const TEXTO_ANTIGO = {
  A41: ['gc_ideal1', 'gc_ideal2'],
  A42: ['gc_ideal1', 'gc_ideal2'],
  A43: ['gc_ideal1', 'gc_ideal2', 'risco'],
  A44: ['gc_ideal1', 'gc_ideal2', 'risco'],
  A60: ['gc_ideal2'],
  A61: ['gc_ideal2'],
  A62: ['gc_ideal2'],
  A63: ['gc_ideal2'],
};

/** Confere que o campo antigo vem sem classificação e com aviso no resultado numérico. */
function conferirSemClassificacao(r, campo) {
  if (campo === 'gc_ideal1') {
    assert.equal(r.dobras.classificacao.rotulo, null);
    assert.equal(r.dobras.classificacao.referencia, null);
    assert.equal(r.dobras.classificacao.aviso, AVISO_SEM_REFERENCIA);
  } else if (campo === 'gc_ideal2') {
    assert.equal(r.bioimpedancia.classificacao.rotulo, null);
    assert.equal(r.bioimpedancia.classificacao.referencia, null);
    assert.ok(r.bioimpedancia.classificacao.aviso, 'referência da bioimpedância deve trazer aviso');
  } else if (campo === 'risco') {
    assert.equal(r.rcq.classificacao, null);
    assert.ok(r.avisos.includes(`RCQ: ${AVISO_SEM_REFERENCIA}`));
  }
}

test('evidência: 73 casos com ids únicos', () => {
  assert.equal(casos.length, 73);
  assert.equal(new Set(casos.map((c) => c.caso.id)).size, 73);
});

test('paridade com a tela do WebDiet, campo a campo (§5)', async (t) => {
  for (let i = 0; i < casos.length; i++) {
    const { caso, tela } = casos[i];
    await t.test(caso.id, () => {
      const r = calcularAntropometria(entradaDoCaso(caso));
      const antigos = TEXTO_ANTIGO[caso.id] ?? [];
      assert.deepEqual(Object.keys(r.tela).sort(), Object.keys(tela).sort(), `${caso.id}: campos da tela`);
      for (const [campo, esperado] of Object.entries(tela)) {
        if (campo === 'campos') {
          assert.deepEqual(Object.keys(r.tela.campos).sort(), Object.keys(esperado).sort(), `${caso.id}: campos`);
          for (const [id, valor] of Object.entries(esperado)) {
            assert.equal(r.tela.campos[id], valor, `${caso.id}: campos.${id}`);
          }
          continue;
        }
        if (antigos.includes(campo)) {
          // Texto antigo na tela do WebDiet (ver TEXTO_ANTIGO): igual ao do caso anterior; o app mostra ''.
          assert.equal(esperado, casos[i - 1].tela[campo], `${caso.id}: ${campo} deveria ser texto antigo`);
          assert.equal(r.tela[campo], '', `${caso.id}: ${campo}`);
          conferirSemClassificacao(r, campo);
          continue;
        }
        assert.equal(r.tela[campo], esperado, `${caso.id}: ${campo}`);
      }
    });
  }
});

test('§5.7 exemplo conferido: valores numéricos do caso A01', () => {
  const r = calcularAntropometria(entradaDoCaso(casos[0].caso));
  assert.equal(r.idade, 35);
  assert.equal(r.imc.arredondado, 26.1);
  assert.equal(r.imc.classificacao, 'Sobrepeso');
  assert.equal(r.dobras.somatorio, 126);
  assert.equal(r.dobras.classificacao.rotulo, 'Moderadamente alta');
  assert.deepEqual(r.dobras.classificacao.referencia, { min: 8, max: 15 });
  assert.equal(r.cmb.classificacao, 'Eutrófico');
  assert.equal(r.rcq.classificacao, 'Risco moderado');
  assert.deepEqual(r.avisos, []);
});

test('§5.1: idade calculada na data da avaliação', () => {
  const base = entradaDoCaso(casos[0].caso);
  delete base.idade;
  const r2000 = calcularAntropometria({ ...base, nascimento: '15/06/1991', dataAvaliacao: '13/10/2000' });
  const r2026 = calcularAntropometria({ ...base, nascimento: '15/06/1991', dataAvaliacao: '13/10/2026' });
  assert.equal(r2000.idade, 9);
  assert.equal(r2000.tela.class_gc, 'N/D Verif. Idade mínima');
  assert.equal(r2026.idade, 35);
  assert.equal(r2026.tela.class_gc, 'Moderadamente alta');
});

test('4b / §12 #12: %G acima de 65 anos → classificação null + aviso, nunca texto antigo', () => {
  const caso = casos.find((c) => c.caso.id === 'A41').caso; // homem, Pollock 3, %G 22,0 e bio 21,4
  const r65 = calcularAntropometria({ ...entradaDoCaso(caso), idade: 65 });
  assert.equal(r65.dobras.classificacao.rotulo, 'Elevada'); // %G ≈ 21,6 → ≤ 23 na faixa 56–65 H
  assert.equal(r65.tela.gc_ideal1, 'Entre 13% e 21%');
  for (const idade of [66, 68, 80]) {
    const r = calcularAntropometria({ ...entradaDoCaso(caso), idade });
    for (const classe of [r.dobras.classificacao, r.bioimpedancia.classificacao]) {
      assert.equal(classe.rotulo, null);
      assert.equal(classe.referencia, null);
      assert.equal(classe.aviso, AVISO_SEM_REFERENCIA);
    }
    // class_gc vazio é o que o próprio WebDiet escreve; a referência também fica vazia.
    assert.equal(r.tela.class_gc, '');
    assert.equal(r.tela.class_gc_bio, '');
    assert.equal(r.tela.gc_ideal1, '');
    assert.equal(r.tela.gc_ideal2, '');
    assert.ok(r.avisos.includes(`% de gordura (dobras): ${AVISO_SEM_REFERENCIA}`));
  }
  assert.deepEqual(classificarGordura(25, 'feminino', 70), {
    rotulo: null,
    referencia: null,
    texto: '',
    textoReferencia: '',
    aviso: AVISO_SEM_REFERENCIA,
  });
});

test('4b / §12 #13: RCQ a partir de 70 anos → risco null + aviso, nunca texto antigo', () => {
  const caso = casos.find((c) => c.caso.id === 'A43').caso;
  const r69 = calcularAntropometria({ ...entradaDoCaso(caso), idade: 69 });
  assert.equal(r69.rcq.classificacao, 'Risco baixo');
  assert.equal(r69.tela.risco, 'Risco baixo');
  for (const idade of [70, 72, 90]) {
    const r = calcularAntropometria({ ...entradaDoCaso(caso), idade });
    assert.equal(r.tela.razao, '0.88');
    assert.equal(r.rcq.classificacao, null);
    assert.equal(r.tela.risco, '');
    assert.ok(r.avisos.includes(`RCQ: ${AVISO_SEM_REFERENCIA}`));
  }
  assert.deepEqual(classificarRcq(0.95, 'masculino', 70), { rotulo: null, aviso: AVISO_SEM_REFERENCIA });
});

test('RCQ: risco usa a razão sem arredondar (0,7551 < 0,76 → baixo; "0.76" na tela)', () => {
  assert.equal(classificarRcq(74 / 98, 'feminino', 63).rotulo, 'Risco baixo');
  assert.equal(classificarRcq(0.76, 'feminino', 63).rotulo, 'Risco moderado');
});

test('%G abaixo de 16 anos: "N/D Verif. Idade mínima" e referência vazia (sem texto antigo)', () => {
  const c = classificarGordura(20, 'masculino', 15);
  assert.equal(c.texto, 'N/D Verif. Idade mínima');
  assert.equal(c.rotulo, null);
  assert.equal(c.textoReferencia, '');
  // 16 anos já classifica; limite "≤": 20 ainda é "Alta" (≤ 20), 20,01 já é "Muito alta".
  assert.equal(classificarGordura(20, 'masculino', 16).rotulo, 'Alta');
  assert.equal(classificarGordura(20.01, 'masculino', 16).rotulo, 'Muito alta');
});

test('4c / §12 #11: Pollock 3 feminino — constante do WebDiet por padrão, da literatura com corrigir', () => {
  assert.equal(CONSTANTE_POLLOCK3_FEMININO.webdiet, 1.099421);
  assert.equal(CONSTANTE_POLLOCK3_FEMININO.literatura, 1.0994921);
  const entrada = entradaDoCaso(casos.find((c) => c.caso.id === 'A14').caso); // mulher, 35 a, Brozek
  const padrao = calcularAntropometria(entrada);
  const corrigido = calcularAntropometria(entrada, { corrigir: true });
  assert.equal(padrao.tela.gc, '27.1%'); // = tela do WebDiet (A14)
  assert.equal(corrigido.tela.gc, '27.0%');
  assert.equal(corrigido.tela.densidade, '1.036 Kg/L');
  assert.ok(Math.abs(corrigido.dobras.densidade - padrao.dobras.densidade - (1.0994921 - 1.099421)) < 1e-12);
  const dif = padrao.dobras.percentualGordura - corrigido.dobras.percentualGordura;
  assert.ok(dif > 0.025 && dif < 0.035, `diferença no %G ≈ 0,03 ponto (obtido ${dif})`); // §12 #11
  // Padrão explícito {} é igual a sem opções; homens não mudam com corrigir.
  assert.deepEqual(calcularAntropometria(entrada, {}).tela, padrao.tela);
  const homem = entradaDoCaso(casos.find((c) => c.caso.id === 'A02').caso);
  assert.deepEqual(calcularAntropometria(homem, { corrigir: true }).tela, calcularAntropometria(homem).tela);
});

test('§12 #10: estimativa de peso de Chumlea com o sexo trocado (mantido como no WebDiet)', () => {
  const dados = { bracoEsquerdo: 29, panturrilha: 33, subescapular: 14, alturaJoelho: 52.5 };
  const m = estimarPesoChumlea({ sexo: 'M', ...dados });
  const f = estimarPesoChumlea({ sexo: 'F', ...dados });
  assert.equal(m.texto, (0.98 * 29 + 1.27 * 33 + 0.4 * 14 + 0.87 * 52.5 - 62.35).toFixed(1)); // equação "−62,35"
  assert.equal(f.texto, (1.73 * 29 + 0.98 * 33 + 0.37 * 14 + 1.16 * 52.5 - 81.69).toFixed(1)); // equação "−81,69"
  assert.equal(estimarPesoChumlea({ sexo: 'M', ...dados, subescapular: '' }).erro, 'Dados incompletos!');
});

test('§12 #14: p50 da CMB de meninas de 4 anos = 11 (mantido como no WebDiet)', () => {
  assert.equal(p50Cmb('feminino', 4), 11);
  assert.equal(p50Cmb('feminino', 3), 13.2);
  assert.equal(p50Cmb('feminino', 5), 14.2);
  assert.equal(p50Cmb('masculino', 4), 14.1);
});

test('4e: DIVERGENCIAS lista os itens 10 a 14 do §12', () => {
  assert.deepEqual(DIVERGENCIAS.map((d) => d.item), [10, 11, 12, 13, 14]);
  for (const d of DIVERGENCIAS) {
    assert.equal(typeof d.descricao, 'string');
    assert.equal(typeof d.comportamento, 'string');
    assert.ok(d.descricao.length > 0 && d.comportamento.length > 0);
  }
});

test('bioimpedância: preenchimento automático não recalcula a tela (A72); recalcular atualiza', () => {
  assert.deepEqual(preencherBioimpedancia('massaGordura', { peso: 80, massaGordura: 17.3 }), {
    percentualGordura: '21.6',
    massaLivreGordura: '62.7',
  });
  const r = calcularAntropometria({ sexo: 'M', idade: 35, peso: 80, estatura: 175, bioimpedancia: { percentualGordura: '21.6' } });
  assert.equal(r.tela.bioimpedancia_gordura_rel, '21.6%');
  assert.equal(r.tela.class_gc_bio, 'Alta');
  assert.equal(preencherBioimpedancia('percentualGordura', { peso: '', percentualGordura: 20 }), null);
});

test('catálogos: protocolos usam dobras válidas e equações de %G', () => {
  const chaves = new Set(DOBRAS.map((d) => d.chave));
  assert.equal(DOBRAS.length, 10);
  for (const [nome, p] of Object.entries(PROTOCOLOS_DOBRAS)) {
    for (const sexo of ['masculino', 'feminino']) {
      assert.ok(p.dobras[sexo].every((k) => chaves.has(k)), `${nome}/${sexo}`);
    }
  }
  assert.equal(PROTOCOLOS_DOBRAS.pollock7.dobras.masculino.length, 7);
  assert.equal(PROTOCOLOS_DOBRAS.nenhuma.dobras.feminino.length, 10);
  assert.equal(EQUACOES_GORDURA.brozek.padrao, true);
  // Protocolo com dobra vazia: calcula como o WebDiet (check → 0), mas avisa.
  const r = calcularDobras({ protocolo: 'durnin', sexo: 'masculino', idade: 35, dobras: { tricipital: 10, subescapular: 12, suprailiaca: 15 } });
  assert.deepEqual(r.dobrasAusentes, ['bicipital']);
  assert.throws(() => calcularDobras({ protocolo: 'xyz', sexo: 'masculino', idade: 30 }), RangeError);
});
