// @ts-check

/** Conteúdo HTML já seguro (não será escapado novamente). */
export class Raw {
  /** @param {string} s */
  constructor(s) {
    this.s = s;
  }
  toString() {
    return this.s;
  }
}

/** @type {Record<string, string>} */
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** @param {unknown} s */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Marca uma string como HTML confiável. @param {string} s */
export const raw = (s) => new Raw(s);

/** @param {unknown} v @returns {string} */
function renderValor(v) {
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(renderValor).join('');
  if (v === false || v === null || v === undefined) return '';
  return esc(v);
}

/**
 * Template literal que escapa toda interpolação por padrão (proteção contra XSS
 * em nomes de pacientes, anotações etc.).
 * @param {TemplateStringsArray} strings
 * @param {...unknown} vals
 */
export function html(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => {
    out += renderValor(v) + strings[i + 1];
  });
  return new Raw(out);
}

/** @param {string} prefixo */
export function uid(prefixo = 'id') {
  return `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
