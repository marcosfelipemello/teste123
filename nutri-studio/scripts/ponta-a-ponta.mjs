// Teste de ponta a ponta no navegador (Chromium via Playwright), em 1280 px e 375 px de largura.
// Não faz parte do `npm test` (precisa de navegador). Para rodar:
//   1. instale o Playwright FORA do repositório: mkdir /tmp/pw && cd /tmp/pw && npm i playwright
//   2. com o app no ar (npm start), rode:
//      PLAYWRIGHT=/tmp/pw/node_modules/playwright/index.mjs node scripts/ponta-a-ponta.mjs
//      (CHROMIUM=/caminho/do/chrome se o Playwright não achar o navegador; URL=… se não for :8080)
//
// Cria um paciente, usa cada aba e cada página, recarrega e confere que os dados persistem, que o console
// não tem erros e que nenhuma tela tem rolagem horizontal. Os alimentos de teste são os da evidência do
// planejamento (docs/webdiet-evidencias), importados por CSV só no navegador do teste; os valores
// esperados são os do relatório (§4.8, §8.4, §8.6, §8.7, §10.5).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const URL_APP = (process.env.URL || 'http://localhost:8080').replace(/\/$/, '');
const FOTOS = process.env.FOTOS; // pasta para capturas de tela (opcional)
const evidencia = (nome) => JSON.parse(readFileSync(fileURLToPath(new URL(`../../docs/webdiet-evidencias/${nome}`, import.meta.url)), 'utf8'));
const DRIS = JSON.parse(readFileSync(fileURLToPath(new URL('../src/dados/dris.json', import.meta.url)), 'utf8'));

/** CSV de "Meus alimentos" com os alimentos da evidência do planejamento. */
function csvDeTeste() {
  const chaves = DRIS.nutrientes.map((n) => n.chave);
  const micros = chaves.filter((c) => c !== 'fibras');
  const n = (v) => String(v).replace('.', ',');
  const linhas = [['nome', 'unidade', 'kcal', 'ptn', 'lip', 'cho', 'fibras', 'medidas', 'origem', ...micros].join(';')];
  for (const a of Object.values(evidencia('tela_planejamento_alimentos.json').alimentos)) {
    const medidas = a.mc.filter((m) => !/^(grama|mililitro)\(s\)$/.test(m.nome_mc)).map((m) => `${m.nome_mc}:${m.peso}`).join('|');
    linhas.push([a.nome.trim(), a.unidade, n(a.kcal), n(a.ptn), n(a.lip), n(a.cho), n(a.fibras), medidas, 'TACO (teste)',
      ...micros.map((c) => n(a.micros[chaves.indexOf(c)]))].join(';'));
  }
  return linhas.join('\n') + '\n';
}

const resultados = [];
function confere(nome, obtido, esperado) {
  const ok = esperado instanceof RegExp ? esperado.test(obtido) : obtido === esperado;
  resultados.push({ ok, nome, obtido, esperado: String(esperado) });
  console.log(`${ok ? 'ok  ' : 'FALHOU'} ${nome}${ok ? '' : `: obtido ${JSON.stringify(obtido)}, esperado ${esperado}`}`);
}

async function rodar(largura) {
  console.log(`\n=== ${largura} px ===`);
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const page = await (await browser.newContext({ viewport: { width: largura, height: 900 }, acceptDownloads: true })).newPage();
  const erros = [];
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  page.on('pageerror', (e) => erros.push(e.message));
  page.on('dialog', (d) => d.accept());
  const texto = async (sel) => (await page.innerText(sel)).replace(/\s+/g, ' ').trim();
  const destaques = async () => page.$$eval('aside .destaques .resultado', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
  async function semRolagem(onde) {
    const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    confere(`${onde}: sem rolagem horizontal`, r.sw <= r.cw, true);
  }
  async function aba(nome) {
    await page.click(`button[role=tab]:has-text("${nome}")`);
    await page.waitForTimeout(100);
    await semRolagem(`aba ${nome}`);
  }
  async function adicionar(raiz, nome, medida, qtd) {
    const busca = raiz.locator('.seletor-alimento input[list]').last();
    await busca.fill(nome);
    await busca.dispatchEvent('change');
    if (medida) await raiz.locator('.seletor-alimento select').last().selectOption({ label: medida });
    await raiz.locator('.seletor-alimento input[name^=quantidade]').last().fill(String(qtd));
    await raiz.locator('.seletor-alimento button:has-text("Adicionar")').last().click();
  }

  // ---- Meus alimentos: importação por CSV e cadastro pelo rótulo (§8.7) -----------------------
  await page.goto(`${URL_APP}/#/alimentos`);
  await semRolagem('Meus alimentos (vazio)');
  await page.click('text=Importar tabela (CSV)');
  await page.setInputFiles('input[type=file]', { name: 'alimentos.csv', mimeType: 'text/csv', buffer: Buffer.from(csvDeTeste()) });
  await page.click('button:has-text("Importar 8")');
  await page.click('text=Cadastrar pelo rótulo');
  const rotulo = evidencia('tela_alimento_rotulo.json').entrada;
  for (const [campo, chave] of [['nome', 'nomeNovoAlimento'], ['medida', 'mcNovoAlimento'], ['quantidadeMedidas', 'mcquantidadeNovoAlimento'], ['peso', 'pesoNovoAlimento'], ['cho', 'choNovoAlimento'], ['ptn', 'ptnNovoAlimento'], ['lip', 'lipNovoAlimento'], ['fibras', 'fibrasNovoAlimento']]) {
    await page.fill(`[name=${campo}]`, rotulo[chave]);
  }
  confere('§8.7 kcal automática da porção', (await destaques())[0], /^ENERGIA DA PORÇÃO 181 kcal/i);
  await page.click('button[type=submit]');
  confere('§8.7 por 100 g', await texto(`tr:has-text("${rotulo.nomeNovoAlimento}")`), /402 13\.6 10\.2 60\.7 7\.1/);
  confere('Meus alimentos: total', await texto('p[role=status]'), '9 alimentos.');
  await semRolagem('Meus alimentos');

  // ---- Receitas (§8.6) ------------------------------------------------------------------------
  await page.goto(`${URL_APP}/#/receitas`);
  await page.click('text=Nova receita');
  await page.locator('form label:has-text("Nome") input').first().fill('Receita de teste');
  for (const [padrao, gramas] of evidencia('tela_receita.json').ING) {
    const nome = { '^Arroz cozido$': 'Arroz cozido', '^Feij[ãa]o carioca cozido': 'Feijão carioca cozido', '^Azeite': 'Azeite de dendê', '^Banana.*prata': 'Banana prata' }[padrao];
    await adicionar(page, `${nome} · TACO (teste)`, 'grama(s)', gramas);
  }
  await page.fill('label:has-text("Rendimento") input', '4');
  const rec = await destaques();
  confere('§8.6 peso total', rec[0], /480 g/);
  confere('§8.6 kcal total', rec[1], /576 kcal/);
  confere('§8.6 porção automática', rec[2], /120 g Porção$/);
  await page.fill('label:has-text("Peso final") input', '420');
  await page.click('text=Gerar medida pelo peso final');
  confere('§8.6 porção pelo peso final', (await destaques())[2], /105 g Porção\(ões\)/);
  await page.fill('label:has-text("Modo de preparo") textarea', 'Misturar.');
  await semRolagem('Receita (editor)');
  await page.click('button:has-text("Salvar receita")');
  confere('Receita salva na lista', await texto('table tbody'), /Receita de teste .* 105 g/i);

  // ---- Paciente --------------------------------------------------------------------------------
  await page.goto(`${URL_APP}/#/pacientes`);
  await page.click('text=Novo paciente');
  await page.fill('[name=nome]', 'Paciente E2E');
  await page.selectOption('[name=sexo]', 'M');
  await page.fill('[name=nascimento]', '15/06/1991');
  await page.click('button[type=submit]');
  await page.waitForSelector('button[role=tab]');
  await semRolagem('Perfil');

  // Antropometria
  await aba('Antropometria');
  await page.fill('[name=peso]', '80');
  await page.fill('[name=estatura]', '175');
  confere('Antropometria: IMC', (await destaques())[0], /IMC 26\.1/);
  await page.click('button:has-text("Salvar avaliação")');

  // Cálculo energético, E01 com data 13/10/2026 (§4.8)
  await aba('Cálculo energético');
  confere('Energia: peso vindo da antropometria', await page.inputValue('[name=peso]'), '80');
  await page.fill('[name=data]', '13/10/2026');
  await page.selectOption('[name=formula]', '1');
  await page.selectOption('[name=fator]', '1.550');
  const e01 = await destaques();
  confere('E01 TMB', e01[0], 'TMB 1806 Kcal/dia (22.6 Kcal/kg)');
  confere('E01 GET', e01[1], 'GET 2799 Kcal/dia (35.0 Kcal/kg)');
  await page.click('button:has-text("Salvar cálculo")');

  // Planejamento por alimentos (§8.4)
  await aba('Planejamento');
  await page.click('text=Novo plano por alimentos');
  const meta = (c) => `[name=meta-${c}]`;
  const metas = async () => (await Promise.all(['tipo', 'peso', 'ptn', 'lip', 'cho', 'get'].map((c) => page.inputValue(meta(c))))).join(' ');
  confere('Metas de plano novo: g/kg zerado, como no WebDiet', await metas(), 'gkg 0 0 0 0 0');
  await page.click('button:has-text("Usar o GET de 13/10/2026")');
  confere('Metas: GET importado passa para % do GET e zera PTN/LIP/CHO', await metas(), 'percentual 80 0 0 0 2799');
  await page.fill(meta('ptn'), '20');
  await page.fill(meta('lip'), '30');
  confere('Metas: CHO = 100 − PTN − LIP', await metas(), 'percentual 80 20 30 50 2799');
  confere('Metas: meta de energia', (await destaques())[1], /^META 2799 Kcal \(35\.0 Kcal\/Kg\)/);
  if (FOTOS) await page.locator('[aria-labelledby=plan-metas]').screenshot({ path: `${FOTOS}/metas-${largura}.png` });
  const almoco = () => page.locator('section.refeicao').nth(1);
  await adicionar(almoco(), 'Arroz cozido · TACO (teste)', 'Colher(es) de arroz rasa(s) (30 g)', 4);
  await adicionar(almoco(), 'Feijão carioca cozido · TACO (teste)', 'grama(s)', 150);
  await adicionar(almoco(), 'Coração de frango grelhado · TACO (teste)', 'grama(s)', 120);
  await adicionar(almoco(), 'Azeite de dendê · TACO (teste)', 'Colher(es) de sopa (8 g)', 1);
  const tot = await texto('section.refeicao >> nth=1 >> .total-refeicao');
  confere('§8.4 almoço', tot, /^Total: 398g · PTN 37\.1g · LIP 23\.5g · CHO 54\.8g · 587 Kcal/);
  confere('§8.4 distribuição', tot, /25\.3%.*36\.1%.*38\.6%.*1\.47 Kcal\/g/);
  confere('Planejamento: micronutrientes (fibras × DRI 38 g)', await texto('.tabela-micros tr:has-text("Fibras")'), /14\.7 g 38\.7% 38 g/i);
  await adicionar(page.locator('section.refeicao').nth(0), 'Receita de teste · Receita', null, 1);
  await page.click('text=Importar alimentos do plano');
  await semRolagem('Planejamento (editor)');
  if (FOTOS) await page.locator('aside').screenshot({ path: `${FOTOS}/total-do-dia-${largura}.png` });
  await page.click('aside >> text=Salvar plano');

  // Questionários: cronotipo com as primeiras opções (§10.5)
  await aba('Questionários');
  await page.selectOption('[name=novo]', 'cronotipo');
  await page.click('text=Responder');
  for (let n = 1; n <= 19; n++) await page.locator(`input[name="q-cronotipo-${n}"]`).first().check();
  const cr = await destaques();
  confere('Cronotipo: pontuação', cr[0], 'PONTUAÇÃO Resultado: 62 pontos');
  confere('Cronotipo: perfil', cr[1], 'PERFIL Moderadamente matutino');
  await semRolagem('Questionário (cronotipo)');
  await page.click('text=Salvar questionário');

  // ---- Persistência após recarregar -----------------------------------------------------------
  await page.reload();
  await page.waitForSelector('button[role=tab]');
  await aba('Antropometria');
  confere('Persistiu: antropometria', await texto('table[aria-labelledby=antropo-historico] tbody'), /80\.0 kg/);
  await aba('Cálculo energético');
  confere('Persistiu: energia', await texto('table[aria-labelledby=energia-historico] tbody'), /2799 kcal/);
  await aba('Planejamento');
  confere('Persistiu: plano', await texto('table[aria-labelledby=plan-historico] tbody'), /Plano alimentar Alimentos \d+ kcal/);
  await page.click('button[aria-label^="Abrir Plano alimentar"]');
  confere('Persistiu: almoço do plano', await texto('section.refeicao >> nth=1 >> .total-refeicao'), /^Total: 398g/);
  confere('Persistiu: metas', await metas(), 'percentual 80 20 30 50 2799');
  // §12 #30 corrigido: ao abrir, a adequação do gN já usa o prescrito atual (o WebDiet usa 0).
  const gN = async () => {
    const item = (grupo) => page.locator(`aside div:has(> h4:text-is("${grupo}")) dl > div:has(> dt:text-is("kcal não proteica/g N")) dd`);
    const adequacao = item('Adequação (prescrito − planejado)');
    const prescrita = parseFloat(await item('Prescrito (total do dia)').locator('.valor').innerText());
    const planejada = parseFloat((await adequacao.locator('small').innerText()).replace('planejado ', ''));
    return { prescrita, planejada, adequacao: await adequacao.locator('.valor').innerText() };
  };
  const g0 = await gN();
  confere('Ao abrir: adequação do gN = prescrito − planejado (§12 #30 corrigido)', g0.adequacao, `${(g0.prescrita - g0.planejada).toFixed(0)} Kcal`);
  // §12 #31 corrigido: em g/kg, mudar só o peso refaz o GET.
  await page.selectOption(meta('tipo'), 'gkg');
  await page.fill(meta('ptn'), '1.5');
  await page.fill(meta('lip'), '1');
  await page.fill(meta('cho'), '4');
  confere('Metas g/kg: GET = PTN×P×4 + LIP×P×9 + CHO×P×4', await metas(), 'gkg 80 1.5 1 4 2480');
  await page.fill(meta('peso'), '70');
  confere('Metas g/kg: mudar o peso refaz o GET (§12 #31 corrigido)', await metas(), 'gkg 70 1.5 1 4 2170');
  confere('Persistiu: lista de compras', (await page.$$eval('.lista-compras input:not([type])', (els) => els.map((e) => e.value))).join(', '),
    'Arroz cozido, Azeite de dendê, Banana prata, Coração de frango grelhado, Feijão carioca cozido');
  await aba('Questionários');
  confere('Persistiu: questionário', await texto('table tbody'), /Resultado: 62 pontos · Perfil: Moderadamente matutino/);

  // Paciente feminina: aba Gestação e DRIs de gestante
  await page.goto(`${URL_APP}/#/pacientes`);
  await page.click('text=Novo paciente');
  await page.fill('[name=nome]', 'Gestante E2E');
  await page.selectOption('[name=sexo]', 'F');
  await page.fill('[name=nascimento]', '10/03/1991');
  await page.selectOption('[name=condicao]', 'gestante');
  await page.click('button[type=submit]');
  await aba('Gestação');
  await page.fill('[name=ppg]', '60');
  await page.fill('[name=altura]', '165');
  await page.fill('[name=semanas]', '24');
  confere('Gestação: classe pré-gestacional', (await destaques())[0], /Saudável/);
  await page.click('button:has-text("Salvar acompanhamento")');
  await aba('Cálculo energético');
  await page.selectOption('[name=formula]', '28');
  confere('EER 2023 gestante: semanas do acompanhamento', await page.inputValue('[name=semanas]'), '24');

  // Referências e backup
  await page.goto(`${URL_APP}/#/referencias`);
  confere('Referências: F 35 anos', await texto('section >> nth=0 >> .destaques'), /Mulheres, 31–50 anos .*Conferido na tela do WebDiet/);
  await semRolagem('Referências');
  await page.goto(`${URL_APP}/#/dados`);
  await semRolagem('Dados e backup');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('text=Baixar backup (JSON)')]);
  const backup = JSON.parse(readFileSync(await download.path(), 'utf8'));
  confere('Backup: pacientes, alimentos e receitas', `${backup.pacientes.length}/${backup.alimentos.length}/${backup.receitas.length}`, '2/9/1');

  // TACO 4ª edição: carga em "Meus alimentos" e uso no planejamento (§8.4 em gramas).
  await page.goto(`${URL_APP}/#/alimentos`);
  await page.click('button:has-text("Carregar a TACO")');
  await page.waitForFunction(() => /^602 /.test(document.querySelector('p[role=status]')?.textContent || ''));
  confere('TACO: 593 alimentos a mais', await texto('p[role=status]'), /^602 alimentos encontrados; mostrando os 200 primeiros/);
  await page.fill('input[type=search]', 'Arroz, tipo 1, cozido');
  confere('TACO: arroz tipo 1 cozido', await texto('table.tabela-alimentos tbody tr'), /128 2\.5 0\.2 28\.1 1\.6/);
  await semRolagem('Meus alimentos com a TACO');
  // Medida caseira do IBGE acrescentada ao arroz da TACO pela consulta da edição.
  await page.click('button[aria-label="Editar Arroz, tipo 1, cozido"]');
  await page.fill('input[aria-label="Buscar medidas caseiras do IBGE"]', 'arroz polido');
  await page.click('button[aria-label^="Acrescentar Colher de sopa cheia, 25 gramas"]');
  await semRolagem('Edição com a consulta do IBGE');
  await page.click('button:has-text("Salvar alterações")');
  await page.fill('input[type=search]', 'Arroz, tipo 1, cozido');
  confere('IBGE: medida no arroz da TACO', await texto('table.tabela-alimentos tbody tr'), /Colher de sopa cheia = 25 g/);
  await page.reload();
  await page.waitForSelector('p[role=status]');
  confere('TACO: persistiu', await texto('p[role=status]'), /^602 alimentos/);
  await page.goto(`${URL_APP}/#/pacientes`);
  await page.click('a:has-text("Paciente E2E")');
  await aba('Planejamento');
  await page.click('text=Novo plano por alimentos');
  await adicionar(page.locator('section.refeicao').nth(1), 'Arroz, tipo 1, cozido · TACO', 'Colher de sopa cheia (25 g)', 4.8); // 120 g
  for (const [nome, g] of [['Feijão, carioca, cozido', 150], ['Frango, coração, grelhado', 120], ['Azeite, de dendê', 8]]) {
    await adicionar(page.locator('section.refeicao').nth(1), `${nome} · TACO`, 'grama(s)', g);
  }
  confere('§8.4 com a TACO', await texto('section.refeicao >> nth=1 >> .total-refeicao'), /^Total: 398g · PTN 37\.1g · LIP 23\.5g · CHO 54\.8g · 587 Kcal/);

  confere('Console sem erros', erros.join(' | '), '');
  await browser.close();
}

for (const largura of [1280, 375]) await rodar(largura);
const falhas = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - falhas.length} de ${resultados.length} conferências passaram.`);
process.exit(falhas.length ? 1 : 0);
