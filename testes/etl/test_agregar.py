"""Agregação seção → local → região, reclassificação como nulo e caixa de título."""

import math

import pandas as pd
import pytest

from etl import agregar as ag

ALVO, ADV, RECLASS = "01", "02", ("09",)


@pytest.mark.parametrize(
    ("entrada", "saida"),
    [
        ("SÃO JOÃO DA BALIZA", "São João da Baliza"),
        ("PAU D'ARCO", "Pau d'Arco"),
        ("D'ÁVILA", "D'Ávila"),
        ("GUAJARÁ-MIRIM", "Guajará-Mirim"),
        ("OLHOS-D'ÁGUA", "Olhos-d'Água"),
        ("ESCOLA ESTADUAL XV DE NOVEMBRO", "Escola Estadual XV de Novembro"),
        ("BR 364 KM 50", "BR 364 KM 50"),
        ("RUA 7 DE SETEMBRO, S/N", "Rua 7 de Setembro, S/N"),
        ("E DO CENTRO", "E do Centro"),
        ("AV. BRASIL (ANEXO)", "Av. Brasil (Anexo)"),
        ("SANTA RITA DOS DOURADOS E DAS FLORES", "Santa Rita dos Dourados e das Flores"),
        ("", ""),
        ("EE CAETANO DE CAMPOS", "EE Caetano de Campos"),
        ("E.E. PROF. JOSÉ", "E.E. Prof. José"),
        ("EMEF ANA NERI", "EMEF Ana Neri"),
        ("UERJ - CAMPUS MARACANÃ", "UERJ - Campus Maracanã"),
        ("SÃO JOÃO DEL REI", "São João del Rei"),
        ("JARDIM CÉU AZUL", "Jardim Céu Azul"),
        ("E.E.B. SÃO PEDRO", "E.E.B. São Pedro"),
        ("A.C. CAMARGO", "A.C. Camargo"),
    ],
)
def test_titulo_ptbr(entrada, saida):
    assert ag.titulo_ptbr(entrada) == saida


def _detalhe(linhas):
    colunas = ["uf", "mun", "zona", "secao", "aptos", "comparecimento", "abstencao", "brancos", "nulos", "instalada"]
    return pd.DataFrame(linhas, columns=colunas)


def _votos(linhas):
    return pd.DataFrame(linhas, columns=["uf", "mun", "zona", "secao", "numero", "votos"])


DETALHE = _detalhe([
    ("XX", "00001", 1, 1, 100, 80, 20, 2, 3, True),
    ("XX", "00001", 1, 2, 50, 40, 10, 1, 1, True),
    ("XX", "00001", 2, 7, 30, 20, 10, 0, 0, True),
    ("ZZ", "99999", 1, 5, 10, 0, 0, 0, 0, False),
])
VOTOS = _votos([
    ("XX", "00001", 1, 1, ALVO, 40), ("XX", "00001", 1, 1, ADV, 30), ("XX", "00001", 1, 1, "09", 5),
    ("XX", "00001", 1, 1, "95", 2), ("XX", "00001", 1, 1, "96", 3),
    ("XX", "00001", 1, 2, ALVO, 10), ("XX", "00001", 1, 2, ADV, 20), ("XX", "00001", 1, 2, "03", 8),
    ("XX", "00001", 2, 7, ADV, 20),
])


def test_secoes_com_votos_reclassifica_como_nulo():
    secoes, avisos = ag.secoes_com_votos(DETALHE, VOTOS, RECLASS)
    s1 = secoes[(secoes.zona == 1) & (secoes.secao == 1)].iloc[0]
    assert s1.nulos == 3 + 5
    assert "n:09" not in secoes.columns and "n:95" not in secoes.columns
    assert s1[f"n:{ALVO}"] == 40
    assert avisos == []


def test_secoes_com_votos_avisa_incoerencia_e_votos_sem_secao():
    votos = pd.concat([VOTOS, _votos([("XX", "00001", 9, 9, ALVO, 1), ("XX", "00001", 2, 7, "03", 1)])])
    _, avisos = ag.secoes_com_votos(DETALHE, votos, RECLASS)
    assert any("sem seção no detalhe" in a for a in avisos)
    assert any("comparecimento" in a for a in avisos)


def test_totais():
    secoes, _ = ag.secoes_com_votos(DETALHE, VOTOS, RECLASS)
    t = ag.totais(secoes[secoes.uf == "XX"])
    assert t == {
        "secoes": 3, "aptos": 180, "comparecimento": 140, "abstencao": 40, "brancos": 3, "nulos": 9,
        "nominais": {ALVO: 50, ADV: 70, "03": 8},
    }
    vazio = ag.totais(secoes[secoes.uf == "ZZ"])
    assert vazio["nominais"] == {} and vazio["secoes"] == 1 and vazio["aptos"] == 10


def _cadastro(linhas):
    colunas = ["uf", "mun", "municipio", "zona", "secao", "nr_local", "nome", "cd_tipo_local", "tipo_local", "endereco",
               "bairro", "cep", "lat", "lon", "eleitores"]
    return pd.DataFrame(linhas, columns=colunas)


CADASTRO = _cadastro([
    ("XX", "00001", "VILA DO SUL", 1, 1, 1015, "ESCOLA A", 1, "Convencional", "RUA A, 1", "CENTRO", "69300000",
     -10.123456, -50.123456, 100),
    ("XX", "00001", "VILA DO SUL", 1, 2, 1023, "ESCOLA B", 1, "Convencional", "RUA B, 2", "", "69300001",
     -10.123460, -50.123459, 50),
    ("XX", "00001", "VILA DO SUL", 2, 7, 1001, "ESCOLA C", 1, "Convencional", "RUA C", "CENTRO", "",
     math.nan, math.nan, 30),
])


def test_locais_junta_por_municipio_zona_secao_e_soma():
    secoes, _ = ag.secoes_com_votos(DETALHE, VOTOS, RECLASS)
    locais, sem_cadastro = ag.montar_locais(secoes[secoes.uf != "ZZ"], CADASTRO)
    assert sem_cadastro.empty
    a = locais[locais.nr_local == 1015].iloc[0]
    assert a.eleitores == 100 and list(a.secoes) == [1] and a.municipio == "Vila do Sul"
    assert a.v_aptos == 100 and a.nulos == 8 and bool(a.tem_resultado)


def test_locais_avisa_secao_sem_cadastro():
    secoes, _ = ag.secoes_com_votos(DETALHE, VOTOS, RECLASS)
    _, sem_cadastro = ag.montar_locais(secoes[secoes.uf != "ZZ"], CADASTRO.iloc[:2])
    assert list(sem_cadastro.secao) == [7]


def test_regioes_agrupam_locais_no_mesmo_ponto_com_id_do_menor_local():
    secoes, _ = ag.secoes_com_votos(DETALHE, VOTOS, RECLASS)
    locais, _ = ag.montar_locais(secoes[secoes.uf != "ZZ"], CADASTRO)
    locais = locais.assign(posicao=["tse" if not math.isnan(x) else "" for x in locais.lat])
    regioes = ag.montar_regioes(locais[locais.posicao != ""])
    assert len(regioes) == 1
    r = regioes[0]
    assert r["id"] == "xx-00001-0001-1015"
    assert r["eleitores"] == 150 and r["secoes"] == 2
    assert r["bairro"] == "Centro" and r["municipio"] == "Vila do Sul"
    assert (r["lat"], r["lon"]) == (-10.12346, -50.12346)
    assert r["posicao"] == "tse"
    assert [loc["nr"] for loc in r["locais"]] == [1015, 1023]
    assert r["locais"][0] == {"nome": "Escola A", "endereco": "Rua A, 1", "cep": "69300000", "zona": 1, "nr": 1015,
                              "secoes": [1]}
    assert r["votos"] == {"aptos": 150, "comparecimento": 120, "abstencao": 30, "brancos": 3, "nulos": 9,
                          "nominais": {ALVO: 50, ADV: 50, "03": 8}}


def test_regiao_sem_resultado_tem_votos_nulos_e_reserva_marca_posicao():
    detalhe = _detalhe([("XX", "00001", 1, 1, 100, 0, 0, 0, 0, False)])
    secoes, _ = ag.secoes_com_votos(detalhe, _votos([]), RECLASS)
    locais, _ = ag.montar_locais(secoes, CADASTRO.iloc[:1])
    regioes = ag.montar_regioes(locais.assign(posicao=["reserva"]))
    assert regioes[0]["votos"] is None and regioes[0]["posicao"] == "reserva"


def test_id_nao_depende_da_ordem_de_entrada():
    secoes, _ = ag.secoes_com_votos(DETALHE, VOTOS, RECLASS)
    locais, _ = ag.montar_locais(secoes[secoes.uf != "ZZ"], CADASTRO.iloc[:2])
    locais = locais.assign(posicao="tse")
    assert ag.montar_regioes(locais) == ag.montar_regioes(locais.iloc[::-1])


def test_regiao_mista_segue_a_posicao_do_local_representante():
    # Escola da reserva que cai no mesmo ponto de uma do TSE: a coordenada publicada é a do representante (1015, TSE),
    # então a região não leva o aviso de posição de reserva; com o representante da reserva, leva.
    secoes, _ = ag.secoes_com_votos(DETALHE, VOTOS, RECLASS)
    locais, _ = ag.montar_locais(secoes[secoes.uf != "ZZ"], CADASTRO)
    locais = locais[locais.lat.notna()]
    mista = ag.montar_regioes(locais.assign(posicao=["tse" if nr == 1015 else "reserva" for nr in locais.nr_local]))
    assert [r["posicao"] for r in mista] == ["tse"]
    invertida = ag.montar_regioes(locais.assign(posicao=["reserva" if nr == 1015 else "tse" for nr in locais.nr_local]))
    assert [r["posicao"] for r in invertida] == ["reserva"]
