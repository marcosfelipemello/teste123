// @ts-check
import { raw } from './html.js';

// Iconografia Kryven: grade 24 px, traço 2 px, linear, cantos vivos.
/** @type {Record<string, string>} */
const PATHS = {
  inicio: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  pacientes: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.3-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.8c1.9.7 3.1 2.4 3.5 5.2"/>',
  novo: '<path d="M12 5v14M5 12h14"/>',
  anamnese: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 12h7M9 16h7"/>',
  avaliacao: '<path d="M3 17 17 3l4 4L7 21H3z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>',
  energia: '<path d="M13 2 5 14h6l-1 8 8-12h-6z"/>',
  plano: '<circle cx="12" cy="13" r="7"/><circle cx="12" cy="13" r="3"/><path d="M4 3v5M20 3v5"/>',
  evolucao: '<path d="M3 20h18"/><path d="m4 15 5-5 4 4 7-7"/><path d="M15 7h5v5"/>',
  alimentos: '<ellipse cx="12" cy="5.5" rx="8" ry="2.5"/><path d="M4 5.5v13c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-13"/><path d="M4 12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5"/>',
  calculadora: '<rect x="5" y="3" width="14" height="18"/><path d="M8 7h8"/><path d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',
  config: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  lixo: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 14h10l1-14"/>',
  imprimir: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8"/><path d="M6 14h12v7H6z"/>',
  baixar: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/>',
  enviar: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M4 21h16"/>',
  busca: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  voltar: '<path d="M20 12H5"/><path d="m11 6-6 6 6 6"/>',
  fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
  copiar: '<rect x="8" y="8" width="12" height="12"/><path d="M4 16V4h12"/>',
  foco: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
};

/**
 * @param {string} nome
 * @param {number} [tamanho]
 */
export function icon(nome, tamanho = 20) {
  return raw(
    `<svg class="icon" width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${PATHS[nome] ?? ''}</svg>`,
  );
}
