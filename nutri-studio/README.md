# Nutri Studio (rascunho, em pausa)

**Status: incompleto e NÃO verificado contra o WebDiet.**

O ambiente de desenvolvimento bloqueou o acesso a `webdiet.com.br` (política de rede, HTTP 403),
então o app original não pôde ser examinado com a REA. Este rascunho guarda apenas o trabalho feito
até a pausa:

- `src/calc/`: equações publicadas na literatura (antropometria, composição corporal por dobras,
  gasto energético, macronutrientes, plano alimentar, ganho de peso gestacional). Cada função cita
  a referência.
- `tests/`: testes com valores calculados de forma independente (`npm test`, usa só o Node).
- `src/data/alimentos.js`: base de alimentos digitada como ponto de partida. **Conferir com a TACO oficial.**
- Interface com os tokens do Kryven Design System v1.1, ainda incompleta: as abas Energia, Plano,
  Evolução e as páginas Alimentos, Calculadoras, Configurações e Impressão ainda não foram escritas.

Próximo passo: liberar `webdiet.com.br` na rede do ambiente, examinar o app original e então
alinhar ferramentas e cálculos ao que ele faz.
