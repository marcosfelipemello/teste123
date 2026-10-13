// Planejamento alimentar — método por alimentos ("Convencional", metodoPlanning.php): relatório §8.3 e §8.4.
// Conferido contra docs/webdiet-evidencias/tela_planejamento_alimentos.json (223/223 iguais na tela do WebDiet).
//
// Alimentos: objetos como os da evidência, com valores por 100 g (ou 100 mL):
//   {id, nome, unidade: 'g'|'ml', mc: [{nome_mc, peso}], kcal, ptn, lip, cho, fibras, micros: [27]}
// A base de alimentos do WebDiet não foi copiada (§1.2): quem chama fornece os alimentos.
//
// Arredondamentos (relatório §3): sempre `toFixed` do JS (fx/fxn de numeros.js). O peso da linha é guardado
// já arredondado (1 casa) e é ele que entra nos totais. Os totais somam os nutrientes SEM arredondar; no
// total do dia, os valores arredondados (`totalMacros`) alimentam densidade, análise calórica, g/kg e
// kcal não proteica/g N.
//
// Divergências tratadas aqui: §12 itens 20, 30, 31 e 32 (ver DIVERGENCIAS).

import { check, fx, fxn } from './numeros.js';

/** Fator de conversão proteína → nitrogênio (g N = g PTN / 6,25). */
export const FATOR_NITROGENIO = 6.25;

/**
 * Cores da adequação, como o navegador devolve na evidência: vermelho #EE091D, verde #83C688, neutro (preto).
 * No método por equivalentes o neutro é cinza #8E8E92 (`neutroEquivalentes`, visto na conta em 13/10/2026).
 */
export const CORES = Object.freeze({
  vermelho: 'rgb(238, 9, 29)',
  verde: 'rgb(131, 198, 136)',
  neutro: 'rgb(0, 0, 0)',
  neutroEquivalentes: 'rgb(142, 142, 146)',
});

/**
 * Faixas de densidade energética da refeição (kcal/g), relatório §8.3. Só o texto da faixa "baixa" foi
 * visto na tela; os outros seguem o mesmo molde com os limites do relatório.
 */
export const FAIXAS_DENSIDADE = Object.freeze([
  { ate: 0.6, classe: 'muito baixa', faixa: '0 até 0.6' },
  { ate: 1.5, classe: 'baixa', faixa: '0.6 até 1.5' },
  { ate: 3.9, classe: 'média', faixa: '1.5 até 3.9' },
  { ate: Infinity, classe: 'alta', faixa: '3.9 até 9.0' },
]);

/** Número de micronutrientes do vetor `micros` (ordem em dris.js → NUTRIENTES). */
export const N_MICROS = 27;

/**
 * Divergências do WebDiet (relatório §12) tratadas neste módulo.
 * @type {ReadonlyArray<{item:number, descricao:string, comportamento:string}>}
 */
export const DIVERGENCIAS = Object.freeze([
  {
    item: 20,
    descricao:
      'kcal não proteica por g de N PLANEJADA usa (gPTN×9 + gLIP×4) / (gPTN/6,25) no lugar de (gLIP×9 + gCHO×4) / (gPTN/6,25). ' +
      'A prescrita usa a fórmula certa.',
    comportamento:
      'Padrão igual ao WebDiet (paridade com a evidência: 72.9 e 71.9 Kcal); com a opção { corrigir: true } usa ' +
      '(gLIP×9 + gCHO×4) / (gPTN/6,25). A adequação acompanha o valor escolhido.',
  },
  {
    item: 30,
    descricao:
      'Método por alimentos: a adequação da kcal não proteica/g N lê o texto de #gNPrescrita ANTES de recalcular, ' +
      'então usa o valor do cálculo anterior; ao abrir o plano, o texto inicial "0 Kcal" (paciente de teste: ' +
      '"-72 Kcal" ao abrir, "26 Kcal" depois de recalcular).',
    comportamento:
      'Corrigido a pedido do usuário (13/10/2026): a aba Planejamento usa o valor atual. Para reproduzir o WebDiet, ' +
      'calcularPlanejamento aceita { gNAnterior } (o valor que a tela mostrava: 0 ao abrir o plano, depois o do ' +
      'cálculo anterior); { corrigir: true } ignora gNAnterior.',
  },
  {
    item: 31,
    descricao:
      'Metas em g/kg: o modal refaz o GET só ao digitar PTN, LIP ou CHO; mudar o peso não refaz o GET, que fica ' +
      'com o valor antigo na kcal planejada e na adequação de kcal.',
    comportamento:
      'Corrigido a pedido do usuário (13/10/2026): na aba Planejamento, mudar o peso também refaz o GET. ' +
      'calcularMetas continua usando o GET guardado (o que o formulário de metas guarda).',
  },
  {
    item: 32,
    descricao: 'Análise calórica com 0 kcal no plano: %CHO = 100 − 0 − 0, e a tela mostra "0.0 Kcal - 100.0%".',
    comportamento: 'Igual ao WebDiet.',
  },
]);

// ---------------------------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------------------------

/** Divisão que segue a leitura do WebDiet (`check`): resultado NaN ou infinito vira 0. */
const div = (a, b) => check(a / b);

/** true se a refeição entra no cálculo (`ativo` true/"true"; ausente = ativa). */
export function refeicaoAtiva(refeicao) {
  const a = refeicao?.ativo;
  if (a === undefined || a === null) return true;
  return a === true || String(a).trim().toLowerCase() === 'true';
}

/**
 * Medida caseira escolhida para um alimento.
 * - objeto {nome_mc, peso} (ou {nome, peso}): medida informada ("personalizada");
 * - texto: procurada pelo nome em `alimento.mc`; "grama(s)" e "mililitro(s)" valem 1 mesmo fora da lista (§8.2).
 * @param {{nome?:string, mc?:{nome_mc:string, peso:number|string}[]}} alimento
 * @param {string|{nome_mc?:string, nome?:string, peso:number|string}} medida
 * @returns {{nome:string, peso:number, pesoTexto:string}} `pesoTexto` = peso como estava no cadastro
 * @throws {Error} se a medida não existe no alimento
 */
export function medidaDoAlimento(alimento, medida) {
  if (medida && typeof medida === 'object') {
    return { nome: String(medida.nome_mc ?? medida.nome ?? ''), peso: check(medida.peso), pesoTexto: String(medida.peso) };
  }
  const nome = String(medida ?? '');
  const achada = (alimento?.mc ?? []).find((m) => m.nome_mc === nome);
  if (achada) return { nome, peso: check(achada.peso), pesoTexto: String(achada.peso) };
  if (/^(grama|mililitro)\(s\)$/i.test(nome)) return { nome, peso: 1, pesoTexto: '1' };
  throw new Error(`Medida "${nome}" não encontrada em "${alimento?.nome ?? '?'}"`);
}

/**
 * Nutrientes de um peso de alimento: valor/100 × peso, sem arredondar.
 * @param {object} alimento valores por 100 g/mL
 * @param {number} peso
 * @returns {{kcal:number, ptn:number, lip:number, cho:number, fibras:number, micros:number[]}}
 */
export function nutrientesPorPeso(alimento, peso) {
  const v = (x) => (check(x) / 100) * peso;
  const micros = [];
  for (let i = 0; i < N_MICROS; i++) micros.push(v(alimento?.micros?.[i]));
  return { kcal: v(alimento?.kcal), ptn: v(alimento?.ptn), lip: v(alimento?.lip), cho: v(alimento?.cho), fibras: v(alimento?.fibras), micros };
}

/**
 * Classe de densidade energética. Compara o valor já arredondado em 2 casas (o exibido).
 * @param {number} densidade kcal/g
 * @returns {{classe:string, faixa:string, texto:string}}
 */
export function classificarDensidade(densidade) {
  const d = fxn(check(densidade), 2);
  const f = FAIXAS_DENSIDADE.find((x) => d <= x.ate);
  return { classe: f.classe, faixa: f.faixa, texto: `Refeição com densidade ${f.classe}(${f.faixa} Kcal/g)` };
}

/** Acumulador de somas (peso, macros, fibras e os 27 micronutrientes). */
function somaVazia() {
  return { peso: 0, kcal: 0, ptn: 0, lip: 0, cho: 0, fibras: 0, micros: new Array(N_MICROS).fill(0) };
}

/** Soma uma linha no acumulador (na ordem das linhas, como a tela). */
function somar(s, l) {
  s.peso += l.peso;
  s.kcal += l.kcal;
  s.ptn += l.ptn;
  s.lip += l.lip;
  s.cho += l.cho;
  s.fibras += l.fibras;
  for (let i = 0; i < N_MICROS; i++) s.micros[i] += l.micros[i];
  return s;
}

// ---------------------------------------------------------------------------------------------
// Linha, refeição e dia
// ---------------------------------------------------------------------------------------------

/**
 * Uma linha do cardápio: peso = quantidade × peso da medida, guardado com 1 casa; nutrientes = valor/100 × peso.
 *
 * Na tela, o CHO de todas as linhas sai "x.x g" (com espaço), menos o da ÚLTIMA linha de cada refeição,
 * que sai "x.xg" — é o que a evidência mostra nas 3 refeições (o relatório não comenta). `ultima` reproduz isso.
 *
 * @param {{alimento:object, quantidade:number|string, medida:string|object}} item
 * @param {{ultima?: boolean}} [opcoes]
 * @returns {{id:string, nome:string, unidade:string, quantidade:number, medida:string, pesoMedida:number,
 *   peso:number, kcal:number, ptn:number, lip:number, cho:number, fibras:number, micros:number[],
 *   tela:{id:string, qtd:string, medida:string, medidaPeso:string, peso:string, ptn:string, lip:string, cho:string, kcal:string}}}
 */
export function calcularLinha(item, { ultima = false } = {}) {
  const al = item.alimento ?? {};
  const med = medidaDoAlimento(al, item.medida);
  const quantidade = check(item.quantidade);
  const peso = fxn(quantidade * med.peso, 1);
  const unidade = al.unidade ?? 'g';
  const n = nutrientesPorPeso(al, peso);
  return {
    id: String(al.id ?? ''),
    nome: al.nome ?? '',
    unidade,
    quantidade,
    medida: med.nome,
    pesoMedida: med.peso,
    peso,
    ...n,
    tela: {
      id: String(al.id ?? ''),
      qtd: String(item.quantidade),
      medida: med.nome,
      medidaPeso: med.pesoTexto,
      peso: `${peso}${unidade}`,
      ptn: `${fx(n.ptn, 1)}g`,
      lip: `${fx(n.lip, 1)}g`,
      cho: `${fx(n.cho, 1)}${ultima ? 'g' : ' g'}`,
      kcal: `${fx(n.kcal, 0)} Kcal`,
    },
  };
}

/**
 * Uma refeição: linhas + total. O total soma os valores sem arredondar; densidade e % usam esses valores.
 * %CHO = 100 − %PTN − %LIP (os dois já arredondados). Refeição sem kcal: os três % valem 0.
 *
 * @param {{nome?:string, ativo?:boolean|string, itens?:object[]}} refeicao
 * @returns {{nome:string, ativo:boolean, linhas:object[], total:{peso:number, kcal:number, ptn:number,
 *   lip:number, cho:number, fibras:number, micros:number[], densidade:number, classe:string,
 *   percentuais:{ptn:number, lip:number, cho:number}},
 *   tela:{peso:string, ptn:string, lip:string, cho:string, kcal:string, dens:string, classe:string,
 *   gptn:string, glip:string, gcho:string}}}
 */
export function calcularRefeicao(refeicao) {
  const itens = refeicao?.itens ?? [];
  const linhas = itens.map((it, i) => calcularLinha(it, { ultima: i === itens.length - 1 }));
  const s = linhas.reduce(somar, somaVazia());
  const densidade = fxn(div(s.kcal, s.peso), 2);
  const classe = classificarDensidade(densidade);
  const pPtn = fxn(div(s.ptn * 4, s.kcal) * 100, 1);
  const pLip = fxn(div(s.lip * 9, s.kcal) * 100, 1);
  const pCho = s.kcal ? fxn(100 - pPtn - pLip, 1) : 0;
  return {
    nome: refeicao?.nome ?? '',
    ativo: refeicaoAtiva(refeicao),
    linhas,
    total: { ...s, densidade, classe: classe.classe, percentuais: { ptn: pPtn, lip: pLip, cho: pCho } },
    tela: {
      peso: `${fx(s.peso, 0)}g`,
      ptn: `${fx(s.ptn, 1)}g`,
      lip: `${fx(s.lip, 1)}g`,
      cho: `${fx(s.cho, 1)}g`,
      kcal: `${fx(s.kcal, 0)} Kcal`,
      dens: fx(densidade, 2),
      classe: classe.texto,
      gptn: `Proteínas - ${fx(s.ptn, 1)}g (${fx(pPtn, 1)}%)`,
      glip: `Lipídios - ${fx(s.lip, 1)}g (${fx(pLip, 1)}%)`,
      gcho: `Carbo - ${fx(s.cho, 1)}g (${fx(pCho, 1)}%)`,
    },
  };
}

/**
 * Análise do total do dia (o que a tela chama de "prescrito"), como `graficoMacros()` do WebDiet (código lido
 * na conta em 13/10/2026, igual nas duas páginas de plano, salvo o que `equivalentes` muda):
 * - gramas: `parseFloat(x.toFixed(1)) + "g"` ("58g", não "58.0g"); kcal: `parseFloat(K.toFixed(0))`;
 * - g/kg só quando o peso das metas é > 0; CHO disponível = (CHO − fibras).toFixed(1), g/kg sobre o valor sem
 *   arredondar;
 * - kcal da PTN e da LIP com 1 casa e em forma de número ("202 Kcal"); os % saem delas; %CHO = 100 − %PTN − %LIP
 *   (sem kcal no plano, 100%); kcal do CHO = (K − kcal PTN − kcal LIP).toFixed(1);
 * - kcal não proteica/g N = (LIP×9 e CHO×4, cada um com 1 casa) / (PTN/6,25), 1 casa, em forma de número;
 * - densidade (só no método por alimentos) = K / peso, 2 casas.
 * @param {number[]} totalMacros [PTN, LIP, CHO, kcal, fibras, peso]: no método por alimentos, arredondados;
 *   nos equivalentes, sem arredondar e sem o peso
 * @param {number|string} pesoReferencia peso das metas (kg) para os g/kg
 * @param {{equivalentes?: boolean}} [opcoes] `equivalentes`: fibras também com g/kg e sem densidade
 *   (metodoWebdiet.php)
 */
export function analisarTotal(totalMacros, pesoReferencia, { equivalentes = false } = {}) {
  const [P, L, C, K, F] = [0, 1, 2, 3, 4].map((i) => check(totalMacros?.[i]));
  const W = check(totalMacros?.[5]);
  const peso = check(pesoReferencia);
  const kcalPtn = fxn(P * 4, 1);
  const kcalLip = fxn(L * 9, 1);
  const kcalChoBruto = fxn(C * 4, 1);
  const gN = fxn(div(kcalLip + kcalChoBruto, P / FATOR_NITROGENIO), 1);
  const choDisponivel = C - F;
  const densidade = div(K, W);
  const pctPtn = div(kcalPtn, K) * 100;
  const pctLip = div(kcalLip, K) * 100;
  const pctCho = 100 - pctPtn - pctLip;
  const kcalCho = K - kcalPtn - kcalLip;
  const analise = {
    kcalPtn, kcalLip, kcalCho: fxn(kcalCho, 1),
    pctPtn: fxn(pctPtn, 1), pctLip: fxn(pctLip, 1), pctCho: fxn(pctCho, 1),
  };
  const gkg = (x, unidade = 'g/Kg') => (peso > 0 ? ` (${fx(x / peso, 1)}${unidade})` : '');
  const g = (x) => `${fxn(x, 1)}g`;
  const kcal = `${fxn(K, 0)} Kcal`;
  return {
    ptn: P, lip: L, cho: C, kcal: K, fibras: F, peso: W, choDisponivel: fxn(choDisponivel, 1), gN,
    densidade: fxn(densidade, 2), analise,
    tela: {
      ptnPrescrita: g(P) + gkg(P),
      lipPrescrita: g(L) + gkg(L),
      choPrescrita: g(C) + gkg(C),
      choDisponivelPrescrita: `${fx(choDisponivel, 1)}g${gkg(choDisponivel)}`,
      fibrasPrescrita: g(F) + (equivalentes ? gkg(F) : ''),
      kcalPrescrita: kcal + gkg(K, ' Kcal/Kg'),
      gNPrescrita: `${gN} Kcal`,
      ...(equivalentes ? {} : { densidadePrescrita: `${fx(densidade, 2)} Kcal/g` }),
      ptnTotalanalise: `${kcalPtn} Kcal - ${fx(pctPtn, 1)}%`,
      lipTotalanalise: `${kcalLip} Kcal - ${fx(pctLip, 1)}%`,
      choTotalanalise: `${fx(kcalCho, 1)} Kcal - ${fx(pctCho, 1)}%`,
      kcalTotalanalise: kcal,
      ptnResumo: g(P) + gkg(P),
      lipResumo: g(L) + gkg(L),
      choResumo: g(C) + gkg(C),
      kcalResumo: kcal + gkg(K, ' Kcal/Kg'),
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Metas (referências) e adequação
// ---------------------------------------------------------------------------------------------

/**
 * Metas do planejamento (§8.3 "Metas"), como `mostrarReferencias()` do WebDiet, que lê o que o modal guardou
 * (`referencias = [ptn, lip, cho, get, peso, tipo]`):
 * - tipo "percentual": `get` (kcal) e `ptn`/`lip`/`cho` em % do GET. O modal preenche o CHO com
 *   100 − PTN − LIP a cada tecla; aqui, CHO não informado também vale 100 − PTN − LIP. Gramas: GET×%/100/4
 *   (PTN, CHO) ou /9 (LIP).
 * - qualquer outro tipo ("gkg"; o WebDiet chama de "bolso", e plano sem metas salvas também cai aqui):
 *   `peso` e `ptn`/`lip`/`cho` em g/kg; gramas = valor × peso. O GET é o guardado pelo modal; não informado,
 *   PTN×P×4 + LIP×P×9 + CHO×P×4 (a mesma conta do modal).
 * Gramas com 1 casa (o valor arredondado segue para a kcal não proteica/g N e a adequação); g/kg só com peso
 * > 0; kcal não proteica/g N em forma de número ("72.9 Kcal", "57 Kcal").
 *
 * @param {{tipo?:'percentual'|'gkg'|'bolso', get?:number|string, peso?:number|string, ptn?:number|string,
 *          lip?:number|string, cho?:number|string}} metas
 * @param {{corrigir?: boolean}} [opcoes] `corrigir: true` corrige a kcal não proteica/g N planejada (§12 #20)
 */
export function calcularMetas(metas, opcoes = {}) {
  const tipo = metas?.tipo === 'percentual' ? 'percentual' : 'gkg';
  const peso = check(metas?.peso);
  const informado = (v) => v !== undefined && v !== null && String(v).trim() !== '';
  let get, ptn, lip, cho, percentuais = null;
  if (tipo === 'percentual') {
    get = check(metas?.get);
    const pP = check(metas?.ptn), pL = check(metas?.lip);
    const pC = informado(metas?.cho) ? check(metas.cho) : 100 - pP - pL;
    percentuais = { ptn: pP, lip: pL, cho: pC };
    ptn = fxn((get * pP) / 100 / 4, 1);
    lip = fxn((get * pL) / 100 / 9, 1);
    cho = fxn((get * pC) / 100 / 4, 1);
  } else {
    const kP = check(metas?.ptn), kL = check(metas?.lip), kC = check(metas?.cho);
    get = informado(metas?.get) ? check(metas.get) : kP * peso * 4 + kL * peso * 9 + kC * peso * 4;
    ptn = fxn(kP * peso, 1);
    lip = fxn(kL * peso, 1);
    cho = fxn(kC * peso, 1);
  }
  const base = opcoes.corrigir ? lip * 9 + cho * 4 : ptn * 9 + lip * 4; // WebDiet §12 #20
  const gN = fxn(div(base, ptn / FATOR_NITROGENIO), 1);
  const gkg = (x, unidade = 'g/Kg') => (peso > 0 ? ` (${fx(x / peso, 1)}${unidade})` : '');
  return {
    tipo, peso, get, ptn, lip, cho, percentuais, gN,
    tela: {
      ptnPlanejada: `${fx(ptn, 1)}g${gkg(ptn)}`,
      lipPlanejada: `${fx(lip, 1)}g${gkg(lip)}`,
      choPlanejada: `${fx(cho, 1)}g${gkg(cho)}`,
      kcalPlanejada: `${fx(get, 0)} Kcal${gkg(get, ' Kcal/Kg')}`,
      gNPlanejada: `${gN} Kcal`,
    },
  };
}

/**
 * Adequação de um item: diferença = prescrito − planejado; % = prescrito/planejado×100 (0 casas).
 * Cor pelo % arredondado: > 105 vermelho; 95–105 verde; senão neutro (planejado 0 = neutro, % null).
 * @param {number} prescrito
 * @param {number} planejado
 * @param {{neutro?: string}} [opcoes] cor neutra (a do método por equivalentes é outra: CORES_EQUIVALENTES)
 * @returns {{diferenca:number, percentual:number|null, cor:string}}
 */
export function adequar(prescrito, planejado, { neutro = CORES.neutro } = {}) {
  const percentual = planejado ? fxn(div(prescrito, planejado) * 100, 0) : null;
  let cor = neutro;
  if (percentual !== null && percentual > 105) cor = CORES.vermelho;
  else if (percentual !== null && percentual >= 95) cor = CORES.verde;
  return { diferenca: prescrito - planejado, percentual, cor };
}

/**
 * Adequação do dia (PTN, LIP, CHO, kcal e kcal não proteica/g N). Usa os totais que recebe: no método por
 * alimentos, os arredondados; nos equivalentes, os sem arredondar (como o WebDiet).
 * @param {{ptn:number, lip:number, cho:number, kcal:number, gN:number}} total p.ex. `analisarTotal(...)`
 * @param {ReturnType<typeof calcularMetas>} metas
 * @param {{gNPrescrito?: number, neutro?: string}} [opcoes] `gNPrescrito`: kcal não proteica/g N prescrita
 *   usada na adequação (padrão: a do total; ver §12 #30); `neutro`: cor neutra
 */
export function calcularAdequacao(total, metas, { gNPrescrito = total.gN, neutro = CORES.neutro } = {}) {
  const o = { neutro };
  const r = {
    ptn: adequar(total.ptn, metas.ptn, o),
    lip: adequar(total.lip, metas.lip, o),
    cho: adequar(total.cho, metas.cho, o),
    kcal: adequar(total.kcal, metas.get, o),
    gN: adequar(check(gNPrescrito), metas.gN, o),
  };
  return {
    ...r,
    tela: {
      ptnAdequacao: `${fx(r.ptn.diferenca, 1)}g`,
      lipAdequacao: `${fx(r.lip.diferenca, 1)}g`,
      choAdequacao: `${fx(r.cho.diferenca, 1)}g`,
      kcalAdequacao: `${fx(r.kcal.diferenca, 0)} Kcal`,
      gNAdequacao: `${fx(r.gN.diferenca, 0)} Kcal`,
    },
    cores: {
      ptnAdequacao: r.ptn.cor,
      lipAdequacao: r.lip.cor,
      choAdequacao: r.cho.cor,
      kcalAdequacao: r.kcal.cor,
      gNAdequacao: r.gN.cor,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Micronutrientes
// ---------------------------------------------------------------------------------------------

/**
 * Tabela dos 27 micronutrientes: valor com 1 casa; % = valor arredondado / referência × 100 (1 casa), só
 * quando a referência é um número > 0 (sem referência, "N/D" ou "0" → % vazio). A barra vai até 200%.
 * @param {number[]} valores somas sem arredondar (ordem de dris.js → NUTRIENTES)
 * @param {{valores:(number|string|null)[], tela:Record<string,string>}|null} referencias resultado de
 *        `referenciasMicros` (dris.js); null = sem referências
 * @returns {{valor:number, percentual:number|null, referencia:number|string|null, barra:number|null,
 *            tela:[string,string,string]}[]}
 */
export function tabelaMicros(valores, referencias = null) {
  const lista = [];
  for (let i = 0; i < N_MICROS; i++) {
    const valor = fxn(check(valores?.[i]), 1);
    const referencia = referencias?.valores?.[i] ?? null;
    const percentual = typeof referencia === 'number' && referencia > 0 ? fxn((valor / referencia) * 100, 1) : null;
    lista.push({
      valor,
      percentual,
      referencia,
      barra: percentual === null ? null : Math.min(percentual, 200),
      tela: [fx(valor, 1), percentual === null ? '' : `${fx(percentual, 1)}%`, referencias?.tela?.[`micro${i + 1}`] ?? ''],
    });
  }
  return lista;
}

// ---------------------------------------------------------------------------------------------
// Planejamento completo
// ---------------------------------------------------------------------------------------------

/**
 * Calcula o planejamento por alimentos: refeições, total do dia (só refeições ativas), análise calórica,
 * metas, adequação e micronutrientes.
 *
 * @param {{refeicoes:{nome?:string, ativo?:boolean|string,
 *            itens:{alimento:object, quantidade:number|string, medida:string|object}[]}[],
 *          metas?:Parameters<typeof calcularMetas>[0]|null,
 *          referencias?:{valores:(number|string|null)[], tela:Record<string,string>}|null}} entrada
 *   `metas.peso` também é o peso de referência dos g/kg do total. `referencias` = `referenciasMicros(...)`.
 * @param {{corrigir?: boolean, gNAnterior?: number}} [opcoes]
 *   `gNAnterior`: kcal não proteica/g N prescrita do cálculo anterior (o que a tela mostrava; 0 ao abrir o
 *   plano). O WebDiet usa esse valor na adequação da kcal não proteica/g N (§12 #30); sem ele, usa o atual.
 *   `corrigir: true` → kcal não proteica/g N planejada corrigida (§12 #20) e adequação com o valor atual (#30).
 * @returns {{refeicoes:ReturnType<typeof calcularRefeicao>[], soma:object, totalMacros:number[],
 *   total:ReturnType<typeof analisarTotal>, metas:object|null, adequacao:object|null, micros:object[],
 *   tela:Record<string, unknown>}}
 *   `tela` usa os nomes de campo da evidência (ptnPrescrita, kcalPrescrita, gNPlanejada, cores, micros,
 *   ativos, totalMacros…); sem `metas`, os campos de metas/adequação/cores ficam de fora.
 */
export function calcularPlanejamento({ refeicoes = [], metas = null, referencias = null } = {}, opcoes = {}) {
  const calculadas = refeicoes.map(calcularRefeicao);
  const soma = somaVazia();
  for (const r of calculadas) if (r.ativo) for (const l of r.linhas) somar(soma, l);
  const totalMacros = [fxn(soma.ptn, 1), fxn(soma.lip, 1), fxn(soma.cho, 1), fxn(soma.kcal, 0), fxn(soma.fibras, 1), fxn(soma.peso, 1)];
  const total = analisarTotal(totalMacros, metas?.peso);
  const planejado = metas ? calcularMetas(metas, opcoes) : null;
  const gNPrescrito = opcoes.corrigir || opcoes.gNAnterior === undefined ? total.gN : check(opcoes.gNAnterior);
  const adequacao = planejado ? calcularAdequacao(total, planejado, { gNPrescrito }) : null;
  const micros = tabelaMicros(soma.micros, referencias);
  const tela = {
    ...total.tela,
    ...(planejado ? planejado.tela : {}),
    ...(adequacao ? adequacao.tela : {}),
    ...(adequacao ? { cores: adequacao.cores } : {}),
    micros: micros.map((m) => m.tela),
    ativos: calculadas.map((r) => String(r.ativo)),
    totalMacros,
  };
  return { refeicoes: calculadas, soma, totalMacros, total, metas: planejado, adequacao, micros, tela };
}

// ---------------------------------------------------------------------------------------------
// Substitutos
// ---------------------------------------------------------------------------------------------

/**
 * Ajusta os substitutos quando o peso do alimento principal muda: fator = novo/antigo; quantidade e peso de
 * cada substituto × fator, com 1 casa. (O WebDiet pergunta antes; a confirmação fica com a interface.)
 * Peso antigo ≤ 0: não há fator (null) e os substitutos voltam sem mudança.
 * @param {{quantidade:number|string, peso:number|string}[]} substitutos
 * @param {number|string} pesoAntigo
 * @param {number|string} pesoNovo
 * @returns {{fator:number|null, substitutos:object[]}}
 */
export function ajustarSubstitutos(substitutos, pesoAntigo, pesoNovo) {
  const antigo = check(pesoAntigo);
  if (!(antigo > 0)) return { fator: null, substitutos: (substitutos ?? []).map((s) => ({ ...s })) };
  const fator = check(pesoNovo) / antigo;
  return {
    fator,
    substitutos: (substitutos ?? []).map((s) => ({
      ...s,
      quantidade: fxn(check(s.quantidade) * fator, 1),
      peso: fxn(check(s.peso) * fator, 1),
    })),
  };
}
