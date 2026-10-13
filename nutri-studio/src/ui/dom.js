// Pequenos utilitários de DOM usados pelas páginas.

/**
 * Cria um elemento. `attrs` aceita on* (eventos), class, style (texto) e demais atributos.
 * Filhos podem ser texto, nós, arrays ou null/false (ignorados). Texto nunca é interpretado como HTML.
 */
export function h(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  const add = (f) => {
    if (f === null || f === undefined || f === false) return;
    if (Array.isArray(f)) f.forEach(add);
    else el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  };
  filhos.forEach(add);
  return el;
}

/** Campo com rótulo (padrão Votum: rótulo em caixa alta acima do controle). */
export function campo(rotulo, controle, ajuda) {
  return h('label', { class: 'campo' }, h('span', {}, rotulo), controle, ajuda ? h('small', {}, ajuda) : null);
}

/** Lista de seleção a partir de [{valor, rotulo}] ou [valor]. */
export function selecao(attrs, opcoes, selecionado) {
  return h('select', attrs, opcoes.map((o) => {
    const valor = typeof o === 'object' ? o.valor : o;
    const rotulo = typeof o === 'object' ? o.rotulo : o;
    return h('option', { value: valor, selected: String(valor) === String(selecionado) ? true : null }, rotulo);
  }));
}

/** Lê os valores de todos os controles com atributo name dentro de um elemento. */
export function lerFormulario(raiz) {
  const dados = {};
  raiz.querySelectorAll('[name]').forEach((el) => {
    if (el.type === 'checkbox') dados[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) dados[el.name] = el.value; }
    else dados[el.name] = el.value;
  });
  return dados;
}

/** Baixa um texto como arquivo. */
export function baixar(nome, conteudo, tipo = 'application/json') {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = h('a', { href: url, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Lê um arquivo escolhido pelo usuário como texto. */
export function lerArquivo(arquivo) {
  return new Promise((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => erro(r.error);
    r.readAsText(arquivo, 'utf-8');
  });
}

/** Mostra uma mensagem curta e acessível no topo da página. */
export function avisar(texto) {
  let el = document.getElementById('mensagem-global');
  if (!el) {
    el = h('div', { id: 'mensagem-global', role: 'status', 'aria-live': 'polite', class: 'aviso', style: 'position:fixed;left:16px;right:16px;bottom:16px;max-width:560px;margin:auto;z-index:20' });
    document.body.append(el);
  }
  el.textContent = texto;
  el.classList.remove('oculto');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('oculto'), 4500);
}
