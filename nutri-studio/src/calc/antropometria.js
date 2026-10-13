// Antropometria de adultos e idosos — relatório docs/webdiet-analise.md §5.
// Convenções numéricas: §3 (check / toFixed / valores intermediários arredondados).
// Divergências do WebDiet tratadas aqui: §12, itens 10 a 14 (ver DIVERGENCIAS no fim do arquivo).
//
// Tudo é função pura sobre objetos simples. `calcularAntropometria` devolve os valores numéricos e
// um objeto `tela` com os mesmos textos (e os mesmos nomes de campo) que a tela do WebDiet exibe.

import { check, fx, fxn, idadeAnos } from './numeros.js';

/** @typedef {'masculino'|'feminino'} Sexo */

/** Texto que o WebDiet mostra quando o campo não tem valor. */
const VAZIO = '-';

/** Aviso usado quando o WebDiet não classifica e deixaria um texto antigo na tela (§12 itens 12 e 13). */
export const AVISO_SEM_REFERENCIA = 'Sem referência de classificação para esta idade';

// ---------------------------------------------------------------------------------------------
// Catálogos de campos (para montar formulários). `idWebDiet` é o id do campo na tela do WebDiet,
// como aparece nos arquivos de evidência; serve para importar dados e para os testes de paridade.
// ---------------------------------------------------------------------------------------------

/** As 10 dobras cutâneas aceitas (§5.1), em mm, na ordem da tela. */
export const DOBRAS = Object.freeze([
  { chave: 'tricipital', sigla: 'TR', rotulo: 'Tricipital', idWebDiet: 'dobra_triceptal' },
  { chave: 'bicipital', sigla: 'BI', rotulo: 'Bicipital', idWebDiet: 'dobra_biciptal' },
  { chave: 'abdominal', sigla: 'AB', rotulo: 'Abdominal', idWebDiet: 'dobra_abdominal' },
  { chave: 'subescapular', sigla: 'SE', rotulo: 'Subescapular', idWebDiet: 'dobra_subescapular' },
  { chave: 'axilarMedia', sigla: 'AX', rotulo: 'Axilar média', idWebDiet: 'dobra_axilar' },
  { chave: 'coxa', sigla: 'CX', rotulo: 'Coxa', idWebDiet: 'dobra_coxa' },
  { chave: 'toracica', sigla: 'TO', rotulo: 'Torácica', idWebDiet: 'dobra_toracica' },
  { chave: 'suprailiaca', sigla: 'SI', rotulo: 'Suprailíaca', idWebDiet: 'dobra_suprailiaca' },
  { chave: 'panturrilha', sigla: 'PA', rotulo: 'Panturrilha', idWebDiet: 'dobra_panturrilha' },
  { chave: 'supraespinhal', sigla: 'SE2', rotulo: 'Supraespinhal', idWebDiet: 'dobra_supraespinhal' },
]);

/**
 * Medidas (fora as dobras) que entram em algum cálculo deste módulo. `grupo` diz onde ficam em
 * `entrada` (raiz, `circunferencias` ou `diametros`). As demais medidas da §5.1 (pescoço, tórax,
 * ombro, abdômen, braço contraído, antebraço, coxas, estatura sentado…) são só registradas.
 */
export const MEDIDAS = Object.freeze([
  { chave: 'peso', grupo: null, rotulo: 'Peso', unidade: 'kg', idWebDiet: 'pesoInput' },
  { chave: 'estatura', grupo: null, rotulo: 'Estatura', unidade: 'cm', idWebDiet: 'alturaInput' },
  { chave: 'alturaJoelho', grupo: null, rotulo: 'Altura do joelho', unidade: 'cm', idWebDiet: 'alturaJoelhoInput' },
  { chave: 'cintura', grupo: 'circunferencias', rotulo: 'Cintura', unidade: 'cm', idWebDiet: 'circunferencia_cintura' },
  { chave: 'quadril', grupo: 'circunferencias', rotulo: 'Quadril', unidade: 'cm', idWebDiet: 'circunferencia_quadril' },
  { chave: 'bracoEsquerdo', grupo: 'circunferencias', rotulo: 'Braço relaxado (esquerdo)', unidade: 'cm', idWebDiet: 'circunferencia_bracorelaxado' },
  { chave: 'bracoDireito', grupo: 'circunferencias', rotulo: 'Braço relaxado (direito)', unidade: 'cm', idWebDiet: 'circunferencia_bracorelaxado_dir' },
  { chave: 'panturrilha', grupo: 'circunferencias', rotulo: 'Panturrilha', unidade: 'cm', idWebDiet: 'circunferencia_panturrilha' },
  { chave: 'punho', grupo: 'diametros', rotulo: 'Diâmetro do punho', unidade: 'cm', idWebDiet: 'diametro_punho' },
  { chave: 'femur', grupo: 'diametros', rotulo: 'Diâmetro do fêmur', unidade: 'cm', idWebDiet: 'diametro_femur' },
  { chave: 'umero', grupo: 'diametros', rotulo: 'Diâmetro do úmero', unidade: 'cm', idWebDiet: 'diametro_umero' },
]);

/** Campos de bioimpedância com cálculo (§5.6). `idWebDiet` é também a chave em `tela.campos`. */
export const CAMPOS_BIOIMPEDANCIA = Object.freeze([
  { chave: 'massaGordura', rotulo: 'Massa gorda', unidade: 'kg', idWebDiet: 'bioimpedancia_massaGordura' },
  { chave: 'massaLivreGordura', rotulo: 'Massa livre de gordura', unidade: 'kg', idWebDiet: 'bioimpedancia_MassaLivreGordura' },
  { chave: 'percentualGordura', rotulo: '% de gordura', unidade: '%', idWebDiet: 'bioimpedancia_percentualGordura' },
  { chave: 'massaMagra', rotulo: 'Massa magra', unidade: 'kg', idWebDiet: 'bioimpedancia_massaMagra' },
  { chave: 'percentualMagra', rotulo: '% de massa magra', unidade: '%', idWebDiet: 'bioimpedancia_percentualMagra' },
]);

// ---------------------------------------------------------------------------------------------
// Protocolos de dobras (§5.4)
// ---------------------------------------------------------------------------------------------

/** Constante do Pollock 3 feminino: a do WebDiet e a do artigo original (§12 item 11). */
export const CONSTANTE_POLLOCK3_FEMININO = Object.freeze({ webdiet: 1.099421, literatura: 1.0994921 });

const log10 = Math.log10;

/**
 * Protocolos de dobras. Para cada sexo: as dobras somadas (na ordem do relatório), se o somatório
 * aparece "cru" na tela (sem toFixed(2)) e a equação de densidade (g/mL) ou de %G direto.
 * `densidade(S, I, opcoes)` recebe o somatório S (mm), a idade I (anos) e as opções do cálculo.
 */
export const PROTOCOLOS_DOBRAS = Object.freeze({
  pollock7: {
    nome: 'Pollock 7 dobras',
    tipo: 'densidade',
    rotulo: { masculino: 'Pollock 7, 1978', feminino: 'Pollock 7, 1989' },
    dobras: {
      masculino: ['tricipital', 'subescapular', 'coxa', 'axilarMedia', 'suprailiaca', 'toracica', 'abdominal'],
      feminino: ['tricipital', 'subescapular', 'coxa', 'axilarMedia', 'suprailiaca', 'toracica', 'abdominal'],
    },
    somatorioCru: { masculino: false, feminino: false },
    densidade: {
      masculino: (S, I) => 1.112 - 0.00043499 * S + 0.00000055 * S * S - 0.00028826 * I,
      feminino: (S, I) => 1.097 - 0.00046971 * S + 0.00000056 * S * S - 0.00012828 * I,
    },
  },
  pollock3: {
    nome: 'Pollock 3 dobras',
    tipo: 'densidade',
    rotulo: { masculino: 'Pollock 3, 1978', feminino: 'Pollock 3, 1989' },
    dobras: {
      masculino: ['toracica', 'abdominal', 'coxa'],
      feminino: ['tricipital', 'coxa', 'suprailiaca'],
    },
    somatorioCru: { masculino: false, feminino: false },
    densidade: {
      masculino: (S, I) => 1.10938 - 0.0008267 * S + 0.0000016 * S * S - 0.0002574 * I,
      // WebDiet §12 #11: constante 1,099421 (o original de Jackson, Pollock & Ward 1980 traz 1,0994921).
      // Padrão = WebDiet; com { corrigir: true } usa a constante da literatura.
      feminino: (S, I, opcoes = {}) =>
        (opcoes.corrigir ? CONSTANTE_POLLOCK3_FEMININO.literatura : CONSTANTE_POLLOCK3_FEMININO.webdiet) -
        0.0009929 * S + 0.0000023 * S * S - 0.0001392 * I,
    },
  },
  guedes: {
    nome: 'Guedes',
    tipo: 'densidade',
    rotulo: { masculino: 'Guedes, 1994', feminino: 'Guedes, 1994' },
    dobras: {
      masculino: ['tricipital', 'abdominal', 'suprailiaca'],
      feminino: ['subescapular', 'coxa', 'suprailiaca'],
    },
    // §5.4: Guedes masculino mostra o somatório cru.
    somatorioCru: { masculino: true, feminino: false },
    densidade: {
      masculino: (S) => 1.1714 - 0.0671 * log10(S),
      feminino: (S) => 1.1665 - 0.07063 * log10(S),
    },
  },
  petroski: {
    nome: 'Petroski',
    tipo: 'densidade',
    rotulo: { masculino: 'Petroski, 1995', feminino: 'Petroski, 1995' },
    dobras: {
      masculino: ['tricipital', 'subescapular', 'suprailiaca', 'panturrilha'],
      feminino: ['axilarMedia', 'coxa', 'suprailiaca', 'panturrilha'],
    },
    // §5.4: Petroski masculino mostra o somatório cru.
    somatorioCru: { masculino: true, feminino: false },
    densidade: {
      masculino: (S, I) => 1.10726863 - 0.00081201 * S + 0.00000212 * S * S - 0.00041761 * I,
      feminino: (S, I) => 1.1954713 - 0.07513507 * log10(S) - 0.00041072 * I,
    },
  },
  durnin: {
    nome: 'Durnin & Womersley',
    tipo: 'densidade',
    rotulo: { masculino: 'Durnin & Womersley, 1974', feminino: 'Durnin & Womersley, 1974' },
    dobras: {
      masculino: ['tricipital', 'subescapular', 'bicipital', 'suprailiaca'],
      feminino: ['tricipital', 'subescapular', 'bicipital', 'suprailiaca'],
    },
    somatorioCru: { masculino: false, feminino: false },
    densidade: {
      masculino: (S) => 1.1765 - 0.0744 * log10(S),
      feminino: (S) => 1.1567 - 0.0717 * log10(S),
    },
  },
  faulkner: {
    nome: 'Faulkner',
    tipo: 'direto',
    rotulo: { masculino: 'Faulkner, 1968', feminino: 'Faulkner, 1968' },
    dobras: {
      masculino: ['tricipital', 'subescapular', 'abdominal', 'suprailiaca'],
      feminino: ['tricipital', 'subescapular', 'abdominal', 'suprailiaca'],
    },
    somatorioCru: { masculino: false, feminino: false },
    // %G direto, sem densidade (§5.4).
    percentual: (S) => S * 0.153 + 5.783,
  },
  nenhuma: {
    nome: 'Nenhuma (só o somatório)',
    tipo: 'nenhum',
    rotulo: { masculino: null, feminino: null },
    dobras: {
      masculino: DOBRAS.map((d) => d.chave),
      feminino: DOBRAS.map((d) => d.chave),
    },
    // Inferido da evidência (A07, A19, A45–A73): a soma das 10 dobras aparece crua ("156 mm", "178.5 mm").
    somatorioCru: { masculino: true, feminino: true },
  },
});

/** Equações densidade → % de gordura (§5.4). Brozek é o padrão do WebDiet (§5.1). */
export const EQUACOES_GORDURA = Object.freeze({
  brozek: { nome: 'Brozek (1963)', padrao: true, calcular: (D) => (4.57 / D - 4.142) * 100 },
  siri: { nome: 'Siri (1961)', padrao: false, calcular: (D) => (4.95 / D - 4.5) * 100 },
});

// ---------------------------------------------------------------------------------------------
// Tabelas de classificação
// ---------------------------------------------------------------------------------------------

/** IMC (§5.2): limite superior exclusivo de cada classe; abaixo de 1 não há classe; ≥ 100 → aviso. */
export const CLASSES_IMC = Object.freeze({
  adulto: [
    { ate: 18.5, rotulo: 'Baixo peso' },
    { ate: 25, rotulo: 'Eutrófico' },
    { ate: 30, rotulo: 'Sobrepeso' },
    { ate: 35, rotulo: 'Obesidade grau 1' },
    { ate: 40, rotulo: 'Obesidade grau 2' },
    { ate: 100, rotulo: 'Obesidade grau 3' },
  ],
  // A partir de 60 anos.
  idoso: [
    { ate: 22, rotulo: 'Baixo peso' },
    { ate: 27, rotulo: 'Peso adequado' },
    { ate: 100, rotulo: 'Sobrepeso' },
  ],
  verifique: 'Verifique altura e peso',
});

/** Faixas de IMC usadas no peso ideal (§5.2): abaixo de 60 anos e a partir de 60. */
export const PESO_IDEAL_IMC = Object.freeze({ adulto: [18.5, 24.9], idoso: [22, 27] });

/** Rótulos de %G (§5.5), na ordem dos limites. */
export const ROTULOS_GORDURA = Object.freeze([
  'Excessivamente baixa',
  'Excelente',
  'Adequada',
  'Elevada',
  'Moderadamente alta',
  'Alta',
  'Muito alta',
  'Excessivamente alta',
]);

/**
 * %G por faixa etária (§5.5): `limites` são os limites superiores (≤) dos 7 primeiros rótulos;
 * acima do último → "Excessivamente alta". `referencia` é a faixa ideal exibida ("Entre a% e b%").
 */
export const FAIXAS_GORDURA = Object.freeze([
  { de: 16, ate: 25, feminino: { limites: [13, 16, 19, 22, 25, 28, 31], referencia: [13, 19] }, masculino: { limites: [4, 6, 10, 13, 16, 20, 24], referencia: [4, 10] } },
  { de: 26, ate: 35, feminino: { limites: [14, 16, 20, 23, 25, 29, 33], referencia: [14, 20] }, masculino: { limites: [8, 11, 15, 18, 20, 22, 24], referencia: [8, 15] } },
  { de: 36, ate: 45, feminino: { limites: [16, 19, 23, 26, 29, 32, 36], referencia: [16, 23] }, masculino: { limites: [10, 14, 18, 21, 23, 25, 29], referencia: [10, 18] } },
  { de: 46, ate: 55, feminino: { limites: [17, 21, 25, 28, 31, 34, 38], referencia: [17, 25] }, masculino: { limites: [12, 16, 20, 23, 25, 27, 30], referencia: [12, 20] } },
  { de: 56, ate: 65, feminino: { limites: [18, 22, 26, 29, 32, 35, 38], referencia: [18, 26] }, masculino: { limites: [13, 18, 21, 23, 25, 27, 30], referencia: [13, 21] } },
]);

/** Texto do WebDiet abaixo de 16 anos (§5.5). */
export const TEXTO_IDADE_MINIMA_GORDURA = 'N/D Verif. Idade mínima';

/**
 * p50 da circunferência muscular do braço (cm) por idade (§5.6). `ate` = idade máxima da linha.
 * Idades de 1 a 18 são anuais; depois 19–25, >25–35, >35–45, >45–55, >55–65 e >65.
 */
export const P50_CMB = Object.freeze([
  { ate: 1, feminino: 12.4, masculino: 12.7 },
  { ate: 2, feminino: 12.6, masculino: 13 },
  { ate: 3, feminino: 13.2, masculino: 13.7 },
  // WebDiet §12 #14: meninas de 4 anos = 11 (fora da sequência 13,2 → 14,2). Mantido como no WebDiet.
  { ate: 4, feminino: 11, masculino: 14.1 },
  { ate: 5, feminino: 14.2, masculino: 14.7 },
  { ate: 6, feminino: 14.5, masculino: 15.1 },
  { ate: 7, feminino: 15.1, masculino: 16 },
  { ate: 8, feminino: 16, masculino: 16.2 },
  { ate: 9, feminino: 16.7, masculino: 17 },
  { ate: 10, feminino: 17, masculino: 18 },
  { ate: 11, feminino: 18.1, masculino: 18.3 },
  { ate: 12, feminino: 19.1, masculino: 19.5 },
  { ate: 13, feminino: 19.8, masculino: 21.1 },
  { ate: 14, feminino: 20.1, masculino: 22.1 },
  { ate: 15, feminino: 20.2, masculino: 23.7 },
  { ate: 16, feminino: 20.2, masculino: 24.9 },
  { ate: 17, feminino: 20.5, masculino: 25.8 },
  { ate: 18, feminino: 20.2, masculino: 26.4 },
  { ate: 25, feminino: 20.7, masculino: 27.3 },
  { ate: 35, feminino: 21.2, masculino: 27.9 },
  { ate: 45, feminino: 21.8, masculino: 28.6 },
  { ate: 55, feminino: 22, masculino: 28.1 },
  { ate: 65, feminino: 22.5, masculino: 27.8 },
  { ate: Infinity, feminino: 22.5, masculino: 26.8 },
]);

/** Classes de adequação da CMB (§5.6): limite superior exclusivo; ≥ 90 → Eutrófico. */
export const CLASSES_CMB = Object.freeze([
  { ate: 70, rotulo: 'Desnutrição Grave' },
  { ate: 80, rotulo: 'Desnutrição Moderada' },
  { ate: 90, rotulo: 'Desnutrição Leve' },
  { ate: Infinity, rotulo: 'Eutrófico' },
]);

/**
 * Risco pela RCQ (Bray & Gray, §5.6): [a, b, c] → baixo < a ≤ moderado < b ≤ alto < c ≤ muito alto.
 * A partir de 70 anos não há classificação.
 */
export const RISCO_RCQ = Object.freeze([
  { ate: 29, masculino: [0.83, 0.89, 0.94], feminino: [0.71, 0.78, 0.82] },
  { ate: 39, masculino: [0.84, 0.91, 0.96], feminino: [0.72, 0.79, 0.84] },
  { ate: 49, masculino: [0.88, 0.96, 1.0], feminino: [0.73, 0.8, 0.87] },
  { ate: 59, masculino: [0.9, 0.97, 1.02], feminino: [0.74, 0.82, 0.88] },
  { ate: 69, masculino: [0.91, 0.99, 1.03], feminino: [0.76, 0.84, 0.9] },
]);

export const ROTULOS_RCQ = Object.freeze(['Risco baixo', 'Risco moderado', 'Risco alto', 'Risco muito alto']);

/** Fração do peso residual (Würch, §5.6). */
export const FRACAO_PESO_RESIDUAL = Object.freeze({ feminino: 0.209, masculino: 0.241 });

// ---------------------------------------------------------------------------------------------
// Utilitários internos
// ---------------------------------------------------------------------------------------------

/**
 * Normaliza o sexo. Atenção: 'M' = masculino (convenção do WebDiet e das evidências); nas tabelas
 * do relatório, "M" quer dizer mulheres e "H" homens.
 * @param {unknown} s
 * @returns {Sexo}
 */
export function normalizarSexo(s) {
  const t = String(s ?? '').trim().toLowerCase();
  if (t === 'm' || t === 'masculino') return 'masculino';
  if (t === 'f' || t === 'feminino') return 'feminino';
  throw new TypeError(`Sexo inválido: ${String(s)} (use 'M'/'masculino' ou 'F'/'feminino')`);
}

/**
 * Texto de um campo de entrada, como fica no input do WebDiet (vírgula vira ponto ao digitar, §3).
 * @param {unknown} v
 * @returns {string}
 */
function textoCampo(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  return String(v).trim().replace(',', '.');
}

/** Idade em anos: na data da avaliação quando há nascimento e data (§5.1); senão `idade`. */
function resolverIdade(entrada) {
  if (entrada.nascimento && entrada.dataAvaliacao) return idadeAnos(entrada.nascimento, entrada.dataAvaliacao);
  return check(entrada.idade);
}

/** Soma as dobras na ordem dada (a ordem importa para o somatório exibido cru). */
function somarDobras(chaves, dobras) {
  let S = 0;
  for (const k of chaves) S += check(dobras[k]);
  return S;
}

// ---------------------------------------------------------------------------------------------
// Funções de cálculo (exportadas para uso isolado)
// ---------------------------------------------------------------------------------------------

/**
 * Classe do IMC (§5.2). Recebe o IMC JÁ ARREDONDADO a 1 casa (é o que o WebDiet classifica).
 * @param {number} imcArredondado
 * @param {number} idade anos completos na data da avaliação
 * @returns {string|null} null quando o IMC é menor que 1 (sem classe na tabela)
 */
export function classificarImc(imcArredondado, idade) {
  if (imcArredondado >= 100) return CLASSES_IMC.verifique;
  if (!(imcArredondado >= 1)) return null;
  const tabela = idade >= 60 ? CLASSES_IMC.idoso : CLASSES_IMC.adulto;
  return tabela.find((c) => imcArredondado < c.ate).rotulo;
}

/**
 * Classificação do % de gordura (§5.5), igual para dobras e bioimpedância. Usa o %G sem arredondar.
 * - abaixo de 16 anos: texto "N/D Verif. Idade mínima", sem rótulo nem referência;
 * - acima de 65 anos: sem classificação (WebDiet §12 #12: a tela fica vazia e mantém a referência
 *   anterior; aqui o rótulo e a referência são null, com aviso — nunca um valor antigo).
 * @param {number} percentual %G sem arredondar
 * @param {Sexo} sexo
 * @param {number} idade
 * @returns {{rotulo: string|null, referencia: {min:number,max:number}|null, texto: string, textoReferencia: string, aviso: string|null}}
 */
export function classificarGordura(percentual, sexo, idade) {
  if (idade < 16) {
    return {
      rotulo: null,
      referencia: null,
      texto: TEXTO_IDADE_MINIMA_GORDURA,
      textoReferencia: '',
      aviso: 'Classificação do % de gordura só a partir de 16 anos',
    };
  }
  const faixa = FAIXAS_GORDURA.find((f) => idade <= f.ate);
  if (!faixa) {
    // WebDiet §12 #12: acima de 65 anos o WebDiet não classifica e deixa a referência antiga na tela.
    return { rotulo: null, referencia: null, texto: '', textoReferencia: '', aviso: AVISO_SEM_REFERENCIA };
  }
  const { limites, referencia } = faixa[sexo];
  const i = limites.findIndex((lim) => percentual <= lim);
  const rotulo = ROTULOS_GORDURA[i === -1 ? limites.length : i];
  return {
    rotulo,
    referencia: { min: referencia[0], max: referencia[1] },
    texto: rotulo,
    textoReferencia: `Entre ${referencia[0]}% e ${referencia[1]}%`,
    aviso: null,
  };
}

/**
 * Risco pela relação cintura/quadril (§5.6). Compara o valor sem arredondar (inferido da evidência:
 * 74/98 = 0,7551 → "0.76", e mulher de 60–69 anos fica em "Risco baixo" porque 0,7551 < 0,76).
 * A partir de 70 anos (WebDiet §12 #13) não há classificação: rótulo null e aviso.
 * @param {number} rcq cintura/quadril sem arredondar
 * @param {Sexo} sexo
 * @param {number} idade
 * @returns {{rotulo: string|null, aviso: string|null}}
 */
export function classificarRcq(rcq, sexo, idade) {
  const faixa = RISCO_RCQ.find((f) => idade <= f.ate);
  // WebDiet §12 #13: a partir de 70 anos o WebDiet não classifica e o texto anterior permanece.
  if (!faixa) return { rotulo: null, aviso: AVISO_SEM_REFERENCIA };
  const [a, b, c] = faixa[sexo];
  const i = rcq < a ? 0 : rcq < b ? 1 : rcq < c ? 2 : 3;
  return { rotulo: ROTULOS_RCQ[i], aviso: null };
}

/**
 * p50 da CMB para o sexo e a idade (§5.6). Sem linha para idade < 1 ano.
 * @param {Sexo} sexo
 * @param {number} idade
 * @returns {number|null}
 */
export function p50Cmb(sexo, idade) {
  if (!(idade >= 1)) return null;
  const linha = P50_CMB.find((l) => idade <= l.ate);
  return linha ? linha[sexo] : null;
}

/**
 * Classe da adequação da CMB (§5.6), sobre a adequação sem arredondar.
 * @param {number} adequacao %
 * @returns {string}
 */
export function classificarCmb(adequacao) {
  return CLASSES_CMB.find((c) => adequacao < c.ate).rotulo;
}

/**
 * Composição corporal por dobras (§5.4).
 * @param {object} p
 * @param {string} p.protocolo chave de PROTOCOLOS_DOBRAS
 * @param {Sexo} p.sexo
 * @param {number} p.idade
 * @param {Record<string, unknown>} p.dobras valores em mm, por chave de DOBRAS
 * @param {'brozek'|'siri'} [p.equacao='brozek'] densidade → %G
 * @param {{corrigir?: boolean}} [opcoes]
 * @returns {{protocolo:string, rotulo:string|null, somatorio:number, somatorioCru:boolean,
 *   densidade:number|null, percentualGordura:number|null, dobrasAusentes:string[]}}
 */
export function calcularDobras({ protocolo, sexo, idade, dobras = {}, equacao = 'brozek' }, opcoes = {}) {
  const prot = PROTOCOLOS_DOBRAS[protocolo];
  if (!prot) throw new RangeError(`Protocolo de dobras desconhecido: ${protocolo}`);
  const eq = EQUACOES_GORDURA[equacao];
  if (!eq) throw new RangeError(`Equação de %G desconhecida: ${equacao}`);
  const chaves = prot.dobras[sexo];
  const S = somarDobras(chaves, dobras);
  let densidade = null;
  let percentualGordura = null;
  if (prot.tipo === 'densidade') {
    densidade = prot.densidade[sexo](S, idade, opcoes);
    percentualGordura = eq.calcular(densidade);
  } else if (prot.tipo === 'direto') {
    percentualGordura = prot.percentual(S);
  }
  return {
    protocolo,
    rotulo: prot.rotulo[sexo],
    somatorio: S,
    somatorioCru: prot.somatorioCru[sexo],
    densidade,
    percentualGordura,
    // O WebDiet calcula mesmo com dobra vazia (check → 0); aqui só se avisa.
    dobrasAusentes: prot.tipo === 'nenhum' ? [] : chaves.filter((k) => !(check(dobras[k]) > 0)),
  };
}

/**
 * Estatura estimada por Chumlea (§5.3), só com altura do joelho > 10 cm. Resultado toFixed(0).
 * @param {{sexo: unknown, idade: number, alturaJoelho: unknown}} p
 * @returns {{valor: number|null, texto: string|null, erro: string|null}}
 */
export function estimarEstaturaChumlea({ sexo, idade, alturaJoelho }) {
  const s = normalizarSexo(sexo);
  const AJ = check(alturaJoelho);
  const I = check(idade);
  if (!(AJ > 10)) return { valor: null, texto: null, erro: 'Altura do joelho deve ser maior que 10 cm' };
  const v = s === 'masculino' ? 64.19 - 0.04 * I + 2.02 * AJ : 84.88 - 0.24 * I + 1.83 * AJ;
  return { valor: fxn(v, 0), texto: fx(v, 0), erro: null };
}

/**
 * Peso estimado (peso de acamado, Chumlea; §5.3), resultado toFixed(1).
 * Exige dobra subescapular, braço ESQUERDO, panturrilha e altura do joelho; senão "Dados incompletos!".
 * @param {{sexo: unknown, bracoEsquerdo: unknown, panturrilha: unknown, subescapular: unknown, alturaJoelho: unknown}} p
 * @returns {{valor: number|null, texto: string|null, erro: string|null}}
 */
export function estimarPesoChumlea({ sexo, bracoEsquerdo, panturrilha, subescapular, alturaJoelho }) {
  const s = normalizarSexo(sexo);
  const CB = check(bracoEsquerdo);
  const CP = check(panturrilha);
  const DSE = check(subescapular);
  const AJ = check(alturaJoelho);
  if (!(CB > 0 && CP > 0 && DSE > 0 && AJ > 0)) return { valor: null, texto: null, erro: 'Dados incompletos!' };
  // WebDiet §12 #10: equações com o sexo trocado em relação à forma usual de Chumlea 1988
  // (lá, −62,35 é a feminina e −81,69 a masculina). Mantido como no WebDiet (conferido na tela, A68/A69).
  const v =
    s === 'masculino'
      ? 0.98 * CB + 1.27 * CP + 0.4 * DSE + 0.87 * AJ - 62.35
      : 1.73 * CB + 0.98 * CP + 0.37 * DSE + 1.16 * AJ - 81.69;
  return { valor: fxn(v, 1), texto: fx(v, 1), erro: null };
}

/**
 * Preenchimento automático da bioimpedância (§5.6), a partir do campo que a pessoa digitou.
 * Tudo toFixed(1). Devolve só os campos preenchidos (texto), por chave de CAMPOS_BIOIMPEDANCIA.
 * - percentualGordura → massaGordura = P × %/100 e massaLivreGordura = P × (1 − %/100)
 * - massaGordura → percentualGordura = MG/P × 100 e massaLivreGordura = P − MG
 * - percentualMagra → massaMagra = P × %/100
 * - massaMagra → percentualMagra = MM/P × 100
 * @param {'percentualGordura'|'massaGordura'|'percentualMagra'|'massaMagra'} origem
 * @param {{peso: unknown, percentualGordura?: unknown, massaGordura?: unknown, percentualMagra?: unknown, massaMagra?: unknown}} valores
 * @returns {Record<string, string>|null} null sem peso
 */
export function preencherBioimpedancia(origem, valores) {
  const P = check(valores.peso);
  if (!(P > 0)) return null;
  const x = check(valores[origem]);
  switch (origem) {
    case 'percentualGordura':
      return { massaGordura: fx((P * x) / 100, 1), massaLivreGordura: fx(P * (1 - x / 100), 1) };
    case 'massaGordura':
      return { percentualGordura: fx((x / P) * 100, 1), massaLivreGordura: fx(P - x, 1) };
    case 'percentualMagra':
      return { massaMagra: fx((P * x) / 100, 1) };
    case 'massaMagra':
      return { percentualMagra: fx((x / P) * 100, 1) };
    default:
      throw new RangeError(`Campo de bioimpedância desconhecido: ${origem}`);
  }
}

// ---------------------------------------------------------------------------------------------
// Cálculo completo da tela
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {object} EntradaAntropometria
 * @property {'M'|'F'|'masculino'|'feminino'} sexo
 * @property {number} [idade] anos completos; ignorada se houver `nascimento` e `dataAvaliacao`
 * @property {string|Date} [nascimento] "dd/mm/aaaa"
 * @property {string|Date} [dataAvaliacao] "dd/mm/aaaa" — a idade é a desta data (§5.1)
 * @property {number|string} [peso] kg
 * @property {number|string} [estatura] cm
 * @property {number|string} [alturaJoelho] cm
 * @property {Record<string, number|string>} [dobras] mm, chaves de DOBRAS
 * @property {{cintura?, quadril?, bracoEsquerdo?, bracoDireito?, panturrilha?}} [circunferencias] cm
 * @property {{punho?, femur?, umero?}} [diametros] cm
 * @property {{percentualGordura?, massaGordura?, massaLivreGordura?, massaMagra?, percentualMagra?}} [bioimpedancia]
 * @property {string} [protocolo='nenhuma'] chave de PROTOCOLOS_DOBRAS
 * @property {'brozek'|'siri'} [equacaoGordura='brozek']
 * @property {'esquerdo'|'direito'} [ladoBraco='esquerdo'] braço usado na CMB
 * @property {'estimarEstatura'|'estimarPeso'} [acao] botão de estimativa (Chumlea): preenche o campo
 *   e a tela é recalculada com ele, como no WebDiet
 * @property {'percentualGordura'|'massaGordura'|'percentualMagra'|'massaMagra'} [preencherBio]
 *   campo de bioimpedância digitado que dispara o preenchimento automático. Como no WebDiet, o
 *   preenchimento só altera `tela.campos`; a tela não é recalculada (chame de novo com os campos
 *   preenchidos para atualizá-la).
 */

/**
 * Calcula a antropometria de adultos e idosos (§5) e monta a tela do WebDiet.
 *
 * @param {EntradaAntropometria} entrada
 * @param {{corrigir?: boolean}} [opcoes] `corrigir: true` usa a constante da literatura no
 *   Pollock 3 feminino (§12 #11). Os itens 10 e 14 seguem sempre o WebDiet.
 * @returns {object} valores numéricos (`imc`, `pesoIdeal`, `dobras`, `fracionamento`, `cmb`, `rcq`,
 *   `bioimpedancia`, `estimativa`), `avisos` e `tela` (textos iguais aos do WebDiet).
 */
export function calcularAntropometria(entrada = {}, opcoes = {}) {
  const avisos = [];
  const sexo = normalizarSexo(entrada.sexo);
  const idade = resolverIdade(entrada);
  const protocolo = entrada.protocolo ?? 'nenhuma';
  const equacao = entrada.equacaoGordura ?? 'brozek';
  const ladoBraco = entrada.ladoBraco ?? 'esquerdo';
  const dobras = entrada.dobras ?? {};
  const circ = entrada.circunferencias ?? {};
  const diam = entrada.diametros ?? {};
  const bio = entrada.bioimpedancia ?? {};

  // Textos dos campos de peso e estatura (o que está no input).
  let campoPeso = textoCampo(entrada.peso);
  let campoEstatura = textoCampo(entrada.estatura);

  // 1) Estimativas de Chumlea: o botão preenche o campo e a tela é recalculada (A66–A69).
  let estimativa = null;
  if (entrada.acao === 'estimarEstatura') {
    const r = estimarEstaturaChumlea({ sexo, idade, alturaJoelho: entrada.alturaJoelho });
    estimativa = { tipo: 'estatura', ...r };
    if (r.erro) avisos.push(r.erro);
    else campoEstatura = r.texto;
  } else if (entrada.acao === 'estimarPeso') {
    const r = estimarPesoChumlea({
      sexo,
      bracoEsquerdo: circ.bracoEsquerdo,
      panturrilha: circ.panturrilha,
      subescapular: dobras.subescapular,
      alturaJoelho: entrada.alturaJoelho,
    });
    estimativa = { tipo: 'peso', ...r };
    if (r.erro) avisos.push(r.erro);
    else campoPeso = r.texto;
  } else if (entrada.acao !== undefined && entrada.acao !== null) {
    throw new RangeError(`Ação desconhecida: ${entrada.acao}`);
  }

  const peso = check(campoPeso);
  const estatura = check(campoEstatura);
  const temPeso = peso > 0;
  const temEstatura = estatura > 0;
  const altM = estatura / 100;

  const tela = {
    massa: temPeso ? `${peso} Kg` : VAZIO,
    estatura: temEstatura ? `${estatura} cm` : VAZIO,
    imc: VAZIO,
    class_imc: VAZIO,
    peso_ideal: VAZIO,
    gc: VAZIO,
    peso_g: VAZIO,
    mlg: VAZIO,
    somatorio: VAZIO,
    densidade: VAZIO,
    class_gc: VAZIO,
    gc_ideal1: VAZIO,
    peso_o: VAZIO,
    peso_r: VAZIO,
    peso_m: VAZIO,
    cmb: VAZIO,
    class_cmb: VAZIO,
    razao: VAZIO,
    risco: VAZIO,
    bioimpedancia_gordura_rel: VAZIO,
    class_gc_bio: VAZIO,
    gc_ideal2: VAZIO,
    formula_escolhida: VAZIO,
    campos: null,
  };

  // 2) IMC e peso ideal (§5.2). A classe usa o IMC arredondado a 1 casa.
  let imc = null;
  if (temPeso && temEstatura) {
    const valor = peso / (altM * altM);
    const arredondado = fxn(valor, 1);
    const classificacao = classificarImc(arredondado, idade);
    if (classificacao === null) avisos.push('IMC abaixo de 1: sem classificação');
    imc = { valor, arredondado, classificacao };
    tela.imc = `${fx(valor, 1)} Kg/m2`;
    tela.class_imc = classificacao ?? '';
  }
  let pesoIdeal = null;
  if (temEstatura) {
    const [a, b] = idade >= 60 ? PESO_IDEAL_IMC.idoso : PESO_IDEAL_IMC.adulto;
    pesoIdeal = { min: a * altM * altM, max: b * altM * altM };
    tela.peso_ideal = `${fx(pesoIdeal.min, 1)} a ${fx(pesoIdeal.max, 1)}Kg`;
  }

  // 3) Dobras (§5.4) e classificação do %G (§5.5).
  const rDobras = calcularDobras({ protocolo, sexo, idade, dobras, equacao }, opcoes);
  tela.somatorio = `${rDobras.somatorioCru ? rDobras.somatorio : fx(rDobras.somatorio, 2)} mm`;
  let composicao = null;
  if (rDobras.percentualGordura !== null) {
    if (rDobras.dobrasAusentes.length) {
      avisos.push(`Dobras sem valor para o protocolo ${PROTOCOLOS_DOBRAS[protocolo].nome}: ${rDobras.dobrasAusentes.join(', ')}`);
    }
    const G = rDobras.percentualGordura;
    const classe = classificarGordura(G, sexo, idade);
    if (classe.aviso) avisos.push(`% de gordura (dobras): ${classe.aviso}`);
    tela.gc = `${fx(G, 1)}%`;
    tela.class_gc = classe.texto;
    tela.gc_ideal1 = classe.textoReferencia;
    tela.formula_escolhida = rDobras.rotulo;
    if (rDobras.densidade !== null) tela.densidade = `${fx(rDobras.densidade, 3)} Kg/L`;
    let pesoGordo = null;
    let massaLivreGordura = null;
    if (temPeso) {
      // Peso gordo com o %G sem arredondar; MLG = P − peso gordo (conferido em todos os casos).
      pesoGordo = (peso * G) / 100;
      massaLivreGordura = peso - pesoGordo;
      tela.peso_g = `${fx(pesoGordo, 1)} Kg`;
      tela.mlg = `${fx(massaLivreGordura, 1)} Kg`;
    }
    composicao = { pesoGordo, massaLivreGordura, classificacao: classe };
  }

  // 4) Fracionamento (§5.6).
  let pesoOsseo = null;
  const punhoM = check(diam.punho) / 100;
  const femurM = check(diam.femur) / 100;
  if (temEstatura && punhoM > 0 && femurM > 0) {
    // Von Döbeln modificado por Rocha.
    pesoOsseo = 3.02 * Math.pow(altM * altM * punhoM * femurM * 400, 0.712);
    tela.peso_o = `${fx(pesoOsseo, 1)} Kg`;
  }
  let pesoResidual = null;
  if (temPeso) {
    pesoResidual = FRACAO_PESO_RESIDUAL[sexo] * peso;
    tela.peso_r = `${fx(pesoResidual, 1)} Kg`;
  }
  let pesoMuscular = null;
  if (pesoOsseo !== null && pesoResidual !== null && composicao && composicao.pesoGordo !== null) {
    // Usa os textos já arredondados (§5.6).
    pesoMuscular =
      peso - parseFloat(fx(pesoResidual, 1)) - parseFloat(fx(composicao.pesoGordo, 1)) - parseFloat(fx(pesoOsseo, 1));
    tela.peso_m = `${fx(pesoMuscular, 1)} Kg`;
  }

  // 5) CMB (§5.6): braço do lado escolhido − DCT × 0,314. Exige braço e DCT (A68/A69: sem DCT → "-").
  let cmb = null;
  const CB = check(ladoBraco === 'direito' ? circ.bracoDireito : circ.bracoEsquerdo);
  const DCT = check(dobras.tricipital);
  if (CB > 0 && DCT > 0) {
    const valor = CB - DCT * 0.314;
    const p50 = p50Cmb(sexo, idade);
    if (p50 === null) {
      avisos.push('CMB: sem p50 de referência para idade abaixo de 1 ano');
      cmb = { valor, p50: null, adequacao: null, classificacao: null };
      tela.cmb = `${fx(valor, 1)} cm`;
      tela.class_cmb = '';
    } else {
      // Adequação com a CMB sem arredondar (A33: 27,29/28,6 → "95.4%"; com 27,3 daria 95.5).
      const adequacao = (valor / p50) * 100;
      const classificacao = classificarCmb(adequacao);
      cmb = { valor, p50, adequacao, classificacao };
      tela.cmb = `${fx(valor, 1)} cm (${fx(adequacao, 1)}%)`;
      tela.class_cmb = classificacao;
    }
  }

  // 6) RCQ (§5.6).
  let rcq = null;
  const cintura = check(circ.cintura);
  const quadril = check(circ.quadril);
  if (cintura > 0 && quadril > 0) {
    const valor = cintura / quadril;
    const r = classificarRcq(valor, sexo, idade);
    if (r.aviso) avisos.push(`RCQ: ${r.aviso}`);
    rcq = { valor, classificacao: r.rotulo };
    tela.razao = fx(valor, 2);
    // WebDiet §12 #13: a partir de 70 anos o WebDiet deixa o texto antigo; aqui fica vazio.
    tela.risco = r.rotulo ?? '';
  }

  // 7) Bioimpedância: %G digitado, classificado com a mesma tabela (§5.5).
  let bioimpedancia = null;
  const bioG = check(bio.percentualGordura);
  if (bioG > 0) {
    const classe = classificarGordura(bioG, sexo, idade);
    if (classe.aviso) avisos.push(`% de gordura (bioimpedância): ${classe.aviso}`);
    bioimpedancia = { percentualGordura: bioG, classificacao: classe };
    tela.bioimpedancia_gordura_rel = `${fx(bioG, 1)}%`;
    tela.class_gc_bio = classe.texto;
    tela.gc_ideal2 = classe.textoReferencia;
  }

  // 8) Campos (inputs) depois da ação; o preenchimento automático da bioimpedância vem por último
  //    e não recalcula a tela (A72: %G preenchido "21.6", tela continua "-").
  const camposBio = {};
  for (const c of CAMPOS_BIOIMPEDANCIA) camposBio[c.chave] = textoCampo(bio[c.chave]);
  let preenchimentoBio = null;
  if (entrada.preencherBio) {
    preenchimentoBio = preencherBioimpedancia(entrada.preencherBio, { peso: campoPeso, ...bio });
    if (preenchimentoBio) Object.assign(camposBio, preenchimentoBio);
    else avisos.push('Bioimpedância: informe o peso para o preenchimento automático');
  }
  tela.campos = { pesoInput: campoPeso, alturaInput: campoEstatura };
  for (const c of CAMPOS_BIOIMPEDANCIA) tela.campos[c.idWebDiet] = camposBio[c.chave];

  return {
    sexo,
    idade,
    peso: temPeso ? peso : null,
    estatura: temEstatura ? estatura : null,
    estimativa,
    imc,
    pesoIdeal,
    dobras: {
      ...rDobras,
      pesoGordo: composicao ? composicao.pesoGordo : null,
      massaLivreGordura: composicao ? composicao.massaLivreGordura : null,
      classificacao: composicao ? composicao.classificacao : null,
    },
    fracionamento: { pesoOsseo, pesoResidual, pesoMuscular },
    cmb,
    rcq,
    bioimpedancia,
    preenchimentoBio,
    avisos,
    tela,
  };
}

/**
 * Converte os campos do WebDiet (ids das evidências, ex.: `pesoInput`, `dobra_triceptal`) na
 * entrada deste módulo. Útil para importar dados e nos testes de paridade.
 * @param {Record<string, unknown>} v campos com ids do WebDiet
 * @param {Partial<EntradaAntropometria>} [extras] sexo, idade, protocolo etc.
 * @returns {EntradaAntropometria}
 */
export function deCamposWebDiet(v = {}, extras = {}) {
  const entrada = { dobras: {}, circunferencias: {}, diametros: {}, bioimpedancia: {} };
  for (const d of DOBRAS) if (d.idWebDiet in v) entrada.dobras[d.chave] = v[d.idWebDiet];
  for (const m of MEDIDAS) {
    if (!(m.idWebDiet in v)) continue;
    if (m.grupo) entrada[m.grupo][m.chave] = v[m.idWebDiet];
    else entrada[m.chave] = v[m.idWebDiet];
  }
  for (const c of CAMPOS_BIOIMPEDANCIA) if (c.idWebDiet in v) entrada.bioimpedancia[c.chave] = v[c.idWebDiet];
  return { ...entrada, ...extras };
}

// ---------------------------------------------------------------------------------------------
// Divergências do WebDiet (§12, itens 10 a 14) e o que este módulo faz com cada uma
// ---------------------------------------------------------------------------------------------

export const DIVERGENCIAS = Object.freeze([
  {
    item: 10,
    descricao:
      'Estimativa de peso (Chumlea 1988) com o sexo trocado: homens usam a equação de −62,35 (feminina na forma usual) e mulheres a de −81,69.',
    comportamento: 'Igual ao WebDiet (paridade conferida em A68/A69). Item ainda aberto no relatório.',
  },
  {
    item: 11,
    descricao: 'Pollock 3 feminino com constante 1,099421; o original (Jackson, Pollock & Ward 1980) traz 1,0994921.',
    comportamento: 'Padrão igual ao WebDiet (1,099421); com a opção { corrigir: true } usa 1,0994921.',
  },
  {
    item: 12,
    descricao: 'Acima de 65 anos não há classificação do %G: o texto fica vazio e a referência anterior continua na tela.',
    comportamento:
      'Classificação e referência null com aviso; tela.class_gc/class_gc_bio vazios (como o WebDiet) e tela.gc_ideal1/gc_ideal2 vazios (nunca a referência antiga).',
  },
  {
    item: 13,
    descricao: 'RCQ: a partir de 70 anos não há classificação de risco e o texto anterior permanece na tela.',
    comportamento: 'Risco null com aviso; tela.risco vazio (nunca o texto antigo).',
  },
  {
    item: 14,
    descricao: 'CMB: p50 de meninas de 4 anos = 11 cm, fora da sequência 13,2 → 14,2.',
    comportamento: 'Igual ao WebDiet (p50 = 11).',
  },
]);
