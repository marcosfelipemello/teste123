# Nutri Studio

Web app de consultório de nutrição, com pacientes, cálculo energético, antropometria (adultos e crianças), acompanhamento gestacional, planejamento alimentar, receitas, questionários de saúde e referências de micronutrientes.

Os cálculos reproduzem os do WebDiet, conforme o relatório [`docs/webdiet-analise.md`](../docs/webdiet-analise.md). Cada cálculo foi conferido contra os valores que a tela do WebDiet mostrou, guardados em [`docs/webdiet-evidencias/`](../docs/webdiet-evidencias/).

O app usa JavaScript puro (módulos ES), sem dependências e sem etapa de build.

## Como rodar

Precisa do Node 20 ou mais novo e de um navegador atual. O app usa módulos ES e importa JSON com `import … with { type: 'json' }`; foi testado no Chromium.

```sh
cd nutri-studio
npm start        # servidor estático em http://localhost:8080 (PORT=… muda a porta)
npm test         # testes dos cálculos e da camada de dados (node --test), sem navegador
```

Os módulos ES não carregam por `file://`, por isso o app precisa de um servidor. O `scripts/servidor.js` é um servidor estático mínimo, também sem dependências.

### Teste de ponta a ponta (navegador)

`scripts/ponta-a-ponta.mjs` abre o app no Chromium, em 1280 px e em 375 px de largura, e faz o seguinte:

1. cria pacientes e usa cada aba e cada página;
2. recarrega a página e confere que os dados persistiram;
3. confere que o console não tem erros e que nenhuma tela tem rolagem horizontal.

Os alimentos de teste são os da evidência do planejamento. Eles são importados por CSV só no navegador do teste e não fazem parte do app.

O Playwright **não** é dependência do projeto. Instale-o numa pasta fora do repositório:

```sh
mkdir /tmp/pw && (cd /tmp/pw && npm init -y && npm i playwright)
npm start &
PLAYWRIGHT=/tmp/pw/node_modules/playwright/index.mjs npm run e2e
# CHROMIUM=/caminho/do/chrome se o Playwright não achar o navegador; URL=… para outro endereço
```

Resultado atual: `npm test`: 1592 testes passando; `npm run e2e`: 94 de 94 conferências passando.

## O que o app faz

| Onde | O que faz | Relatório |
|---|---|---|
| Pacientes | Lista, busca, cadastro, ficha com abas | §2.2 |
| Ficha · Antropometria | Adultos e idosos (IMC, dobras, %G, fracionamento, CMB, RCQ, bioimpedância, Chumlea) e crianças/adolescentes (z-escores OMS, Slaughter), escolhidos pela idade na data da avaliação | §5, §6 |
| Ficha · Gestação (sexo F) | Classe pré-gestacional, curva de ganho de peso, avaliação da semana, percentis de CMB/DCT, aporte calórico | §7 |
| Ficha · Cálculo energético | 23 fórmulas, fator atividade, injúria, MET, programação de peso, GET manual, fórmula de bolso, adicional gestante; peso/altura/MLG da última antropometria | §4 |
| Ficha · Planejamento | Por alimentos (substitutos, metas, adequação, 27 micronutrientes × DRIs) e por equivalentes (15 grupos + avulsos); lista de compras; impressão | §8.3–§8.5, §8.8 |
| Ficha · Questionários | Os 10 questionários (Sinais e sintomas aparece como indisponível, ver abaixo) | §10 |
| Meus alimentos | Cadastro pelo rótulo, cadastro por 100 g, importação/exportação de tabelas em CSV, modelo para baixar | §8.7 |
| Receitas | Receitas calculadas; a receita salva vira alimento de origem "Receita" | §8.6 |
| Referências | DRIs por sexo, idade e condição, com a fonte de cada faixa; lista das divergências do WebDiet (§12) e do que o app faz | §8.10, §12 |
| Dados e backup | Backup completo em JSON; exportação e importação de pacientes (CSV/JSON) | — |

## Arquitetura

```
nutri-studio/
├── index.html            casca da página (menu e <main id="app">)
├── scripts/
│   ├── servidor.js       servidor estático (npm start)
│   └── ponta-a-ponta.mjs teste no navegador (npm run e2e)
├── src/
│   ├── calc/             cálculos: funções puras, sem DOM, testadas em test/
│   ├── dados/            tabelas: LMS da OMS, curvas de ganho de peso gestacional, DRIs
│   └── ui/               interface
│       ├── app.js        rotas por hash (#/pacientes, #/paciente/<id>/<aba>, …) e carga das páginas
│       ├── dom.js        h() (cria elementos; texto nunca vira HTML), campos, download, avisos
│       ├── armazenamento.js  dados no localStorage, com interface pequena para trocar por servidor
│       ├── importacao.js     CSV/JSON de pacientes
│       ├── alimentosCsv.js   CSV de alimentos (funções puras, testadas)
│       ├── catalogo.js       catálogo de alimentos + receitas e o seletor de alimento
│       ├── paginas/      páginas gerais: pacientes, alimentos, receitas, referências, dados
│       ├── abas/         abas da ficha (cada uma chama registrarAba ao ser importada)
│       └── votum.css     sistema visual (paleta e tipografia; claro e escuro)
└── test/                 node --test
```

- **Cálculo separado da tela.** Tudo o que tem número fica em `src/calc/`, em funções puras que devolvem os valores e os textos exatos da tela do WebDiet (campo `tela`). As abas só leem o formulário, chamam o cálculo e mostram o resultado. Os testes comparam `tela` com as evidências.
- **Páginas e abas se registram sozinhas.** `app.js` importa os módulos em `carregarExtras`. Cada página chama `registrarRota` e cada aba chama `registrarAba({id, rotulo, ordem, disponivel?, montar})`. Uma aba com erro de carga não derruba o app, e o erro vai para o console.
- **Dados.** Ficam numa chave do `localStorage` (`nutri-studio:v1`):
  - `pacientes[id].registros[tipo]`: `antropometria`, `gestacao`, `energia`, `planejamento` e `questionario`;
  - coleções gerais: `alimentos`, `receitas` e `equivalentes` (alimentos dos grupos de equivalentes).

  Planos e receitas guardam uma **cópia** de cada alimento usado. Assim, editar ou excluir um alimento depois não muda o que já foi prescrito.
- **Painel de resultados.** `abas/painel-resultados.js` é reaproveitado pelas abas. Ele atualiza só os textos que mudaram, para o leitor de tela anunciar apenas o que mudou.

## Política de erros

1. **Casos conferidos: igual ao WebDiet.** Com as entradas das evidências, os valores e os textos exibidos são os mesmos da tela do WebDiet, incluindo o arredondamento com `toFixed` e os valores intermediários arredondados (relatório §3).
2. **Onde o WebDiet trava ou fica vazio: `null` + `aviso`.** O app não repete a exceção nem deixa valor antigo na tela. Ele mostra "-" e um aviso em português. Exemplos:
   - EER/IOM 2005 infantil com exatamente 36 meses;
   - Henry & Rees abaixo de 3 anos;
   - aporte gestacional sem peso registrado.
3. **Erros e divergências do §12: iguais ao WebDiet.** Cada módulo lista os seus em `DIVERGENCIAS`, com o comportamento adotado, e a página **Referências** mostra todos. Isso vale também para os defeitos de exibição que não travam a tela:
   - aporte gestacional sem peso registrado ("+7431 Kcal/dia"), com um aviso de que o valor não tem sentido clínico;
   - rótulo "15 mg" do selênio de 0–6 meses;
   - receita substituta na lista de compras pelo nome de compra;
   - kcal do ingrediente da receita em dois formatos ("256Kcal" ao redesenhar, "117.6 Kcal" na linha recalculada).

   Onde há versão corrigida, ela fica disponível no cálculo com a opção `{ corrigir: true }`. Continuam diferentes do WebDiet:
   - os casos em que ele trava ou deixa valor antigo (item 2 acima);
   - "com/sem receitas" nos equivalentes (§12, item 26), porque o relatório não diz qual dos dois resultados o WebDiet dá ao ignorar a escolha;
   - o envio de `gorduratrans` no alimento pelo rótulo, que não muda nada na tela.
4. **Na interface:**
   - Entrada faltando não vira número sem sentido. Por exemplo, sem peso e altura a TMB não é calculada (no WebDiet, campo vazio vale 0).
   - Ações que apagam dados pedem confirmação.

## De onde vem cada dado

| Dado | Origem |
|---|---|
| Fórmulas, coeficientes, arredondamentos, classificações e textos de resultado | Relatório `docs/webdiet-analise.md`, conferido contra `docs/webdiet-evidencias/` |
| `src/dados/lms_oms_mensal.json` | Tabelas LMS mensais da OMS, como usadas pelo WebDiet (evidência de mesmo nome) |
| `src/dados/curvas_ganho_peso_gestacional.json` | Curvas brasileiras de ganho de peso gestacional (Kac et al., 2021), como usadas pelo WebDiet |
| `src/dados/dris.json` | DRIs (RDA/AI): 16 perfis conferidos na tela do WebDiet (`fonte: "webdiet-conferido"`); as faixas não observadas vêm das tabelas oficiais NASEM (Na e K de 2019; fibras pela Health Canada), com `fonte: "nasem-oficial"` |
| Alimentos | **Nenhuma tabela embutida.** A base do WebDiet não foi copiada (§1.2). Os alimentos entram pelo rótulo, por 100 g ou por CSV (TACO, TBCA, tabela própria) |
| Listas dos grupos de equivalentes | Montadas pelo consultório a partir de "Meus alimentos" (as listas curadas do WebDiet não foram copiadas). Grupo sem lista própria usa as médias padrão que o WebDiet mostra (`src/dados/equivalentes_padrao.json`, relatório §8.5), com os mesmos totais do WebDiet |
| Textos das perguntas dos questionários | **Não copiados.** Os itens aparecem como "Item n" + categoria |
| Base de sinais e sintomas → nutrientes | **Não copiada.** O questionário fica indisponível |

## Limitações conhecidas

- Os dados ficam só neste navegador. Faça backup com frequência (página "Dados e backup"). Não há login nem sincronização.
- O app não traz tabela de alimentos: antes de planejar, é preciso cadastrar ou importar os alimentos.
- Não foram reproduzidos:
  - planejamento qualitativo (texto livre);
  - piloto automático (modelos do WebDiet);
  - reescrita da lista de compras por IA;
  - PDF (há versão para impressão no navegador);
  - periodização;
  - HandyMET (a fórmula 24 existe, mas a TMB é digitada);
  - receitas "comuns" (só texto);
  - extensões pagas;
  - as abas sem cálculo do §11.
- Sinais e sintomas: o motor de contagem existe (`calc/questionarios/sinais.js`), mas falta a base sinal → nutrientes.
- Adequação no método por equivalentes: usa as regras do método por alimentos (§8.3) sobre os totais arredondados. A evidência do WebDiet para os equivalentes não mostra metas.
- Grupos de equivalentes com a média padrão do WebDiet não têm micronutrientes (só os macronutrientes das médias foram registrados) nem alimentos para a lista de compras.
- Meses de amamentação (EER 2023 lactante): são contados até a data do cálculo. O WebDiet usa "hoje", que é o mesmo nos casos conferidos.
