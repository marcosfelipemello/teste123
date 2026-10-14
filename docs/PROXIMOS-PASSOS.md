# Próximos passos — continuação da Etapa 3 (app nutri-studio)

Branch de trabalho: `ccr-547159ad-oarva6`.

**Em 14/10/2026 o app passou para o repositório `marcosfelipemello/diet-kryven` (branch `main`), de onde será publicado no subdomínio. Continue o trabalho lá; esta branch fica como histórico das sessões 1–4.**

**Situação em 13/10/2026 (quarta sessão):** a lista "Falta fazer" abaixo foi concluída na segunda sessão; a terceira e a quarta deixaram cálculos e telas iguais aos do WebDiet onde dava para conferir. O que continua em aberto está em "Ainda não feito" e em "Decisões que dependem do usuário".

## Onde está cada coisa

- `docs/webdiet-analise.md` — relatório completo do WebDiet (fórmulas, arredondamentos, classificações, erros §12, pendências §14). **Fonte única de verdade dos cálculos.**
- `docs/webdiet-evidencias/` — valores que a tela do WebDiet mostrou para entradas de teste. Os testes do app comparam com eles.
- `nutri-studio/` — o app novo: web app estático, JS puro (módulos ES), sem dependências e sem build. Dados no `localStorage` do navegador, com backup em JSON. Design system Votum (`src/ui/votum.css`): só paleta e tipografia, sem logotipo.
  - `npm test` → 1628 testes passando (`node --test "test/**/*.test.js"`).
  - `npm start` → abre em http://localhost:8080.
  - `npm run e2e` → teste de ponta a ponta no Chromium, em 1280 e 375 px: 124 de 124 conferências passando. O Playwright fica fora do repositório (ver `nutri-studio/README.md`). Com `FOTOS=<pasta>`, salva capturas das metas e do total do dia.
  - `nutri-studio/README.md` → como rodar, arquitetura, política de erros, de onde vem cada dado.

## Pronto e testado

**Cálculos** (`src/calc/`), todos conferidos contra as evidências do WebDiet:

- `numeros.js` (convenções)
- `energia.js` (110 casos)
- `antropometria.js` (73 casos)
- `infantil.js`
- `gestante.js`
- `planejamento.js`, `equivalentes.js`, `receitas.js`, `alimentoProprio.js`, `listaCompras.js`
- `dris.js` + `dados/dris.json`: 16 perfis conferidos no WebDiet; as demais faixas vêm das tabelas oficiais NASEM/Health Canada, marcadas por `fonte`.
- `questionarios/` (10 questionários; registro `QUESTIONARIOS`)

**Interface** (`src/ui/`):

- `app.js` (rotas), `dom.js`, `armazenamento.js`, `importacao.js` (pacientes por CSV/JSON)
- `paginas/pacientes.js`: lista, cadastro, ficha com abas via `registrarAba`
- `paginas/dados.js`: backup e importação
- `abas/antropometria.js` (adulto e infantil) e `abas/gestacao.js`, testadas no navegador
- `abas/painel-resultados.js`: painel de resultados reutilizável

## Interrompido no meio na primeira sessão — revisado e testado na segunda

- `src/ui/alimentosCsv.js` + `test/alimentosCsv.test.js` (importação de tabela de alimentos por CSV)
- `src/ui/catalogo.js`
- `src/ui/paginas/alimentos.js`
- `armazenamento.js`: `salvarVarios`

Revisão: a página estava completa. Foi testada no navegador (cadastro pelo rótulo = §8.7; importação, exportação e modelo CSV; persistência). Duas mudanças:
- a nota técnica da divergência 27 virou um texto para o usuário;
- um alimento do rótulo agora pode ser editado por 100 g, para preencher os micronutrientes.

## Falta fazer — concluído na segunda sessão

Todos os itens abaixo foram feitos e conferidos no navegador. Nenhum arquivo de `src/calc/` foi alterado. Resumo:
1. **Cálculo energético** (`abas/energia.js`): E01 confere (1806 / 22,6; 2799 / 35,0), assim como E02, E31, EER 2023 categorias 1–4, VENTA, MET, GET manual e bolso.
2. **Questionários** (`abas/questionarios.js`): cronotipo com as primeiras opções dá 62 pontos / Moderadamente matutino.
3. **Planejamento** (`abas/planejamento.js`):
   - §8.4 confere (398 g; 37,1/23,5/54,8; 587 kcal);
   - equivalentes com uma lista de grupos do consultório (nova coleção `equivalentes`);
   - lista de compras com quantidades conforme o §8.8;
   - impressão.
4. **Páginas:** alimentos (§8.7), receitas (§8.6: 480 g, 576 kcal, 120 g; 105 g com peso final de 420 g) e referências (DRIs com a fonte + lista das divergências do §12).
5. **Ponta a ponta:** `nutri-studio/scripts/ponta-a-ponta.mjs`, 94/94 em 1280 e 375 px, console sem erros.
6. **README** do app.
7. **Relatório:** nova §15, "Lacunas encontradas na reconstrução". A contagem de protocolos foi conferida: são 23 documentados, não 26 (§15.1).

Texto original da lista, para referência:

Siga o padrão das abas existentes. Não altere `src/calc/`; leia o código e os testes para entender a API.

1. **Aba "Cálculo energético"** (`src/ui/abas/energia.js`):
   - formulário montado a partir de `PROTOCOLOS`, com fator de atividade, injúria, MET, programação de peso, GET manual e fórmula de bolso;
   - peso e altura pré-preenchidos da última antropometria;
   - histórico salvo como registro `energia`;
   - conferir no navegador o caso E01 de `tela_energia.json`, com data 13/10/2026.
2. **Aba "Questionários"** (`src/ui/abas/questionarios.js`):
   - formulário gerado pelo registro `QUESTIONARIOS`;
   - os itens aparecem como "Item n" + categoria, porque os textos das perguntas não foram copiados;
   - salvar como registro `questionario`;
   - conferir no navegador: cronotipo com todas as primeiras opções → "Resultado: 62 pontos" / "Perfil: Moderadamente matutino".
3. **Aba "Planejamento"** (`src/ui/abas/planejamento.js`):
   - método por alimentos: refeições, itens, substitutos, totais, metas (GET da última energia), adequação e micronutrientes contra as DRIs do paciente;
   - método por equivalentes;
   - lista de compras;
   - impressão;
   - conferir no navegador: §8.4 do relatório (398 g; 37,1/23,5/54,8; 587 kcal).
4. **Páginas:**
   - terminar `#/alimentos` (cadastro pelo rótulo: §8.7 dá 181 kcal e 402/13,6/10,2/60,7/7,1 por 100 g; importação e exportação por CSV; modelo para baixar);
   - `#/receitas` (§8.6: 480 g, 576 kcal, porção de 120 g; com peso final de 420 g, porção de 105 g; a receita salva vira alimento de origem "Receita");
   - `#/referencias` (DRIs por sexo, idade e condição, mostrando a fonte).
   - Registrar tudo em `carregarExtras` (`app.js`).
5. **Teste de ponta a ponta no navegador** (Playwright + Chromium em `/opt/pw-browsers/chromium`; instale o pacote `playwright` numa pasta temporária fora do repositório):
   - criar paciente;
   - usar cada aba;
   - recarregar a página e conferir que os dados persistem;
   - nenhum erro no console;
   - telas de 1280 px e 375 px sem rolagem horizontal.
6. **`nutri-studio/README.md`:** como rodar, arquitetura, política de erros, de onde vem cada dado.
7. **Relatório:** acrescentar uma seção "Lacunas encontradas na reconstrução", com o que os agentes precisaram inferir das evidências. Por exemplo:
   - RCQ usa o valor bruto com `<` estrito;
   - CMB usa o valor bruto e exige a dobra tricipital;
   - semanas 1–9 da gestação usam `ppg + (esp10 − ppg)·s/9`;
   - a lista de fatores da fórmula 22 é igual à da 21;
   - semana inicial etc.
   Conferir também a contagem "26 protocolos" (§2.2), porque só 23 estão documentados em §4.

## Terceira sessão (pedido do usuário: cálculos e telas idênticos ao WebDiet)

- **Equivalentes:** os grupos sem lista do consultório usam as médias padrão que o WebDiet mostra (§8.5). Os totais da evidência saem iguais (r1: 981 kcal; r2: 707 kcal).
- **Defeitos de exibição do §12 (itens 18, 24, 25 e 28):** passaram a ser iguais ao WebDiet por padrão. A versão corrigida fica disponível com `{ corrigir: true }`. O item 26 continua corrigido, porque não se sabe qual resultado o WebDiet dá.
- **Linhas de alimentos e ingredientes:** mostram os textos exatos da tela do WebDiet.
- **TACO 4ª edição** (decisão 3):
  - 593 alimentos em `src/dados/taco.json`, com botão "Carregar a TACO" em "Meus alimentos";
  - mesmos valores do WebDiet nos alimentos TACO da evidência: 249 de 256 valores, e os 7 restantes são dados do próprio WebDiet que diferem da TACO oficial (§15.8);
  - o almoço do §8.4 montado com a TACO em gramas dá o mesmo resultado da tela.
- **Medidas caseiras do IBGE** (POF 2008–2009):
  - consulta na edição de alimentos, que acrescenta a medida com um clique;
  - os pesos que o WebDiet mostra (arroz colher de sopa cheia 25 g; feijão concha cheia 140 g; azeite colher de sopa 8 g; pão francês 50 g; ovo 45 g) são os do IBGE.

## Quarta sessão: conta do WebDiet aberta só para leitura (autorizada pelo usuário)

Login com as credenciais do usuário e, depois dele, um bloqueio no navegador que só deixava passar leituras; nada foi salvo nem alterado na conta. Só os planos do paciente de teste foram abertos. Detalhes no relatório, §15.9; o que a tela mostrou está em `docs/webdiet-evidencias/tela_planejamento_metas_conta.json`.

- **§15.1 resolvido:** são 23 fórmulas (15–20 não existem). A aba Cálculo energético usa os rótulos e a ordem do WebDiet ("Escolha sua fórmula").
- **Totais, metas e adequação** (`calc/planejamento.js`, `calc/equivalentes.js`): seguem o código de `graficoMacros()` e `mostrarReferencias()`. Mudanças comprovadas por teste (`test/totaisWebdiet.test.js` falha no código anterior):
  - gramas e kcal em forma de número ("58g"), g/kg só com peso > 0, kcal não proteica/g N com LIP×9 e CHO×4 arredondados antes;
  - análise: %CHO = 100 − %PTN − %LIP;
  - equivalentes: CHO disponível, fibras com g/kg, campos "Resumo", metas e adequação sobre os totais sem arredondar, neutro cinza;
  - metas usam o CHO% e o GET guardados.
- **Metas na aba Planejamento:** iguais ao modal do WebDiet (plano novo em g/kg zerado; trocar a distribuição zera; "Usar o GET" passa para % do GET e zera PTN/LIP/CHO; CHO = 100 − PTN − LIP; GET em g/kg refeito ao digitar PTN/LIP/CHO). Planos salvos antes são convertidos sem perder valores (os campos antigos ficam em `metas.formatoAntigo`).
- **Novos itens do §12:** #30 (adequação do gN com o valor do cálculo anterior; ao abrir o plano, 0) e #31 (GET em g/kg não refeito ao mudar só o peso) foram **corrigidos a pedido do usuário**; #32 (CHO 100% na análise de plano vazio) fica igual ao WebDiet.

- **Pacientes de teste excluídos** (autorização do usuário): os dois "Teste Rea" (18236779 e 18236776), os únicos com "teste" no nome.
- **Simulação dos questionários na conta** (pedido do usuário): 40 cenários por questionário, marcados pelas funções da própria página, sem salvar. 360 de 360 iguais ao app (rastreamento, FINDRISC, disbiose, cafeína resumida e completa, fenótipo, sarcopenia, cronotipo, QFA). Evidência `docs/webdiet-evidencias/tela_q_simulacao.json`, teste `test/questionariosSimulacao.test.js`.

## Ainda não feito (fora desta lista)

- Não reproduzidos:
  - planejamento qualitativo;
  - piloto automático (modelos do WebDiet);
  - lista de compras reescrita por IA;
  - PDF (há impressão pelo navegador);
  - periodização;
  - integração HandyMET (a TMB é digitada);
  - receitas "comuns" (só texto);
  - abas sem cálculo do §11.
- Sinais e sintomas: o motor de contagem existe, mas falta a base sinal → nutrientes (decisão 2).
- Hospedagem e login (decisão 4): hoje os dados ficam só no navegador, com backup em JSON.

## Regras combinadas com o usuário (manter)

- **Não apagar nada sem consultar o usuário.**
- **Não copiar dados de pacientes do WebDiet.** Na quarta sessão o usuário autorizou abrir a conta; ela foi usada só para leitura e só nos planos do paciente de teste. Conteúdo protegido (base de alimentos, listas de equivalentes, textos) não é copiado.
  - Os pacientes de teste "Teste Rea" (18236779 e 18236776) foram **excluídos** em 13/10/2026, com autorização do usuário. Não há mais paciente de teste na conta: uma nova conferência precisa criar outro (e excluí-lo no fim).
- **Política de erros do app:**
  - Reproduzir o WebDiet nos casos conferidos.
  - Onde o WebDiet trava ou fica vazio, retornar `null` + `aviso`.
  - Divergências científicas da §12 ficam iguais ao WebDiet (listadas em `DIVERGENCIAS`) até o usuário decidir.
- **Commits:** em português, terminando com as linhas de atribuição da sessão. Push na branch acima.

## Decisões que dependem do usuário

1. Corrigir ou manter as divergências científicas da §12. Ex.: Pollock 3 feminino (já existe a opção `corrigir`); meninas de 25–60 meses usando a tabela LMS dos meninos; fórmula da kcal não proteica planejada.
2. Textos das perguntas dos questionários: hoje aparecem só "Item n". Opções: usar as versões publicadas dos instrumentos, ou o usuário fornecer os textos.
3. Base de alimentos: o app não traz tabela. Incluir a TACO (pública, NEPA/UNICAMP)?
4. Hospedagem e acesso por login (hoje os dados ficam só no navegador). Opção: Supabase.
5. ~~Excluir o paciente de teste da conta do WebDiet~~ — **feito** em 13/10/2026 (os dois "Teste Rea", com autorização do usuário).
6. ~~Metas padrão de um plano novo~~ — **resolvido na quarta sessão:** igual ao WebDiet (g/kg com tudo 0; o botão "Usar o GET" faz a importação do cálculo energético).
7. ~~Adequação no método por equivalentes~~ — **resolvido na quarta sessão:** o WebDiet mostra metas e adequação nos equivalentes, e o app faz o mesmo cálculo.
8. Lista dos grupos de equivalentes: começa vazia e o consultório monta a partir de "Meus alimentos". Se a TACO entrar (decisão 3), dá para sugerir uma lista inicial.
9. Questionário de sinais e sintomas: montar uma base própria (sinal → nutrientes) a partir da literatura, ou deixar indisponível.
