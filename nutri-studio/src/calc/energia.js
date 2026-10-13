// Cálculo energético (TMB/GET) — reprodução do WebDiet conforme docs/webdiet-analise.md §4.
// Convenções numéricas do §3 (check, toFixed, valores intermediários arredondados) e erros do
// WebDiet do §12, itens 1–9. Conferido contra docs/webdiet-evidencias/tela_energia.json (110 casos)
// e tela_energia_extras.json (test/energia.test.js).
//
// Política para os erros do WebDiet (§12):
//  - Paridade: para todo caso de evidência, as strings de `tela` são iguais às da tela do WebDiet.
//    Única exceção: E108 (item 1), em que a tela do WebDiet ficou com o GET do caso anterior.
//  - Item 1 (EER/IOM 2005 infantil com exatamente 36 meses): o WebDiet calcula a TMB e mostra a
//    lista de fatores de até 36 meses, mas o GET dá exceção de JS. Aqui a TMB e a lista ficam como no
//    WebDiet e o GET usa o ramo de 3 anos ou mais, com `aviso` e `corrigido = true`.
//  - Item 6 (Henry & Rees abaixo de 3 anos): TMB e GET = null, com `aviso` (o WebDiet deixava a TMB
//    anterior na tela).
//  - Itens 2, 3, 4, 5, 7, 8 e 9: mantidos como no WebDiet, marcados com `// WebDiet §12 #n` e listados
//    em `DIVERGENCIAS`.
//
// Convenção de sexo: 'M' = masculino, 'F' = feminino (como nas evidências). Atenção: nas tabelas do
// relatório, "H" = homens e "M" = mulheres.

import { check, fx, fxn, idadeAnos, idadeMeses, partesData } from './numeros.js';

/** kcal por kg de peso na programação de peso (VENTA), §4.7. */
export const KCAL_POR_KG = 7700;

/**
 * Mensagens. As marcadas "WebDiet" são textos da tela/relatório; as demais são do nutri-studio
 * (o relatório não traz o texto do WebDiet, ou o WebDiet não tem a situação).
 */
export const MENSAGENS = Object.freeze({
  // WebDiet (E50): texto do campo GET quando ele não é calculado.
  escolhaFator: 'Escolha o fator atividade',
  // WebDiet (E50): kcal/kg exibido junto do texto acima (sem parênteses).
  getKgVazio: '0.0 Kcal/kg',
  // WebDiet (§4.4.5; E50, cujo campo `erro` a captura cortou em 120 caracteres).
  primeiroTrimestre:
    'Para o 1º trimestre de gravidez, deve ser usada a equação de predição de EER não grávida. ' +
    'Assume-se que a disposição de energia é insignificante e, portanto, ignorada.',
  // WebDiet (§4.2, fórmula 3): exibido no lugar da TMB quando a MLG é 0.
  mlgEmBranco: 'Massa livre de gordura em branco',
  // nutri-studio. O relatório (§4.7) só traz o começo do aviso do WebDiet: "A fórmula EER 2023 já
  // considera o adicional energético…".
  gestanteAdicional:
    'A fórmula EER 2023 já considera o adicional energético da gestação: o adicional gestante não foi somado.',
  // nutri-studio (textos próprios).
  formulaDesconhecida: 'Escolha a fórmula.',
  sexoAusente: 'Informe o sexo do paciente.',
  nascimentoInvalido: 'Informe uma data de nascimento válida (dd/mm/aaaa).',
  dataReferenciaAusente: 'Informe a data da avaliação (dd/mm/aaaa) para calcular a idade.',
  idadeAusente: 'Informe a data de nascimento (com a data da avaliação) ou a idade.',
  idadeNegativa: 'A data de nascimento é posterior à data da avaliação.',
  mesesEstimados:
    'Idade em meses estimada como anos × 12: informe a idade em meses (ou o nascimento) para as faixas por mês.',
  pesoAusente: 'Informe o peso: sem peso não há kcal/kg.',
  injuriaDesconhecida: 'Fator injúria desconhecido.',
  fatorForaDaLista: 'O fator atividade informado não está na lista desta fórmula.',
  tmbAusente: 'Informe a TMB.',
  getManualAusente: 'Informe o GET (kcal ou kcal/kg).',
  bolsoAusente: 'Informe proteína, lipídio e carboidrato (g/kg).',
  henryMenor3:
    'Henry & Rees não tem equação para menores de 3 anos: TMB não calculada. ' +
    '(No WebDiet a TMB anterior ficava na tela — §12, item 6.)',
  schofieldMaior18: 'Schofield (1985) infantil não tem equação acima de 18 anos: TMB não calculada.',
  msGestanteAte10: 'Min. Saúde – Gestante não tem equação para 10 anos ou menos: TMB não calculada.',
  eer2023AdultoMenor19: 'A EER 2023 adultos é para 19 anos ou mais: para menores, use a EER 2023 infantil.',
  eer2023InfantilMaior19:
    'EER 2023 infantil não tem equação a partir de 19 anos: use a EER 2023 adultos. GET não calculado.',
  somenteFeminino: 'Protocolo para gestantes e lactantes: as equações são do sexo feminino.',
  eerInfantil36Meses:
    'Corrigido em relação ao WebDiet: com exatamente 36 meses o WebDiet não aplica nenhum ramo do GET ' +
    'da EER/IOM 2005 infantil e a tela dá erro (§12, item 1). Aqui o GET usa o ramo de 3 anos ou mais ' +
    '(equação de 36 a 96 meses, idade de 3 anos, fator 1); a TMB e a lista de fatores ficam como no WebDiet.',
  eerInfantilSoVenta:
    'Na EER/IOM 2005 infantil o GET soma só a programação de peso (como no WebDiet): ' +
    'MET e adicional gestante não entram.',
  gestanteDados: 'Informe a idade gestacional (semanas) e o estado nutricional.',
  partoAusente: 'Informe uma data do parto válida (dd/mm/aaaa) e a data de referência, ou os meses de amamentação.',
  partoFuturo: 'A data do parto é posterior à data de referência.',
  lactacaoMaior12:
    'Mais de 12 meses de amamentação: a EER 2023 lactante não se aplica. GET não calculado.',
  ventaPesoForaDaFaixa: 'O peso desejado deve ficar entre −20% e +20% do peso atual.',
  ventaDiasForaDaFaixa: 'O prazo deve ser de 1 a 180 dias.',
});

// ---------------------------------------------------------------------------------------------
// Listas de fator atividade (§4.6). `valor` é o value da opção (texto do select, lido com check());
// o item vazio é a opção em branco do WebDiet. Os valores juntados por vírgula formam o campo
// `fatores` das evidências (ex.: ",1.000,1.200,1.375,1.550,1.725,1.900").
// ---------------------------------------------------------------------------------------------

const op = (valor, rotulo = valor) => Object.freeze({ valor, rotulo });
const lista = (...opcoes) => Object.freeze(opcoes);
const BRANCO = op('', '');

/** Listas de fator atividade por chave (ver `PROTOCOLOS[].fatores` e `listaFatores`). */
export const LISTAS_FATORES = Object.freeze({
  // Fórmulas 1, 2, 4, 6, 7, 9, 10, 12, 13, 14, 23 e fórmula vazia.
  padrao: lista(BRANCO, op('1.000', 'Não utilizar'), op('1.200', 'Sedentário'), op('1.375', 'Leve'),
    op('1.550', 'Moderada'), op('1.725', 'Intensa'), op('1.900', 'Muito intensa')),
  // Fórmula 5 (EER/IOM 2005 adulto) e 3 (Katch-McArdle — WebDiet §12 #7). Rótulos não documentados.
  eer2005M: lista(BRANCO, op('1.00'), op('1.11'), op('1.25'), op('1.48')),
  eer2005F: lista(BRANCO, op('1.00'), op('1.12'), op('1.27'), op('1.45')),
  // Fórmula 8 (FAO/WHO 2004): três valores FAO 2004 e três FAO 1985 (estes por sexo).
  faoM: lista(BRANCO, op('1.55', 'FAO 2004 · 1,55'), op('1.85', 'FAO 2004 · 1,85'), op('2.20', 'FAO 2004 · 2,20'),
    op('1.55', 'FAO 1985 · 1,55'), op('1.80', 'FAO 1985 · 1,80'), op('2.10', 'FAO 1985 · 2,10')),
  faoF: lista(BRANCO, op('1.55', 'FAO 2004 · 1,55'), op('1.85', 'FAO 2004 · 1,85'), op('2.20', 'FAO 2004 · 2,20'),
    op('1.56', 'FAO 1985 · 1,56'), op('1.64', 'FAO 1985 · 1,64'), op('1.82', 'FAO 1985 · 1,82')),
  // Fórmulas 21 e 22 acima de 36 meses (§4.4.2; para a 22, inferido de E56/E61/E66/E71).
  eer2005InfantilM: lista(BRANCO, op('1.00'), op('1.13'), op('1.26'), op('1.42')),
  eer2005InfantilF: lista(BRANCO, op('1.00'), op('1.16'), op('1.31'), op('1.56')),
  // Fórmulas 21 e 22 até 36 meses, inclusive: opção única (§4.4.2 "fator 'Não se aplica' = 1";
  // o limite de 36 meses inclusive e a fórmula 22 vêm de E76–E108).
  naoSeAplica: lista(op('1', 'Não se aplica')),
  // Fórmula 11 (fórmula de bolso): fator fixo (§4.6; extras `fatoresBolso`).
  naoAplicavel: lista(op('1', 'Não aplicável')),
  // Fórmula 24 (HandyMET). Textos exatos das opções não documentados (§4.6 dá só os valores).
  handymet: lista(BRANCO, op('1.0'), op('1.2'), op('1.5'), op('1.7'), op('2.1')),
  // Fórmula 25 (Min. Saúde – Gestante).
  gestanteMS: lista(BRANCO, op('1.0'), op('1.56'), op('1.64'), op('1.82')),
  // Fórmula 26: categoria 1–4 com os rótulos da tela (§4.4.3).
  categorias2023: lista(BRANCO, op('1', '1,4 Inativo'), op('2', '1,6 Pouco ativo'), op('3', '1,75 Ativo'),
    op('4', '2,05 Muito ativo')),
  // Fórmulas 27 e 28: categoria 1–4 (rótulos não documentados no relatório).
  categorias: lista(BRANCO, op('1', 'Categoria 1'), op('2', 'Categoria 2'), op('3', 'Categoria 3'),
    op('4', 'Categoria 4')),
  // Fórmula 29: categoria 1–4 com os rótulos da tela (§4.4.6).
  categoriasLactante: lista(BRANCO, op('1', '1,4'), op('2', '1,5'), op('3', '1,6'), op('4', '2,05')),
});

// ---------------------------------------------------------------------------------------------
// Fator injúria (§4.6). O WebDiet usa o atributo `calculo` da opção (`valor` aqui).
// `id` = value da opção. As evidências conferem os ids 4 (Sepse 1,3 — E31), 12 (Queimadura 100% —
// E32) e 16 (Doença cardiopulmonar 0,9 — E33); os demais seguem a ordem da lista do relatório,
// começando em 0 = "Não utilizar" (inferência, coerente com os três ids conferidos).
// ---------------------------------------------------------------------------------------------

const inj = (id, grupo, nome, valor, valorRotulo = valor) =>
  Object.freeze({ id, grupo, nome, valor, valorRotulo });

/** Opções de fator injúria: `valor` entra na conta; `valorRotulo` é o número mostrado no rótulo. */
export const INJURIAS = Object.freeze([
  inj(0, '', 'Não utilizar', 1.0),
  inj(1, 'Harris-Benedict (1919)', 'Não complicado', 1.0),
  inj(2, 'Harris-Benedict (1919)', 'Pós-operatório de câncer', 1.1),
  inj(3, 'Harris-Benedict (1919)', 'Fratura', 1.2),
  inj(4, 'Harris-Benedict (1919)', 'Sepse', 1.3),
  inj(5, 'Harris-Benedict (1919)', 'Peritonite', 1.4),
  inj(6, 'Harris-Benedict (1919)', 'Multitrauma + reabilitação', 1.5),
  inj(7, 'Harris-Benedict (1919)', 'Multitrauma + sepse', 1.6),
  inj(8, 'Harris-Benedict (1919)', 'Queimadura até 20%', 1.25),
  inj(9, 'Harris-Benedict (1919)', 'Queimadura 30–50%', 1.7),
  inj(10, 'Harris-Benedict (1919)', 'Queimadura 50–70%', 1.8),
  inj(11, 'Harris-Benedict (1919)', 'Queimadura 70–90%', 2.0),
  // WebDiet §12 #5: o rótulo mostra 2.100, mas o valor usado na conta é 2,0 (E32).
  inj(12, 'Harris-Benedict (1919)', 'Queimadura 100%', 2.0, 2.1),
  inj(13, 'Long (1979)', 'Câncer', 1.27),
  inj(14, 'Long (1979)', 'Cirurgia eletiva', 1.1),
  inj(15, 'Long (1979)', 'Desnutrição grave', 1.5),
  inj(16, 'Long (1979)', 'Doença cardiopulmonar', 0.9),
  inj(17, 'Long (1979)', 'Doença cardiopulmonar com cirurgia', 1.42),
  inj(18, 'Long (1979)', 'Fraturas múltiplas', 1.27),
  inj(19, 'Long (1979)', 'Infecção grave', 1.32),
  inj(20, 'Long (1979)', 'Insuficiência cardíaca', 1.4),
  inj(21, 'Long (1979)', 'Insuficiência hepática', 1.42),
  inj(22, 'Long (1979)', 'Insuficiência renal aguda', 1.3),
  inj(23, 'Long (1979)', 'Jejum', 0.9),
  inj(24, 'Long (1979)', 'Pancreatite', 1.55),
  inj(25, 'Long (1979)', 'Pequena cirurgia', 1.2),
  inj(26, 'Long (1979)', 'Pequeno trauma de tecido', 1.25),
  inj(27, 'Long (1979)', 'Pós-operatório: cirurgia cardíaca', 1.35),
  inj(28, 'Long (1979)', 'Pós-operatório: geral', 1.25),
  inj(29, 'Long (1979)', 'Pós-operatório: torácico', 1.35),
  inj(30, 'Long (1979)', 'Sepse', 1.6),
  inj(31, 'Long (1979)', 'Transplante de fígado', 1.35),
  inj(32, 'Long (1979)', 'Transplante de medula óssea', 1.25),
]);

/** Disposição de energia da EER 2023 gestante por estado nutricional (§4.4.5). */
export const DISPOSICAO_GESTANTE = Object.freeze({
  'Baixo peso': 300,
  'Saudável': 200,
  'Sobrepeso': 150,
  'Obesidade': -50,
});

// ---------------------------------------------------------------------------------------------
// Catálogo de protocolos (para a UI montar o formulário). Campos:
//  id, nome: value e rótulo da fórmula na tela (§4.2).
//  entradas: dados de que a fórmula precisa, com os nomes de `EntradaEnergia` ('nascimento' também
//    é satisfeito por `idade`/`meses`). Fator e injúria valem para todas e não estão listados.
//  fatores: lista de fator atividade — chave de LISTAS_FATORES; { M, F } (por sexo); ou
//    { ateMeses, ate, M, F } (lista `ate` até `ateMeses` meses, inclusive). `listaFatores` resolve.
//  tipoFator: 'multiplicador' (o fator multiplica) ou 'categoria' (26–29: categoria 1–4 da equação).
//  tmb: 'calculada' | 'informada' (digitada/importada) | 'nao_aplicavel' (tela "Não aplicável": a
//    equação dá o GET direto, ou o GET é manual) | 'ate_36_meses' (21: TMB até 36 meses, inclusive).
//  adicionais: adicionais (§4.7) que entram no GET: 'met', 'venta', 'gestante'.
//  limites: sexo ('F' = só mulheres; outro sexo calcula e avisa); idadeMinAnos/idadeMaxAnos
//    (inclusive); foraDaFaixa: 'sem_calculo' (não há equação: resultado null + aviso) ou
//    'calcula_com_aviso'; semanasMin (28) e mesesAmamentacaoMax (29).
// ---------------------------------------------------------------------------------------------

const TODOS_ADICIONAIS = Object.freeze(['met', 'venta', 'gestante']);
const SEM_LIMITES = Object.freeze({
  sexo: null, idadeMinAnos: null, idadeMaxAnos: null, foraDaFaixa: null, semanasMin: null, mesesAmamentacaoMax: null,
});
const limites = (l) => Object.freeze({ ...SEM_LIMITES, ...l });
const proto = (id, nome, entradas, fatores, tmb, extra = {}) => Object.freeze({
  id,
  nome,
  entradas: Object.freeze(entradas),
  fatores: typeof fatores === 'string' ? fatores : Object.freeze(fatores),
  tipoFator: extra.tipoFator || 'multiplicador',
  tmb,
  adicionais: extra.adicionais || TODOS_ADICIONAIS,
  limites: extra.limites || SEM_LIMITES,
});

const ANTROPO = ['sexo', 'nascimento', 'peso', 'altura'];
const EER2005 = { M: 'eer2005M', F: 'eer2005F' };
const EER2005_INFANTIL = { ateMeses: 36, ate: 'naoSeAplica', M: 'eer2005InfantilM', F: 'eer2005InfantilF' };
const CATEGORIA = 'categoria';

/** Protocolos documentados no relatório (§4.2–§4.5): ids 1–14 e 21–29. */
export const PROTOCOLOS = Object.freeze([
  proto(1, 'Harris-Benedict (1919)', ANTROPO, 'padrao', 'calculada'),
  proto(2, 'Harris-Benedict (1984)', ANTROPO, 'padrao', 'calculada'),
  // WebDiet §12 #7: Katch-McArdle usa a lista de fatores da EER 2005 (por isso precisa do sexo).
  proto(3, 'Katch-McArdle (1996)', ['sexo', 'peso', 'mlg'], EER2005, 'calculada'),
  proto(4, 'Cunningham (1980)', ['peso', 'mlg'], 'padrao', 'calculada'),
  proto(5, 'EER/IOM (2005) adulto', ANTROPO, EER2005, 'nao_aplicavel'),
  proto(6, 'Mifflin-St Jeor (1990)', ANTROPO, 'padrao', 'calculada'),
  proto(7, 'Mifflin-St Jeor por MLG', ['peso', 'mlg'], 'padrao', 'calculada'),
  proto(8, 'FAO/WHO (2004)', ['sexo', 'nascimento', 'peso'], { M: 'faoM', F: 'faoF' }, 'calculada'),
  proto(9, 'Henry & Rees (1991)', ['sexo', 'nascimento', 'peso'], 'padrao', 'calculada', {
    limites: limites({ idadeMinAnos: 3, foraDaFaixa: 'sem_calculo' }),
  }),
  proto(10, 'GET manual', ['peso', 'getManual'], 'padrao', 'nao_aplicavel'),
  proto(11, 'Fórmula de bolso', ['peso', 'bolso'], 'naoAplicavel', 'nao_aplicavel'),
  proto(12, 'Tinsley por peso (2018)', ['peso'], 'padrao', 'calculada'),
  proto(13, 'Tinsley por MLG (2018)', ['peso', 'mlg'], 'padrao', 'calculada'),
  proto(14, 'TMB manual', ['peso', 'tmbInformada'], 'padrao', 'informada'),
  proto(21, 'EER/IOM (2005) infantil', ANTROPO, EER2005_INFANTIL, 'ate_36_meses', { adicionais: Object.freeze(['venta']) }),
  proto(22, 'FAO/WHO (2004) infantil', ['sexo', 'nascimento', 'peso'], EER2005_INFANTIL, 'calculada'),
  proto(23, 'Schofield (1985) infantil', ANTROPO, 'padrao', 'calculada', {
    limites: limites({ idadeMaxAnos: 18, foraDaFaixa: 'sem_calculo' }),
  }),
  proto(24, 'HandyMET', ['peso', 'tmbInformada'], 'handymet', 'informada'),
  proto(25, 'Min. Saúde – Gestante (2005)', ['nascimento', 'peso'], 'gestanteMS', 'calculada', {
    limites: limites({ sexo: 'F', idadeMinAnos: 11, foraDaFaixa: 'sem_calculo' }),
  }),
  proto(26, 'EER 2023 adultos (≥ 19 anos)', ANTROPO, 'categorias2023', 'nao_aplicavel', {
    tipoFator: CATEGORIA,
    limites: limites({ idadeMinAnos: 19, foraDaFaixa: 'calcula_com_aviso' }),
  }),
  proto(27, 'EER 2023 infantil', ANTROPO, 'categorias', 'nao_aplicavel', {
    tipoFator: CATEGORIA,
    limites: limites({ idadeMaxAnos: 18, foraDaFaixa: 'sem_calculo' }),
  }),
  proto(28, 'EER 2023 gestante', ['nascimento', 'peso', 'altura', 'semanas', 'estadoNutricional'],
    'categorias', 'nao_aplicavel', {
      tipoFator: CATEGORIA,
      adicionais: Object.freeze(['venta', 'met']),
      limites: limites({ sexo: 'F', semanasMin: 14 }),
    }),
  proto(29, 'EER 2023 lactante', ['nascimento', 'peso', 'altura', 'dataParto'], 'categoriasLactante',
    'nao_aplicavel', {
      tipoFator: CATEGORIA,
      limites: limites({ sexo: 'F', mesesAmamentacaoMax: 12 }),
    }),
]);

/** Mensagem para idade fora da faixa, por protocolo com `limites.foraDaFaixa`. */
const AVISO_FORA_DA_FAIXA = Object.freeze({
  9: MENSAGENS.henryMenor3, // §12 #6
  23: MENSAGENS.schofieldMaior18,
  25: MENSAGENS.msGestanteAte10,
  26: MENSAGENS.eer2023AdultoMenor19,
  27: MENSAGENS.eer2023InfantilMaior19,
});

/**
 * Até que idade (anos) as faixas em meses mudam o resultado: 21 (TMB por mês até 36 m; +20/+25 em
 * 96 m), 22 (lista de fatores em 36 m) e 27 (faixas por mês abaixo de 3 anos).
 */
const IDADE_ATE_A_QUAL_MESES_IMPORTAM = Object.freeze({ 21: 8, 22: 3, 27: 2 });

/** Divergências científicas do §12 mantidas iguais ao WebDiet (itens 2, 3, 4, 5, 7, 8, 9). */
export const DIVERGENCIAS = Object.freeze([
  {
    item: 2,
    descricao: 'EER 2023 gestante: precedência "… + disposição × injúria" — só a disposição de energia é multiplicada pela injúria.',
    comportamento: 'Mantido como no WebDiet: GET = equação + disposição × injúria + VENTA + MET.',
  },
  {
    item: 3,
    descricao: 'EER 2023 lactante: "+540 − 140 × injúria" — só o 140 é multiplicado pela injúria.',
    comportamento: 'Mantido como no WebDiet: 0–6 meses = equação + 540 − 140 × injúria; 7–12 meses = equação + 380 × injúria; a equação base não é multiplicada.',
  },
  {
    item: 4,
    descricao: 'EER 2023 infantil 0–2,99 anos: o termo de idade usa a idade em anos (provavelmente não é erro; Health Canada também usa anos).',
    comportamento: 'Mantido como no WebDiet: termo de idade com I em anos completos (conferido em E79–E105).',
  },
  {
    item: 5,
    descricao: 'Injúria "Queimadura 100%": o rótulo mostra 2.100, mas o valor usado é 2,0.',
    comportamento: 'Mantido como no WebDiet: INJURIAS id 12 tem valor 2,0 (valorRotulo 2,1 só para exibição; conferido em E32).',
  },
  {
    item: 7,
    descricao: 'Katch-McArdle usa a lista de fatores da EER 2005 (1,00/1,11/1,25/1,48 · 1,00/1,12/1,27/1,45) em vez da lista padrão.',
    comportamento: 'Mantido como no WebDiet: listaFatores(3) devolve a lista eer2005 do sexo (conferido em E03/E18).',
  },
  {
    item: 8,
    descricao: 'Schofield infantil, meninas 3–10 anos: coeficiente da estatura 161,08 (a forma usual traz 161,8).',
    comportamento: 'Mantido como no WebDiet: 16,969P + 161,08Am + 371,2 (conferido em E72; com 161,8 a tela daria 915).',
  },
  {
    item: 9,
    descricao: 'Programação de peso: a tela mostra o valor arredondado (toFixed) e aplica o truncado (parseInt).',
    comportamento: 'Mantido como no WebDiet: programarPeso().kcalDia é o valor truncado que entra no GET; tela.r2 mostra o arredondado.',
  },
]);

/** Erros do §12 em que o nutri-studio devolve um resultado explícito em vez do comportamento do WebDiet. */
export const CORRECOES = Object.freeze([
  {
    item: 1,
    descricao: 'EER/IOM 2005 infantil com exatamente 36 meses: nenhum ramo do GET se aplica, exceção de JS e a tela fica com o GET anterior (E108).',
    comportamento: 'TMB (até 36 meses, inclusive) e lista de fatores ("Não se aplica" = 1) como no WebDiet; o GET usa o ramo de 3 anos ou mais (36 < Im ≤ 96, +20) com I = 3 e fator 1; `corrigido = true` e `aviso`.',
  },
  {
    item: 6,
    descricao: 'Henry & Rees abaixo de 3 anos não tem equação: a TMB não é recalculada e fica a anterior.',
    comportamento: 'TMB e GET = null, com `aviso`.',
  },
]);

// ---------------------------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------------------------

/**
 * Normaliza o sexo: 'M' (masculino) ou 'F' (feminino); qualquer outro valor → null.
 * @param {unknown} sexo
 * @returns {'M'|'F'|null}
 */
function normalizarSexo(sexo) {
  const s = String(sexo ?? '').trim().toUpperCase();
  if (s === 'M' || s === 'MASCULINO' || s === 'H') return 'M';
  if (s === 'F' || s === 'FEMININO') return 'F';
  return null;
}

/** true se o valor foi informado (não nulo, não indefinido, não string vazia). */
const informado = (v) => v !== null && v !== undefined && String(v).trim() !== '';

/** Texto sem acento e em minúsculas (para comparar o estado nutricional). */
const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/**
 * Disposição de energia (EER 2023 gestante) pelo estado nutricional, sem diferenciar acento/caixa.
 * @param {unknown} estado
 * @returns {number|undefined}
 */
function disposicaoGestante(estado) {
  const alvo = semAcento(estado);
  const chave = Object.keys(DISPOSICAO_GESTANTE).find((k) => semAcento(k) === alvo);
  return chave === undefined ? undefined : DISPOSICAO_GESTANTE[chave];
}

/**
 * Idade em anos e meses completos (§3), pelo nascimento na data do exame ou por `idade`/`meses`.
 * @param {EntradaEnergia} e
 * @returns {{I: number, Im: number, estimada: boolean, erro: string|null}}
 */
function resolverIdade(e) {
  const falha = (erro) => ({ I: 0, Im: 0, estimada: false, erro });
  if (informado(e.nascimento)) {
    const dataIdade = informado(e.dataExame) ? e.dataExame : e.dataReferencia;
    if (!partesData(e.nascimento)) return falha(MENSAGENS.nascimentoInvalido);
    if (!partesData(dataIdade)) return falha(MENSAGENS.dataReferenciaAusente);
    const I = idadeAnos(e.nascimento, dataIdade);
    const Im = idadeMeses(e.nascimento, dataIdade);
    return Im < 0 ? falha(MENSAGENS.idadeNegativa) : { I, Im, estimada: false, erro: null };
  }
  if (informado(e.meses)) {
    const Im = Math.trunc(check(e.meses));
    const I = informado(e.idade) ? Math.trunc(check(e.idade)) : Math.floor(Im / 12);
    return Im < 0 || I < 0 ? falha(MENSAGENS.idadeNegativa) : { I, Im, estimada: false, erro: null };
  }
  if (informado(e.idade)) {
    const I = Math.trunc(check(e.idade));
    return I < 0 ? falha(MENSAGENS.idadeNegativa) : { I, Im: I * 12, estimada: true, erro: null };
  }
  return falha(MENSAGENS.idadeAusente);
}

/**
 * Lista de fator atividade de uma fórmula (§4.6), já resolvida por sexo e idade.
 * Fórmula desconhecida ou vazia → lista padrão (como no WebDiet). Lista por sexo sem sexo → só a opção em branco.
 * @param {number|string} formula
 * @param {{sexo?: string, idadeMeses?: number}} [paciente]
 * @returns {ReadonlyArray<{valor: string, rotulo: string}>}
 */
export function listaFatores(formula, paciente = {}) {
  const p = PROTOCOLOS.find((x) => x.id === check(formula));
  const d = p ? p.fatores : 'padrao';
  if (typeof d === 'string') return LISTAS_FATORES[d];
  if (d.ateMeses !== undefined && check(paciente.idadeMeses) <= d.ateMeses) return LISTAS_FATORES[d.ate];
  const sexo = normalizarSexo(paciente.sexo);
  return sexo ? LISTAS_FATORES[d[sexo]] : lista(BRANCO);
}

/**
 * Adicional de atividade física por MET (§4.7): Σ (minutos × peso × MET / 60).
 * @param {{peso: number|string, atividades?: Array<{met: number|string, minutos: number|string}>}} p
 * @returns {{kcal: number, tela: string}} kcal sem arredondar (é o que entra no GET); tela = "420 Kcal/dia".
 */
export function calcularMet({ peso, atividades = [] }) {
  const P = check(peso);
  let kcal = 0;
  for (const a of atividades) kcal += (check(a.minutos) * P * check(a.met)) / 60;
  return { kcal, tela: `${fx(kcal, 0)} Kcal/dia` };
}

/**
 * Programação de peso / VENTA (§4.7): kcal/dia = (peso desejado − peso) × 7700 / dias.
 * Sem peso, usa 50 kg. Peso desejado: ±20% do peso atual; dias: 1–180 (padrão 90).
 * @param {{peso?: number|string, pesoDesejado: number|string, dias?: number|string}} p
 * @returns {{
 *   kcalDia: number|null, kcalDiaExato: number|null, diferencaKg: number|null,
 *   pesoMinimo: number, pesoMaximo: number, dias: number, aviso: string|null,
 *   tela: {r1: string, r2: string, pesoPaciente: string, sliderMin: string, sliderMax: string, venta: string}
 * }} kcalDia = valor aplicado no GET (truncado); tela.r2 = valor exibido (arredondado).
 */
export function programarPeso({ peso, pesoDesejado, dias }) {
  const base = check(peso) || 50; // "Sem peso, usa 50 kg."
  const pesoMinimo = base * 0.8;
  const pesoMaximo = base * 1.2;
  const d = informado(dias) ? check(dias) : 90;
  const alvo = check(pesoDesejado);
  const telaVazia = {
    r1: '', r2: '', pesoPaciente: '', sliderMin: String(pesoMinimo), sliderMax: String(pesoMaximo), venta: 'Programar peso',
  };
  const falha = (aviso) => ({
    kcalDia: null, kcalDiaExato: null, diferencaKg: null, pesoMinimo, pesoMaximo, dias: d, aviso, tela: telaVazia,
  });
  // O WebDiet aceita 0 dias (divide por zero); aqui o prazo vai de 1 a 180 dias.
  if (!(d > 0 && d <= 180)) return falha(MENSAGENS.ventaDiasForaDaFaixa);
  const tolerancia = 1e-9; // ex.: 70,2 × 0,8 = 56,160000000000004
  if (alvo < pesoMinimo - tolerancia || alvo > pesoMaximo + tolerancia) return falha(MENSAGENS.ventaPesoForaDaFaixa);

  const diferencaKg = alvo - base;
  const kcalDiaExato = (diferencaKg * KCAL_POR_KG) / d;
  // WebDiet §12 #9: mostra toFixed(0), mas aplica parseInt (trunca em direção a zero).
  const kcalDia = Math.trunc(kcalDiaExato);
  const sinalKg = diferencaKg > 0 ? '+' : '';
  const sinalKcal = kcalDiaExato > 0 ? '+' : '';
  return {
    kcalDia,
    kcalDiaExato,
    diferencaKg,
    pesoMinimo,
    pesoMaximo,
    dias: d,
    aviso: null,
    tela: {
      r1: `Total de ${sinalKg}${fx(diferencaKg, 1)} Kg em ${d} dias`,
      r2: `(${sinalKcal}${fx(kcalDiaExato, 0)} Kcal/dia)`,
      pesoPaciente: fx(diferencaKg, 1),
      sliderMin: String(pesoMinimo),
      sliderMax: String(pesoMaximo),
      venta: `${kcalDia} Kcal/dia`,
    },
  };
}

/**
 * Fórmula de bolso (11), §4.5: GET = PTN×P×4 + LIP×P×9 + CHO×P×4 (g/kg).
 * @param {{peso: number|string, ptn: number|string, lip: number|string, cho: number|string}} p
 * @returns {{kcal: number, kcalArredondado: number, tela: {r: string, r2: string}}}
 *   r = GET.toFixed(0); r2 = (GET.toFixed(0) / P).toFixed(1).
 */
export function calcularBolso({ peso, ptn, lip, cho }) {
  const P = check(peso);
  const kcal = check(ptn) * P * 4 + check(lip) * P * 9 + check(cho) * P * 4;
  const kcalArredondado = fxn(kcal, 0);
  return {
    kcal,
    kcalArredondado,
    tela: { r: fx(kcal, 0), r2: P > 0 ? fx(kcalArredondado / P, 1) : '' },
  };
}

/**
 * Conversão entre os dois campos do GET manual (10), §4.5.
 * Com `kcalKg` (e sem `kcal`): kcal = (kcal/kg × P).toFixed(0). Com `kcal`: kcal/kg = (kcal / P).toFixed(1).
 * @param {{peso: number|string, kcal?: number|string, kcalKg?: number|string}} p
 * @returns {{kcal: number, kcalKg: number|null, tela: {getTemp: string, getTemp2: string}}}
 *   kcal = valor do campo kcal (é o que entra no GET); tela.getTemp = campo kcal; tela.getTemp2 =
 *   campo kcal/kg (nomes das evidências).
 */
export function converterGetManual({ peso, kcal, kcalKg }) {
  const P = check(peso);
  if (informado(kcalKg) && !informado(kcal)) {
    const k = check(kcalKg);
    return { kcal: fxn(k * P, 0), kcalKg: k, tela: { getTemp: fx(k * P, 0), getTemp2: String(kcalKg) } };
  }
  const k = check(kcal);
  return {
    kcal: k,
    kcalKg: P > 0 ? fxn(k / P, 1) : null,
    tela: { getTemp: informado(kcal) ? String(kcal) : '', getTemp2: P > 0 ? fx(k / P, 1) : '' },
  };
}

// ---------------------------------------------------------------------------------------------
// Equações de TMB (§4.2). `sexo` é 'M' ou 'F'; I em anos completos; P em kg; A em cm.
// ---------------------------------------------------------------------------------------------

/** FAO/WHO 2004 (fórmulas 8 e 22), §4.2.1. */
function tmbFao(sexo, I, P) {
  const H = sexo === 'M';
  if (I <= 3) return H ? 59.512 * P - 30.4 : 58.317 * P - 31.1;
  if (I <= 10) return H ? 22.706 * P + 504.3 : 20.315 * P + 485.9;
  if (I <= 18) return H ? 17.686 * P + 658.2 : 13.384 * P + 692.6;
  if (I <= 30) return H ? 15.057 * P + 692.2 : 14.818 * P + 486.6;
  if (I <= 60) return H ? 11.472 * P + 873.1 : 8.126 * P + 845.6;
  return H ? 11.711 * P + 587.7 : 9.082 * P + 658.5;
}

/** Henry & Rees 1991 (fórmula 9), §4.2.2. Abaixo de 3 anos não há equação: null (§12 #6, corrigido). */
function tmbHenry(sexo, I, P) {
  const H = sexo === 'M';
  if (I < 3) return null;
  if (I <= 10) return (H ? 0.113 * P + 1.689 : 0.063 * P + 2.466) * 239;
  if (I <= 18) return (H ? 0.084 * P + 2.122 : 0.047 * P + 2.951) * 239;
  if (I <= 30) return (H ? 0.056 * P + 2.800 : 0.048 * P + 2.562) * 239;
  return (H ? 0.046 * P + 3.160 : 0.048 * P + 2.448) * 239;
}

/** Schofield 1985 infantil (fórmula 23), §4.2.3. Acima de 18 anos não há equação: null. */
function tmbSchofield(sexo, I, P, A) {
  const H = sexo === 'M';
  const Am = A / 100;
  if (I <= 3) return H ? 0.167 * P + 15.174 * A - 617.6 : 16.252 * P + 10.232 * A - 413.5;
  if (I <= 10) {
    // WebDiet §12 #8: meninas com 161,08 (a forma usual traz 161,8). Conferido em E72.
    return H ? 19.59 * P + 130.3 * Am + 414.9 : 16.969 * P + 161.08 * Am + 371.2;
  }
  if (I <= 18) return H ? 16.25 * P + 137.2 * Am + 515.5 : 8.365 * P + 465 * Am + 200;
  return null;
}

/** Min. Saúde – Gestante 2005 (fórmula 25), §4.2. Até 10 anos não há equação: null. */
function tmbGestanteMS(I, P) {
  if (I > 60) return 10.5 * P + 596;
  if (I > 30) return 8.7 * P + 829;
  if (I > 18) return 14.7 * P + 496;
  if (I > 10) return 12.2 * P + 746;
  return null;
}

/** EER/IOM 2005 infantil (21), §4.2: TMB até 36 meses = (89P − 100) + adicional por idade em meses. */
function tmbEerInfantil(Im, P) {
  const extra = Im <= 3 ? 175 : Im <= 6 ? 56 : Im <= 12 ? 22 : 20;
  return 89 * P - 100 + extra;
}

// ---------------------------------------------------------------------------------------------
// Equações de GET direto (§4.4)
// ---------------------------------------------------------------------------------------------

/** EER 2023 adultos (§4.4.3): [constante, coef. altura (cm), coef. peso] por categoria 1–4. */
const EER2023_ADULTO = {
  M: [[753.07, 6.50, 14.10], [581.47, 8.30, 14.94], [1004.82, 6.52, 15.91], [-517.88, 15.61, 19.11]],
  F: [[584.90, 5.72, 11.71], [575.77, 6.60, 12.14], [710.25, 6.54, 12.34], [511.83, 9.07, 12.56]],
};

/** EER 2023 3–18 anos (§4.4.4): [constante, coef. altura (cm), coef. peso] por categoria 1–4. */
const EER2023_INFANTIL = {
  M: [[-447.51, 13.01, 13.15], [19.12, 8.62, 20.28], [-388.19, 12.66, 20.46], [-671.75, 15.38, 23.25]],
  F: [[55.59, 8.43, 17.07], [-297.54, 12.77, 14.73], [-189.55, 11.74, 18.34], [-709.59, 18.22, 14.25]],
};

/** EER 2023 gestante (§4.4.5): [constante, coef. altura (cm), coef. peso] por categoria 1–4. */
const EER2023_GESTANTE = [[1131.20, 0.34, 12.15], [693.35, 5.73, 10.20], [-223.84, 13.23, 8.15], [-779.72, 18.45, 8.73]];

/** EER/IOM 2005 adulto (5), §4.4.1, sem injúria e adicionais. */
function eer2005Adulto(sexo, fator, I, P, Am) {
  return sexo === 'M'
    ? 662 - 9.53 * I + fator * (15.91 * P + 539.6 * Am)
    : 354 - 6.91 * I + fator * (9.36 * P + 726 * Am);
}

/** EER/IOM 2005 infantil (21) acima de 36 meses, §4.4.2: fator e injúria multiplicam o termo de P e Am. */
function eer2005InfantilMaior36(sexo, fatorInjuria, I, Im, P, Am) {
  const extra = Im <= 96 ? 20 : 25;
  return sexo === 'M'
    ? 88.5 - 61.9 * I + fatorInjuria * (26.7 * P + 903 * Am) + extra
    : 135.3 - 30.8 * I + fatorInjuria * (10 * P + 934 * Am) + extra;
}

function eer2023Adulto(sexo, cat, I, A, P) {
  const [c, a, p] = EER2023_ADULTO[sexo][cat - 1];
  return sexo === 'M' ? c - 10.83 * I + a * A + p * P : c - 7.01 * I + a * A + p * P;
}

/** Equação EER 2023 de 3–18 anos, sem o custo energético. */
function eer2023Infantil(sexo, cat, I, A, P) {
  const [c, a, p] = EER2023_INFANTIL[sexo][cat - 1];
  return sexo === 'M' ? c + 3.68 * I + a * A + p * P : c - 22.25 * I + a * A + p * P;
}

/** EER 2023 de 0 a 2,99 anos (§4.4.4): a categoria não altera o resultado. */
function eer2023Ate3Anos(sexo, I, Im, A, P) {
  // WebDiet §12 #4: o termo de idade usa I em anos (Health Canada também usa anos).
  if (sexo === 'M') {
    const extra = Im < 3 ? 200 : Im < 6 ? 50 : 20;
    return -716.45 - 1.00 * I + 17.82 * A + 15.06 * P + extra;
  }
  const extra = Im < 3 ? 180 : Im < 6 ? 60 : Im < 12 ? 20 : 15;
  return -69.15 + 80.0 * I + 2.65 * A + 54.15 * P + extra;
}

/** Custo energético da EER 2023 de 3 a 13 anos (§4.4.4). */
function custoEnergetico2023(sexo, I) {
  if (I <= 3) return sexo === 'M' ? 20 : 15;
  if (I <= 8) return 15;
  return sexo === 'M' ? 25 : 30;
}

// ---------------------------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} EntradaEnergia
 * @property {number|string} formula Id do protocolo (ver PROTOCOLOS).
 * @property {'M'|'F'} [sexo] 'M' masculino, 'F' feminino.
 * @property {string} [nascimento] "dd/mm/aaaa". A idade é calculada na data do exame (§4.1).
 * @property {string} [dataExame] Data do exame "dd/mm/aaaa". Padrão: dataReferencia.
 * @property {string} [dataReferencia] "Hoje" em "dd/mm/aaaa" (no WebDiet, a data do servidor). Usada
 *   para a idade (sem dataExame) e para os meses de amamentação (29).
 * @property {number|string} [idade] Idade em anos completos (alternativa a nascimento + data).
 * @property {number|string} [meses] Idade em meses completos (alternativa a nascimento + data; sem
 *   `idade`, anos = ⌊meses/12⌋). Só com `idade`, meses = anos × 12, com aviso nas fórmulas por mês.
 * @property {number|string} [peso] kg.
 * @property {number|string} [altura] cm.
 * @property {number|string} [mlg] Massa livre de gordura, kg.
 * @property {number|string} [fator] Value da opção de fator atividade (26–29: categoria 1–4). Tem de
 *   estar na lista da fórmula (`listaFatores`); listas de opção única dispensam.
 * @property {number|string} [injuria] Id da opção de INJURIAS (padrão 0 = "Não utilizar").
 * @property {number|string} [tmbInformada] TMB digitada (14) ou importada do HandyMET (24).
 * @property {{kcal?: number|string, kcalKg?: number|string}} [getManual] GET manual (10).
 * @property {{ptn: number|string, lip: number|string, cho: number|string}} [bolso] Fórmula de bolso (11), g/kg.
 * @property {number|string} [semanas] Idade gestacional em semanas (28).
 * @property {'Baixo peso'|'Saudável'|'Sobrepeso'|'Obesidade'} [estadoNutricional] (28).
 * @property {string} [dataParto] "dd/mm/aaaa" (29), com dataReferencia.
 * @property {number|string} [mesesAmamentacao] Alternativa a dataParto (29).
 * @property {Array<{met: number|string, minutos: number|string}>} [atividades] Adicional MET.
 * @property {{pesoDesejado: number|string, dias?: number|string}} [programacaoPeso] Adicional VENTA.
 * @property {number|string} [adicionalGestante] kcal/dia digitadas ou importadas do acompanhamento gestacional.
 */

/**
 * @typedef {Object} TelaEnergia Strings como na tela do WebDiet (mesmos nomes das evidências).
 * @property {string} tmb "1806 Kcal/dia" | "Não aplicável" | "Massa livre de gordura em branco" | "" (não calculada).
 * @property {string} tmbkg "(22.6 Kcal/kg)" | "".
 * @property {string} get "2799 Kcal/dia" | "Escolha o fator atividade" | "".
 * @property {string} getkg "(35.0 Kcal/kg)" | "0.0 Kcal/kg" | "".
 * @property {string} erro Mensagem da linha de erro (EER 2023 gestante/lactante); "" se não houver.
 * @property {string} fatores Values da lista de fator atividade juntados por vírgula.
 * @property {string} met "420 Kcal/dia" | "Programar MET".
 * @property {string} venta "-641 Kcal/dia" | "Programar peso".
 * @property {string} gest "300 Kcal/dia" | "Incluir adicional".
 */

/**
 * @typedef {Object} ResultadoEnergia
 * @property {number|null} formula
 * @property {string|null} protocolo Nome do protocolo.
 * @property {number} idadeAnos Na data do exame.
 * @property {number} idadeMeses Na data do exame.
 * @property {number|null} mesesAmamentacao Só na fórmula 29.
 * @property {boolean} tmbAplicavel false quando a TMB é "Não aplicável".
 * @property {number|null} tmb TMB sem arredondar (null se não aplicável ou não calculada).
 * @property {number|null} tmbArredondada TMB inteira (a que entra no GET, §4.3).
 * @property {number|null} tmbPorKg TMB/P sem arredondar.
 * @property {number|null} get GET sem arredondar (null se não calculado).
 * @property {number|null} getArredondado GET inteiro (o exibido).
 * @property {number|null} getPorKg GET/P sem arredondar.
 * @property {number|null} fatorAtividade Valor usado (26–29: categoria).
 * @property {number|null} fatorInjuria Valor usado (atributo `calculo`).
 * @property {{met: number|null, venta: number|null, gestante: number|null}} adicionais Valores somados ao GET.
 * @property {ReturnType<typeof programarPeso>|null} programacaoPeso Detalhe da VENTA.
 * @property {ReadonlyArray<{valor: string, rotulo: string}>} opcoesFator Lista de fator atividade.
 * @property {boolean} corrigido true quando o resultado difere do WebDiet por correção (§12 #1).
 * @property {string|null} aviso Avisos em português, juntados por espaço (null se não houver).
 * @property {string[]} avisos Os mesmos avisos, um por item.
 * @property {TelaEnergia} tela
 */

/**
 * Calcula TMB e GET como o WebDiet (§4).
 *
 * GET padrão (§4.3): TMB exibida (inteira) × fator × injúria + MET + VENTA + adicional gestante.
 * kcal/kg da TMB e do GET usam os valores sem arredondar. Nunca lança exceção: entradas faltando ou
 * fora da faixa dão valores null e `aviso`.
 * @param {EntradaEnergia} entrada
 * @returns {ResultadoEnergia}
 */
export function calcularEnergia(entrada = {}) {
  const avisos = [];
  const f = check(entrada.formula);
  const protocolo = PROTOCOLOS.find((p) => p.id === f) || null;
  const sexo = normalizarSexo(entrada.sexo);
  const idade = resolverIdade(entrada);
  const I = idade.I;
  const Im = idade.Im;
  const P = check(entrada.peso);
  const A = check(entrada.altura);
  const Am = A / 100;
  const MLG = check(entrada.mlg);
  const H = sexo === 'M';

  // Fator atividade: lista da fórmula. Lista de opção única: usada sempre (o select só tem ela).
  const opcoesFator = listaFatores(f, { sexo, idadeMeses: Im });
  const fatores = opcoesFator.map((o) => o.valor).join(',');
  const valoresFator = opcoesFator.filter((o) => o.valor !== '').map((o) => check(o.valor));
  let fator = null;
  let fatorInvalido = false;
  if (opcoesFator.length === 1 && valoresFator.length === 1) {
    fator = valoresFator[0];
  } else if (informado(entrada.fator)) {
    const v = check(entrada.fator);
    if (valoresFator.includes(v)) fator = v;
    else fatorInvalido = true;
  }

  // Fator injúria pelo id da opção.
  const idInjuria = informado(entrada.injuria) ? check(entrada.injuria) : 0;
  const opInjuria = INJURIAS.find((o) => o.id === idInjuria) || null;
  const fatorInjuria = opInjuria ? opInjuria.valor : null;

  // Adicionais (§4.7).
  const temMet = Array.isArray(entrada.atividades) && entrada.atividades.length > 0;
  const met = temMet ? calcularMet({ peso: P, atividades: entrada.atividades }) : null;
  const venta = entrada.programacaoPeso ? programarPeso({ peso: P, ...entrada.programacaoPeso }) : null;
  if (venta && venta.aviso) avisos.push(venta.aviso);
  const gestante = informado(entrada.adicionalGestante) && check(entrada.adicionalGestante) !== 0
    ? check(entrada.adicionalGestante) : null;
  const vMet = met ? met.kcal : 0; // soma sem arredondar (só a exibição usa toFixed)
  const vVenta = venta && venta.kcalDia !== null ? venta.kcalDia : 0;
  const vGest = gestante ?? 0;

  /** @type {ResultadoEnergia} */
  const r = {
    formula: protocolo ? f : null,
    protocolo: protocolo ? protocolo.nome : null,
    idadeAnos: I,
    idadeMeses: Im,
    mesesAmamentacao: null,
    tmbAplicavel: true,
    tmb: null,
    tmbArredondada: null,
    tmbPorKg: null,
    get: null,
    getArredondado: null,
    getPorKg: null,
    fatorAtividade: null,
    fatorInjuria,
    adicionais: { met: null, venta: null, gestante: null },
    programacaoPeso: venta,
    opcoesFator,
    corrigido: false,
    aviso: null,
    avisos,
    tela: {
      tmb: '', tmbkg: '', get: '', getkg: '', erro: '', fatores,
      met: met ? met.tela : 'Programar MET',
      venta: venta && venta.kcalDia !== null ? venta.tela.venta : 'Programar peso',
      gest: gestante !== null ? `${fx(gestante, 0)} Kcal/dia` : 'Incluir adicional',
    },
  };

  const fim = () => {
    r.aviso = avisos.length ? avisos.join(' ') : null;
    return r;
  };
  /** TMB "Não aplicável" (a equação dá o GET direto). */
  const naoAplicavel = () => {
    r.tmbAplicavel = false;
    r.tela.tmb = 'Não aplicável';
    r.tela.tmbkg = '';
  };
  /** GET não calculado. `placeholder` reproduz a tela do WebDiet ("Escolha o fator atividade"). */
  const semGet = (aviso, placeholder = false) => {
    if (aviso) avisos.push(aviso);
    if (placeholder) {
      r.tela.get = MENSAGENS.escolhaFator;
      r.tela.getkg = MENSAGENS.getKgVazio;
    }
    return fim();
  };
  /** GET não calculado por falta de fator atividade válido. */
  const semFator = () => semGet(fatorInvalido ? MENSAGENS.fatorForaDaLista : MENSAGENS.escolhaFator, true);
  /** Mensagem na linha de erro da tela (EER 2023 gestante/lactante) e GET não calculado. */
  const erroTela = (mensagem) => {
    r.tela.erro = mensagem;
    return semGet(mensagem, true);
  };
  /** Registra a TMB calculada (sem arredondar) e a exibição. */
  const registrarTmb = (tmb) => {
    r.tmb = tmb;
    r.tmbArredondada = fxn(tmb, 0);
    r.tela.tmb = `${fx(tmb, 0)} Kcal/dia`;
    if (P > 0) {
      r.tmbPorKg = tmb / P; // kcal/kg da TMB usa a TMB sem arredondar (§4.3)
      r.tela.tmbkg = `(${fx(tmb / P, 1)} Kcal/kg)`;
    }
  };
  /** Registra o GET (sem arredondar), a exibição e os adicionais efetivamente somados. */
  const registrarGet = (get, somados) => {
    r.get = get;
    r.getArredondado = fxn(get, 0);
    r.tela.get = `${fx(get, 0)} Kcal/dia`;
    if (P > 0) {
      r.getPorKg = get / P; // kcal/kg do GET usa o GET sem arredondar (§4.3)
      r.tela.getkg = `(${fx(get / P, 1)} Kcal/kg)`;
    } else {
      avisos.push(MENSAGENS.pesoAusente);
    }
    r.adicionais = {
      met: somados.includes('met') && met ? vMet : null,
      venta: somados.includes('venta') && venta && venta.kcalDia !== null ? vVenta : null,
      gestante: somados.includes('gestante') ? gestante : null,
    };
    return fim();
  };

  // --- validações gerais ---
  if (!protocolo) return semGet(MENSAGENS.formulaDesconhecida);
  if (protocolo.tmb === 'nao_aplicavel') naoAplicavel();
  if (protocolo.entradas.includes('sexo') && !sexo) return semGet(MENSAGENS.sexoAusente);
  if (protocolo.entradas.includes('nascimento')) {
    if (idade.erro) return semGet(idade.erro);
    if (idade.estimada && I <= (IDADE_ATE_A_QUAL_MESES_IMPORTAM[f] ?? -1)) avisos.push(MENSAGENS.mesesEstimados);
  }
  if (fatorInjuria === null) return semGet(MENSAGENS.injuriaDesconhecida);

  // --- limites do protocolo ---
  const lim = protocolo.limites;
  if (lim.sexo && sexo && sexo !== lim.sexo) avisos.push(MENSAGENS.somenteFeminino);
  const foraDaFaixa = (lim.idadeMinAnos !== null && I < lim.idadeMinAnos)
    || (lim.idadeMaxAnos !== null && I > lim.idadeMaxAnos);
  if (foraDaFaixa && lim.foraDaFaixa === 'sem_calculo') return semGet(AVISO_FORA_DA_FAIXA[f]);
  if (foraDaFaixa && lim.foraDaFaixa === 'calcula_com_aviso') avisos.push(AVISO_FORA_DA_FAIXA[f]);

  const categoria = (c) => (Number.isInteger(c) && c >= 1 && c <= 4 ? c : null);

  // =========================== GET direto (EER), TMB "Não aplicável" ===========================
  if (f === 5) {
    // §4.4.1 — EER/IOM 2005 adulto: [equação] × injúria + VENTA + MET + gestante.
    if (fator === null) return semFator();
    r.fatorAtividade = fator;
    return registrarGet(eer2005Adulto(sexo, fator, I, P, Am) * fatorInjuria + vVenta + vMet + vGest, TODOS_ADICIONAIS);
  }

  if (f === 26) {
    // §4.4.3 — EER 2023 adultos: equação × injúria + VENTA + MET + gestante.
    const cat = categoria(fator);
    if (!cat) return semFator();
    r.fatorAtividade = cat;
    return registrarGet(eer2023Adulto(sexo, cat, I, A, P) * fatorInjuria + vVenta + vMet + vGest, TODOS_ADICIONAIS);
  }

  if (f === 27) {
    // §4.4.4 — EER 2023 infantil. O relatório não diz como injúria e adicionais entram nesta fórmula;
    // aqui seguem a EER 2023 adultos (equação × injúria + VENTA + MET + gestante).
    let eq;
    if (I < 3) {
      eq = eer2023Ate3Anos(sexo, I, Im, A, P);
      r.fatorAtividade = categoria(fator); // não altera o resultado nesta faixa
    } else {
      const cat = categoria(fator);
      if (!cat) return semFator();
      r.fatorAtividade = cat;
      const extra = I >= 14 ? 20 : custoEnergetico2023(sexo, I);
      eq = eer2023Infantil(sexo, cat, I, A, P) + extra;
    }
    return registrarGet(eq * fatorInjuria + vVenta + vMet + vGest, TODOS_ADICIONAIS);
  }

  if (f === 28) {
    // §4.4.5 — EER 2023 gestante.
    const S = check(entrada.semanas);
    const disposicao = disposicaoGestante(entrada.estadoNutricional);
    // Sem semanas (ou sem estado nutricional) o WebDiet pede os dados; o GET fica sem valor.
    if (!(S > 0) || disposicao === undefined) return erroTela(MENSAGENS.gestanteDados);
    // WebDiet (E50): até 13 semanas, mensagem na linha de erro e GET "Escolha o fator atividade".
    if (S <= 13) return erroTela(MENSAGENS.primeiroTrimestre);
    const cat = categoria(fator);
    if (!cat) return semFator();
    r.fatorAtividade = cat;
    if (gestante !== null) avisos.push(MENSAGENS.gestanteAdicional);
    const [c, a, p] = EER2023_GESTANTE[cat - 1];
    const eq = c - 2.04 * I + a * A + p * P + 9.16 * S;
    // WebDiet §12 #2: só a disposição é multiplicada pela injúria (precedência do código).
    return registrarGet(eq + disposicao * fatorInjuria + vVenta + vMet, ['venta', 'met']);
  }

  if (f === 29) {
    // §4.4.6 — EER 2023 lactante. Meses de amamentação contados na data de referência ("hoje"),
    // sem olhar o dia: (ano_atual − ano_parto) × 12 + (mês_atual − mês_parto).
    let meses;
    if (informado(entrada.mesesAmamentacao)) {
      meses = Math.trunc(check(entrada.mesesAmamentacao));
    } else {
      const parto = partesData(entrada.dataParto);
      const hoje = partesData(informado(entrada.dataReferencia) ? entrada.dataReferencia : entrada.dataExame);
      if (!parto || !hoje) return erroTela(MENSAGENS.partoAusente);
      meses = (hoje.a - parto.a) * 12 + (hoje.m - parto.m);
    }
    r.mesesAmamentacao = meses;
    if (meses < 0) return erroTela(MENSAGENS.partoFuturo);
    if (meses > lim.mesesAmamentacaoMax) return erroTela(MENSAGENS.lactacaoMaior12);
    const cat = categoria(fator);
    if (!cat) return semFator();
    r.fatorAtividade = cat;
    // ≥ 19 anos: EER 2023 adulta feminina; abaixo: equação feminina de 3–18 anos, sem custo
    // energético nem o +20 (conferido em E55).
    const eq = I >= 19 ? eer2023Adulto('F', cat, I, A, P) : eer2023Infantil('F', cat, I, A, P);
    // WebDiet §12 #3: só o 140 (0–6 meses) ou o 380 (7–12 meses) é multiplicado pela injúria.
    const lactacao = meses <= 6 ? eq + 540 - 140 * fatorInjuria : eq + 380 * fatorInjuria;
    return registrarGet(lactacao + vVenta + vMet + vGest, TODOS_ADICIONAIS);
  }

  if (f === 21) {
    // §4.2 e §4.4.2 — EER/IOM 2005 infantil. Só a VENTA entra no GET (MET e gestante não).
    if (met || gestante !== null) avisos.push(MENSAGENS.eerInfantilSoVenta);
    // TMB só até 36 meses, inclusive (E108 mostra a TMB com 36 meses); acima, "Não aplicável".
    if (Im <= 36) registrarTmb(tmbEerInfantil(Im, P));
    else naoAplicavel();
    if (fator === null) return semFator();
    r.fatorAtividade = fator;
    if (Im < 36) {
      // GET = TMB exibida × fator ("Não se aplica" = 1) × injúria + VENTA.
      return registrarGet(r.tmbArredondada * fator * fatorInjuria + vVenta, ['venta']);
    }
    if (Im === 36) {
      // Corrigido (§12 #1): no WebDiet nenhum ramo do GET se aplica com exatamente 36 meses e a tela
      // dá exceção. Aqui vale o ramo de 3 anos ou mais (I = 3); o fator é o da lista de até 36 meses (1).
      r.corrigido = true;
      avisos.push(MENSAGENS.eerInfantil36Meses);
    }
    return registrarGet(eer2005InfantilMaior36(sexo, fator * fatorInjuria, I, Im, P, Am) + vVenta, ['venta']);
  }

  // ====================== GET manual (10) e fórmula de bolso (11): sem TMB ======================
  if (f === 10 || f === 11) {
    let base;
    if (f === 10) {
      const gm = entrada.getManual || {};
      if (!informado(gm.kcal) && !informado(gm.kcalKg)) return semGet(MENSAGENS.getManualAusente);
      base = converterGetManual({ peso: P, ...gm }).kcal; // valor do campo kcal
    } else {
      const bolso = calcularBolso({ peso: P, ...(entrada.bolso || {}) });
      if (!(bolso.kcal > 0)) return semGet(MENSAGENS.bolsoAusente);
      base = bolso.kcalArredondado; // valor exibido (toFixed(0)), como no GET manual
    }
    if (fator === null) return semFator();
    r.fatorAtividade = fator;
    return registrarGet(base * fator * fatorInjuria + vMet + vVenta + vGest, TODOS_ADICIONAIS);
  }

  // ============================== Fórmulas com TMB (GET padrão) ===============================
  let tmb;
  switch (f) {
    case 1:
      tmb = H ? 66.4730 + 13.7516 * P + 5.0033 * A - 6.7550 * I : 655.0955 + 9.5634 * P + 1.8494 * A - 4.6756 * I;
      break;
    case 2:
      tmb = H ? 88.362 + 13.397 * P + 4.799 * A - 5.677 * I : 447.593 + 9.247 * P + 3.098 * A - 4.330 * I;
      break;
    case 3:
      if (MLG === 0) {
        // §4.2: com MLG 0 a TMB dá lugar ao texto "Massa livre de gordura em branco".
        r.tela.tmb = MENSAGENS.mlgEmBranco;
        return semGet(MENSAGENS.mlgEmBranco);
      }
      tmb = 370 + 21.6 * MLG;
      break;
    case 4:
      tmb = 500 + 22 * MLG;
      break;
    case 6:
      // No código do WebDiet: "+166−161" para homens (= +5) e "−161" para mulheres.
      tmb = H ? 9.99 * P + 6.25 * A - 4.92 * I + 166 - 161 : 9.99 * P + 6.25 * A - 4.92 * I - 161;
      break;
    case 7:
      tmb = 19.7 * MLG + 413;
      break;
    case 8:
    case 22:
      tmb = tmbFao(sexo, I, P);
      break;
    case 9:
      tmb = tmbHenry(sexo, I, P); // < 3 anos já saiu acima (limites; §12 #6)
      break;
    case 12:
      tmb = 24.8 * P + 10;
      break;
    case 13:
      tmb = 25.9 * MLG + 284;
      break;
    case 14:
    case 24:
      if (!informado(entrada.tmbInformada)) return semGet(MENSAGENS.tmbAusente);
      tmb = check(entrada.tmbInformada);
      break;
    case 23:
      tmb = tmbSchofield(sexo, I, P, A); // > 18 anos já saiu acima (limites)
      break;
    case 25:
      tmb = tmbGestanteMS(I, P); // ≤ 10 anos já saiu acima (limites)
      break;
    default:
      return semGet(MENSAGENS.formulaDesconhecida);
  }

  registrarTmb(tmb);
  if (fator === null) return semFator();
  r.fatorAtividade = fator;
  // O GET usa a TMB já arredondada para inteiro (lida do texto da tela), §4.3.
  const T = r.tmbArredondada;
  if (f === 24) {
    // HandyMET (§4.3): TMB × fator × injúria + 0,1 × TMB + adicionais.
    return registrarGet(T * fator * fatorInjuria + 0.1 * T + vMet + vVenta + vGest, TODOS_ADICIONAIS);
  }
  // GET padrão (§4.3); também Min. Saúde gestante (25) e FAO infantil (22).
  return registrarGet(T * fator * fatorInjuria + vMet + vVenta + vGest, TODOS_ADICIONAIS);
}
