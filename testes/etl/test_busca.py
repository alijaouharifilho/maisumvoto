"""Busca (CONTRATO §5): normalização, palavras-chave, prefixos e índice por prefixo."""

import pytest

from etl import busca


def test_normalizar_golden(golden):
    for caso in golden["busca"]["normalizar"]:
        assert busca.normalizar(caso["entrada"]) == caso["saida"]


def test_prefixos_de_consulta_golden(golden, regras_busca):
    for caso in golden["busca"]["prefixosConsulta"]:
        assert busca.prefixos_consulta(caso["entrada"], regras_busca) == caso["prefixos"], caso


def test_cep_golden(golden):
    for caso in golden["busca"]["cep"]:
        esperado = None if caso["arquivo"] is None else (caso["arquivo"], caso["chave"])
        assert busca.chave_cep(caso["entrada"]) == esperado


def test_palavras_chave_ignora_genericas(regras_busca):
    assert busca.palavras_chave("Jardim Botânico", regras_busca) == ["botanico"]
    assert busca.palavras_chave("São José dos Pinhais", regras_busca) == ["jose", "pinhais"]


def test_palavras_chave_reserva_com_tres_letras(regras_busca):
    assert busca.palavras_chave("Vila Sul", regras_busca) == ["sul"]


def test_palavras_chave_ultimo_recurso_usa_genericas(regras_busca):
    assert busca.palavras_chave("Vila Nova", regras_busca) == ["vila", "nova"]
    assert busca.palavras_chave("Centro", regras_busca) == ["centro"]


def test_palavras_chave_sem_nada_aproveitavel(regras_busca):
    assert busca.palavras_chave("A B", regras_busca) == []


def test_palavras_chave_sem_repeticao(regras_busca):
    assert busca.palavras_chave("Rio Rio Branco Branco", regras_busca) == ["branco"]


def test_prefixos_consulta_vazia(regras_busca):
    assert busca.prefixos_consulta("  ,  ", regras_busca) == []


def test_prefixos_consulta_bairro_e_cidade_sem_virgula(regras_busca):
    # Tijuca só está em tij.json; antes a consulta pedia só jan.json (a palavra mais longa) e não achava nada.
    assert busca.prefixos_consulta("Tijuca Rio de Janeiro", regras_busca) == ["tij", "jan"]


def _item(t, n, e, m=None):
    item = {"t": t, "n": n, "uf": "RR", "lat": 2.8, "lon": -60.6, "e": e}
    if m is not None:
        item["m"] = m
    return item


def test_indexar_poe_item_em_cada_prefixo_e_ordena_por_eleitorado(regras_busca):
    itens = [
        _item("m", "São José dos Pinhais", 100),
        _item("b", "Jardim Botânico", 300, m="Curitiba"),
        _item("l", "Escola Estadual José Bonifácio", 200, m="Curitiba"),
    ]
    indice = busca.indexar(itens, regras_busca)
    assert [i["n"] for i in indice["jos"]] == ["Escola Estadual José Bonifácio", "São José dos Pinhais"]
    assert [i["n"] for i in indice["pin"]] == ["São José dos Pinhais"]
    assert [i["n"] for i in indice["bot"]] == ["Jardim Botânico"]
    assert [i["n"] for i in indice["bon"]] == ["Escola Estadual José Bonifácio"]
    assert "jar" not in indice


def test_indexar_desempata_de_forma_deterministica(regras_busca):
    itens = [_item("b", "Pinheiros", 10, m="B"), _item("b", "Pinheiros", 10, m="A")]
    um = busca.indexar(itens, regras_busca)
    outro = busca.indexar(list(reversed(itens)), regras_busca)
    assert um == outro
    assert [i["m"] for i in um["pin"]] == ["A", "B"]


def test_indexar_mesmo_prefixo_duas_palavras_entra_uma_vez(regras_busca):
    indice = busca.indexar([_item("l", "Pinheiro Pinhal", 5, m="X")], regras_busca)
    assert len(indice["pin"]) == 1


@pytest.mark.parametrize("texto", ["80010-000", "80010000", "80.010-000", "80010 000"])
def test_chave_cep_aceita_com_e_sem_hifen(texto):
    assert busca.chave_cep(texto) == ("800", "80010000")


def _locais():
    import math

    import pandas as pd

    linhas = [
        # uf, mun, municipio, bairro, nome, eleitores, lat_regiao, lon_regiao
        ("RR", "03018", "Boa Vista", "Centro", "Escola Estadual Gonçalves Dias", 300, 2.8, -60.6),
        ("RR", "03018", "Boa Vista", "Centro", "Escola Estadual Gonçalves Dias", 100, 2.8, -60.6),
        ("RR", "03018", "Boa Vista", "Canarinho", "Escola Lobo d'Almada", 200, 2.9, -60.7),
        ("RR", "03018", "Boa Vista", "", "Escola Sem Bairro", 50, math.nan, math.nan),
        ("RR", "03115", "Normandia", "Rural", "Escola Indígena", 80, math.nan, math.nan),
    ]
    colunas = ["uf", "mun", "municipio", "bairro", "nome", "eleitores", "lat_regiao", "lon_regiao"]
    return pd.DataFrame(linhas, columns=colunas)


def test_itens_busca_municipio_bairro_e_local():
    itens = busca.itens_busca(_locais())
    por_tipo = {t: [i for i in itens if i["t"] == t] for t in "mbl"}
    # Posição = região medoide (a de 400 eleitores), não o centro ponderado (2,83333; -60,63333), que pode cair no vazio.
    assert por_tipo["m"] == [{"t": "m", "n": "Boa Vista", "uf": "RR", "lat": 2.8, "lon": -60.6, "e": 650}]
    bairros = {i["n"]: i for i in por_tipo["b"]}
    assert set(bairros) == {"Centro", "Canarinho"}
    assert bairros["Centro"] == {"t": "b", "n": "Centro", "m": "Boa Vista", "uf": "RR", "lat": 2.8, "lon": -60.6, "e": 400}
    locais = {i["n"]: i for i in por_tipo["l"]}
    assert locais["Escola Estadual Gonçalves Dias"]["e"] == 400
    assert "Escola Sem Bairro" not in locais and "Escola Indígena" not in locais


def test_indexar_tambem_pela_grafia_sem_apostrofo(regras_busca):
    # "Santana do Livramento" pede san/liv e "Dias Davila" pede dia/dav: o item tem de estar nesses arquivos.
    indice = busca.indexar([_item("m", "Dias d'Ávila", 50), _item("m", "Sant'Ana do Livramento", 60)], regras_busca)
    assert [i["n"] for i in indice["dav"]] == ["Dias d'Ávila"]
    assert [i["n"] for i in indice["san"]] == ["Sant'Ana do Livramento"]
    assert busca.sem_apostrofo("Sant’Ana") == "SantAna"


def test_arquivo_da_busca_golden(golden):
    """Nome de dispositivo do Windows (con, prn, aux, nul) não vira nome de arquivo: o Git no Windows recusa."""
    for caso in golden["busca"]["arquivos"]:
        assert busca.arquivo_da_busca(caso["prefixo"]) == caso["arquivo"], caso
