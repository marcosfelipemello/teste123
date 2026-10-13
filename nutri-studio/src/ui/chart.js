// @ts-check
import { esc, raw } from './html.js';
import { fmt, fmtData } from './format.js';

/**
 * Gráfico de linha em SVG (sem dependências) para a evolução do paciente.
 * @param {Object} p
 * @param {Array<{ x: string, y: number }>} p.pontos x = data ISO
 * @param {string} p.unidade
 * @param {number} [p.casas]
 * @param {string} [p.titulo]
 */
export function graficoLinha({ pontos, unidade, casas = 1, titulo = '' }) {
  const validos = pontos.filter((p) => Number.isFinite(p.y)).sort((a, b) => a.x.localeCompare(b.x));
  if (validos.length === 0) return raw('<p class="vazio">Sem dados suficientes.</p>');

  const W = 640;
  const H = 220;
  const m = { t: 16, r: 16, b: 34, l: 52 };
  const ys = validos.map((p) => p.y);
  let min = Math.min(...ys);
  let max = Math.max(...ys);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const folga = (max - min) * 0.15;
  min -= folga;
  max += folga;
  const n = validos.length;
  const px = (/** @type {number} */ i) => m.l + (n === 1 ? (W - m.l - m.r) / 2 : (i * (W - m.l - m.r)) / (n - 1));
  const py = (/** @type {number} */ y) => m.t + ((max - y) * (H - m.t - m.b)) / (max - min);

  const linhasGrade = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const y = min + (max - min) * f;
    const yy = py(y);
    return `<line x1="${m.l}" x2="${W - m.r}" y1="${yy}" y2="${yy}" class="gl"/><text x="${m.l - 8}" y="${yy + 4}" text-anchor="end" class="eixo">${esc(fmt(y, casas))}</text>`;
  });

  const d = validos.map((p, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ');
  const pontosSvg = validos.map(
    (p, i) =>
      `<g><circle cx="${px(i)}" cy="${py(p.y)}" r="4" class="ponto"/><title>${esc(fmtData(p.x))}: ${esc(fmt(p.y, casas))} ${esc(unidade)}</title></g>`,
  );
  const passo = Math.max(1, Math.ceil(n / 6));
  const rotulosX = validos
    .map((p, i) => (i % passo === 0 || i === n - 1 ? `<text x="${px(i)}" y="${H - 10}" text-anchor="middle" class="eixo">${esc(fmtData(p.x).slice(0, 5))}</text>` : ''))
    .join('');

  return raw(`<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(titulo)}">
    ${linhasGrade.join('')}
    <path d="${d}" class="linha"/>
    ${pontosSvg.join('')}
    ${rotulosX}
  </svg>`);
}
