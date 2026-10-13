# Extrai as medidas caseiras da "Tabela de Medidas Referidas para os Alimentos Consumidos no Brasil" (IBGE,
# Pesquisa de Orçamentos Familiares 2008-2009) para src/dados/medidas_ibge.json, a consulta de medidas da página
# "Meus alimentos". Ferramenta de desenvolvimento: o app usa só o JSON gerado. Requer Python 3 e xlrd.
#   Planilha: https://ftp.ibge.gov.br/Orcamentos_Familiares/Pesquisa_de_Orcamentos_Familiares_2008_2009/
#             Tabela_de_Medidas_Referidas_para_os_Alimentos_Consumidos_no_Brasil/tabelamedidas_bd.zip
#   python3 scripts/medidas-ibge.py tabelamedidas_bd.xls src/dados/medidas_ibge.json
#
# Cada linha da planilha liga uma medida RELATADA na pesquisa a um peso em gramas, tirado de uma referência
# (Pinheiro et al., Guia Alimentar etc.). Muitas são aproximações da pesquisa (ex.: "caneca" de arroz = "prato
# fundo raso", 100 g). Ficam só as linhas em que a referência descreve a própria medida ("Arroz cozido - colher de
# sopa cheia" para COLHER DE SOPA) e as porções do Guia Alimentar. Grama, quilo, mililitro e litro saem (o app já
# tem "grama(s)" e "mililitro(s)").
import sys, json, unicodedata

sys_path = [p for p in sys.argv[1:] if p.startswith('--lib=')]
if sys_path:
    sys.path.insert(0, sys_path[0][len('--lib='):])
args = [a for a in sys.argv[1:] if not a.startswith('--lib=')]
import xlrd

origem, saida = args[0], args[1]
SEM_MEDIDA = {'grama', 'quilo', 'mililitro', 'litro'}


def norm(s):
    s = unicodedata.normalize('NFD', str(s)).encode('ascii', 'ignore').decode()
    return ' '.join(s.lower().replace('´', "'").split())


def frase(s):
    s = ' '.join(str(s).split())
    return s[:1].upper() + s[1:].lower() if s.isupper() else s[:1].upper() + s[1:]


s = xlrd.open_workbook(origem).sheet_by_index(0)
itens = {}
for r in range(5, s.nrows):
    row = [str(c.value).strip() for c in s.row(r)]
    if not row[0]:
        continue
    medida, peso, ref = norm(row[5]), row[8], row[10]
    if medida in SEM_MEDIDA:
        continue
    try:
        peso = float(peso)
    except ValueError:
        continue
    if not peso > 0:
        continue
    qualif = ref.rsplit(' - ', 1)[-1].strip() if ' - ' in ref else ''
    if medida == 'porcao':
        if 'porcao' not in norm(ref):
            continue
        nome = 'Porção (Guia Alimentar)' if 'guia alimentar' in norm(ref) else 'Porção'
    elif qualif and (norm(qualif).startswith(medida) or norm(qualif).startswith(medida.split('/')[0].strip())):
        # "colher de arroz/servir" é descrita na referência como "colher de arroz cheia"
        nome = frase(qualif)
    else:
        continue  # aproximação da pesquisa: a referência descreve outra medida
    chave = (row[0], row[2])
    item = itens.setdefault(chave, {
        'nome': frase(row[1]), 'preparo': '' if norm(row[3]) == 'nao se aplica' else frase(row[3]).lower(), 'medidas': [],
    })
    if not any(norm(m['nome']) == norm(nome) for m in item['medidas']):
        item['medidas'].append({'nome': nome, 'peso': round(peso, 2), 'ref': ' '.join(ref.split())})

lista = [i for i in itens.values() if i['medidas']]
dados = {
    '_fonte': 'IBGE, Pesquisa de Orçamentos Familiares 2008-2009: Tabela de Medidas Referidas para os Alimentos Consumidos no Brasil. Rio de Janeiro, 2011.',
    '_conversao': 'nutri-studio/scripts/medidas-ibge.py: só as medidas cuja referência descreve a própria medida e as porções do Guia Alimentar; peso de 1 medida em gramas (ou mL).',
    'n': len(lista), 'alimentos': lista,
}
json.dump(dados, open(saida, 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
print(len(lista), 'alimentos/preparações com', sum(len(i['medidas']) for i in lista), 'medidas')
