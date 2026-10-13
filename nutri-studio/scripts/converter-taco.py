# Converte a TACO 4ª edição (planilha oficial do NEPA/UNICAMP, https://nepa.unicamp.br/) para
# src/dados/taco.json, no formato de alimentos do nutri-studio. Ferramenta de desenvolvimento: o app usa só o
# JSON gerado. Requer Python 3 e openpyxl.
#   python3 scripts/converter-taco.py Taco-4a-Edicao.xlsx src/dados/dris.json src/dados/taco.json
# Conferido em test/taco.test.js contra os alimentos TACO que a tela do WebDiet mostrou.
import sys, json, openpyxl
from decimal import Decimal, ROUND_HALF_UP
origem, chaves_json, saida = sys.argv[1], sys.argv[2], sys.argv[3]
CHAVES = [n['chave'] for n in json.load(open(chaves_json, encoding='utf8'))['nutrientes']]

def num(v):
    if v is None: return 0.0
    if isinstance(v, (int, float)): return float(v)
    s = str(v).strip().replace(',', '.')
    try: return float(s)
    except ValueError: return 0.0  # Tr, NA, *, vazio

def arred(v, casas):
    d = Decimal(repr(num(v))).quantize(Decimal(1).scaleb(-casas), rounding=ROUND_HALF_UP)
    return float(d) if casas else int(d)

wb = openpyxl.load_workbook(origem, read_only=True, data_only=True)
cmv, ag = {}, {}
grupo = None
excluidos = []
for row in wb['CMVCol taco3'].iter_rows(min_row=4, values_only=True):
    n, desc = row[0], row[1]
    if isinstance(n, (int, float)) and desc:
        # "*" na energia = amostra não analisada na TACO: o alimento ficaria com 0 kcal, então fica de fora.
        if str(row[3]).strip() == '*':
            excluidos.append({'numero': int(n), 'nome': str(desc).strip()})
            continue
        cmv[int(n)] = (grupo, str(desc).strip(), row)
    elif isinstance(n, str) and n.strip() and all(c is None or str(c).strip() == '' for c in row[1:]):
        grupo = str(n).strip()  # linha de grupo (o cabeçalho que se repete a cada página tem outras células)
for row in wb['AGtaco3'].iter_rows(min_row=4, values_only=True):
    if isinstance(row[0], (int, float)): ag[int(row[0])] = row

alimentos = []
for n in sorted(cmv):
    grupo, desc, r = cmv[n]
    a = ag.get(n)
    micro = {
        'gordurasat': arred(a[2], 1) if a else 0.0, 'gorduramono': arred(a[3], 1) if a else 0.0,
        'gordurapoli': arred(a[4], 1) if a else 0.0,
        # Como no WebDiet: trans = 18:1t + 18:2t, com 2 casas (as colunas da TACO têm 2 casas).
        'gorduratrans': arred(num(a[23]) + num(a[24]), 2) if a else 0.0,
        'colesterol': arred(r[7], 0), 'fibras': arred(r[9], 1), 'ca': arred(r[11], 0), 'mg': arred(r[12], 0),
        'p': arred(r[15], 0), 'fe': arred(r[16], 1), 'na': arred(r[17], 0), 'k': arred(r[18], 0), 'co': arred(r[19], 2),
        'zn': arred(r[20], 1),
        # Como no WebDiet: o campo "re" (retinol) recebe a coluna RE da TACO (banana: 32; ovo: 0).
        're': arred(r[22], 0), 'rea': arred(r[23], 0), 'tiamina': arred(r[24], 2),
        'riboflavina': arred(r[25], 2), 'piridoxina': arred(r[26], 2), 'niacina': arred(r[27], 2), 'vitc': arred(r[28], 1),
    }
    alimentos.append({
        'id': f'taco-{n}', 'numero': n, 'nome': desc, 'grupo': grupo, 'unidade': 'g', 'origem': 'TACO',
        'kcal': arred(r[3], 0), 'ptn': arred(r[5], 1), 'lip': arred(r[6], 1), 'cho': arred(r[8], 1), 'fibras': arred(r[9], 1),
        'micros': [micro.get(c, 0) for c in CHAVES], 'mc': [],
    })
meta = {
    '_fonte': 'TACO - Tabela Brasileira de Composição de Alimentos, 4ª edição revisada e ampliada. NEPA/UNICAMP, Campinas, 2011. Planilha oficial: https://nepa.unicamp.br/',
    '_conversao': 'nutri-studio/scripts/converter-taco.py. Valores por 100 g, arredondados como na tabela publicada; "Tr", "NA" e vazio = 0. Gordura trans = 18:1t + 18:2t (2 casas) e "re" = coluna RE, como no WebDiet. Selênio, folato, B12, vitaminas D e E e álcool não constam da TACO (0).',
    '_excluidos': excluidos,
}
json.dump({**meta, 'n': len(alimentos), 'alimentos': alimentos}, open(saida, 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
from collections import Counter
print(len(alimentos), 'alimentos;', len(excluidos), 'excluídos;', dict(Counter(a['grupo'] for a in alimentos)))
