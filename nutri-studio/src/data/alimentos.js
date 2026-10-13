// @ts-check
/**
 * Base inicial de alimentos, valores por 100 g da parte comestível.
 * Fonte de referência: TACO · Tabela Brasileira de Composição de Alimentos, 4ª ed. (NEPA/UNICAMP, 2011).
 *
 * IMPORTANTE: esta base foi digitada como ponto de partida e deve ser conferida contra a
 * publicação oficial antes de uso clínico. A tela "Alimentos" permite editar qualquer valor e
 * importar a tabela completa em CSV.
 *
 * Colunas: [id, nome, grupo, kcal, proteína g, carboidrato g, lipídio g, fibra g]
 */
/** @type {Array<[string, string, string, number, number, number, number, number]>} */
const LINHAS = [
  ['taco-arroz-branco-coz', 'Arroz, tipo 1, cozido', 'Cereais e derivados', 128, 2.5, 28.1, 0.2, 1.6],
  ['taco-arroz-integral-coz', 'Arroz, integral, cozido', 'Cereais e derivados', 124, 2.6, 25.8, 1.0, 2.7],
  ['taco-aveia-flocos', 'Aveia, flocos, crua', 'Cereais e derivados', 394, 13.9, 66.6, 8.5, 9.1],
  ['taco-pao-frances', 'Pão, trigo, francês', 'Cereais e derivados', 300, 8.0, 58.6, 3.1, 2.3],
  ['taco-pao-forma-integral', 'Pão, trigo, forma, integral', 'Cereais e derivados', 253, 9.4, 49.9, 3.7, 6.9],
  ['taco-macarrao-cru', 'Macarrão, trigo, cru', 'Cereais e derivados', 371, 10.0, 77.9, 1.3, 2.9],
  ['taco-cuscuz-milho', 'Cuscuz, de milho, cozido com sal', 'Cereais e derivados', 113, 2.2, 25.3, 0.7, 2.1],
  ['taco-biscoito-cream-cracker', 'Biscoito, salgado, cream cracker', 'Cereais e derivados', 432, 10.1, 68.7, 14.4, 2.5],
  ['taco-pao-queijo', 'Pão, de queijo, assado', 'Cereais e derivados', 363, 5.1, 34.2, 24.6, 0.6],
  ['taco-feijao-carioca-coz', 'Feijão, carioca, cozido', 'Leguminosas', 76, 4.8, 13.6, 0.5, 8.5],
  ['taco-feijao-preto-coz', 'Feijão, preto, cozido', 'Leguminosas', 77, 4.5, 14.0, 0.5, 8.4],
  ['taco-lentilha-coz', 'Lentilha, cozida', 'Leguminosas', 93, 6.3, 16.3, 0.5, 7.9],
  ['taco-grao-bico-cru', 'Grão-de-bico, cru', 'Leguminosas', 355, 21.2, 57.9, 5.4, 12.4],
  ['taco-batata-inglesa-coz', 'Batata, inglesa, cozida', 'Tubérculos', 52, 1.2, 11.9, 0.0, 1.3],
  ['taco-batata-doce-coz', 'Batata, doce, cozida', 'Tubérculos', 77, 0.6, 18.4, 0.1, 2.2],
  ['taco-mandioca-coz', 'Mandioca, cozida', 'Tubérculos', 125, 0.6, 30.1, 0.3, 1.6],
  ['taco-frango-peito-grelhado', 'Frango, peito, sem pele, grelhado', 'Carnes e ovos', 159, 32.0, 0.0, 2.5, 0],
  ['taco-frango-coxa-coz', 'Frango, coxa, sem pele, cozida', 'Carnes e ovos', 167, 26.9, 0.0, 5.8, 0],
  ['taco-patinho-grelhado', 'Carne, bovina, patinho, sem gordura, grelhado', 'Carnes e ovos', 219, 35.9, 0.0, 7.3, 0],
  ['taco-acem-moido-coz', 'Carne, bovina, acém, moído, cozido', 'Carnes e ovos', 212, 26.7, 0.0, 10.9, 0],
  ['taco-lombo-suino-assado', 'Carne, suína, lombo, assado', 'Carnes e ovos', 210, 35.7, 0.0, 6.4, 0],
  ['taco-salmao-grelhado', 'Salmão, sem pele, fresco, grelhado', 'Pescados', 229, 23.9, 0.0, 14.0, 0],
  ['taco-atum-oleo', 'Atum, conserva em óleo', 'Pescados', 166, 26.2, 0.0, 6.0, 0],
  ['taco-sardinha-oleo', 'Sardinha, conserva em óleo', 'Pescados', 285, 15.9, 0.0, 24.0, 0],
  ['taco-ovo-cozido', 'Ovo, de galinha, inteiro, cozido/10 minutos', 'Carnes e ovos', 146, 13.3, 0.6, 9.5, 0],
  ['taco-ovo-cru', 'Ovo, de galinha, inteiro, cru', 'Carnes e ovos', 143, 13.0, 1.6, 8.9, 0],
  ['taco-leite-integral', 'Leite, de vaca, integral', 'Leite e derivados', 61, 2.9, 4.3, 3.2, 0],
  ['taco-leite-desnatado', 'Leite, de vaca, desnatado, UHT', 'Leite e derivados', 35, 3.4, 4.9, 0.2, 0],
  ['taco-iogurte-natural', 'Iogurte, natural', 'Leite e derivados', 51, 4.1, 1.9, 3.0, 0],
  ['taco-queijo-minas-frescal', 'Queijo, minas, frescal', 'Leite e derivados', 264, 17.4, 3.2, 20.2, 0],
  ['taco-queijo-mussarela', 'Queijo, mozarela', 'Leite e derivados', 330, 22.6, 3.0, 25.2, 0],
  ['taco-requeijao', 'Queijo, requeijão, cremoso', 'Leite e derivados', 257, 9.6, 2.4, 23.4, 0],
  ['taco-banana-prata', 'Banana, prata, crua', 'Frutas', 98, 1.3, 26.0, 0.1, 2.0],
  ['taco-banana-nanica', 'Banana, nanica, crua', 'Frutas', 92, 1.4, 23.8, 0.1, 1.9],
  ['taco-maca-fuji', 'Maçã, Fuji, com casca, crua', 'Frutas', 56, 0.3, 15.2, 0.0, 1.3],
  ['taco-mamao-papaia', 'Mamão, Papaia, cru', 'Frutas', 40, 0.5, 10.4, 0.1, 1.0],
  ['taco-laranja-pera', 'Laranja, pêra, crua', 'Frutas', 37, 1.0, 8.9, 0.1, 0.8],
  ['taco-manga-tommy', 'Manga, Tommy Atkins, crua', 'Frutas', 51, 0.9, 12.8, 0.2, 2.1],
  ['taco-abacate', 'Abacate, cru', 'Frutas', 96, 1.2, 6.0, 8.4, 6.3],
  ['taco-morango', 'Morango, cru', 'Frutas', 30, 0.9, 6.8, 0.3, 1.7],
  ['taco-melancia', 'Melancia, crua', 'Frutas', 33, 0.9, 8.1, 0.0, 0.1],
  ['taco-uva-italia', 'Uva, Itália, crua', 'Frutas', 53, 0.7, 13.6, 0.2, 0.9],
  ['taco-alface-crespa', 'Alface, crespa, crua', 'Hortaliças', 11, 1.3, 1.7, 0.2, 1.8],
  ['taco-tomate', 'Tomate, com semente, cru', 'Hortaliças', 15, 1.1, 3.1, 0.2, 1.2],
  ['taco-cenoura-crua', 'Cenoura, crua', 'Hortaliças', 34, 1.3, 7.7, 0.2, 3.2],
  ['taco-brocolis-coz', 'Brócolis, cozido', 'Hortaliças', 25, 2.1, 4.4, 0.5, 3.4],
  ['taco-abobrinha-coz', 'Abobrinha, italiana, cozida', 'Hortaliças', 15, 1.1, 3.0, 0.2, 1.6],
  ['taco-beterraba-crua', 'Beterraba, crua', 'Hortaliças', 49, 1.9, 11.1, 0.1, 3.4],
  ['taco-pepino', 'Pepino, cru', 'Hortaliças', 10, 0.9, 2.0, 0.0, 1.1],
  ['taco-couve-refogada', 'Couve, manteiga, refogada', 'Hortaliças', 90, 1.7, 8.7, 6.6, 5.7],
  ['taco-azeite', 'Azeite, de oliva, extra virgem', 'Óleos e gorduras', 884, 0, 0, 100, 0],
  ['taco-oleo-soja', 'Óleo, de soja', 'Óleos e gorduras', 884, 0, 0, 100, 0],
  ['taco-manteiga', 'Manteiga, com sal', 'Óleos e gorduras', 726, 0.4, 0.1, 82.4, 0],
  ['taco-amendoim-torrado', 'Amendoim, grão, torrado, salgado', 'Oleaginosas', 606, 22.5, 18.7, 54.0, 7.8],
  ['taco-castanha-para', 'Castanha-do-Brasil, crua', 'Oleaginosas', 643, 14.5, 15.1, 63.5, 7.9],
  ['taco-acucar-refinado', 'Açúcar, refinado', 'Açúcares e doces', 387, 0.3, 99.5, 0, 0],
  ['taco-mel', 'Mel, de abelha', 'Açúcares e doces', 309, 0, 84.0, 0, 0],
  ['taco-chocolate-leite', 'Chocolate, ao leite', 'Açúcares e doces', 540, 7.2, 59.6, 30.3, 2.2],
  ['taco-cafe-infusao', 'Café, infusão 10%', 'Bebidas', 9, 0.7, 1.5, 0.1, 0],
];

/** @type {import('../calc/plano.js').Alimento[]} */
export const ALIMENTOS_BASE = LINHAS.map(([id, nome, grupo, kcal, ptn, cho, lip, fibra]) => ({
  id,
  nome,
  grupo,
  kcal,
  ptn,
  cho,
  lip,
  fibra,
  fonte: 'TACO 4ª ed. (conferir)',
}));
