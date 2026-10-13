// Painel de resultados ao vivo das abas de medidas (antropometria, gestação).
// A região é aria-live: para que o leitor de tela anuncie só o que mudou, o painel reaproveita os
// mesmos nós e troca apenas os textos alterados; cada resultado tem aria-atomic, então o anúncio
// inclui o rótulo ("IMC 26.1 Kg/m2 Sobrepeso").
import { h } from '../dom.js';

// Estado visual de uma classificação (o texto continua visível; a cor só reforça).
const ESTADOS = {
  ok: ['Eutrófico', 'Peso adequado', 'Adequado', 'Adequada', 'Excelente', 'Estatura adequada', 'Ótimo', 'Saudável', 'Risco baixo'],
  alerta: ['Baixo peso', 'Baixo Peso', 'Sobrepeso', 'Elevada', 'Moderadamente alta', 'Excessivamente baixa', 'Risco moderado',
    'Desnutrição Leve', 'Baixa estatura', 'Magreza', 'Baixo', 'Elevado', 'Muito baixo', 'Abaixo do peso', 'Acima do peso'],
  perigo: ['Obesidade', 'Obesidade grau 1', 'Obesidade grau 2', 'Obesidade grau 3', 'Obesidade grave', 'Alta', 'Muito alta',
    'Excessivamente alta', 'Risco alto', 'Risco muito alto', 'Desnutrição Moderada', 'Desnutrição Grave', 'Muito baixo peso',
    'Muito baixa estatura', 'Magreza severa', 'Alto', 'Muito alto', 'Peso elevado', 'Verifique altura e peso'],
};

/** Classe CSS (ok / alerta / perigo) para o texto de uma classificação, ou '' se neutra. */
export function estadoClasse(texto) {
  const t = String(texto ?? '').trim();
  for (const [estado, lista] of Object.entries(ESTADOS)) if (lista.includes(t)) return estado;
  return '';
}

/**
 * Cria o painel. `atualizar({destaques, grupos, avisos})`:
 * - destaques: [{chave, rotulo, valor, detalhe?, estado?, estadoValor?, largo?}] em blocos grandes
 *   (largo = ocupa a linha toda, para textos longos);
 * - grupos: [{titulo, itens: [mesmo formato]}] em listas rótulo → valor;
 * - avisos: textos (todos são mostrados).
 * `estado` (cor do detalhe) omitido = estadoClasse(detalhe); `estadoValor` colore o próprio valor.
 */
export function criarPainel() {
  const corpo = h('div', { class: 'pilha' });
  const listaAvisos = h('ul', { class: 'lista-avisos oculto' });
  const el = h('div', { class: 'pilha', 'aria-live': 'polite' }, corpo, listaAvisos);
  let assinatura = null;
  let celulas = new Map();
  let textoAvisos = '';

  function celula(item, destaque) {
    const valor = h('span', { class: 'valor' });
    const detalhe = h('small', {});
    const no = destaque
      ? h('div', { class: item.largo ? 'resultado largo' : 'resultado', 'aria-atomic': 'true' }, h('span', { class: 'rotulo' }, item.rotulo), valor, detalhe)
      : h('div', { 'aria-atomic': 'true' }, h('dt', {}, item.rotulo), h('dd', {}, valor, detalhe));
    celulas.set(item.chave, { valor, detalhe });
    return no;
  }

  function preencher(item) {
    const c = celulas.get(item.chave);
    const valor = item.valor === null || item.valor === undefined || item.valor === '' ? '-' : String(item.valor);
    const detalhe = item.detalhe ? String(item.detalhe) : '';
    const estado = item.estado ?? estadoClasse(detalhe);
    if (c.valor.textContent !== valor) c.valor.textContent = valor;
    const classeValor = item.estadoValor ? `valor ${item.estadoValor}` : 'valor';
    if (c.valor.className !== classeValor) c.valor.className = classeValor;
    if (c.detalhe.textContent !== detalhe) c.detalhe.textContent = detalhe;
    const classe = [estado, detalhe ? '' : 'oculto'].filter(Boolean).join(' ');
    if (c.detalhe.className !== classe) c.detalhe.className = classe;
  }

  function atualizar({ destaques = [], grupos = [], avisos = [] } = {}) {
    const nova = [destaques.map((i) => `${i.chave}${i.largo ? '+' : ''}`).join(','), ...grupos.map((g) => `${g.titulo}:${g.itens.map((i) => i.chave).join(',')}`)].join('|');
    if (nova !== assinatura) {
      assinatura = nova;
      celulas = new Map();
      const blocos = grupos.map((g) => h('div', {},
        g.titulo ? h('h4', { class: 'titulo-grupo' }, g.titulo) : null,
        h('dl', { class: 'resumo' }, g.itens.map((i) => celula(i, false)))));
      if (destaques.length) blocos.unshift(h('div', { class: 'destaques' }, destaques.map((i) => celula(i, true))));
      corpo.replaceChildren(...blocos);
    }
    destaques.forEach(preencher);
    grupos.forEach((g) => g.itens.forEach(preencher));

    const unicos = [...new Set(avisos.filter(Boolean))];
    const texto = unicos.join('\n');
    if (texto !== textoAvisos) {
      textoAvisos = texto;
      listaAvisos.replaceChildren(...unicos.map((a) => h('li', { class: 'aviso' }, a)));
      listaAvisos.classList.toggle('oculto', !unicos.length);
    }
  }

  return { el, atualizar };
}
