// Alimento próprio ("Meus alimentos", cadastro por rótulo): relatório §8.7.
// Conferido contra docs/webdiet-evidencias/tela_alimento_rotulo.json (envio bloqueado; nada foi salvo).
//
// Entrada = valores DA PORÇÃO do rótulo; o cadastro grava valores por 100 g (ou 100 mL).
//
// Divergência tratada aqui: §12 item 27 (ver DIVERGENCIAS).

import { check, fx, fxn } from './numeros.js';

/**
 * Campos de micronutrientes enviados como "0" (ordem do envio da evidência, com `gorduratrans` depois de
 * `gordurasat` — §12 #27 corrigido).
 */
export const CAMPOS_MICROS_ENVIO = Object.freeze([
  'gorduramono', 'gordurapoli', 'gordurasat', 'gorduratrans', 'colesterol', 'ca', 'mg', 'p', 'fe', 'na', 'k', 'co',
  'zn', 'se', 're', 'rea', 'vitb9', 'vitb12', 'tiamina', 'riboflavina', 'piridoxina', 'niacina', 'vitc', 'vitd',
  'vite', 'alcool',
]);

/**
 * Divergências do WebDiet (relatório §12) tratadas neste módulo.
 * @type {ReadonlyArray<{item:number, descricao:string, comportamento:string}>}
 */
export const DIVERGENCIAS = Object.freeze([
  {
    item: 27,
    descricao:
      '`gorduratrans` não é enviado ao salvar (os outros micronutrientes vão como "0"). A kcal automática soma ' +
      'fibras×2 sobre o CHO digitado; se o rótulo já inclui a fibra no CHO, ela é contada duas vezes.',
    comportamento:
      'Corrigido: `gorduratrans` vai como "0" junto com os outros. Mantido: kcal = CHO×4 + PTN×4 + LIP×9 + ' +
      'fibras×2 (fórmula do WebDiet; a interface pode avisar que o CHO deve ser o disponível).',
  },
]);

/**
 * kcal automática (`autoCompletarNovoAlimento`): CHO×4 + PTN×4 + LIP×9 + fibras×2; campo vazio = 0.
 * @param {{cho?:number|string, ptn?:number|string, lip?:number|string, fibras?:number|string}} porcao
 * @returns {{kcal:number, tela:{kcalAuto:string}}} `kcal` sem arredondar; `tela.kcalAuto` com 0 casas (valor do campo)
 */
export function kcalAutomatica({ cho, ptn, lip, fibras } = {}) {
  const kcal = check(cho) * 4 + check(ptn) * 4 + check(lip) * 9 + check(fibras) * 2;
  return { kcal, tela: { kcalAuto: fx(kcal, 0) } };
}

/**
 * Cadastro (`cadastrarAlimento`): cada valor = valor da porção / peso × 100 (kcal 0 casas; PTN, LIP, CHO e
 * fibras 1 casa); peso da medida caseira = peso / quantidade de medidas, `parseFloat(toFixed(1))`;
 * micronutrientes "0". A kcal convertida é a do campo (a digitada ou a automática, já com 0 casas).
 *
 * @param {{nome:string, unidade?:'g'|'ml', medida:string, quantidadeMedidas:number|string,
 *          peso:number|string, kcal?:number|string, cho?:number|string, ptn?:number|string,
 *          lip?:number|string, fibras?:number|string}} entrada valores da porção do rótulo
 * @returns {{valido:boolean, faltando:string[], kcalPorcao:string|null,
 *   porCem:{kcal:number, ptn:number, lip:number, cho:number, fibras:number}|null,
 *   medida:{nome_mc:string, peso:number}|null, envio:Record<string,string>|null}}
 *   `envio` = campos enviados ao servidor, como na evidência (textos), mais `gorduratrans`.
 *   Faltando nome, peso > 0, medida ou quantidade de medidas > 0: valido false e o resto null.
 */
export function cadastrarAlimento(entrada = {}) {
  const faltando = [];
  if (!String(entrada.nome ?? '').trim()) faltando.push('nome');
  if (!(check(entrada.peso) > 0)) faltando.push('peso');
  if (!String(entrada.medida ?? '').trim()) faltando.push('medida');
  if (!(check(entrada.quantidadeMedidas) > 0)) faltando.push('quantidadeMedidas');
  if (faltando.length) return { valido: false, faltando, kcalPorcao: null, porCem: null, medida: null, envio: null };

  const kcalPorcao = String(entrada.kcal ?? '').trim() !== '' ? fx(check(entrada.kcal), 0) : kcalAutomatica(entrada).tela.kcalAuto;
  const peso = check(entrada.peso);
  const por100 = (v) => (check(v) / peso) * 100;
  const texto = {
    kcal: fx(por100(kcalPorcao), 0),
    ptn: fx(por100(entrada.ptn), 1),
    lip: fx(por100(entrada.lip), 1),
    cho: fx(por100(entrada.cho), 1),
    fibras: fx(por100(entrada.fibras), 1),
  };
  const medida = { nome_mc: String(entrada.medida), peso: fxn(peso / check(entrada.quantidadeMedidas), 1) };
  const envio = {
    tipo: 'alimento',
    nome: String(entrada.nome),
    unidade: entrada.unidade === 'ml' ? 'ml' : 'g',
    mc: JSON.stringify([medida]),
    peso: String(entrada.peso),
    proteinas: texto.ptn,
    lipidios: texto.lip,
    carboidratos: texto.cho,
    kcal: texto.kcal,
    fibras: texto.fibras,
  };
  for (const c of CAMPOS_MICROS_ENVIO) envio[c] = '0';
  return {
    valido: true,
    faltando,
    kcalPorcao,
    porCem: Object.fromEntries(Object.entries(texto).map(([k, v]) => [k, Number(v)])),
    medida,
    envio,
  };
}
