# Análise do WebDiet — ferramentas e cálculos

**Data da análise:** 13/10/2026 · **Versão observada:** painel `pt.webdiet.com.br/painel/v4`
**Método:** REA 6.4.0 (`rea-agents`) + Chromium 141 (headless, CDP) controlado por Playwright, com login na conta fornecida.

Este relatório é a base da Etapa 3. Ele registra **o que o WebDiet faz**: fórmulas, coeficientes, arredondamentos, classificações e textos de resultado. Também registra **como cada item foi conferido**. Cada cálculo marcado como *conferido na tela* foi reimplementado de forma independente e comparado, valor a valor, com o que a tela do WebDiet exibiu para entradas de teste. Os arquivos de evidência estão em [`docs/webdiet-evidencias/`](webdiet-evidencias/).

---

## Sumário

1. [Escopo, cuidados e limitações](#1-escopo-cuidados-e-limitações)
2. [Mapa de ferramentas](#2-mapa-de-ferramentas)
3. [Convenções numéricas do WebDiet](#3-convenções-numéricas-do-webdiet)
4. [Cálculo energético (TMB/GET)](#4-cálculo-energético-tmbget)
5. [Antropometria — adultos e idosos](#5-antropometria--adultos-e-idosos)
6. [Antropometria — crianças e adolescentes](#6-antropometria--crianças-e-adolescentes)
7. [Acompanhamento gestacional](#7-acompanhamento-gestacional)
8. [Planejamento alimentar](#8-planejamento-alimentar)
9. [Exames laboratoriais](#9-exames-laboratoriais)
10. [Questionários de saúde](#10-questionários-de-saúde)
11. [Demais módulos (sem cálculo)](#11-demais-módulos-sem-cálculo)
12. [Erros e inconsistências encontrados no WebDiet](#12-erros-e-inconsistências-encontrados-no-webdiet)
13. [Evidências e rastreabilidade (REA)](#13-evidências-e-rastreabilidade-rea)
14. [Pendências — o que não foi verificado](#14-pendências--o-que-não-foi-verificado)
15. [Lacunas encontradas na reconstrução](#15-lacunas-encontradas-na-reconstrução)

---

## 1. Escopo, cuidados e limitações

### 1.1 O que foi feito na conta

- **Nenhum dado de paciente real foi lido, copiado ou alterado.**
  - A captura da REA guardou apenas o código dos scripts. DOM, corpos de resposta JSON, textos de acessibilidade e chaves de armazenamento ficaram de fora, pela política da própria REA.
  - Antes de capturar, conferi que os scripts embutidos não traziam listas de pacientes. Os CPFs encontrados eram máscaras `000.000.000-00`.
  - A lista de pacientes só foi consultada com o filtro "TESTE REA".
- **Paciente de teste criado:** um único paciente, `Teste Rea` (id `18236779`), masculino, nascido em 15/06/1991, telefone fictício, sem e-mail e sem CPF. A mensagem de boas-vindas estava desativada (WhatsApp Connect inativo).
- **Atenção:** a conta já tinha **outro** paciente "Teste Rea" (id `18236776`, modificado às 02:07, antes do meu login). Ele **não foi criado nem tocado** por esta análise.
- **Registros criados dentro do paciente de teste** (todos fictícios), para abrir cada ferramenta:
  - 1 cálculo energético
  - 2 antropometrias (adulto; infantil retroativa com data de 15/12/1999)
  - 1 acompanhamento gestacional (dados pré-gestacionais editados várias vezes pela tela)
  - 2 planejamentos alimentares (por alimentos e por equivalentes)
  - 1 registro de exames
  - 10 questionários de saúde
- **Nada foi apagado.**
- **Testes com outros sexos e idades:** para não criar outros pacientes, o sexo, o nascimento ou a idade foram trocados **apenas na memória do navegador**, no objeto do paciente de teste. Nada disso foi salvo. O cálculo continua sendo feito pelo próprio código do WebDiet.
- **Exceções na segunda passada** (só no paciente de teste):
  - **Referências de micronutrientes (§8.10).** Elas vêm do servidor, então a troca na memória não bastava. O cadastro do paciente de teste foi **salvo 15 vezes** com outro sexo, nascimento ou condição (gestante/lactante). Depois foi **restaurado** para masculino, 15/06/1991.
  - **Antropometria de adulto (§5.1).** A data da avaliação de teste foi trocada para 13/10/2000 e depois **restaurada** para 13/10/2026.
  - **Questionários.** Os 10 questionários de teste foram respondidos várias vezes, porque a página salva sozinha. A última resposta de cada um ficou gravada.
  - **Receita e alimento próprio (§8.6, §8.7).** Nada foi salvo. A receita foi montada no editor e fechada sem salvar. No alimento próprio, o envio (`api/salvarFavorito.php`) foi **bloqueado** no navegador.
  - **Financeiro e extensões pagas:** não foram usados (§10, §11).

### 1.2 O que não foi copiado

- **Base de alimentos:** 27.998 itens, compilada pelo WebDiet. Só a estrutura foi registrada.
- **Listas curadas de equivalentes.** Só as médias por grupo foram registradas.
- **Textos autorais:** explicações dos 196 exames, condutas, base de "sinais e sintomas", modelos de prescrição, receitas e cursos.
- Pelos Termos de Uso, isso é conteúdo protegido do WebDiet. O app novo deve usar fontes públicas (TACO/TBCA oficiais, OMS, DRIs do IOM) ou conteúdo próprio.

### 1.3 Termos de Uso

- Os Termos de Uso do WebDiet (cláusulas "Vedação ao uso e manipulação de código", "Vedação ao Robot" e seção 9) proíbem engenharia reversa e acesso automatizado.
- O responsável pelo projeto foi informado e decidiu prosseguir. A titular da conta assume o risco de suspensão.
- As fórmulas registradas aqui são, em sua maioria, equações científicas publicadas (as referências estão em cada seção).

### 1.4 Limitações gerais

- Alguns valores vêm prontos do servidor, e o cálculo deles não é visível:
  - idade na antropometria;
  - referências de micronutrientes por idade e sexo;
  - lista de alimentos;
  - divisão de parcelas no financeiro.
- Esses casos estão marcados como **"servidor"**. Os dois primeiros foram conferidos pelo resultado na tela: a idade em §5.1 e as referências em §8.10.

---

## 2. Mapa de ferramentas

### 2.1 Menu principal (topo)

| Grupo | Itens |
|---|---|
| Consultório | Pacientes · Agendamentos · Pré-consulta · Respostas pré-consulta · Meus favoritos · Meus alimentos · Receitas culinárias · Diário alimentar · Financeiro · Impressos · Lixeira |
| Estudos | Lâminas · Cursos completos · WebDiet Cast · Biblioteca científica · Casos clínicos · Pasta compartilhada · E-books · Blog |
| Marketing | WebDiet canvas · Mensagens do sistema · Modelos de mensagens · Benefícios para pacientes · NutriLinks · Criador de site · Mailing captado |
| Ferramentas | Videochamada · MoveHealth · Estatísticas · Benefícios para você · NutriValoriza · Ver chat |
| Suporte | WhatsApp · Vídeos tutoriais · Agendar treinamento · Contatos |
| Atalhos (+) | nova tarefa · novo paciente · novo agendamento · novo registro financeiro · novo questionário · novo arquivo no cloud |

Itens do menu com cálculo: **Receitas culinárias** (§8.6), **Meus alimentos** (§8.7) e **Financeiro** (parcelas no servidor, §11).

### 2.2 Ficha do paciente (21 abas)

| Aba | O que faz | Tem cálculo? | Seção |
|---|---|---|---|
| Perfil do paciente | Dados básicos, fluxo de consulta, ajustes do app, diário alimentar, reações a refeições, resumo | não | §11 |
| Fármaco-nutrientes | Medicamentos em uso → orientações (análise) | não (base/IA) | §11 |
| Acompanhamento | Gráficos vindos do app: nutrientes, atividade física, peso, ingestão hídrica | não | §11 |
| Avaliação integrada (360) | Avaliação consolidada | não identificado | §14 |
| Histórico de consultas | Registro de consultas (alimenta "Estatísticas") | não | §11 |
| Anamnese geral | Modelos de anamnese (WebDiet ou próprios), importação da pré-consulta | não | §11 |
| Questionários de saúde | 10 questionários criáveis + 7 de outros fluxos | **sim** | §10 |
| Exames laboratoriais | Pedido, anexos em PDF (interpretação por IA), registro baixo/normal/alto | laudo textual | §9 |
| Evolução fotográfica | Fotos frente, costas, direita e esquerda; comparação | não | §11 |
| Antropometria geral | Adultos/idosos, crianças/adolescentes, PDF externo, Body3D | **sim** | §5, §6 |
| Acompanhamento gestacional | Curvas de ganho de peso, conduta, aporte calórico | **sim** | §7 |
| Cálculo energético | TMB/GET por 23 protocolos documentados (a primeira contagem dizia 26; ver §15.1) + injúria, MET, programação de peso, adicional gestante | **sim** | §4 |
| Planejamento alimentar | Por alimentos, por equivalentes ou qualitativo; PDF; periodização | **sim** | §8 |
| Suplementos e produtos | Lista de produtos (marketplace) | não | §11 |
| Prescrição de metas | Metas com check-in no app | não | §11 |
| Prescrição de manipulados | Fórmulas manipuladas | não | §11 |
| Orientações nutricionais | Listas e orientações | não | §11 |
| Arquivos anexos | Arquivos e lâminas | não | §11 |
| Prontuário do paciente | Registro técnico | não | §11 |
| Atestados e receituários | Documentos | não | §11 |
| Recibos e financeiro | Lançamentos e recibos do paciente | não | §11 |

O inventário visível de cada aba está em `webdiet-evidencias/inventario_abas_paciente.json`.

---

## 3. Convenções numéricas do WebDiet

Estas convenções valem para todos os cálculos e precisam ser reproduzidas exatamente para dar os mesmos números.

| Convenção | Detalhe |
|---|---|
| Leitura de números | `check(v)`: `NaN`, `""` ou não finito → `0`; senão `parseFloat(v)`. Vírgula vira ponto ao digitar. |
| Arredondamento | Sempre `Number.prototype.toFixed` do JavaScript. É meio-para-cima sobre o valor binário: `(1.005).toFixed(2) = "1.00"`, `(31.25).toFixed(1) = "31.3"`. O app novo deve usar `toFixed` do JS, não `Math.round` decimal. |
| Valores intermediários arredondados | Vários cálculos usam um valor **já exibido/arredondado** como entrada do passo seguinte: TMB → GET (§4.3), IMC → classificação (§5.2), IMC → z-score (§6.2), peso do alimento → totais (§8.3). |
| Idade | Anos completos na **data do exame/avaliação**: `ano2-ano1`, menos 1 se o mês ou dia ainda não chegou. Meses: `anos*12 + meses`, menos 1 se `dia2 < dia1`. |
| Data "de hoje" | Vem do servidor (ex.: `moment("13/10/2026")`), não do relógio do navegador. |
| Sexo | Nas tabelas deste relatório, **H = homens e M = mulheres**. Nos arquivos de evidência, o campo `sexo` usa **"M" = masculino e "F" = feminino**. |

---

## 4. Cálculo energético (TMB/GET)

**Status: conferido na tela.** Foram 110 casos (adultos, idosos, crianças, gestantes e lactantes; ambos os sexos) com **110/110 iguais** em TMB, GET e kcal/kg. Mais 4 testes de adicionais.

- Evidência: `tela_energia.json` e `tela_energia_extras.json`
- Script: inline em `pacientes.php`; REA `ev_2c8f9607…`

### 4.1 Entradas

- Peso (kg), altura (cm), MLG (massa livre de gordura, kg) e data do exame. A idade é calculada na data do exame.
- Fórmula, fator atividade, fator injúria e adicionais: MET, programação de peso (VENTA) e gestante.
- É possível importar peso, altura e MLG de uma antropometria (adulto, infantil ou gestante).
  - Se a avaliação tiver MLG por dobras **e** por bioimpedância, o sistema pergunta qual usar.
  - Importando de uma gestante, a idade gestacional é calculada pela DUM.

### 4.2 Fórmulas de TMB

Notação: `P` = peso (kg), `A` = altura (cm), `Am` = altura (m), `I` = idade (anos), `Im` = idade (meses), `MLG` em kg.

| Valor | Rótulo na tela | Equação (TMB, kcal/dia) |
|---|---|---|
| 1 | Harris-Benedict (1919) | **H:** 66,4730 + 13,7516P + 5,0033A − 6,7550I · **M:** 655,0955 + 9,5634P + 1,8494A − 4,6756I |
| 2 | Harris-Benedict (1984) | **H:** 88,362 + 13,397P + 4,799A − 5,677I · **M:** 447,593 + 9,247P + 3,098A − 4,330I |
| 3 | Katch-McArdle (1996) | 370 + 21,6·MLG (MLG = 0 → "Massa livre de gordura em branco") |
| 4 | Cunningham (1980) | 500 + 22·MLG |
| 6 | Mifflin-St Jeor (1990) | 9,99P + 6,25A − 4,92I **+5 (H)** / **−161 (M)** (no código: `+166−161`) |
| 7 | Mifflin-St Jeor por MLG | 19,7·MLG + 413 |
| 8 | FAO/WHO (2004) | Schofield/FAO-OMS-ONU (ver 4.2.1) |
| 9 | Henry & Rees (1991) | (a·P + b) × 239 (ver 4.2.2) |
| 12 | Tinsley por peso (2018) | 24,8P + 10 |
| 13 | Tinsley por MLG (2018) | 25,9·MLG + 284 |
| 14 | TMB manual | valor digitado |
| 22 | FAO/WHO (2004) infantil | mesmas equações da 8 |
| 23 | Schofield (1985) infantil | ver 4.2.3 |
| 25 | Min. Saúde – Gestante (2005) | >10–18a: 12,2P + 746 · >18–30: 14,7P + 496 · >30–60: 8,7P + 829 · >60: 10,5P + 596 |
| 21 | EER/IOM (2005) infantil | TMB só até 36 meses: (89P − 100) + **175** (≤3m) / **56** (>3–6m) / **22** (>6–12m) / **20** (>12–36m); >36m "Não aplicável" |
| 5, 26–29 | EER (IOM 2005 / 2023) | TMB "Não aplicável": a equação dá o GET direto (4.4) |
| 10, 11, 24 | GET manual, fórmula de bolso, HandyMET | ver 4.5 |

#### 4.2.1 FAO/WHO (fórmulas 8 e 22)

As faixas usam a idade `I` em anos completos.

| Faixa | Mulheres | Homens |
|---|---|---|
| I ≤ 3 | 58,317P − 31,1 | 59,512P − 30,4 |
| 3 < I ≤ 10 | 20,315P + 485,9 | 22,706P + 504,3 |
| 10 < I ≤ 18 | 13,384P + 692,6 | 17,686P + 658,2 |
| 18 < I ≤ 30 | 14,818P + 486,6 | 15,057P + 692,2 |
| 30 < I ≤ 60 | 8,126P + 845,6 | 11,472P + 873,1 |
| I > 60 | 9,082P + 658,5 | 11,711P + 587,7 |

#### 4.2.2 Henry & Rees (fórmula 9)

| Faixa | Mulheres | Homens |
|---|---|---|
| 3 ≤ I ≤ 10 | 0,063P + 2,466 | 0,113P + 1,689 |
| 10 < I ≤ 18 | 0,047P + 2,951 | 0,084P + 2,122 |
| 18 < I ≤ 30 | 0,048P + 2,562 | 0,056P + 2,800 |
| I > 30 | 0,048P + 2,448 | 0,046P + 3,160 |

O resultado é multiplicado por 239. Abaixo de 3 anos não há equação: a TMB não é recalculada e fica o valor anterior (ver §12).

#### 4.2.3 Schofield infantil (fórmula 23)

| Faixa | Mulheres | Homens |
|---|---|---|
| I ≤ 3 | 16,252P + 10,232A − 413,5 | 0,167P + 15,174A − 617,6 |
| 3 < I ≤ 10 | 16,969P + 161,08Am + 371,2 | 19,59P + 130,3Am + 414,9 |
| 10 < I ≤ 18 | 8,365P + 465Am + 200 | 16,25P + 137,2Am + 515,5 |

### 4.3 GET e arredondamento

- **TMB exibida:** `basal.toFixed(0) + " Kcal/dia"`. kcal/kg da TMB = `(basal / P).toFixed(1)`, usando a TMB **sem** arredondar.
- **GET padrão:** `GET = TMB_exibida(inteira) × fator_atividade × fator_injúria + MET + VENTA + adicional_gestante`.
  - Atenção: o GET usa a **TMB já arredondada para inteiro** (lida do texto da tela).
  - Isso foi comprovado: com a TMB não arredondada, 11 dos 110 casos dariam GET diferente. Exemplo: Harris-Benedict 1919, mulher, 35 anos, 62,5 kg, 163 cm, fator 1,55 → tela 2156; sem arredondar seria 2155.
- **Exibição:** `GET.toFixed(0) + " Kcal/dia"`; kcal/kg = `(GET / P).toFixed(1)` (GET sem arredondar).
- **HandyMET (24):** `GET = TMB×fator×injúria + 0,1×TMB + adicionais`.
- **Min. Saúde gestante (25):** `TMB×fator×injúria + adicionais`.

### 4.4 Equações de GET direto (EER)

#### 4.4.1 EER/IOM 2005 adulto (fórmula 5)

- **H:** GET = [662 − 9,53I + fator × (15,91P + 539,6Am)] × injúria + VENTA + MET + gestante
- **M:** GET = [354 − 6,91I + fator × (9,36P + 726Am)] × injúria + …
- Fatores — H: 1,00 / 1,11 / 1,25 / 1,48 · M: 1,00 / 1,12 / 1,27 / 1,45.

#### 4.4.2 EER/IOM 2005 infantil (fórmula 21)

| Idade | GET |
|---|---|
| Im < 36 | TMB × fator × injúria + VENTA (fator "Não se aplica" = 1) |
| 36 < Im ≤ 96 | **M:** 135,3 − 30,8I + fator·injúria·(10P + 934Am) + 20 + VENTA · **H:** 88,5 − 61,9I + fator·injúria·(26,7P + 903Am) + 20 + VENTA |
| Im > 96 | iguais, com **+25** no lugar de +20 |
| Im = 36 exato | nenhum ramo → exceção de JS na tela (§12) |

Fatores para mais de 36 meses — H: 1,00 / 1,13 / 1,26 / 1,42 · M: 1,00 / 1,16 / 1,31 / 1,56.

#### 4.4.3 EER 2023 adultos, ≥ 19 anos (fórmula 26)

O "fator" é uma categoria de 1 a 4. Os rótulos na tela são 1,4 Inativo / 1,6 Pouco ativo / 1,75 Ativo / 2,05 Muito ativo.

| Categoria | Homens | Mulheres |
|---|---|---|
| 1 | 753,07 − 10,83I + 6,50A + 14,10P | 584,90 − 7,01I + 5,72A + 11,71P |
| 2 | 581,47 − 10,83I + 8,30A + 14,94P | 575,77 − 7,01I + 6,60A + 12,14P |
| 3 | 1004,82 − 10,83I + 6,52A + 15,91P | 710,25 − 7,01I + 6,54A + 12,34P |
| 4 | −517,88 − 10,83I + 15,61A + 19,11P | 511,83 − 7,01I + 9,07A + 12,56P |

O resultado é multiplicado pela injúria e somado a VENTA + MET + gestante.

#### 4.4.4 EER 2023 infantil (fórmula 27)

**0 a 2,99 anos.** O termo de idade usa `I` em **anos**. A tabela de equações da Health Canada para a NASEM 2023 também usa idade em anos, estatura em cm e peso em kg, com as mesmas constantes +200 / +50 / +20 dos meninos. Ver §12, item 4.

| Faixa | Meninos | Meninas |
|---|---|---|
| 0–2,99 m | −716,45 − 1,00I + 17,82A + 15,06P + **200** | −69,15 + 80,0I + 2,65A + 54,15P + **180** |
| 3–5,99 m | idem + **50** | idem + **60** |
| 6 m – 2,99 a | idem + **20** | idem + custo energético |

Custo energético das meninas: 6–11,99 m = 20; 12–35,99 m = 15. Nesta faixa a categoria de atividade não altera o resultado.

**3 a 13,99 anos** (categoria 1–4), mais o custo energético:

| Categoria | Meninos | Meninas |
|---|---|---|
| 1 | −447,51 + 3,68I + 13,01A + 13,15P | 55,59 − 22,25I + 8,43A + 17,07P |
| 2 | 19,12 + 3,68I + 8,62A + 20,28P | −297,54 − 22,25I + 12,77A + 14,73P |
| 3 | −388,19 + 3,68I + 12,66A + 20,46P | −189,55 − 22,25I + 11,74A + 18,34P |
| 4 | −671,75 + 3,68I + 15,38A + 23,25P | −709,59 − 22,25I + 18,22A + 14,25P |

Custo energético por idade:

| Idade | Meninos | Meninas |
|---|---|---|
| 3 a | 20 | 15 |
| 4–8 a | 15 | 15 |
| 9–13 a | 25 | 30 |

**14 a 18,99 anos:** mesmas equações, com **+20** fixo.

#### 4.4.5 EER 2023 gestante (fórmula 28)

- Exige a idade gestacional `S` (semanas) e o estado nutricional.
- Com S = 0, aparece um aviso pedindo os dados.
- Com S ≤ 13: "Para o 1º trimestre de gravidez, deve ser usada a equação de predição de EER não grávida. Assume-se que a disposição de energia é insignificante e, portanto, ignorada."

| Categoria | Equação |
|---|---|
| 1 | 1131,20 − 2,04I + 0,34A + 12,15P + 9,16S |
| 2 | 693,35 − 2,04I + 5,73A + 10,20P + 9,16S |
| 3 | −223,84 − 2,04I + 13,23A + 8,15P + 9,16S |
| 4 | −779,72 − 2,04I + 18,45A + 8,73P + 9,16S |

- Some **disposição de energia × injúria** (precedência do código, ver §12): Baixo peso 300 · Saudável 200 · Sobrepeso 150 · Obesidade −50.
- Depois some VENTA e MET.
- O estado nutricional pode ser importado da antropometria da gestante.

#### 4.4.6 EER 2023 lactante (fórmula 29)

- **Meses de amamentação** = `(ano_atual − ano_parto)×12 + (mês_atual − mês_parto)`. Com mais de 12 meses, aparece uma mensagem de erro.
- **0–6 meses:** equação EER adulta feminina da categoria (§4.4.3) + 540 − 140×injúria + VENTA + MET + gestante. Abaixo de 19 anos, usa a equação feminina de 3–18 anos (§4.4.4).
- **7–12 meses:** mesma base + 380×injúria + …
- Rótulos dos fatores: 1,4 / 1,5 / 1,6 / 2,05.

### 4.5 GET manual, fórmula de bolso e HandyMET

- **GET manual (10):** digita kcal ou kcal/kg.
  - kcal/kg = `(GET/P).toFixed(1)`; kcal = `(kcal/kg × P).toFixed(0)`.
  - Depois, `GET × fator × injúria + adicionais`.
  - Conferido: 33 kcal/kg × 80 → 2640; 2500/80 → "31.3"; com fator 1,2 → 3000.
- **Fórmula de bolso (11):** GET = (PTN g/kg × P × 4) + (LIP g/kg × P × 9) + (CHO g/kg × P × 4).
  - Mostra `GET.toFixed(0)` e `(GET.toFixed(0) / P).toFixed(1)` kcal/kg. Fator fixo "1".
  - Conferido: PTN 2 / CHO 4,5 / LIP 1 com 80 kg → 2800 kcal (35,0 kcal/kg).
- **HandyMET (24):** integração externa. Importa exame, data, peso, altura, %gordura, %carboidrato, RER, TMB e estilo de vida.

### 4.6 Fatores

**Fator atividade padrão** (fórmulas 1, 2, 4, 6, 7, 9, 10, 12, 13, 14, 23 e vazio): 1,000 Não utilizar · 1,200 Sedentário · 1,375 Leve · 1,550 Moderada · 1,725 Intensa · 1,900 Muito intensa.

| Fórmula | Fatores |
|---|---|
| 3 (Katch-McArdle) e 5 (EER 2005) | H 1,00 / 1,11 / 1,25 / 1,48 · M 1,00 / 1,12 / 1,27 / 1,45 |
| 8 (FAO) | FAO 2004: 1,55 / 1,85 / 2,20 · FAO 1985: H 1,55 / 1,80 / 2,10; M 1,56 / 1,64 / 1,82 |
| 11 | "Não aplicável" (1) |
| 24 | 1,0 / 1,2 / 1,5 / 1,7 / 2,1 |
| 25 | 1,0 / 1,56 / 1,64 / 1,82 |

**Fator injúria.** O valor que entra na conta é o atributo `calculo` da opção.

- "Não utilizar": 1,0
- **Harris-Benedict (1919):**
  - Não complicado 1,0 · Pós-operatório de câncer 1,1 · Fratura 1,2 · Sepse 1,3 · Peritonite 1,4
  - Multitrauma + reabilitação 1,5 · Multitrauma + sepse 1,6
  - Queimadura: até 20% 1,25 · 30–50% 1,7 · 50–70% 1,8 · 70–90% 2,0 · **100%: rótulo "2.100", mas usa 2,0**
- **Long (1979):**
  - Câncer 1,27 · Cirurgia eletiva 1,1 · Desnutrição grave 1,5
  - Doença cardiopulmonar 0,9 · Doença cardiopulmonar com cirurgia 1,42
  - Fraturas múltiplas 1,27 · Infecção grave 1,32 · Insuficiência cardíaca 1,4 · Insuficiência hepática 1,42 · Insuficiência renal aguda 1,3
  - Jejum 0,9 · Pancreatite 1,55 · Pequena cirurgia 1,2 · Pequeno trauma de tecido 1,25
  - Pós-operatório: cirurgia cardíaca 1,35 · geral 1,25 · torácico 1,35
  - Sepse 1,6 · Transplante de fígado 1,35 · Transplante de medula óssea 1,25

### 4.7 Adicionais

- **MET:** `adicional = Σ (minutos × peso × MET / 60)`, exibido com `toFixed(0)`.
  - A lista de atividades segue o Compendium de Atividades Físicas (lista atual + lista antiga quando já usada).
  - Conferido: 30 min de MET 6,0 + 45 min de MET 3,0, com 80 kg → 240 + 180 = **420 kcal/dia**.
- **Programação de peso (VENTA):** 1 kg = **7700 kcal**.
  - `kcal/dia = (peso_desejado − peso) × 7700 / dias`.
  - Controle de peso: ±20% do peso atual. Dias: 0–180 (padrão 90). Sem peso, usa 50 kg.
  - A tela **mostra** `toFixed(0)`, mas **aplica** `parseInt` (trunca).
  - Conferido: 80 → 75 kg em 60 dias mostra "(-642 Kcal/dia)" e aplica −641. 83,3 kg em 45 d: +565 / +564. 72,7 kg em 90 d: −625 / −624.
- **Adicional gestante:** digitado ou importado do acompanhamento gestacional ("usar aporte", §7.6).
  - Com idade gestacional acima de 13 semanas na EER 2023, aparece o aviso: "A fórmula EER 2023 já considera o adicional energético…".

### 4.8 Exemplos conferidos (tela = cálculo)

Paciente de 35 anos, data do exame 13/10/2026.

| Caso | Entrada | TMB | GET |
|---|---|---|---|
| E01 | HB1919, H, 80 kg, 175 cm, fator 1,55 | 1806 (22,6 kcal/kg) | 2799 (35,0) |
| E02 | HB1984, H, idem | 1801 | 2792 |
| E05 | Mifflin, H, idem | 1726 | 2675 |
| E11 | EER 2005, H, fator 1,25 | não aplicável | 3100 |
| E12–E15 | EER 2023, H, categorias 1–4 | — | 2640 / 2850 / 3040 / 3364 |
| E31 | HB1984, H, fator 1,2, injúria sepse (1,3) | 1801 | 2810 |
| E46–E49 | EER 2023 gestante, 24 sem, 68 kg, 165 cm, cat. 2, por estado nutricional | — | 2791 / 2691 / 2641 / 2441 |
| E108 | EER/IOM 2005 infantil, exatamente 36 meses | — | exceção de JS |

A lista completa (110 casos) está em `tela_energia.json`.

---

## 5. Antropometria — adultos e idosos

**Status: conferido na tela.** Foram 65 casos × 19 saídas = **1235/1235 iguais**, mais 4 estimativas e 4 cálculos automáticos de bioimpedância.

- Evidência: `tela_antropometria_adultos.json`
- Página: `antropometria.php`; REA `ev_b606b698…`

### 5.1 Geral

- **Idade e sexo:** vêm do servidor (`window.idade`). **Conferido na tela:** a idade é calculada na **data da avaliação**, em anos completos.
  - Paciente de teste nascido em 15/06/1991, avaliação com data trocada para 13/10/2000: `idade = 9`. Com a data 13/10/2026: `idade = 35`.
  - A data da avaliação de teste foi restaurada depois.
  - Portanto, uma avaliação antiga continua com a idade daquela época. Isso afeta todas as fórmulas que usam idade: classificação do IMC em ≥ 60 anos, %G, RCQ, Chumlea e CMB.
- **Padrões:** % de gordura por **Brozek**; braço para a CMB **esquerdo**.
- **Salvamento:** a cada 60 s.
- **Campos aceitos:**
  - Peso, estatura, estatura sentado, altura do joelho.
  - 10 dobras: tricipital, bicipital, abdominal, subescapular, axilar média, coxa, torácica, suprailíaca, panturrilha, supraespinhal.
  - Circunferências: pescoço, tórax, ombro, cintura, quadril, abdômen; braço relaxado e contraído, antebraço, coxa proximal/medial/distal e panturrilha (esquerda e direita).
  - Diâmetros: úmero, punho, fêmur.
  - Bioimpedância: %G, massa gorda, massa magra, MLG, peso ósseo, gordura visceral, água, idade metabólica, %massa magra.

### 5.2 IMC e peso ideal

- **IMC** = `peso / alt_m²` → `toFixed(1)` (texto). **A classificação usa o valor arredondado.**
  - Conferido: 56,6 kg / 175 cm = 18,48 → "18.5" → **Eutrófico**. 91,8 kg → 29,98 → "30.0" → **Obesidade grau 1**.
- **Classificação abaixo de 60 anos:**

  | IMC | Classe |
  |---|---|
  | [1; 18,5) | Baixo peso |
  | [18,5; 25) | Eutrófico |
  | [25; 30) | Sobrepeso |
  | [30; 35) | Obesidade grau 1 |
  | [35; 40) | Obesidade grau 2 |
  | [40; 100) | Obesidade grau 3 |
  | ≥ 100 | "Verifique altura e peso" |

- **A partir de 60 anos:** [1; 22) Baixo peso · [22; 27) Peso adequado · [27; 100) Sobrepeso.
- **Peso ideal:** abaixo de 60 anos, 18,5 a 24,9 × alt². A partir de 60, 22 a 27 × alt². Formato "x.x a y.yKg".

### 5.3 Estimativas (Chumlea)

`AJ` = altura do joelho (cm), `CB` = circunferência do braço, `CP` = circunferência da panturrilha, `DSE` = dobra subescapular, `I` = idade.

- **Estatura** (só com AJ > 10), resultado `toFixed(0)`:
  - H: 64,19 − 0,04I + 2,02AJ
  - M: 84,88 − 0,24I + 1,83AJ
- **Peso de acamado**, como está no código, resultado `toFixed(1)`:
  - H: 0,98CB + 1,27CP + 0,40DSE + 0,87AJ − 62,35
  - M: 1,73CB + 0,98CP + 0,37DSE + 1,16AJ − 81,69
  - Exige DSE, CB esquerdo, CP e AJ; senão mostra "Dados incompletos!".
  - Ver §12, item 10. Na forma em que estas equações costumam ser citadas (Chumlea 1988), a de coeficiente −81,69 é a **masculina** e a de −62,35 é a **feminina**. No WebDiet está ao contrário. O artigo original não foi consultado.

### 5.4 Composição corporal por dobras

**Somatórios (mm):**

| Protocolo | Mulheres | Homens |
|---|---|---|
| Pollock 7 | TR + SE + CX + AX + SI + TO + AB | igual |
| Pollock 3 | TR + CX + SI | TO + AB + CX |
| Guedes | SE + CX + SI | TR + AB + SI |
| Petroski | AX + CX + SI + PA | TR + SE + SI + PA |
| Durnin & Womersley | TR + SE + BI + SI | igual |
| Faulkner | TR + SE + AB + SI | igual |

**Densidade corporal (g/mL):**

| Protocolo | Mulheres | Homens |
|---|---|---|
| Pollock 7 (F 1989 / H 1978) | 1,097 − 0,00046971S + 0,00000056S² − 0,00012828I | 1,112 − 0,00043499S + 0,00000055S² − 0,00028826I |
| Pollock 3 | **1,099421** − 0,0009929S + 0,0000023S² − 0,0001392I | 1,10938 − 0,0008267S + 0,0000016S² − 0,0002574I |
| Guedes (1994) | 1,16650 − 0,07063·log10 S | 1,1714 − 0,0671·log10 S |
| Petroski (1995) | 1,19547130 − 0,07513507·log10 S − 0,00041072I | 1,10726863 − 0,00081201S + 0,00000212S² − 0,00041761I |
| Durnin & Womersley (1974) | 1,1567 − 0,0717·log10 S | 1,1765 − 0,0744·log10 S |

**% de gordura:**

- Siri (1961): `(4,95/D − 4,5) × 100`
- Brozek (1963, padrão): `(4,57/D − 4,142) × 100`
- Faulkner (1968): `%G = S × 0,153 + 5,783`, sem densidade

**Saídas:**

- %G `toFixed(1)`; peso gordo = P × %G / 100 (`toFixed(1)`); MLG = P − peso gordo (`toFixed(1)`).
- Densidade `toFixed(3)` "Kg/L".
- Σ `toFixed(2)` mm. Exceção: Petroski e Guedes masculinos mostram o número cru.
- Opção "nenhuma": mostra só a soma das 10 dobras.
- Rótulos: "Pollock 7, 1978" (H) / "Pollock 7, 1989" (M); idem Pollock 3; "Faulkner, 1968"; "Guedes, 1994"; "Petroski, 1995"; "Durnin & Womersley, 1974".

### 5.5 Classificação do % de gordura

Usa o %G **sem arredondar**. A mesma tabela vale para dobras e para bioimpedância.

- Rótulos, na ordem: Excessivamente baixa · Excelente · Adequada · Elevada · Moderadamente alta · Alta · Muito alta · Excessivamente alta.
- Abaixo de 16 anos: "N/D Verif. Idade mínima".
- Acima de 65 anos: sem classificação (texto vazio; a referência anterior continua na tela).

Limites superiores (≤) de cada rótulo; acima do último → "Excessivamente alta":

| Faixa | Mulheres (limites) | Ref. M | Homens (limites) | Ref. H |
|---|---|---|---|---|
| 16–25 | 13, 16, 19, 22, 25, 28, 31 | 13–19% | 4, 6, 10, 13, 16, 20, 24 | 4–10% |
| 26–35 | 14, 16, 20, 23, 25, 29, 33 | 14–20% | 8, 11, 15, 18, 20, 22, 24 | 8–15% |
| 36–45 | 16, 19, 23, 26, 29, 32, 36 | 16–23% | 10, 14, 18, 21, 23, 25, 29 | 10–18% |
| 46–55 | 17, 21, 25, 28, 31, 34, 38 | 17–25% | 12, 16, 20, 23, 25, 27, 30 | 12–20% |
| 56–65 | 18, 22, 26, 29, 32, 35, 38 | 18–26% | 13, 18, 21, 23, 25, 27, 30 | 13–21% |

A classificação pode ser personalizada pela nutricionista ("Personalize a classificação").

### 5.6 Fracionamento e outros índices

- **Peso ósseo** (Von Döbeln, modificado por Rocha): `3,02 × (alt_m² × punho_m × fêmur_m × 400)^0,712`, `toFixed(1)`. Exige estatura, punho e fêmur.
- **Peso residual** (Würch): M 0,209 × P; H 0,241 × P (`toFixed(1)`).
- **Peso muscular:** P − residual − gordo − ósseo, usando os **textos já arredondados**. Só aparece se os três existirem.
- **CMB** = CB (lado escolhido) − DCT × 0,314 → `toFixed(1)` cm. Adequação = CMB / p50 × 100 (`toFixed(1)`%).
  - Classes: < 70 Desnutrição Grave · 70–80 Moderada · 80–90 Leve · ≥ 90 Eutrófico.
  - p50 por idade (M / H):

    | Idade | M | H | Idade | M | H |
    |---|---|---|---|---|---|
    | 1 | 12,4 | 12,7 | 12 | 19,1 | 19,5 |
    | 2 | 12,6 | 13 | 13 | 19,8 | 21,1 |
    | 3 | 13,2 | 13,7 | 14 | 20,1 | 22,1 |
    | 4 | **11** | 14,1 | 15 | 20,2 | 23,7 |
    | 5 | 14,2 | 14,7 | 16 | 20,2 | 24,9 |
    | 6 | 14,5 | 15,1 | 17 | 20,5 | 25,8 |
    | 7 | 15,1 | 16 | 18 | 20,2 | 26,4 |
    | 8 | 16 | 16,2 | 19–25 | 20,7 | 27,3 |
    | 9 | 16,7 | 17 | >25–35 | 21,2 | 27,9 |
    | 10 | 17 | 18 | >35–45 | 21,8 | 28,6 |
    | 11 | 18,1 | 18,3 | >45–55 | 22 | 28,1 |
    | | | | >55–65 | 22,5 | 27,8 |
    | | | | >65 | 22,5 | 26,8 |

- **RCQ** = cintura / quadril (`toFixed(2)`). Risco (Bray & Gray), com limites para baixo < a, moderado < b, alto < c, muito alto ≥ c:

  | Idade | H (a / b / c) | M (a / b / c) |
  |---|---|---|
  | ≤ 29 | 0,83 / 0,89 / 0,94 | 0,71 / 0,78 / 0,82 |
  | 30–39 | 0,84 / 0,91 / 0,96 | 0,72 / 0,79 / 0,84 |
  | 40–49 | 0,88 / 0,96 / 1,00 | 0,73 / 0,80 / 0,87 |
  | 50–59 | 0,90 / 0,97 / 1,02 | 0,74 / 0,82 / 0,88 |
  | 60–69 | 0,91 / 0,99 / 1,03 | 0,76 / 0,84 / 0,90 |

  A partir de 70 anos não há classificação (fica a anterior).
- **Bioimpedância, preenchimento automático:**
  - %G → massa gorda = P × %/100 e MLG = P × (1 − %).
  - Massa gorda → %G = MG/P × 100 e MLG.
  - %massa magra ↔ massa magra.
  - Tudo `toFixed(1)`.
  - Conferido: 80 kg com 21,4% → 17,1 / 62,9. 43,7% de magra → 35,0. MG 17,3 → 21,6% / 62,7. MM 35,2 → 44,0%.

### 5.7 Exemplo conferido

Homem, 35 anos, 80 kg, 175 cm. Dobras: TR 15, BI 6, AB 25, SE 18, AX 14, CX 22, TO 12, SI 20, PA 11, SE2 13. Cintura 88, quadril 100, braço 32, punho 5,8, fêmur 9,6. Pollock 7 com Brozek:

| Saída | Valor |
|---|---|
| IMC | 26,1 (Sobrepeso) |
| Peso ideal | 56,7 a 76,3 kg |
| %G | 18,6% (Moderadamente alta; ref. 8–15%) |
| Σ | 126,00 mm |
| Densidade | 1,056 |
| Peso gordo / MLG | 14,9 / 65,1 kg |
| Ósseo / residual / muscular | 11,8 / 19,3 / 34,0 kg |
| CMB | 27,3 cm (97,8%, Eutrófico) |
| RCQ | 0,88 (Risco moderado) |

---

## 6. Antropometria — crianças e adolescentes

**Status: conferido na tela.** Foram 35 casos × 6 saídas = **210/210 iguais**.

- Evidência: `tela_antropometria_infantil.json`
- Página: `infantil.php`; REA `ev_a05b57cb…`

### 6.1 Regras

- Só pode ser criada se a idade **na data da avaliação** for de até 228 meses. Acima disso: "Idade incompatível com protocolos infantis".
- Idade em anos e em meses vem do servidor, calculada **na data da avaliação**. Avaliação de 15/12/1999 para nascido em 15/06/1991 → 8 anos / 102 meses.
- Entradas: peso, altura, dobras tricipital (DCT), subescapular (DCSE) e panturrilha (DCP).

### 6.2 Z-escore OMS (método LMS)

- `z = ((valor/M)^L − 1) / (S·L)` → `toFixed(3)` → número.
- Não há caso especial para L = 0 nem a correção "restricted" da OMS para |z| > 3.
- O z do IMC usa o IMC **arredondado em 1 casa**.
- **Tabelas mensais:** peso/idade m0–m120 (acima de 120 meses mostra "−"); estatura/idade m0–m228; IMC/idade m0–m228.
  - Os dados estão em `lms_oms_mensal.json`.
  - Comparados com os dados oficiais da OMS (repositórios `WorldHealthOrganization/anthro` e `anthroplus`):
    - de 61 a 228 meses são **idênticos**, exceto estatura/idade feminina (M arredondado a 3 casas);
    - de 0 a 60 meses correspondem às tabelas mensais da OMS 2006.
  - **Anomalia:** IMC/idade **meninas 25–60 meses = valores dos meninos** (36 meses idênticos). Exemplo: menina de 30 meses com IMC 15,0 → z WebDiet −0,666; z OMS −0,414.

### 6.3 Classificações

**Peso/idade:**

| z | Classe |
|---|---|
| > 2 | Peso elevado |
| (1; 2] | Eutrófico |
| (−1; 1] | Adequado |
| (−2; −1] | Eutrófico |
| (−3; −2] | Baixo peso |
| ≤ −3 | Muito baixo peso |

**Estatura/idade:** > −2 Estatura adequada · (−3; −2] Baixa estatura · ≤ −3 Muito baixa estatura.

**IMC/idade:**

| z | < 5 anos | 5–9 anos | ≥ 10 anos |
|---|---|---|---|
| > 3 | Obesidade | Obesidade grave | Obesidade grave |
| (2; 3] | Sobrepeso | "\tObesidade"\* | "\tObesidade"\* |
| (1; 2] | Eutrófico | Sobrepeso | Sobrepeso |
| (−1; 1] | Adequado | Adequado | Eutrófico |
| (−2; −1] | Eutrófico | Eutrófico | Eutrófico |
| (−3; −2] | Magreza | Magreza | Magreza |
| ≤ −3 | Magreza severa | Magreza severa | Magreza severa |

\* O texto tem um caractere TAB no início.

Formato de saída: `"z (classe)"`, ou `"-"` quando z = 0 ou não existe.

### 6.4 % de gordura (Slaughter 1988)

- **Só TR + SE** (sem PA):
  - Meninos: `0,783Σ + 1,6`, sempre (ver §12).
  - Meninas: com Σ > 35, `0,546Σ + 9,7`; senão `1,33Σ − 0,013Σ² − 2,5`.
- **TR + PA** (tem prioridade): meninos `0,735Σ + 1,0`; meninas `0,610Σ + 5,1`.
- Resultado `toFixed(2)`.
- **Classificação:**
  - Meninos: < 6 Muito baixo · [6; 10) Baixo · [10; 20) Ótimo · [20; 25) Elevado · [25; 31) Alto · ≥ 31 Muito alto.
  - Meninas: < 12 · [12; 15) · [15; 25) · [25; 30) · [30; 35) · ≥ 35, com os mesmos rótulos.

---

## 7. Acompanhamento gestacional

**Status: conferido na tela.** Foram 5 cenários (Saudável, Baixo Peso, Sobrepeso, Obesidade, Gemelar) × 40 semanas, mais 4 semanas testadas em cada = **1525/1525 iguais**.

- Evidência: `tela_gestante.json` e `curvas_ganho_peso_gestacional.json`
- Página: `gestante.php`; REA `ev_28dcd62e…`

### 7.1 Dados iniciais

- Peso pré-gestacional (ppg), estatura, idade gestacional **ou** data da última menstruação (DUM), tipo Única/Gemelar.
- DUM = hoje − semanas. Semanas = `parseInt(diferença em semanas)`.
- IMC pré = ppg / alt² (`toFixed(2)`, salvo). Exibido com `toFixed(1)`.
- Semana atual acima de 43 é tratada como 40.

### 7.2 Classe pré-gestacional

< 18,5 "Baixo Peso" · [18,5; 25) "Saudável" · [25; 30) "Sobrepeso" · ≥ 30 "Obesidade".

### 7.3 Curvas

São as curvas brasileiras de ganho de peso gestacional (Kac et al., 2021), com arrays da 1ª à 40ª semana, zerados até a 9ª.

- **Gestação única:** percentis por classe (p10, p16, p25, p34, p38, p50, p90, conforme a classe) e a **faixa recomendada** (min/max).
- **Gestação gemelar:** p10 e p50 por classe.
- **Peso esperado, da 10ª semana em diante:** `ppg + (pA[i] + pB[i]) / 2`.

  | Classe | Par (pA, pB) |
  |---|---|
  | Baixo Peso | p16, p34 |
  | Saudável | p10, p34 |
  | Sobrepeso | p16, p25 |
  | Obesidade | p25, p38 |
  | Gemelar | p10, p50 |

- **Semanas 1–9:** interpolação linear de ppg até o valor esperado na 10ª semana. Mínimo = máximo = ppg (exibe "−").
- **Faixa recomendada:** `ppg + faixa.min[i]` e `ppg + faixa.max[i]`. Gemelar: `ppg + p10[i]` e `ppg + p50[i]`.

### 7.4 Avaliação da semana

- Antes da 10ª semana: "N/D".
- Depois: peso < mínimo "Abaixo do peso"; mínimo–máximo "Saudável"; > máximo "Acima do peso".
- IMC atual = PA / alt² (`toFixed(1)`). Ganho total = PA − ppg (`toFixed(2)`).

### 7.5 CMB e DCT (percentis por idade da paciente)

- CMB = CB − 0,314 × DCT.
- Rótulos da CMB: "Abaixo do p5", "Entre p5 e p10", … "Acima do p95".

**Cortes da CMB** (p5, p10, p25, p50, p75, p90, p95):

| Idade | Cortes |
|---|---|
| 12 | 16,2 / 16,6 / 18,0 / 19,1 / 20,1 / 21,4 / 22,0 |
| 13 | 16,9 / 17,5 / 18,3 / 19,8 / 21,1 / 22,6 / 24,0 |
| 14 | 17,4 / 17,9 / 19,0 / 20,1 / 21,6 / 23,2 / 24,7 |
| 15 | 17,5 / 17,8 / 18,9 / 20,0 / 21,5 / 22,8 / 24,4 |
| 16 | 17,0 / 18,0 / 19,0 / 20,0 / 21,6 / 23,4 / 24,9 |
| 17 | 17,5 / 18,3 / 19,4 / 20,5 / 22,1 / 23,9 / 25,7 |
| 18 | 17,4 / 17,9 / 19,5 / 20,2 / 21,5 / 23,7 / 24,5 |
| 19–24 | 17,9 / 18,5 / 19,5 / 20,7 / 22,1 / 23,6 / 24,9 |
| 25–34 | 18,3 / 18,8 / 19,9 / 21,2 / 22,8 / 24,6 / 26,4 |
| ≥ 35 | 18,6 / 19,2 / 20,5 / 21,8 / 23,6 / 25,7 / 27,2 |

**Cortes da DCT** (p5, p10, p15, p25, p50, p75, p85, p90, p95):

| Idade | Cortes |
|---|---|
| 12 | 7 / 8 / 9 / 11 / 14 / 18,5 / 21,5 / 24 / 27,5 |
| 13 | 7 / 8 / 9 / 11 / 15 / 20 / 24 / 25 / 30 |
| 14 | 8 / 9 / 10 / 11,5 / 16 / 21 / 23,5 / 26,5 / 32 |
| 15 | 8 / 9,5 / 10,5 / 12 / 16,5 / 20,5 / 23 / 26 / 32,5 |
| 16 | **1,5** / 11,5 / 12 / 14 / 18 / 23 / 26 / 29 / 32,5 |
| 17 | 9 / 10 / 12 / 13 / 18 / 24 / 26,5 / 29 / 34,5 |
| 18–24 | 9 / 11 / 12 / 14 / 18,5 / 24,5 / 28,5 / 31 / 36 |
| 25–29 | 10 / 12 / 13 / 15 / 20 / 26,5 / 31 / 34 / 38 |
| 30–34 | 10,5 / 13 / 15 / 17 / 22,5 / 29,5 / 33 / 35,5 / 41,5 |
| 35–39 | 11 / 13 / 15,5 / 18 / 23,5 / 30 / 35 / 37 / 41 |
| ≥ 40 | 12 / 14 / 16 / 19 / 24,5 / 30,5 / 35 / 37 / 41 |

### 7.6 Tabela semanal e aporte calórico

- **Colunas:** semana · mínimo · máximo · peso registrado (ou "registrar peso") · kcal · "ver conduta" · "usar aporte".
- `ult` = última semana com peso registrado (padrão 1). `dif = parseFloat((esperado_semana − peso_ult).toFixed(1))`.
- **kcal:** se `dif > 0` e `semana > ult`, `"+" + (dif × 7700 / ((semana − ult) × 7)).toFixed(0) + " Kcal/dia"`. Senão "0 Kcal/dia". Antes da 10ª semana: "−".
- **Bug:** sem nenhum peso registrado, `peso_ult = 0`, o que gera valores como "+7431 Kcal/dia".
- **"Usar aporte":** grava o valor, que o Cálculo energético importa como adicional gestante.
- **Conduta (texto):** muda conforme a situação — antes da 10ª semana (meta de ganho total até o máximo da 10ª), abaixo, dentro ou acima da faixa, ou sem peso registrado.

---

## 8. Planejamento alimentar

### 8.1 Métodos

| Método | Página | Cálculo |
|---|---|---|
| Por alimentos ("Convencional") | `metodoPlanning.php` | sim (§8.3) |
| Por equivalentes | `metodoWebdiet.php` | sim (§8.5) |
| Qualitativo | `metodoQualitativo.php` | não (texto livre) |

Há mais de 100 modelos prontos.

Outras funções:

- Receitas anexas e lista de compras (incluindo versão por IA).
- Hábitos, sintomas, condutas e protocolos favoritos.
- Fotos de refeição (IA), busca de alimentos por IA.
- PDF, envio por WhatsApp, liberar no app, periodização, duplicar e mover refeições, observações por refeição.

### 8.2 Base de alimentos (estrutura; não copiada)

Total de **27.998 itens**, carregados por `api/carregarAlimentosAvulsos.php`.

| Origem | Itens |
|---|---|
| TACO | 598 |
| TBCA | 4.495 |
| TBCA 7.2 | 5.674 |
| TBCA 7.3 | 5.855 |
| Tucunduva | 3.602 |
| Fabricante | 4.037 |
| Rótulo | 707 |
| Receita | 1.778 |
| Suplementos | 1.233 |
| USDA | 2 |
| Usuário | 17 |

**Campos, por 100 g ou 100 mL:**

- Energia e macros: kcal, ptn, lip, cho, fibras.
- Minerais: ca, mg, p, fe, na, k, co (cobre), zn, se.
- Vitaminas: re (retinol), rea (RAE), tiamina, riboflavina, piridoxina, niacina, vitc, vitb12, vitb9, vite, vitd.
- Gorduras e outros: gorduramono, gordurapoli, gordurasat, gorduratrans, colesterol, alcool.
- Metadados: `id`, `nome`, `grupo`, `unidade` (g|ml), `origem`, `tipo` (alimento|receita), `substitutos`, `compras`, `sku`, `img`, `liah`, `exibido`, `destacado`.
- `mc` = medidas caseiras `[{nome_mc, peso}]`, sempre com "grama(s)" = 1 e "À vontade" = 0.

A nutricionista pode cadastrar medidas caseiras próprias e alimentos próprios.

### 8.3 Método por alimentos

**Status: conferido na tela.** Foi um cardápio de 9 itens TACO em 3 refeições (jantar desativado), com 2 tipos de meta: **223/223 iguais**, incluindo os 27 micronutrientes e as cores de adequação.

- Evidência: `tela_planejamento_alimentos.json`
- REA `ev_4b91a804…`

**Estrutura da prescrição.** Cada refeição tem:

- `horario`, `nome`, `obs`, `foto`, `cardapio`, `pdfView`, `exibido`;
- `tipo` ("dieta"…);
- `ativo` ("true"/"false" = entra no cálculo);
- `conteudos`: `[{id, dados:[nome, unidade], mc:[quantidade, medida, peso], subs:[…]}]`.

Planejamento em branco: Café da manhã, Almoço, Jantar.

**Alimento:**

- Peso = quantidade × peso da medida → exibido `parseFloat(peso.toFixed(1)) + unidade`. **O peso guardado é o arredondado** (1 casa) e é ele que entra nos totais.
- Nutriente = valor/100 × peso. PTN, LIP e CHO `toFixed(1)` g; kcal `toFixed(0)`.

**Total da refeição:**

- Soma; peso `toFixed(0)` g; macros `toFixed(1)`; kcal `toFixed(0)`.
- **Densidade** = kcal/peso (`toFixed(2)`):

  | Faixa (kcal/g) | Classe |
  |---|---|
  | ≤ 0,6 | muito baixa (0 até 0,6) |
  | (0,6; 1,5] | baixa (0,6 até 1,5) |
  | (1,5; 3,9] | média (1,5 até 3,9) |
  | > 3,9 | alta (3,9 até 9,0) |

- %PTN = PTN×4/kcal×100 (`toFixed(1)`); %LIP = LIP×9/kcal×100; **%CHO = 100 − %PTN − %LIP** (resto).

**Total do cardápio** (só refeições ativas):

- Somas arredondadas: PTN, LIP, CHO, fibras e peso `toFixed(1)`; kcal `toFixed(0)`.
- g/kg pelo peso de referência.
- **CHO disponível** = CHO − fibras.
- Densidade = kcal / peso.
- **Análise calórica:** kcal PTN = PTN×4 (1 casa); kcal LIP = LIP×9; **kcal CHO = kcal total − kcal PTN − kcal LIP**. Percentuais sobre a kcal total.
- **kcal não proteica por g de N (prescrita)** = (LIP×9 + CHO×4) / (PTN/6,25), `toFixed(1)`.

**Metas (referências):**

- Tipo "percentual (% do GET)" ou "g/kg".
- No modo %, CHO% = 100 − PTN% − LIP% (automático).
- No modo g/kg, GET = PTN×P×4 + LIP×P×9 + CHO×P×4.
- Gramas planejadas:
  - modo %: `GET×%/100/4` (PTN, CHO) ou `/9` (LIP);
  - modo g/kg: `valor × peso`;
  - ambos `toFixed(1)`.
- GET e peso podem ser importados do Cálculo energético.
- kcal não proteica/g N **planejada**, como está no código: (gPTN×9 + gLIP×4) / (gPTN/6,25). **Erro** (§12).

**Adequação:**

- Diferença = prescrito − planejado.
- % = prescrito / planejado × 100 (`toFixed(0)`).
- **> 105% vermelho (#EE091D); 95–105% verde (#83C688); senão neutro.**

**Micronutrientes (27 itens):**

- Soma de valor/100 × peso, `toFixed(1)`.
- % = valor arredondado / referência × 100 (`toFixed(1)`). A barra vai até 200%.
- Lista: mono, poli, saturada, trans, colesterol, fibras, Ca, Mg, P, Fe, Na, K, Cu, Zn, Se, retinol, RAE, folato, B12, B1, B2, B6, niacina, C, D, E, álcool.
- **Referências** vêm do **servidor** conforme idade e sexo. Para homem de 35 anos coincidem com as DRIs do IOM:

  | Nutriente | Ref. | Nutriente | Ref. |
  |---|---|---|---|
  | Fibras | 38 g | Se | 55 mcg |
  | Ca | 1000 mg | RAE | 900 mcg |
  | Mg | 420 mg | Folato | 400 mcg |
  | P | 700 mg | B12 | 2,4 mcg |
  | Fe | 8 mg | B1 | 1,2 mg |
  | Na | 1500 mg | B2 | 1,3 mg |
  | K | 3400 mg | B6 | 1,3 mg |
  | Cu | 0,9 mg | Niacina | 16 mg |
  | Zn | 11 mg | Vit. C | 90 mg |
  | Vit. E | 15 mg | Vit. D | 15 mcg |

  - Colesterol e retinol: "N/D". Mono, poli e saturada: sem referência. Trans e álcool: 0.
  - Outros sexos, idades, gestação e lactação: §8.10.

**Substitutos:** quando o peso do principal muda, `fator = novo/antigo`. A quantidade e o peso de cada substituto são multiplicados (`toFixed(1)`). O sistema pergunta antes.

**Equivalentes dentro do método por alimentos** (15 grupos):

| Grupo | Nome | Alimentos |
|---|---|---|
| g1 | baixa caloria | 7 |
| g2 | vegetais A | 24 |
| g3 | vegetais B | 31 |
| g4 | proteínas | 48 |
| g5 | cereais e tubérculos | 20 |
| g6 | leguminosas | 8 |
| g7 | óleos e gorduras | 9 |
| g8 | alimentos gordurosos | 11 |
| g9 | frutas | 63 |
| g10 | frutas oleosas | 10 |
| g11 | oleaginosas e sementes | 26 |
| g12 | pães e fibras | 32 |
| g13 | laticínios | 24 |
| g14 | suplementos | 6 |
| g15 | açúcares | 14 |

Cada porção tem `{id, peso, medida, quantidade}`. O seletor de porções (×1, ×2 ou personalizado) multiplica quantidade e peso.

### 8.4 Exemplo conferido

Almoço: arroz 4 colheres de arroz rasas (120 g), feijão carioca 150 g, frango grelhado 120 g, azeite 1 colher de sopa (8 g).

| Item | Valor |
|---|---|
| Peso | 398 g |
| PTN / LIP / CHO | 37,1 / 23,5 / 54,8 g |
| Energia | 587 kcal |
| Densidade | 1,47 (baixa) |
| Distribuição | PTN 25,3% · LIP 36,1% · CHO 38,6% |

### 8.5 Método por equivalentes

**Status: conferido na tela: 114/114.**

- Evidência: `tela_planejamento_equivalentes.json`
- REA `ev_93e7c093…`

**Como funciona:**

- Lista própria de alimentos com **valores por porção** (quantidade, medida, peso, PTN, LIP, CHO, kcal, fibras, micros) e grupo g1..g15. A nutricionista marca quais entram.
- **Valor do grupo** = média simples dos alimentos selecionados do grupo. Cada valor é arredondado em 1 casa antes; a média também é arredondada em 1 casa.
- **Desvio-padrão populacional** (÷n), exibido como "± dp" (kcal com 0 casas).
- **Refeição:** porções por grupo (campos `g{k}r{refeição}`), refeição "calculada" sim/não e avulsos (alimentos da base geral, por 100 g; cada um arredondado em 1 casa antes de somar).
- **Total** = Σ por grupo (Σ das porções do grupo nas refeições calculadas) × média do grupo, somando na ordem g1→g15, mais os avulsos.
  - **Atenção:** somar por refeição e depois por grupo muda a última casa decimal. Por isso a ordem precisa ser exatamente esta.
- A exibição é igual ao método por alimentos.

**Médias padrão observadas** (por porção; entre parênteses, o nº de alimentos selecionados):

| Grupo | PTN | LIP | CHO | kcal | Fibras |
|---|---|---|---|---|---|
| g1 baixa caloria (8) | 0,2 | 0,1 | 1,9 | 8,9 | 0,2 |
| g2 vegetais A (25) | 0,9 | 0,4 | 1,9 | 12,5 | 1,2 |
| g3 vegetais B (32) | 1,1 | 0,3 | 4,2 | 19,7 | 1,8 |
| g4 proteínas (52) | 14,9 | 5,2 | 0,3 | 107,9 | 0 |
| g5 cereais e tubérculos (22) | 0,7 | 0,3 | 6,9 | 32,2 | 0,6 |
| g6 leguminosas (11) | 2,7 | 0,4 | 8,2 | 41,2 | 3,1 |
| g7 óleos e gorduras (12) | 0 | 8,8 | 0 | 76,5 | 0 |
| g8 alimentos gordurosos (13) | 4,3 | 10,4 | 2,4 | 119,5 | 0,4 |
| g9 frutas (71) | 1 | 0,3 | 14,7 | 61,2 | 2,1 |
| g10 frutas oleosas (11) | 1,6 | 9,8 | 8,8 | 122,7 | 5,9 |
| g11 oleaginosas e sementes (28) | 3,6 | 9,3 | 5,6 | 116,7 | 3 |
| g12 pães e fibras (41) | 2,2 | 1,4 | 14,4 | 76,3 | 1,5 |
| g13 laticínios (35) | 6,8 | 5,3 | 5,4 | 96,9 | 0,1 |
| g14 suplementos (17) | 12,6 | 0,6 | 1,7 | 62 | 0,1 |
| g15 açúcares (18) | 0,1 | 0 | 11,2 | 42,5 | 0,1 |

### 8.6 Receitas culinárias (receita "calculada")

**Status: conferido na tela** (editor aberto, receita **não salva**).

- Evidência: `tela_receita.json`
- Página: `receitas.php`; REA `ev_c259e055…`

**Tipos de receita:**

- **"Comum":** só texto e PDF, sem nutrientes.
- **"Calculada":** ingredientes vindos da base de alimentos.

**Cálculo de cada ingrediente** (`recalcularAvulso` e `calcularMacrosAvulsos`):

- **peso** = quantidade × peso da medida caseira escolhida (sem arredondar), mais a unidade do alimento.
  - "personalizada" pede nome e peso da medida, só para aquela receita.
- Na linha, PTN, LIP e CHO = valor/100 × peso, `toFixed(1)` + "g".
- A kcal da linha tem dois formatos:
  - quando a linha é recalculada: `toFixed(1)` + " Kcal" (ex.: "117.6 Kcal");
  - quando a lista é redesenhada ao incluir outro ingrediente: 0 casas e sem espaço (ex.: "256Kcal", "88Kcal").

**Totais** (`updateAvulsos`):

- Somam valor/100 × peso **com os valores da base, sem arredondar** (não somam as linhas exibidas).
- Peso `toFixed(0)` → vai para o campo editável **`#peso`** ("peso final").
- kcal `toFixed(0)`.
- PTN, LIP e CHO `toFixed(1)`.
- Os 27 micronutrientes também são somados, sem arredondar.

**Porção:**

- **Automática**, quando há rendimento > 0: porção = **soma dos pesos dos ingredientes** / rendimento, `toFixed(0)`, com o nome "Porção".
  - Recalculada a cada mudança nos ingredientes.
- **Botão "gerar medida"** (`gerarMedida`): porção = **`#peso`** (o peso final digitado, ex.: depois do cozimento) / rendimento, `parseFloat(toFixed(1))`, com o nome "Porção(ões)".
  - Se rendimento ou peso estiver vazio, mostra um aviso.

**Ao salvar** (`salvarReceita`):

- Grava os valores **por 100 g**: `parseFloat((valor / peso × 100).toFixed(1))` para kcal, PTN, LIP, CHO e os 27 micronutrientes.
  - `peso` = campo `#peso` (peso final).
  - kcal, PTN, LIP e CHO saem dos **campos já arredondados** (kcal com 0 casas, macros com 1).
  - Os micronutrientes saem das somas sem arredondar.
- A medida caseira gravada é a única linha "mc1" (nome + gramas da porção).
- Exige nome, rendimento, peso, macros, descrição e medida.

**Ficha da receita** (`infoReceita`):

- Valor por porção = valor por 100 g × (peso da porção / 100).
- PTN, LIP e CHO `toFixed(1)`; kcal `toFixed(0)`. O texto diz "Cálculo referente a uma porção".

**Exemplo conferido** (valores da base TACO como estão no WebDiet):

| Ingrediente | Peso | kcal/100 g | PTN/100 g | LIP/100 g | CHO/100 g |
|---|---|---|---|---|---|
| Arroz cozido | 200 g | 128 | 2,5 | 0,2 | 28,1 |
| Feijão carioca cozido | 150 g | 76 | 4,8 | 0,5 | 13,6 |
| Azeite de dendê | 10 g | 884 | 0 | 100 | 0 |
| Banana prata | 120 g | 98 | 1,3 | 0,1 | 26 |

Resultados na tela:

- Totais: **480 g · 576 kcal · PTN 13,8 · LIP 11,3 · CHO 107,8**.
- Rendimento 4: porção automática **120 g**.
- Peso final digitado 420 g + "gerar medida": porção **105 g**.

### 8.7 Alimento próprio ("Meus alimentos", cadastro por rótulo)

**Status: conferido na tela.** O envio foi bloqueado, e nada foi salvo.

- Evidência: `tela_alimento_rotulo.json`

**Entrada:** nome, unidade (g ou ml), medida caseira, quantidade de medidas, peso da porção do rótulo, kcal, CHO, PTN, LIP e fibras **da porção**.

**kcal automática** (`autoCompletarNovoAlimento`):

- kcal = CHO×4 + PTN×4 + LIP×9 + **fibras×2**, `toFixed(0)`.
- Campo vazio conta como 0.

**Conversão para 100 g** (`cadastrarAlimento`):

- Cada valor = valor da porção / peso × 100.
- kcal `toFixed(0)`; PTN, LIP, CHO e fibras `toFixed(1)`.
- **Peso da medida caseira** = peso / quantidade de medidas, `parseFloat(toFixed(1))`.
- Micronutrientes são gravados como "0". O campo `gorduratrans` não é enviado.

**Exemplo conferido** ("Barra TESTE REA"): rótulo de 45 g = 2 unidades, CHO 27,3, PTN 6,1, LIP 4,6, fibras 3,2.

| Saída | Valor |
|---|---|
| kcal automática | **181** (181,4) |
| Por 100 g | kcal **402** · PTN **13,6** · LIP **10,2** · CHO **60,7** · fibras **7,1** |
| Medida | "Unidade(s)" = **22,5 g** |

### 8.8 Lista de compras

Existe nos dois métodos de planejamento. Há dois caminhos.

**1) "Importar alimentos" (sem quantidades)** (`importarCompras2`):

- Junta o **nome de compra** (`compras`) de cada alimento principal e de cada substituto.
- Remove repetidos e ordena alfabeticamente.
- Mostra uma lista com caixas de marcar (◯/✓), editável.
- **Método por alimentos:** opção "com" ou "sem" os ingredientes das receitas.
  - Com receitas, uma receita principal é trocada pelos seus ingredientes (`getIngredientes`).
  - Dois erros no código (§12):
    - nos substitutos, `final.concat(...)` não é atribuído, então os ingredientes de receitas substitutas são descartados;
    - `parseInt(origem) == "Receita"` nunca é verdadeiro, então uma receita substituta entra pelo nome de compra.
- **Método por equivalentes:** o botão também oferece "com" ou "sem" receitas, mas a função ignora o parâmetro.
  - Entram todos os alimentos de cada grupo com porção > 0 em cada refeição, mais os avulsos.

**2) Lista com quantidades** (só no método por equivalentes; ela é enviada à IA do WebDiet, `api/reescreverListaComprasIA.php`, que reescreve a lista):

- **Opções:**
  - período: 7, **15 (padrão)**, 30, 45 ou 60 dias, ou personalizado;
  - agrupamento ("tema");
  - com ou sem quantidades;
  - com ou sem substitutos.
- **Custo:** para assinatura Premium ou plano 3, o sistema avisa que custa **1 crédito de IA**. Esta parte não foi executada.
- **Antes de enviar**, o próprio navegador calcula as quantidades (`carregarDadosListaGeral`):
  - Uma entrada por refeição e por grupo com porção > 0: o primeiro alimento do grupo é o principal; os demais viram "opções".
  - Os avulsos também entram.
  - **Não há soma entre refeições.**
- **Quantidade de um alimento de grupo** (`calcularQuantidadeGrupoEquivalente`):
  - qtd = porções × quantidade da medida do alimento;
  - peso = porções × peso;
  - usa o nome da medida no plural quando qtd > 1.
- **Conversão para compra** (`calcularQuantidadeCompra(qtd, medida, peso, unidade, período)`):

  | Caso | Resultado |
  |---|---|
  | medida contém "unidade" | `Math.round(qtd × período)` + " Unidade(s)" |
  | ml, total = peso × período > 1000 | `(total/1000).toFixed(2)` com vírgula + " Litros" |
  | ml, até 1000 | `Math.round(total)` + " ml" (vazio se 0) |
  | g, total > 1000 | `(total/1000).toFixed(2)` com vírgula + " Kg" |
  | g, até 1000 | `Math.round(total)` + " g" (vazio se 0) |

  - O período vale 1 quando vazio ou inválido.

### 8.9 Piloto automático (método por equivalentes)

- Não há fórmula. Monta o cardápio a partir de **modelos de refeição prontos** (`piloto`), que são conteúdo do WebDiet e não foram copiados.
- Perfis: todos, low carb, vegetariana, vegana, paleo.
- Os alimentos vêm de listas fixas de IDs da base.
- A soma de macros dos modelos escolhidos é exibida com `toFixed(1)`.
- No app novo, o equivalente seria uma biblioteca de modelos próprios.

### 8.10 Referências de micronutrientes (DRIs) por perfil

**Status: conferido na tela.** As referências vêm do servidor (atributo `referencia_micro` de `#refMicro1..27` no planejamento por alimentos). Foram lidas para 15 perfis do paciente de teste, além do homem de 35 anos já registrado em §8.3.

- Evidência: `tela_dris.json`
- Como foi feito: §1.1.

Todos os valores coincidem com as **DRIs do IOM** (RDA ou AI) da faixa de vida correspondente. Para **sódio e potássio**, são os valores de **2019** (NASEM): Na 1500 mg nos adultos e K 3400 (H) / 2600 (M).

Em todos os perfis:

- mono, poli e saturada: sem referência;
- trans e álcool: "0";
- colesterol e retinol: "N/D".

Minerais e fibras:

| Perfil | Fibras (g) | Ca (mg) | Mg (mg) | P (mg) | Fe (mg) | Na (mg) | K (mg) | Cu (mg) | Zn (mg) | Se (mcg) |
|---|---|---|---|---|---|---|---|---|---|---|
| F 35 a | 25 | 1000 | 320 | 700 | 18 | 1500 | 2600 | 0,9 | 8 | 55 |
| F 35 a gestante | 28 | 1000 | 360 | 700 | 27 | 1500 | 2900 | 1 | 11 | 60 |
| F 35 a lactante | 29 | 1000 | 320 | 700 | 9 | 1500 | 2800 | 1,3 | 12 | 70 |
| F 18 a gestante | 28 | 1300 | 400 | 1250 | 27 | 1500 | 2600 | 1 | 12 | 60 |
| M 16 a | 38 | 1300 | 410 | 1250 | 11 | 1500 | 3000 | 0,89 | 11 | 55 |
| F 16 a | 26 | 1300 | 360 | 1250 | 15 | 1500 | 2300 | 0,89 | 9 | 55 |
| M 10 a | 31 | 1300 | 240 | 1250 | 8 | 1200 | 2500 | 0,7 | 8 | 40 |
| F 10 a | 26 | 1300 | 240 | 1250 | 8 | 1200 | 2300 | 0,7 | 8 | 40 |
| M 5 a | 25 | 1000 | 130 | 500 | 10 | 1000 | 2300 | 0,44 | 5 | 30 |
| M 2 a | 19 | 700 | 80 | 460 | 7 | 800 | 2000 | 0,34 | 3 | 20 |
| M 3 meses | N/D | 200 | 30 | 100 | 0,27 | 110 | 400 | 0,2 | 2 | **"15 mg"** (§12) |
| M 55 a | 30 | 1000 | 420 | 700 | 8 | 1500 | 3400 | 0,9 | 11 | 55 |
| F 55 a | 21 | 1200 | 320 | 700 | 8 | 1500 | 2600 | 0,9 | 8 | 55 |
| M 75 a | 30 | 1200 | 420 | 700 | 8 | 1500 | 3400 | 0,9 | 11 | 55 |
| F 75 a | 21 | 1200 | 320 | 700 | 8 | 1500 | 2600 | 0,9 | 8 | 55 |

Vitaminas:

| Perfil | RAE (mcg) | Folato (mcg) | B12 (mcg) | B1 (mg) | B2 (mg) | B6 (mg) | Niacina (mg) | C (mg) | D (mcg) | E (mg) |
|---|---|---|---|---|---|---|---|---|---|---|
| F 35 a | 700 | 400 | 2,4 | 1,1 | 1,1 | 1,3 | 14 | 75 | 15 | 15 |
| F 35 a gestante | 770 | 600 | 2,6 | 1,4 | 1,4 | 1,9 | 18 | 85 | 15 | 15 |
| F 35 a lactante | 1300 | 500 | 2,8 | 1,4 | 1,6 | 2 | 17 | 120 | 15 | 19 |
| F 18 a gestante | 750 | 600 | 2,6 | 1,4 | 1,4 | 1,9 | 18 | 80 | 15 | 15 |
| M 16 a | 900 | 400 | 2,4 | 1,2 | 1,3 | 1,3 | 16 | 75 | 15 | 15 |
| F 16 a | 700 | 400 | 2,4 | 1 | 1 | 1,2 | 14 | 65 | 15 | 15 |
| M 10 a | 600 | 300 | 1,8 | 0,9 | 0,9 | 1 | 12 | 45 | 15 | 11 |
| F 10 a | 600 | 300 | 1,8 | 0,9 | 0,9 | 1 | 12 | 45 | 15 | 11 |
| M 5 a | 400 | 200 | 1,2 | 0,6 | 0,6 | 0,6 | 8 | 25 | 15 | 7 |
| M 2 a | 300 | 150 | 0,9 | 0,5 | 0,5 | 0,5 | 6 | 15 | 15 | 6 |
| M 3 meses | 400 | 65 | 0,4 | 0,2 | 0,3 | 0,1 | 2 | 40 | 10 | 4 |
| M 55 a | 900 | 400 | 2,4 | 1,2 | 1,3 | 1,7 | 16 | 90 | 15 | 15 |
| F 55 a | 700 | 400 | 2,4 | 1,1 | 1,1 | 1,5 | 14 | 75 | 15 | 15 |
| M 75 a | 900 | 400 | 2,4 | 1,2 | 1,3 | 1,7 | 16 | 90 | 20 | 15 |
| F 75 a | 700 | 400 | 2,4 | 1,1 | 1,1 | 1,5 | 14 | 75 | 20 | 15 |

**Faixas cobertas e não cobertas:**

- **Cobertas** (faixas do IOM): 0–6 m, 1–3 a, 4–8 a, 9–13 a, 14–18 a, 31–50 a, 51–70 a, > 70 a, gestante ≤ 18 e 31–50, lactante 31–50.
- **Não observadas:** 7–12 m, 19–30 a, meninas de 1–8 a, gestante 19–30, lactante ≤ 18 e 19–30.
  - O app novo pode usar a tabela pública do IOM/NASEM para essas faixas.
- **Não testado:** se as mudanças de faixa acontecem exatamente no aniversário.

---

## 9. Exames laboratoriais

Página: `registroExames.php`; REA `ev_98d01989…`.

- **Tipos:**
  - pedido de exames: texto rico, modelos favoritos, PDF;
  - anexo de PDF ou imagens, com "Interpretação" por IA (recurso pago, não analisado);
  - registro de exames.
- **Registro:** catálogo de **196 exames** (nomes em `exames_catalogo_nomes.txt`).
  - Para cada exame a nutricionista marca **Baixo / Normal / Alto**.
  - O laudo junta o texto "alto" ou "baixo" de cada exame marcado. "Normal" não gera texto.
  - As referências são **texto livre** por faixa etária e sexo. **Não há comparação numérica automática nem calculadoras.** HOMA-IR, Castelli, IST e TFG são só itens do catálogo.
- Salva a cada 60 s. A evolução dos exames aparece no link do paciente.

---

## 10. Questionários de saúde

REA: rastreamento `ev_a8aeb317…`, sarcopenia `ev_b5e0ea29…`, FINDRISC `ev_39f81d40…`, cafeína `ev_9d0b18f8…`, cronotipo `ev_2d9f188a…`, sinais `ev_b57b15ab…`, disbiose `ev_9ddf2008…`, QFA `ev_5f73e19c…`, fenótipo `ev_509f2d23…`, doshas `ev_261c2328…`.

**Status: regras extraídas do código e conferidas na tela.**

- Os 10 questionários de teste foram respondidos pelas funções da própria página, em vários cenários: mínimo, máximo, padrões mistos e **totais exatamente nas fronteiras** de cada faixa.
- O texto exibido foi registrado. Evidências: `tela_q_<nome>.json` e `tela_q_fronteiras.json`.
- O resultado de cada um aparece na subseção correspondente ("Conferido na tela").

**Criação:** data + tipo. Há 10 tipos (abaixo).

- A lista do paciente reconhece outros 7: Consciência alimentar, LEAF-Q, LEAM-Q, Índice de Fibrose-4 (FIB-4), Avaliação imunológica, Calculadora do risco de deficiência de magnésio e Food noise.
  - Eles pertencem a **extensões pagas** que a conta não tem (por exemplo "GLP-1" e "Endurance"). Ao expandir, a página mostra "comprar extensão".
  - **Não foram acessados nem comprados.** As fórmulas deles não estão neste relatório.
- Todos geram PDF; alguns têm "Evolução".
- O texto do resultado é salvo junto (`salvarDiagnostico.php`).

### 10.1 Rastreamento metabólico

- 66 sintomas, nota de 0 a 4, em 14 categorias.
- Máximo por categoria:

  | Categoria | Máx. | Categoria | Máx. |
  |---|---|---|---|
  | Cabeça | 16 | Coração | 12 |
  | Olhos | 16 | Pulmões | 16 |
  | Ouvidos | 16 | Trato digestivo | 28 |
  | Nariz | 20 | Articulações/Músculos | 20 |
  | Boca e Garganta | 20 | Energia/Atividade | 16 |
  | Pele | 20 | Mente | 32 |
  | | | Emoções | 16 |
  | | | Outros | 16 |

- Resultado do total:

  | Total | Texto |
  |---|---|
  | ≤ 30 | "Saudável, baixa chance de ter hipersensibilidades" |
  | 31–40 | "Indicativo de existência de hipersensibilidades" |
  | 41–100 | "Absoluta certeza de existência de hipersensibilidades" |
  | > 100 | "Saúde muito ruim, com possível relação com doenças crônicas/degenerativas" |

- Também mostra a soma de cada categoria sobre o máximo.
- **Estrutura** (itens numerados na ordem da tela, todos com nota 0–4, padrão 0):

  | Categoria | Itens | Categoria | Itens |
  |---|---|---|---|
  | Cabeça | 1–4 | Pulmões | 31–34 |
  | Olhos | 5–8 | Trato digestivo | 35–41 |
  | Ouvidos | 9–12 | Articulações / Músculos | 42–46 |
  | Nariz | 13–17 | Energia / Atividade | 47–50 |
  | Boca e Garganta | 18–22 | Mente | 51–58 |
  | Pele | 23–27 | Emoções | 59–62 |
  | Coração | 28–30 | Outros | 63–66 |

  - Cor da nota marcada: 0 verde · 1 amarelo · 2 laranja · 3 vermelho · 4 vermelho-escuro.
  - Cor do resultado: ≤ 30 verde · 31–40 amarelo · 41–100 `#fa5423` · > 100 `#e61c24`.
  - Todo item começa marcado com 0, então as 14 categorias sempre aparecem, no formato "Categoria soma/máximo".
- **Conferido na tela:**
  - **Fronteiras:**

    | Total | Texto exibido |
    |---|---|
    | 30 | "Saudável…" |
    | 31 e 40 | "Indicativo…" |
    | 41 e 100 | "Absoluta certeza…" |
    | 101 | "Saúde muito ruim…" |

  - **Somas por categoria:**
    - tudo 0 → "0 pontos";
    - tudo 4 → **264 pontos**, cada categoria no máximo (ex.: "Mente 32/32");
    - tudo 2 → 132;
    - notas `i mod 5` → 130 (Cabeça 6/16, Olhos 7/16…).
  - Formato: "N pontos" e "Categoria x/máx".

### 10.2 FINDRISC (diabetes mellitus)

| Item | Pontuação |
|---|---|
| Idade | < 45: 0 · 45–54: 2 · 55–64: 3 · > 64: 4 |
| IMC | < 25: 0 · 25–30: 1 · > 30: 3 |
| Cintura (H) | < 94: 0 · 94–102: 3 · > 102: 4 |
| Cintura (M) | < 80: 0 · 80–88: 3 · > 88: 4 |
| Atividade 30 min/dia | sim 0 · não 2 |
| Frutas, legumes e verduras diários | sim 0 · não 1 |
| Anti-hipertensivo | sim 2 |
| Glicemia alta já registrada | sim 5 |
| Família com diabetes | não 0 · 2º grau 3 · 1º grau 5 |

- Máximo de 26.
- Classificação: < 7 BAIXO · 7–11 DISCRETAMENTE AUMENTADO · 12–14 MODERADO · 15–20 ALTO · > 20 MUITO ALTO.
  - O texto exibido é "RISCO " + classe (ex.: "RISCO MODERADO").
  - Cores: verde · `#f8ce4f` · `#FFA500` · `#E53935` · `#8B0000`.
- **Estrutura:** pontos de cada opção, na ordem em que aparecem na tela.

  | Item | Pontos das opções |
  |---|---|
  | 1 Idade | 0, 2, 3, 4 |
  | 2 IMC | 0, 1, 3 |
  | 3 Cintura | 0, 3, 4 (H); 0, 3, 4 (M) — 6 opções |
  | 4 Atividade 30 min | 0, 2 |
  | 5 Frutas/verduras | 0, 1 |
  | 6 Anti-hipertensivo | 2 (sim), 0 (não) |
  | 7 Glicemia alta | 5 (sim), 0 (não) |
  | 8 Família | 0, 3, 5 |

  - Item sem resposta não soma.
  - Escolher a primeira opção de todos os itens dá 7 pontos, porque nos itens 6 e 7 a primeira opção é "sim".
- **Conferido na tela:**
  - **Fronteiras:**

    | Total | Texto exibido |
    |---|---|
    | 6 | "RISCO BAIXO" |
    | 7 e 11 | "RISCO DISCRETAMENTE AUMENTADO" |
    | 12 e 14 | "RISCO MODERADO" |
    | 15 e 20 | "RISCO ALTO" |
    | 21 e 26 | "RISCO MUITO ALTO" |

  - Formato: "N pontos de 26 possíveis".

### 10.3 Sarcopenia em idosos

12 itens:

- SARC-F: 5 itens de 0 a 2.
- Sexo: F 0 / M 1.
- Idade: < 66: 0 · 66–75: 1 · > 75: 2.
- Medicamentos: nenhum 0 · 1–3: 1 · 4 ou mais: 2.
- IMC: < 22: 2 · 22–27: 0 · > 27: 1.
- Preensão manual baixa (H < 27 kg; M < 16 kg): 5.
- Circunferência do braço ≤ 32 cm: 1.
- Panturrilha baixa (H ≤ 34; M ≤ 33): 3.

Mostra **só o total** ("N pontos"). O trecho de classificação está comentado no código.

**Estrutura:** pontos de cada opção, na ordem da tela.

| Itens | Pontos das opções |
|---|---|
| 1–5 SARC-F | 0, 1, 2 |
| 6 Sexo | 0 (F), 1 (M) |
| 7 Idade | 0, 1, 2 |
| 8 Medicamentos | 0, 1, 2 |
| 9 IMC | 2 (< 22), 0 (22–27), 1 (> 27) |
| 10 Preensão baixa | 5, 0 |
| 11 Braço ≤ 32 cm | 1, 0 |
| 12 Panturrilha baixa | 3, 0 |

- Máximo de 26.
- Itens sem resposta não somam. O total aparece mesmo com itens em branco.

**Conferido na tela:** o total aparece sem classificação. Todas as primeiras opções = **11**, todas as últimas = **16**, todas as segundas = **8**.

### 10.4 Dependência de cafeína (CaffEQ)

- 47 afirmações, escala de 1 a 6 (0 = não respondido), 7 fatores:

  | Fator | Itens | Máx. |
  |---|---|---|
  | Dependência | 12 | 72 |
  | Energia e disposição | 8 | 48 |
  | Supressão do apetite | 5 | 30 |
  | Melhoras no humor | 6 | 36 |
  | Desempenho físico | 3 | 18 |
  | Ansiedade e efeitos negativos | 9 | 54 |
  | Distúrbios do sono | 4 | 24 |

- Versão resumida: 21 itens marcados "R" (3 por fator). **A página abre na versão resumida**, que conta só os itens "R".
- Média do fator = soma / nº de itens (na resumida, /3). **Média ≥ 4** mostra o texto "alto" do fator; abaixo de 4, o texto "baixo".
- **Estrutura** (itens na ordem da tela):

  | Fator | Itens | Itens "R" (resumida) |
  |---|---|---|
  | 1 Dependência | 1–12 | 2, 3, 8 |
  | 2 Energia e disposição | 13–20 | 13, 17, 20 |
  | 3 Supressão do apetite | 21–25 | 22, 23, 25 |
  | 4 Melhoras no humor | 26–31 | 27, 30, 31 |
  | 5 Melhoria do desempenho físico | 32–34 | 32, 33, 34 |
  | 6 Ansiedade e efeitos negativos | 35–43 | 37, 38, 41 |
  | 7 Distúrbios do sono | 44–47 | 44, 45, 46 |

  - Cada item vale 1 a 6; 0 = sem resposta. Na resumida, os itens não "R" ficam ocultos e não entram na média.
  - Formato exibido: "• {nome do fator} Média: {média.toFixed(2)} {texto}".
  - Todo item começa com a marcação oculta "0", então os 7 fatores sempre aparecem. Item sem resposta conta 0 na soma.
  - **Cor:**
    - fatores 2–5 (efeitos desejados): média ≥ 4 verde; < 4 cinza `#a2a2a2`;
    - fatores 1, 6 e 7: média ≥ 4 vermelho `#f44336`; < 4 verde.
- **Conferido na tela** (versão resumida):
  - O resultado sai por fator, no formato "Fator — Média: x.xx — texto". A média tem 2 casas e ponto decimal.
  - Média 4.00 → texto "alto" (Dependência: "Dependência à cafeína. Para este paciente, sugere-se a prescrição da cafeína em momentos-chave do dia…").
  - Média 3.67 → texto "baixo" ("Não há dependência à cafeína.").
  - Todos 1 → 1.00; todos 3 → 3.00; todos 6 → 6.00.

### 10.5 Sono e cronotipo (MEQ, Horne-Östberg, 19 itens)

| Total | Perfil |
|---|---|
| 16–30 | Vespertino extremo ou noturno |
| 31–41 | Moderadamente vespertino |
| 42–58 | Intermediário |
| 59–69 | Moderadamente matutino |
| 70–86 | Matutino extremo |

Vem acompanhado de uma conduta de distribuição do VET por refeição. Há diferenças em relação ao MEQ original (§12).

**Estrutura:** pontos de cada opção, na ordem da tela (cada item é uma lista de seleção).

| Item | Pontos | Item | Pontos |
|---|---|---|---|
| 1 | 5, 4, 3, 2, 1, 0 | 11 | 4, 3, 2, 1 |
| 2 | 5, 4, 3, 2, 1, 0 | 12 | 1, 2, 3, 4 |
| 3 | 1, 2, 3, 4 | 13 | 4, 3, 2, 1 |
| 4 | 1, 2, 3, 4 | 14 | 1, 2, 3, 4 |
| 5 | 1, 2, 3, 4 | 15 | 4, 3, 2, 1 |
| 6 | 1, 2, 3, 4 | 16 | 4, 3, 2, 1 |
| 7 | 1, 2, 3, 4 | 17 | 5, 4, 3, 2, 1 |
| 8 | 4, 3, 2, 1 | 18 | 5, 4, 3, 2, 1 |
| 9 | 4, 3, 2, 1 | 19 | 6, 4, 2, 0 |
| 10 | 5, 4, 3, 2, 1 | | |

- Faixa possível com estes pontos: 16 a 83.
- **Item sem resposta:** não há resultado. Aparece a mensagem "Há perguntas que ainda não foram preenchidas. Assim que terminar, você poderá ver o resultado aqui."
- O código monta um texto "N pontos de 43 possíveis", mas **não o exibe** na tela.
- **Conduta: distribuição do VET por refeição.**

  | Perfil | Café da manhã | Lanche da manhã | Almoço | Lanche da tarde | Jantar |
  |---|---|---|---|---|---|
  | Total ≤ 41 (vespertinos) | 20% | 5% | 35% | 10% | 30% |
  | Total > 41 (intermediário e matutinos) | 30% | 10% | 35% | 5% | 20% |

**Conferido na tela:**

- Fronteiras:

  | Total | Perfil exibido |
  |---|---|
  | 30 | Vespertino extremo ou noturno |
  | 31 e 41 | Moderadamente vespertino |
  | 42 e 58 | Intermediário |
  | 59 e 69 | Moderadamente matutino |
  | 70 | Matutino extremo |

- Formato: "Resultado: N pontos" e "Perfil: …".
- Com as pontuações do WebDiet: todas as primeiras opções → 62; todas as últimas → 37; todas as segundas → 56.

### 10.6 Risco de disbiose

- 17 itens, de 0 a 3 pontos cada (fumante: 0/2).
- Os itens 2 (tipo de parto) e 3 (amamentação) aceitam "Não sei informar" (−).
- As faixas mudam com a quantidade de "−":

  | Respostas "−" | Baixo | Médio | Alto | Muito alto | Máximo exibido |
  |---|---|---|---|---|---|
  | nenhuma | 0–10 | 11–23 | 24–36 | 37–49 | "de 49 possíveis" |
  | uma | 0–10 | 11–22 | 23–34 | 35–46 | 46 |
  | duas | 0–10 | 11–21 | 22–32 | 33–43 | 43 |

- **Estrutura:** pontos de cada opção, na ordem da tela.

  | Item | Pontos | Item | Pontos |
  |---|---|---|---|
  | 1 | 3, 0 | 10 (fumante) | 2, 0 |
  | 2 (parto) | 3, 0, − | 11 | 3, 0 |
  | 3 (amamentação) | 3, 2, 0, − | 12 | 3, 0 |
  | 4–9 | 3, 2, 1, 0 | 13 | 0, 3 |
  | | | 14 | 3, 2, 1, 0 |
  | | | 15–17 | 3, 0 |

  - Soma máxima: 50 (§12, item 22).
  - **Contagem de "−":** o código conta os caracteres "-" na lista de respostas convertida em texto. Um "−" usa a tabela "uma"; dois usam a tabela "duas".
  - Cores: baixo verde · médio `#ffcd16` · alto `#fa5423` · muito alto `#e61c24`.
  - Texto: "O paciente encontra-se com {baixo risco | médio risco | risco alto | risco muito alto} de disbiose".
- **Conferido na tela:**
  - **Fronteiras sem "−":**

    | Total | Texto exibido |
    |---|---|
    | 0 e 10 | "baixo risco de disbiose" |
    | 11 e 23 | "médio risco" |
    | 24 e 36 | "risco alto" |
    | 37 | "risco muito alto" |

  - Formato: "O paciente encontra-se com … de disbiose" e "N pontos de 49 possíveis".
  - **Todas as respostas no máximo:** "**50 pontos de 49 possíveis**", com o texto do resultado **vazio** (erro confirmado, §12).
  - **Com "−":**
    - um "−" → "17 pontos de **46** possíveis" (médio);
    - dois "−" → "14 pontos de **43** possíveis" (médio).

### 10.7 Frequência alimentar (QFA)

- 42 itens, com porções por semana digitadas, em 8 categorias:

  | Categoria | Itens |
  |---|---|
  | Leites e derivados | 4 |
  | Carnes e ovos | 5 |
  | Óleos | 6 |
  | Cereais e leguminosas | 8 |
  | Frutas/verduras/legumes | 4 |
  | Petiscos/embutidos/enlatados | 4 |
  | Sobremesas e doces | 4 |
  | Bebidas | 7 |

- **Gráfico:** consumido (soma por categoria) × recomendado de **21, 14, 7, 42, 42, 7, 7, 7** porções por semana, na ordem das categorias.
- **Bebidas:** saudáveis (água, café sem açúcar, suco natural ou chá sem açúcar) × açucaradas (refrigerante, café ou chá com açúcar, suco adoçado, suco de caixinha).
- **Estrutura:**
  - Itens por categoria, na ordem da tela: leites 1–4; carnes 5–9; óleos 10–15; cereais 16–23; frutas/verduras/legumes 24–27; petiscos 28–31; sobremesas 32–35; bebidas 36–42.
  - Consumido = soma das porções digitadas da categoria (campo vazio = 0).
  - Gráfico de bebidas: saudáveis = itens **36–38**; açucaradas = itens **39–42**. A ordem dos dados é [açucaradas, saudáveis].
  - **Se uma das somas for 0, o gráfico usa 1** (só para desenhar a pizza).
- **Conferido na tela** (gráficos Chart.js), com a resposta do item i = (i mod 7) + 1:
  - consumido = **[10, 21, 26, 30, 18, 13, 22, 28]**;
  - recomendado = [21, 14, 7, 42, 42, 7, 7, 7];
  - bebidas, na ordem do gráfico [açucaradas, saudáveis] = **[22, 6]**.

### 10.8 Fenótipo do comportamento alimentar

- 16 itens, escala de 1 a 5, 5 subescalas:

  | Subescala | Itens | Máx. | Baixo | Médio | Alto |
  |---|---|---|---|---|---|
  | Desorganizado | 3 | 15 | ≤ 4 | 5–6 | > 6 |
  | Hedônico | 4 | 20 | ≤ 11 | 12–14 | > 14 |
  | Compulsivo | 2 | 10 | ≤ 3 | 4–6 | > 6 |
  | Emocional | 4 | 20 | ≤ 8 | 9–12 | > 12 |
  | Hiperfágico | 3 | 15 | ≤ 5 | 6–8 | > 8 |

- Há texto de conduta por subescala.
- **Estrutura:**
  - Itens na ordem do cadastro (a tela os agrupa por subescala):

    | Subescala | Itens |
    |---|---|
    | Desorganizado | 9, 11, 16 |
    | Hedônico | 5, 8, 12, 14 |
    | Compulsivo | 13, 15 |
    | Emocional | 2, 4, 7, 10 |
    | Hiperfágico | 1, 3, 6 |

  - Nota de 1 a 5. **Todo item começa marcado com 1.**
  - A classificação usa a **soma** da subescala (o código chama de "média", mas não divide).
  - Cores: BAIXO `#2eca9a` · MÉDIO `#00985E` · ALTO `#006639`.
- **Conferido na tela:** formato "Subescala X — Escala: BAIXO/MÉDIO/ALTO — texto".
  - Tudo 1 → BAIXO.
  - Tudo 5 → ALTO.
  - Tudo 3 → Desorganizado **ALTO** (9 > 6) e Hedônico **MÉDIO** (12).
  - **Limite:** a captura guardou só os primeiros 400 caracteres do resultado. Por isso só Desorganizado e Hedônico foram registrados. As outras 3 subescalas não foram conferidas na tela (§14).

### 10.9 Doshas Ayurveda

- Respostas A/B/C (valores 0/1/2). Conta quantas A, B e C.
- A maior contagem define o dosha: **VATA** (A), **PITTA** (B), **KAPHA** (C).
- Empate: sem resultado. Exige todas as perguntas respondidas.
- **Estrutura:**
  - 24 perguntas, cada uma com 3 opções valendo 0 (A), 1 (B) e 2 (C).
  - Com pergunta em branco, aparece a mesma mensagem do cronotipo ("Há perguntas que ainda não foram preenchidas…").
  - Texto: "Predomínio de respostas {A|B|C} corresponde ao Dosha {VATA|PITTA|KAPHA}".
- **Conferido na tela:**
  - tudo A → "Predomínio de respostas A corresponde ao Dosha VATA";
  - tudo B → "… B … PITTA";
  - tudo C → "… C … KAPHA".

### 10.10 Análise de sinais e sintomas

- 289 sinais em 16 categorias:
  - Cabelos/Pelos, Olhos, Pele, Unhas, Cavidade oral;
  - Sistemas Cardiovascular, Respiratório, Gastrointestinal, Renal, Nervoso, Neuromotor e Endócrino;
  - Articulações, Extremidades, Anemias, Outros.
- Cada sinal aponta nutrientes em **deficiência** e em **excesso**. O resultado conta quantos sinais apontam para cada nutriente:

  | Contagem | Cor |
  |---|---|
  | 1 | amarelo |
  | 2 | #ffa425 |
  | 3 | #fa5423 |
  | ≥ 4 | #e61c24 |

- A base de associações é conteúdo autoral e não foi copiada.
- **Regra de contagem:**
  - Cada sinal marcado acrescenta sua lista de nutrientes (IDs) às listas de deficiência e de excesso.
  - A contagem é feita por ID. Os nutrientes aparecem na ordem crescente do ID (ordem das chaves numéricas de um objeto JS).
  - Lista vazia: "Nenhuma deficiência associada aos sinais" / "Nenhum excesso associado aos sinais".
- **Conferido na tela:**
  - Um nutriente apontado por 1 sinal fica amarelo (classe `amareloRastreamento`).
  - Apontado por 2 sinais: fundo `#ffa425`. Ex.: Vitamina A e Zinco com 3 sinais marcados.
  - Apontado por 3 sinais: fundo `#fa5423`. Ex.: Zinco com 6 sinais marcados.
  - A contagem é separada para deficiência e excesso.
  - A cor de ≥ 4 (`#e61c24`) foi lida só no código.

---

## 11. Demais módulos (sem cálculo)

- **Agenda:** sincronização com o Google, recorrência e conflitos de horário. Tarefas (planner).
- **Pré-consulta:** questionários enviados antes da consulta. As respostas podem ser importadas para anamnese e questionários.
- **Financeiro:** lançamentos, categorias, parcelas, recibos (validação de CPF). Há financeiro geral e por paciente.
  - **Parcelas:** a página envia valor, nº de parcelas e data da cobrança. **A divisão em parcelas é feita no servidor**, e a regra (centavos, datas) não aparece no código do navegador.
  - **Não foi testado**, para não criar lançamentos na conta.
  - Formas de pagamento (códigos 1–7): dinheiro, débito, crédito, cheque, plano, transferência, pix.
- **Documentos e prontuário:**
  - prontuário (registro técnico);
  - atestados e receituários;
  - impressos;
  - orientações, metas, manipulados, anexos e lâminas.
- **App do paciente** (link `paciente.me`):
  - plano alimentar e periodização;
  - diário alimentar com fotos e reações a refeições;
  - metas com check-in;
  - acompanhamento de peso, água, atividade física e nutrientes;
  - cores personalizadas.
- **Marketing, estudos e extensões:** Canvas, mensagens automáticas, NutriLinks, criador de site, mailing, cursos, biblioteca, e-books, WhatsApp Connect, Body3D, HandyMET, Wellhub/TotalPass, IA (anamnese, exames, orientações, metas).
- **Avaliação integrada (360)** e **Fármaco-nutrientes:** só a tela vazia foi vista (§14).

---

## 12. Erros e inconsistências encontrados no WebDiet

| # | Onde | O que acontece | Evidência |
|---|---|---|---|
| 1 | Cálculo energético · EER/IOM 2005 infantil | Com **exatamente 36 meses**, nenhum ramo se aplica e dá exceção de JS ("Cannot read properties of undefined (reading 'toFixed')"). A tela fica com valores antigos. | E108 na tela |
| 2 | Cálculo energético · EER 2023 gestante | Precedência: `… + disposição × injúria` (só a disposição é multiplicada). | código |
| 3 | Cálculo energético · EER 2023 lactante | `+540 − 140 × injúria` (só o 140 é multiplicado). | código |
| 4 | Cálculo energético · EER 2023 infantil 0–2,99 a | O termo de idade usa idade em **anos** (`I`). **Revisado:** a tabela da Health Canada para as equações NASEM 2023 também usa anos, então **provavelmente não é erro**. O relatório NASEM em si não foi lido por completo. | código + literatura |
| 5 | Cálculo energético · injúria "Queimadura 100%" | Rótulo "2.100", mas o valor usado é 2,0. | E32 na tela |
| 6 | Cálculo energético · Henry < 3 anos | Sem equação: a TMB não é recalculada (fica a anterior). | código |
| 7 | Cálculo energético · Katch-McArdle | Usa a lista de fatores do EER (1,00/1,11/1,25/1,48…) em vez da lista padrão. | E03 na tela |
| 8 | Cálculo energético · Schofield meninas 3–10 a | Coeficiente da estatura 161,08; a forma usual (Schofield 1985, com peso e estatura) traz 161,8. A busca não achou fonte primária que confirme um ou outro. **Continua a verificar.** | código |
| 9 | Programação de peso | Mostra o valor arredondado e aplica o truncado (ex.: −642 / −641). | na tela |
| 10 | Antropometria · estimativa de peso (Chumlea 1988) | As equações estão com o **sexo trocado** em relação à forma usualmente citada: H usa a equação de −62,35 (feminina) e M a de −81,69 (masculina). A busca não achou o artigo original. **Continua a verificar.** | código, na tela |
| 11 | Antropometria · Pollock 3 feminino | Constante 1,099421; o original (Jackson, Pollock & Ward 1980) traz **1,0994921**. **Confirmado** em fontes secundárias independentes (pacote R `bodycomp`; artigo de divulgação). Diferença no %G ≈ 0,03 ponto. | código + literatura |
| 12 | Antropometria · %G | Acima de 65 anos não há classificação (vazio) e a referência anterior continua na tela. | A41–A44 na tela |
| 13 | Antropometria · RCQ | A partir de 70 anos não há classificação (texto anterior permanece). | código, na tela |
| 14 | Antropometria · CMB p50 | Meninas de 4 anos = 11 (fora da sequência 13,2 → 14,2). | código |
| 15 | Infantil · IMC/idade | Meninas de 25–60 meses usam os LMS dos meninos. | comparação com a OMS |
| 16 | Infantil · Slaughter | Meninos com TR+SE usam sempre 0,783Σ + 1,6 (o original tem outra equação para Σ ≤ 35). | código |
| 17 | Infantil · texto | Classe "\tObesidade" começa com TAB. | código |
| 18 | Gestante · aporte | Sem peso registrado, calcula contra 0 kg ("+7431 Kcal/dia"). | na tela |
| 19 | Gestante · DCT 16 anos | Corte p5 = 1,5 (provável 10,5). | código |
| 20 | Planejamento · kcal não proteica/g N planejada | Usa (gPTN×9 + gLIP×4) no lugar de (gLIP×9 + gCHO×4). | na tela |
| 21 | Cronotipo (MEQ) | Item 3 (despertador) com pontuação invertida; item 12 (cansaço às 23 h) com 1/2/3/4 no lugar de 0/2/3/5; texto "de 43 possíveis" errado. | código |
| 22 | Disbiose | Soma máxima real = 50, mas a faixa vai até 49 (50 pontos fica sem classificação). | **na tela:** "50 pontos de 49 possíveis", sem texto |
| 23 | Doshas | Empate entre A/B/C não gera resultado. | código |
| 24 | Referências de micronutrientes · 0–6 meses | Selênio exibido como **"15 mg"**; a DRI é 15 **mcg**. Os outros perfis mostram mcg. O % de adequação compara números, então a conta não muda, mas o rótulo está errado. | na tela (§8.10) |
| 25 | Lista de compras · método por alimentos | `final.concat(...)` sem atribuição descarta os ingredientes de receitas **substitutas**. `parseInt(origem) == "Receita"` nunca é verdadeiro, então a receita substituta entra pelo nome de compra. | código |
| 26 | Lista de compras · método por equivalentes | O diálogo oferece "com" ou "sem" receitas, mas `importarCompras2()` ignora a escolha. | código |
| 27 | Alimento próprio | `gorduratrans` não é enviado ao salvar (os outros micronutrientes vão como "0"). A kcal automática soma fibras×2 sobre o CHO digitado; se o rótulo já inclui fibra no CHO, a fibra é contada duas vezes. | código, envio bloqueado |
| 28 | Receitas · kcal por ingrediente | A mesma linha aparece com 0 casas ("256Kcal") ou 1 casa ("117.6 Kcal"), conforme foi redesenhada ou recalculada. Os totais não são afetados. | na tela |
| 29 | Antropometria · referência de %G abaixo de 16 anos | Não há referência ("Entre x% e y%") para menores de 16 anos; a tela continua mostrando a do caso anterior (ex.: menina com a referência masculina de 26–35 anos). | na tela (A60, A62) |
| 30 | Planejamento por alimentos · adequação da kcal não proteica/g N | `calcularCardapio()` chama `mostrarReferencias()` antes de `graficoMacros()`, e a adequação lê o **texto** de `#gNPrescrita`: usa o valor do cálculo **anterior**. Ao abrir o plano, o texto ainda é o inicial do HTML ("0 Kcal"): paciente de teste com "-72 Kcal" ao abrir e "26 Kcal" depois de recalcular. No método por equivalentes a ordem é a outra e não há atraso. | na tela e no código (§15.9) |
| 31 | Planejamento · metas em g/kg | O modal refaz o GET só ao digitar PTN, LIP ou CHO (`onkeyup="recalcularRef()"`); o campo do peso não tem esse evento. Mudar só o peso deixa o GET antigo na kcal planejada e na adequação de kcal. | código (§15.9) |
| 32 | Planejamento · análise calórica | Com 0 kcal no plano, %CHO = 100 − 0 − 0: a tela mostra "0.0 Kcal - 100.0%" no CHO. | código (§15.9) |

Para a Etapa 3: o app novo deve **reproduzir os resultados conferidos** nos casos normais. Nos itens desta tabela, a decisão entre "igual ao WebDiet" e "corrigido" precisa ser tomada e documentada caso a caso.

---

## 13. Evidências e rastreabilidade (REA)

| Página | REA Evidence ID |
|---|---|
| lista de alvos CDP | `ev_72f21905ae8a0bf3cdcd99101bd09963fcb3e06675412648bb9b368ae5659c67` |
| pacientes.php (cálculo energético) | `ev_2c8f960775a4edc8a97d32c42ab2d6c6b7eb1c0f5f48cadac2ffb67abafd1e31` |
| antropometria.php | `ev_b606b698716c0ca458650d1c3a1c817c53e01161a640d0dcaa4db7e8a4dc1b75` |
| infantil.php | `ev_a05b57cb0c823cc78422582ccdb6c2382245252dca0a5e3bba4bcb0b2fb795b8` |
| gestante.php | `ev_28dcd62effa160f17642bc478a25cbadb8671c20b3bf346bfe684a625e2eabed` |
| metodoPlanning.php | `ev_4b91a8049e3607e68f0fdd4a65ba77370880f7c97047da6c976ba08c23266ebf` |
| metodoWebdiet.php | `ev_93e7c0936fc9648079856718fc303cdf320ba33cd2178c042ac40f2ac0736377` |
| registroExames.php | `ev_98d0198941bc70695584c8236d66cac6f05228fe3d307e6e72ae64b879d17491` |
| rastreamento.php | `ev_a8aeb317cb3114220c6bb49509d8d2b15855b614bd32b63644e340220094d5d7` |
| sarcopenia.php | `ev_b5e0ea291cdfe7a1ebfc811261d637901257faefeeca2a50495dfea354a85fa2` |
| diabetes.php | `ev_39f81d40b40dae6df227cb796892eb425b6ab3785568e2f8b6146db0a9e0139c` |
| cafeina.php | `ev_9d0b18f82c21f7f769fa9901179c85339a4ce4f9431c237fad569c9644222129` |
| cronotipo.php | `ev_2d9f188a08962edf6f74249039e5b715266e5b2ae76d33a9e21143b2925f9507` |
| sinaisesintomas.php | `ev_b57b15ab245ff77945e100718d015333c7bfa749bb1e867564005d07053f69a8` |
| disbiose.php | `ev_9ddf200827cd5a76098b24925560af32459b47f56d74121e54800a2597a69eb9` |
| qfa.php | `ev_5f73e19c1ce4540fec864521a6ab1665719a6ffb7df43ca309448fe645ee09aa` |
| fenotipo.php | `ev_509f2d23a44106b5ade68492bd9490434d69466cf59f2909c16bc053ef13ce9d` |
| doshasa_ayurveda_questionario.php | `ev_261c23289525558df431f66942f6290b5d94ece66f916fcf981f7398d3634b70` |
| receitas.php (receitas e alimento próprio) | `ev_c259e05597fc243dd65efbe3a56510149b15d499b754391c3f4884358f84837d` |

A lista de compras e o piloto automático estão nos scripts de `metodoPlanning.php` e `metodoWebdiet.php`, já capturados acima.

**Fluxo REA usado:**

1. `rea list-browser-targets <cdp>`
2. `rea inspect-web-page <cdp> <alvo> --include-script-sources`
3. `rea export-web-scripts <captura> <pasta>`
4. Leitura do script da página e reimplementação independente.
5. Casos de teste executados na interface do WebDiet (Playwright via CDP).
6. Comparação valor a valor.

As capturas brutas contêm tokens de sessão e **não** foram versionadas.

**Arquivos em `docs/webdiet-evidencias/`** (somente dados de teste fictícios e dados públicos):

| Arquivo | Conteúdo |
|---|---|
| `tela_energia.json` | 110 casos de TMB/GET (entrada + saída da tela) |
| `tela_energia_extras.json` | programação de peso, MET, fórmula de bolso, GET manual |
| `tela_antropometria_adultos.json` | 73 casos (IMC, dobras, %G, ósseo/residual/muscular, CMB, RCQ, bioimpedância, estimativas) |
| `tela_antropometria_infantil.json` | 35 casos (z-escores e Slaughter) |
| `tela_gestante.json` | 5 cenários × 40 semanas + testes semanais |
| `tela_planejamento_alimentos.json` | cardápio TACO (9 itens), metas, micronutrientes |
| `tela_planejamento_equivalentes.json` | porções, médias e desvios dos grupos, totais |
| `lms_oms_mensal.json` | tabelas LMS mensais usadas pelo WebDiet (dados OMS) |
| `curvas_ganho_peso_gestacional.json` | percentis e faixas por semana (curvas brasileiras) |
| `exames_catalogo_nomes.txt` | nomes dos 196 exames do catálogo |
| `inventario_abas_paciente.json` | títulos, botões e rótulos das 21 abas |
| `tela_receita.json` | receita calculada com 4 ingredientes TACO: linhas, totais, porção automática e "gerar medida" |
| `tela_alimento_rotulo.json` | alimento por rótulo: kcal automática e valores por 100 g que seriam enviados (envio bloqueado; sem tokens) |
| `tela_dris.json` | referências de micronutrientes de 15 perfis (sexo, idade, gestante, lactante) |
| `tela_q_<nome>.json` (10 arquivos) | questionários: respostas de cada cenário e texto exibido |
| `tela_q_fronteiras.json` | fronteiras do rastreamento (30/31, 40/41, 100/101) e média 4 da cafeína |

**Literatura consultada na segunda passada** (para os itens 4, 8, 10 e 11 de §12):

- NASEM 2023, *Dietary Reference Intakes for Energy*: <https://www.nationalacademies.org/read/26818/chapter/18>
- Health Canada, *Equations to estimate energy requirement*: <https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/equations-estimate-energy-requirement.html>
- Jackson, Pollock & Ward 1980 (3 dobras, mulheres), reproduzido em:
  - <https://rdrr.io/github/GleidsonUERN/bodycomp/man/Jackson.3sites.html>
  - <https://livestrong.com/article/354812-body-fat-percentage-test-using-jackson-pollock-formula>
- Schofield 1985: <https://en.wikipedia.org/wiki/Schofield_equation> (não traz a versão com estatura; item 8 continua aberto).

---

## 14. Pendências — o que não foi verificado

Resolvido na segunda passada:

- os 10 questionários foram conferidos na tela;
- referências de micronutrientes de 15 perfis (§8.10);
- idade na antropometria é calculada na data da avaliação (§5.1);
- receitas, alimento próprio e lista de compras (§8.6–8.8);
- itens 4 e 11 de §12 revistos na literatura.

Ainda em aberto:

- **Extensões pagas:** Consciência alimentar, LEAF-Q, LEAM-Q, FIB-4, Avaliação imunológica, Magnésio e Food noise. Não acessadas, porque exigem compra.
- **Questionários, detalhes:**
  - fenótipo: só Desorganizado e Hedônico foram registrados na tela;
  - cafeína: a versão completa (47 itens) não foi rodada na tela;
  - sinais e sintomas: a cor de ≥ 4 foi lida só no código.
- **Referências de micronutrientes:** faixas 7–12 m, 19–30 a, meninas de 1–8 a, gestante 19–30, lactante ≤ 18 e 19–30. Também não foi testado se a troca de faixa ocorre exatamente no aniversário.
- **Financeiro:** a divisão de parcelas é feita no servidor e não foi testada.
- **Lista de compras com IA:** a reescrita pela IA (1 crédito) não foi executada; só o cálculo enviado foi lido no código.
- **Não analisados:**
  - Avaliação integrada (360), Fármaco-nutrientes, Body3D e HandyMET;
  - funções de IA (pagas);
  - periodização do plano e o PDF;
  - estatísticas.
- **Literatura:** itens 8 (Schofield 161,08 × 161,8) e 10 (Chumlea, sexo trocado) de §12 precisam do artigo original.
- **Itens criados na conta:** o paciente "Teste Rea" (`18236779`) e seus registros continuam lá. A exclusão depende de autorização do responsável.

---

## 15. Lacunas encontradas na reconstrução

Na Etapa 3 o app `nutri-studio/` reimplementou os cálculos a partir deste relatório. Em alguns pontos o texto não bastava, e a regra teve de ser **inferida das evidências** ou **decidida**. Esta seção lista esses pontos para que o relatório e o código digam a mesma coisa.

- **Inferido:** a regra foi tirada dos valores da tela em `webdiet-evidencias/`, e o código reproduz esses valores.
- **Decidido:** nem o relatório nem as evidências cobrem o caso. A escolha está documentada no módulo indicado.

Nenhum destes pontos mexe nos casos conferidos: os testes do app (`npm test`) continuam iguais à tela em todos eles.

### 15.1 Contagem de protocolos do cálculo energético

- O §2.2 falava em **26 protocolos**, mas o §4 documenta **23**: valores 1–14 e 21–29.
- Os valores **15 a 20** não aparecem em nenhuma evidência nem no código lido. Podem ser opções ocultas ou removidas, ou a primeira contagem estava errada.
- **Resolvido na conta (13/10/2026, só leitura):** a lista "Escolha sua fórmula" tem **23 opções**, de valores 1–14 e 21–29. Os valores 15–20 não existem; a contagem de 26 estava errada. Rótulos e ordem estão no §15.9, e o app usa os mesmos.
- Cobertura das evidências de tela por fórmula:
  - `tela_energia.json`: 1–9, 12, 13, 21–23 e 25–29;
  - `tela_energia_extras.json`: 10 e 11;
  - 14 (TMB manual) e 24 (HandyMET): nenhuma conferência de tela, só a regra do §4.3/§4.5.

### 15.2 Cálculo energético (§4)

| Ponto | O que o relatório diz | O que foi preciso | Tipo |
|---|---|---|---|
| Lista de fatores da fórmula 22 (FAO/WHO infantil) | Só a da 21 (§4.4.2) | A 22 usa **a mesma lista da 21**: "Não se aplica" (1) até 36 meses e as listas EER infantil por sexo acima disso (E56, E61, E66, E71) | inferido |
| Limite de 36 meses nas fórmulas 21 e 22 | "até 36 meses" | **Inclusive**: com exatamente 36 meses vale a lista de até 36 meses e a TMB da 21 ainda é calculada (E76–E108) | inferido |
| Ids das opções de injúria | Só os valores | Conferidos 4 (Sepse 1,3), 12 (Queimadura 100%) e 16 (Doença cardiopulmonar 0,9). Os demais seguem a ordem da lista, com 0 = "Não utilizar" | inferido |
| EER 2023 infantil (27): injúria e adicionais | Não diz | Como na EER 2023 adultos: equação × injúria + VENTA + MET + gestante | decidido |
| EER 2023 lactante (29) com menos de 19 anos | Não diz | Equação feminina de 3–18 anos **sem** custo energético e sem o +20 (E55) | inferido |
| Meses de amamentação (29) | "meses desde o parto" | (ano − ano do parto) × 12 + (mês − mês do parto), **sem olhar o dia** | inferido |
| Base da fórmula de bolso (11) antes do fator | GET = soma dos g/kg × peso × kcal | O fator e a injúria multiplicam o GET **já arredondado** (`toFixed(0)`), como no GET manual. No caso conferido (2800 kcal exatos) não há diferença | decidido |
| Rótulos das listas de fator EER 2005, HandyMET e categorias 27/28 | Só os valores | O app mostra o próprio valor ou "Categoria n" | decidido |
| Mensagens de aviso | Algumas só pelo começo (ex.: "A fórmula EER 2023 já considera o adicional energético…") | Textos próprios, marcados em `MENSAGENS` (`calc/energia.js`) | decidido |

### 15.3 Antropometria (§5 e §6)

- **RCQ:** o §5.6 só cita `toFixed(2)`.
  - A **classificação usa o valor bruto**, com limites `<` estritos.
  - Exemplo: 74/98 = 0,7551 aparece como "0.76", mas uma mulher de 60–69 anos fica em "Risco baixo", porque 0,7551 < 0,76 (inferido das evidências de adultos).
- **CMB:**
  - A adequação usa a CMB **sem arredondar** (A33: 27,29/28,6 → "95.4%"; com 27,3 daria 95,5).
  - A CMB **exige a dobra tricipital** e a circunferência do braço; sem a DCT, a tela mostra "-" (A68/A69).
  - Inferido.
- **Somatório no protocolo "nenhum":** a soma das 10 dobras aparece **crua** ("156 mm", "178.5 mm"), sem as 2 casas dos outros protocolos (A07, A19, A45–A73). Inferido.

### 15.4 Acompanhamento gestacional (§7)

- **Semanas 1–9:** o §7.3 diz "interpolação linear de ppg até o valor esperado na 10ª semana".
  - As evidências mostram que o esperado da 10ª já é alcançado **na 9ª**: `esperado(s) = ppg + (esp10 − ppg) · s/9`, com s = 1…9.
  - Exemplo: ppg 62 kg, Saudável: 60,76 kg na 9ª e na 10ª semana.
  - Inferido de `tela_gestante.json`.
- **Semana inicial do aporte:** sem peso registrado, `ult` = 1 (§7.6). O WebDiet então calcula contra 0 kg (§12 #18).
  - O app mantém `ult` = 1 e devolve o aporte `null` + aviso.
  - Decidido, conforme a política de erros.

### 15.5 Planejamento, equivalentes e DRIs (§8)

- **CHO da última linha de cada refeição:** sai "x.xg" (sem espaço); nas outras linhas, "x.x g". Visto nas 3 refeições da evidência. Inferido.
- **Densidade:**
  - só o texto da faixa "baixa" foi visto na tela;
  - os outros seguem o mesmo molde, com os limites do §8.3;
  - inferido.
- **Equivalentes, desvio-padrão:**
  - é o desvio populacional em torno da média **sem arredondar**, com cada valor arredondado em 1 casa antes;
  - só assim o desvio de fibras do g4 bate bit a bit;
  - inferido.
- **DRIs, limites de faixa** (o §8.10 diz que a troca no aniversário não foi testada):
  - idade em meses ou anos **completos** na data de referência, com limites inclusivos;
  - 7–12 meses = 7 a 11 meses completos;
  - decidido.
- **DRIs, faixas não observadas** (7–12 m, 19–30 a, meninas de 1–8 a, gestante 19–30, lactante ≤ 18 e 19–30):
  - valores das tabelas oficiais NASEM, marcados `nasem-oficial` em `dados/dris.json`;
  - decidido.

### 15.6 Questionários (§10)

- **Disbiose, item sem resposta:** não soma. O relatório não diz o que o WebDiet faz; o app faz como no FINDRISC e na sarcopenia. Decidido.
- **Itens que vêm da tabela ou do código, sem conferência de tela** (conforme o §14):
  - fenótipo: as subescalas Compulsivo, Emocional e Hiperfágico vêm da tabela do §10.8 (só Desorganizado e Hedônico foram vistos);
  - cafeína: a versão completa vem do código;
  - sinais e sintomas: a cor para ≥ 4 vem do código.
- **Doshas:** com as 24 respostas, a evidência ainda mostra a mensagem de incompleto ao lado do resultado. É provavelmente um texto antigo que o código não limpa. **Não reproduzido.**
- **Textos das perguntas e das opções:** não foram copiados (§1.2).
  - As opções sem rótulo no relatório usam "Opção k (N pts)".
  - A interface mostra os itens como "Item n" + categoria.

- **Equivalentes, metas e adequação:** a conta mostra que a página por equivalentes também tem metas e adequação (§15.9), sobre os totais **sem arredondar**. O app faz o mesmo.

### 15.7 O que continua dependendo do usuário

- As divergências científicas do §12 continuam **iguais ao WebDiet**. A lista completa, com o comportamento de cada uma, está na página "Referências" do app.
- A decisão de corrigir ou manter cada uma, os textos dos questionários e a base de alimentos estão em `docs/PROXIMOS-PASSOS.md` ("Decisões que dependem do usuário").

### 15.8 Base TACO (terceira sessão)

A TACO 4ª edição oficial (planilha do NEPA/UNICAMP) foi convertida para o app e comparada com os 8 alimentos que a evidência do planejamento marca como origem TACO.

- **Arredondamento:** é o da tabela publicada, com meio para cima (kcal 0 casas; PTN, LIP, CHO e fibras 1 casa; Ca, Mg, P, Na, K 0 casas; Fe e Zn 1 casa; Cu 2 casas). Com ele, macros e minerais saem iguais aos do WebDiet. Inferido.
- **Gordura trans:** o WebDiet usa 18:1t + 18:2t com **2 casas** (dendê 0,14; pão francês 0,35 + 0,02 = 0,37). Inferido.
- **"Retinol" do WebDiet:** é a coluna **RE** da TACO, não a coluna "Retinol" (banana prata: RE 32 → 32; ovo cozido: só Retinol → 0). Inferido.
- **Diferenças que são dado do WebDiet, não conversão:**
  - "Leite integral" (origem TACO no WebDiet) tem 60,3 kcal, 3,22 / 3,25 / 4,52 g, mas na TACO esse item está sem análise ("*");
  - o arroz cozido aparece sem ácidos graxos (na TACO, saturada 0,2);
  - no azeite de dendê, a monoinsaturada é 4,01 no WebDiet e 40,1 na TACO (vírgula deslocada), e a poli-insaturada é 16,1 contra 16,6.
- **Resultado:** 249 de 256 valores iguais. O almoço do §8.4 montado com os alimentos da TACO em gramas dá o mesmo total da tela (398 g; 37,1 / 23,5 / 54,8 g; 587 kcal). Teste em `nutri-studio/test/taco.test.js`.

### 15.9 Observado na conta (13/10/2026)

Com a autorização do usuário, a conta foi aberta **só para leitura**: depois do login, um bloqueio no navegador deixava passar apenas leituras (GET e as chamadas `carregar…`, `buscar…`, `listar…`, `consultar…`); qualquer envio que salvasse ou alterasse algo era cancelado, e nenhum diálogo foi confirmado. Só os planos do paciente de teste "Teste Rea" (id 18236779) foram abertos. Nenhum dado de outro paciente e nenhum conteúdo protegido (base de alimentos, listas de equivalentes, textos) foi copiado. O que a tela mostrou ao abrir os dois planos está em `webdiet-evidencias/tela_planejamento_metas_conta.json`.

**Lista de fórmulas** ("Escolha sua fórmula", nesta ordem): 2 Harris-benedict (1984); 1 Harris-benedict (1919); 8 FAO/WHO (2004); 5 EER/IOM (2005); 26 EER (2023); 3 Katch-McArdle (1996); 4 Cunningham (1980); 6 Mifflin-St Jeor (1990); 7 Mifflin-St Jeor - por MLG (1990); 9 Henry & Rees (1991); 12 Tinsley - Por peso (2018); 13 Tinsley - Por MLG (2018); 11 GET por fórmula de bolso; 14 Colocar TMB manualmente; 10 Colocar GET manualmente; 21 EER/IOM (2005) - Protocolo Infantil; 27 EER (2023) - Protocolo Infantil; 22 FAO/WHO (2004) - Protocolo Infantil; 23 Schofield (1985) - Protocolo Infantil; 25 Min. Saúde - Gestante (2005); 28 EER (2023) - Gestante; 29 EER (2023) - Lactante; 24 HandyMET.

**Metas (modal "Cálculos", igual nas duas páginas de plano):**

- `referencias = [ptn, lip, cho, get, peso, tipo]`. Tipo "bolso" = "Distribuir usando fórmula de bolso (g/Kg)"; "percentual" = "Distribuir usando percentual do GET". Qualquer valor que não seja "percentual" (inclusive vazio ou `null`) conta como bolso.
- **Plano novo:** `referencias` vazio → bolso, tudo 0. Planejada "0.0g" e "0 Kcal"; adequação = prescrito − 0.
- **Trocar o tipo** (`mudarCalculoRef`) zera PTN, LIP, CHO e GET; o peso fica. No bolso, o GET fica desabilitado.
- **Ao digitar PTN, LIP ou CHO** (`recalcularRef`): no percentual, CHO = 100 − PTN − LIP; no bolso, GET = PTN×P×4 + LIP×P×9 + CHO×P×4, ou "-" se ≤ 0 (§12 #31).
- **Importar um cálculo energético** (`importarCalculo2(GET, peso)`): passa para percentual, zera os campos e preenche peso e GET.
- `mostrarReferencias()` usa o CHO% e o GET **guardados** (não recalcula). Gramas com `toFixed(1)` (texto "100.0g"); g/kg só com peso > 0; kcal não proteica/g N planejada com o erro do §12 #20, em forma de número ("72.9 Kcal", "0 Kcal").
- **Adequação:** prescrito − planejado (1 casa; kcal e gN 0 casas); % = prescrito/planejado × 100 com 0 casas; > 105 vermelho #EE091D, 95–105 verde #83C688; senão neutro (preto no método por alimentos, **cinza #8E8E92** nos equivalentes). No método por alimentos, o gN tem o atraso do §12 #30.

**Totais (`graficoMacros()`):**

- gramas e kcal em forma de número: `parseFloat(x.toFixed(1)) + "g"` ("58g", não "58.0g") e `parseFloat(K.toFixed(0))`;
- g/kg só com peso das metas > 0; CHO disponível = (CHO − fibras).toFixed(1), com g/kg; fibras com g/kg só nos equivalentes;
- kcal não proteica/g N = (LIP×9 e CHO×4, **cada um com 1 casa**) / (PTN/6,25), 1 casa, em forma de número;
- análise: kcal de PTN e LIP com 1 casa, em forma de número ("202 Kcal"); os % saem delas; %CHO = 100 − %PTN − %LIP; kcal do CHO = (K − kcal PTN − kcal LIP).toFixed(1) (§12 #32);
- densidade (só por alimentos) = K / peso, 2 casas; campos "Resumo" (PTN, LIP, CHO, kcal) nas duas páginas;
- nos equivalentes, `fibrasPlanejada` e `fibrasAdequacao` são "-" fixos.

**`check()` do painel:** vazio, NaN, ±Infinity e texto não numérico → 0; "2,5" → 0 (vírgula não é aceita); `null` → NaN. O app aceita vírgula decimal nos formulários (convenção brasileira); nos números que vêm do WebDiet não há vírgula.

Tudo isso está nos testes `nutri-studio/test/totaisWebdiet.test.js` (textos esperados tirados da transcrição literal das duas funções) e no teste de ponta a ponta.
