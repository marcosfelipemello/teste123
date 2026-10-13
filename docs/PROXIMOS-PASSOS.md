# Próximos passos — continuação da Etapa 3 (app nutri-studio)

Branch de trabalho: `ccr-547159ad-oarva6`. Tudo o que está aqui foi feito na sessão anterior.

## Onde está cada coisa

- `docs/webdiet-analise.md` — relatório completo do WebDiet (fórmulas, arredondamentos, classificações, erros §12, pendências §14). **Fonte única de verdade dos cálculos.**
- `docs/webdiet-evidencias/` — valores que a tela do WebDiet mostrou para entradas de teste. Os testes do app comparam com eles.
- `nutri-studio/` — o app novo: web app estático, JS puro (módulos ES), sem dependências e sem build. Dados no `localStorage` do navegador, com backup em JSON. Design system Votum (`src/ui/votum.css`): só paleta e tipografia, sem logotipo.
  - `npm test` → 1589 testes passando (`node --test "test/**/*.test.js"`).
  - `npm start` → abre em http://localhost:8080.

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

## Interrompido no meio (o limite de uso acabou) — revisar antes de usar

- `src/ui/alimentosCsv.js` + `test/alimentosCsv.test.js` (importação de tabela de alimentos por CSV)
- `src/ui/catalogo.js`
- `src/ui/paginas/alimentos.js`
- `armazenamento.js`: `salvarVarios`

Esses arquivos ainda **não foram testados no navegador** e a página de alimentos pode estar incompleta.

## Falta fazer

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

## Regras combinadas com o usuário (manter)

- **Não apagar nada sem consultar o usuário.**
- **Não copiar dados de pacientes do WebDiet.** A conta do WebDiet não deve ser usada nesta etapa; o relatório basta.
  - O paciente de teste "Teste Rea" (id 18236779) e os registros dele continuam na conta.
  - A exclusão depende do usuário.
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
5. Excluir o paciente de teste da conta do WebDiet.
