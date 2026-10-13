// Antropometria de crianças e adolescentes (relatório §6, conferido na tela: 35 casos × 6 saídas).
// Z-escores da OMS pelo método LMS, classificações e % de gordura de Slaughter (1988).
//
// Convenções (§3): arredondamento sempre com toFixed do JS (fx/fxn de numeros.js) e
// reaproveitamento de valores já arredondados (o z do IMC usa o IMC arredondado em 1 casa).

import { check, fx, fxn, idadeAnos, idadeMeses } from './numeros.js';
import LMS from '../dados/lms_oms_mensal.json' with { type: 'json' };

/** Idade máxima aceita, em meses, na data da avaliação (§6.1). */
export const IDADE_MAXIMA_MESES = 228;

/** Texto exibido pelo WebDiet quando a idade passa de 228 meses (§6.1). */
export const EXCECAO_IDADE = 'Idade incompatível com protocolos infantis';

/**
 * Divergências do WebDiet (relatório §12) tratadas neste módulo e o comportamento adotado.
 * @type {{item:number, descricao:string, comportamento:string}[]}
 */
export const DIVERGENCIAS = [
  {
    item: 15,
    descricao:
      'IMC/idade: meninas de 25 a 60 meses usam os LMS dos meninos (em lms_oms_mensal.json os 36 meses ' +
      'de imcIdadeMeninas são idênticos aos de imcIdadeMeninos). Ex.: menina de 30 meses, IMC 15,0 → ' +
      'z WebDiet −0,666; z OMS −0,414.',
    comportamento:
      'Mantido igual ao WebDiet. Não há opção de correção: os LMS corretos das meninas para 25–60 meses ' +
      'não estão em lms_oms_mensal.json e não podem ser inventados.',
  },
  {
    item: 16,
    descricao:
      'Slaughter, meninos com TR + SE: usa sempre 0,783Σ + 1,6 (o original tem outra equação para Σ ≤ 35).',
    comportamento: 'Mantido igual ao WebDiet.',
  },
  {
    item: 17,
    descricao: 'IMC/idade, 5 anos ou mais, z em (2; 3]: a classe "\\tObesidade" começa com um caractere TAB.',
    comportamento: 'Corrigido: o texto sai "Obesidade", sem o TAB (na tela HTML o TAB não aparece).',
  },
];

// ---------------------------------------------------------------------------
// Tabelas LMS
// ---------------------------------------------------------------------------

const CHAVES_TABELA = {
  peso: { M: 'pesoIdadeMeninos', F: 'pesoIdadeMeninas' },
  altura: { M: 'alturaIdadeMeninos', F: 'alturaIdadeMeninas' },
  imc: { M: 'imcIdadeMeninos', F: 'imcIdadeMeninas' },
};

/**
 * Devolve [L, M, S] da tabela mensal da OMS usada pelo WebDiet, ou null se o mês não existe
 * (peso/idade só vai até 120 meses; estatura e IMC até 228).
 * WebDiet §12 #15: para IMC/idade, meninas de 25 a 60 meses recebem os valores dos meninos,
 * porque é isso que a própria tabela contém.
 * @param {'peso'|'altura'|'imc'} indicador
 * @param {'M'|'F'} sexo
 * @param {number} meses idade em meses completos
 * @returns {[number, number, number] | null}
 */
export function lms(indicador, sexo, meses) {
  const chave = CHAVES_TABELA[indicador]?.[normalizarSexo(sexo)];
  if (!chave) return null;
  const linha = LMS[chave]['m' + meses];
  return linha ? /** @type {[number, number, number]} */ (linha) : null;
}

/**
 * Z-escore pelo método LMS (§6.2): z = ((valor/M)^L − 1) / (S·L), arredondado com toFixed(3) e
 * convertido em número. Sem caso especial para L = 0 e sem a correção "restricted" da OMS para |z| > 3.
 * @param {number} valor
 * @param {[number, number, number]} lmsLinha [L, M, S]
 * @returns {number}
 */
export function zEscoreLMS(valor, [L, M, S]) {
  return fxn((Math.pow(valor / M, L) - 1) / (S * L), 3);
}

// ---------------------------------------------------------------------------
// Classificações (§6.3)
// ---------------------------------------------------------------------------

/**
 * Peso/idade.
 * @param {number} z
 * @returns {string}
 */
export function classificarPesoIdade(z) {
  if (z > 2) return 'Peso elevado';
  if (z > 1) return 'Eutrófico';
  if (z > -1) return 'Adequado';
  if (z > -2) return 'Eutrófico';
  if (z > -3) return 'Baixo peso';
  return 'Muito baixo peso';
}

/**
 * Estatura/idade.
 * @param {number} z
 * @returns {string}
 */
export function classificarEstaturaIdade(z) {
  if (z > -2) return 'Estatura adequada';
  if (z > -3) return 'Baixa estatura';
  return 'Muito baixa estatura';
}

/**
 * IMC/idade. As faixas dependem da idade em anos: < 5, 5–9 e ≥ 10.
 * WebDiet §12 #17: para 5 anos ou mais e z em (2; 3] o WebDiet devolve "\tObesidade" (com TAB);
 * aqui o texto sai sem o TAB.
 * @param {number} z
 * @param {number} anos idade em anos completos
 * @returns {string}
 */
export function classificarImcIdade(z, anos) {
  const menor5 = anos < 5;
  const menor10 = anos < 10;
  if (z > 3) return menor5 ? 'Obesidade' : 'Obesidade grave';
  if (z > 2) return menor5 ? 'Sobrepeso' : 'Obesidade';
  if (z > 1) return menor5 ? 'Eutrófico' : 'Sobrepeso';
  if (z > -1) return menor10 ? 'Adequado' : 'Eutrófico';
  if (z > -2) return 'Eutrófico';
  if (z > -3) return 'Magreza';
  return 'Magreza severa';
}

/**
 * Texto da tela para um z-escore: "z (classe)", ou "-" quando z = 0 ou não existe (§6.3).
 * O z já vem arredondado (número), então "0.010" aparece como "0.01".
 * @param {number|null} z
 * @param {string|null} classe
 * @returns {string}
 */
function telaZ(z, classe) {
  if (z === null || z === 0 || !Number.isFinite(z)) return '-';
  return `${z} (${classe})`;
}

// ---------------------------------------------------------------------------
// % de gordura — Slaughter 1988 (§6.4)
// ---------------------------------------------------------------------------

/**
 * % de gordura pela equação de Slaughter, como o WebDiet.
 * - TR + PA (tem prioridade): meninos 0,735Σ + 1,0; meninas 0,610Σ + 5,1.
 * - Só TR + SE: meninos 0,783Σ + 1,6 (sempre); meninas Σ > 35 → 0,546Σ + 9,7, senão 1,33Σ − 0,013Σ² − 2,5.
 * Resultado com toFixed(2), devolvido como número.
 * Sem o par de dobras necessário, devolve null.
 * @param {{sexo:'M'|'F', dct?:number|string, dcse?:number|string, dcp?:number|string}} e dobras em mm
 * @returns {{gc:number, protocolo:'TR+PA'|'TR+SE', soma:number} | null}
 */
export function slaughter({ sexo, dct, dcse, dcp }) {
  const tr = check(dct), se = check(dcse), pa = check(dcp);
  const masc = normalizarSexo(sexo) === 'M';
  if (tr > 0 && pa > 0) {
    const s = tr + pa;
    return { gc: fxn(masc ? 0.735 * s + 1.0 : 0.61 * s + 5.1, 2), protocolo: 'TR+PA', soma: s };
  }
  if (tr > 0 && se > 0) {
    const s = tr + se;
    let gc;
    if (masc) {
      // WebDiet §12 #16: meninos usam sempre 0,783Σ + 1,6 (o original tem outra equação para Σ ≤ 35).
      gc = 0.783 * s + 1.6;
    } else if (s > 35) {
      gc = 0.546 * s + 9.7;
    } else {
      gc = 1.33 * s - 0.013 * Math.pow(s, 2) - 2.5;
    }
    return { gc: fxn(gc, 2), protocolo: 'TR+SE', soma: s };
  }
  return null;
}

/**
 * Classificação do % de gordura infantil (§6.4).
 * @param {number} gc % de gordura (já arredondado)
 * @param {'M'|'F'} sexo
 * @returns {string}
 */
export function classificarGorduraInfantil(gc, sexo) {
  const cortes = normalizarSexo(sexo) === 'M' ? [6, 10, 20, 25, 31] : [12, 15, 25, 30, 35];
  const rotulos = ['Muito baixo', 'Baixo', 'Ótimo', 'Elevado', 'Alto', 'Muito alto'];
  let i = 0;
  while (i < cortes.length && gc >= cortes[i]) i++;
  return rotulos[i];
}

// ---------------------------------------------------------------------------
// Avaliação completa
// ---------------------------------------------------------------------------

/**
 * Avaliação antropométrica infantil (aba "Antropometria infantil" do WebDiet).
 *
 * A idade vem de `meses` ou de `nascimento` + `dataAvaliacao` (sempre na data da avaliação, §6.1);
 * os anos são anos completos (equivale a floor(meses/12)).
 *
 * @param {object} e
 * @param {'M'|'F'} e.sexo
 * @param {number} [e.meses] idade em meses completos na data da avaliação
 * @param {string} [e.nascimento] "dd/mm/aaaa" (usado se `meses` não vier)
 * @param {string} [e.dataAvaliacao] "dd/mm/aaaa"
 * @param {number|string} e.peso kg
 * @param {number|string} e.altura cm
 * @param {number|string} [e.dct] dobra tricipital, mm
 * @param {number|string} [e.dcse] dobra subescapular, mm
 * @param {number|string} [e.dcp] dobra da panturrilha, mm
 * @returns {{
 *   meses:number, anos:number, excecao:string,
 *   imc:number|null,
 *   zPeso:number|null, zAltura:number|null, zImc:number|null,
 *   classePeso:string|null, classeAltura:string|null, classeImc:string|null,
 *   gc:number|null, classeGc:string|null, protocoloGc:string|null,
 *   tela:{imc:string, peso:string, altura:string, imcz:string, gc:string, gcClas:string, excecao:string}
 * }}
 */
export function avaliarInfantil(e) {
  const sexo = normalizarSexo(e.sexo);
  if (!sexo) throw new TypeError('sexo deve ser "M" ou "F"');

  let meses;
  let anos;
  if (e.meses !== undefined && e.meses !== null && e.meses !== '') {
    meses = Math.trunc(check(e.meses));
    anos = Math.floor(meses / 12);
  } else {
    meses = idadeMeses(e.nascimento, e.dataAvaliacao);
    anos = idadeAnos(e.nascimento, e.dataAvaliacao);
  }
  if (!Number.isFinite(meses) || meses < 0) throw new RangeError('idade em meses inválida');

  const vazio = {
    meses, anos, excecao: '',
    imc: null, zPeso: null, zAltura: null, zImc: null,
    classePeso: null, classeAltura: null, classeImc: null,
    gc: null, classeGc: null, protocoloGc: null,
  };

  // §6.1: acima de 228 meses a avaliação não pode ser criada.
  if (meses > IDADE_MAXIMA_MESES) {
    return {
      ...vazio,
      excecao: EXCECAO_IDADE,
      tela: { imc: '-', peso: '-', altura: '-', imcz: '-', gc: '-', gcClas: '-', excecao: EXCECAO_IDADE },
    };
  }

  const peso = check(e.peso);
  const altura = check(e.altura);

  // IMC com 1 casa; o valor arredondado alimenta o z-escore (§3, §6.2).
  const imc = peso > 0 && altura > 0 ? fxn(peso / Math.pow(altura / 100, 2), 1) : null;

  const lmsPeso = lms('peso', sexo, meses);
  const lmsAltura = lms('altura', sexo, meses);
  const lmsImc = lms('imc', sexo, meses);

  const zPeso = peso > 0 && lmsPeso ? zEscoreLMS(peso, lmsPeso) : null;
  const zAltura = altura > 0 && lmsAltura ? zEscoreLMS(altura, lmsAltura) : null;
  const zImc = imc !== null && imc > 0 && lmsImc ? zEscoreLMS(imc, lmsImc) : null;

  const classePeso = zPeso === null ? null : classificarPesoIdade(zPeso);
  const classeAltura = zAltura === null ? null : classificarEstaturaIdade(zAltura);
  const classeImc = zImc === null ? null : classificarImcIdade(zImc, anos);

  const g = slaughter({ sexo, dct: e.dct, dcse: e.dcse, dcp: e.dcp });
  const gc = g ? g.gc : null;
  const classeGc = gc === null ? null : classificarGorduraInfantil(gc, sexo);

  return {
    ...vazio,
    imc, zPeso, zAltura, zImc, classePeso, classeAltura, classeImc,
    gc, classeGc, protocoloGc: g ? g.protocolo : null,
    tela: {
      imc: imc === null ? '-' : `${fx(imc, 1)} Kg/m2`,
      peso: telaZ(zPeso, classePeso),
      altura: telaZ(zAltura, classeAltura),
      imcz: telaZ(zImc, classeImc),
      gc: gc === null ? '-' : `${gc}%`,
      gcClas: classeGc ?? '-',
      excecao: '',
    },
  };
}

/**
 * Aceita "M"/"F" (também "masculino"/"feminino", minúsculas).
 * @param {unknown} sexo
 * @returns {'M'|'F'|null}
 */
function normalizarSexo(sexo) {
  const s = String(sexo ?? '').trim().toUpperCase();
  if (s === 'M' || s === 'MASCULINO') return 'M';
  if (s === 'F' || s === 'FEMININO') return 'F';
  return null;
}
