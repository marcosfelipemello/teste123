// Auxiliares das abas da ficha que leem registros de outras abas (cálculo energético, planejamento,
// questionários): ordem por data da avaliação e dados da última antropometria.
import { check, partesData } from '../../calc/numeros.js';

/** "dd/mm/aaaa" → "aaaammdd" (para ordenar). */
export function chaveData(d) {
  const p = partesData(d);
  return p ? `${p.a}${String(p.m).padStart(2, '0')}${String(p.d).padStart(2, '0')}` : '';
}

/** Registros do mais recente para o mais antigo, pela data da avaliação (empate: o salvo por último). */
export function porData(registros) {
  return registros.slice().sort((a, b) =>
    chaveData(b.data).localeCompare(chaveData(a.data)) || (b.criadoEm || '').localeCompare(a.criadoEm || ''));
}

/** Registro mais recente de um tipo (ou null). */
export function ultimoRegistro(db, idPaciente, tipo) {
  return porData(db.listarRegistros(idPaciente, tipo))[0] || null;
}

/** Número de um texto da tela ("65.2 Kg" → 65.2); null se não houver número positivo. */
function numeroDaTela(texto) {
  const n = parseFloat(String(texto ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Peso, estatura e massa livre de gordura da última avaliação antropométrica com peso ou estatura.
 * A MLG pode vir das dobras (tela.mlg) e/ou da bioimpedância (campo digitado); quando há as duas, quem
 * usa escolhe (no WebDiet o sistema pergunta, relatório §4.1).
 * @returns {{data:string, peso:number|null, altura:number|null, mlgDobras:number|null, mlgBio:number|null}|null}
 */
export function dadosAntropometria(db, idPaciente) {
  const r = porData(db.listarRegistros(idPaciente, 'antropometria'))
    .find((x) => check(x.resumo?.peso) > 0 || check(x.resumo?.estatura) > 0);
  if (!r) return null;
  const s = r.resumo || {};
  return {
    data: r.data,
    peso: check(s.peso) > 0 ? check(s.peso) : null,
    altura: check(s.estatura) > 0 ? check(s.estatura) : null,
    mlgDobras: r.modo === 'adulto' ? numeroDaTela(r.tela?.mlg) : null,
    mlgBio: r.modo === 'adulto' ? numeroDaTela(r.entrada?.['bioimpedancia.massaLivreGordura']) : null,
  };
}

/** Texto curto de um número para campos (sem zeros à direita). */
export const textoNumero = (n, casas = 1) => (n === null || n === undefined || !Number.isFinite(Number(n)) ? '' : String(parseFloat(Number(n).toFixed(casas))));
