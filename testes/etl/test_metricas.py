"""Espelho exato do CONTRATO §3: os casos de testes/golden/metricas.json valem para TS e Python."""

import pytest

from etl import metricas


def _casos(golden):
    return [(c["caso"], c) for c in golden["metricas"]]


def test_golden_tem_casos(golden):
    assert len(golden["metricas"]) >= 8


@pytest.mark.parametrize("indice", range(8))
def test_derivadas_batem_com_golden(golden, indice):
    caso = golden["metricas"][indice]
    d = metricas.derivar(caso["votos"], golden["alvo"], golden["adversario"])
    esperado = caso["esperado"]
    assert d.validos == esperado["validos"]
    assert d.alvo == esperado["alvo"]
    assert d.adversario == esperado["adversario"]
    assert d.outros == esperado["outros"]
    assert d.abertos == esperado["abertos"]
    assert d.ate == esperado["ate"]
    assert d.pct_alvo == esperado["pctAlvo"]


@pytest.mark.parametrize("indice", range(8))
def test_classificacao_e_viravel_batem_com_golden(golden, indice):
    caso = golden["metricas"][indice]
    args = (caso["votos"], golden["alvo"], golden["adversario"])
    assert metricas.classificar(*args, golden["limiarFolga"], caso["regra"]) == caso["esperado"]["classificacao"]
    assert metricas.viravel(*args, caso["regra"]) is caso["esperado"]["viravel"]


def test_nominais_ausentes_valem_zero():
    d = metricas.derivar({"brancos": 1, "nulos": 0, "abstencao": 2, "nominais": {}}, "01", "02")
    assert (d.alvo, d.adversario, d.validos, d.pct_alvo) == (0, 0, 0, None)


def test_regra_desconhecida_falha_alto():
    with pytest.raises(ValueError):
        metricas.reservatorio(metricas.derivar({"brancos": 0, "nulos": 0, "abstencao": 0, "nominais": {}}, "01", "02"), "x")


def test_ate_e_simetrico_entre_alvo_e_adversario():
    votos = {"brancos": 3, "nulos": 4, "abstencao": 10, "nominais": {"01": 50, "02": 40, "03": 7}}
    assert metricas.derivar(votos, "01", "02").ate == metricas.derivar(votos, "02", "01").ate == 24


def test_contagem_de_classificacoes_e_viraveis():
    regioes = [
        {"brancos": 0, "nulos": 0, "abstencao": 0, "nominais": {}},
        {"brancos": 1, "nulos": 1, "abstencao": 8, "nominais": {"01": 10, "02": 100, "03": 5}},
        {"brancos": 5, "nulos": 5, "abstencao": 50, "nominais": {"01": 100, "02": 160, "03": 30}},
    ]
    contagem = metricas.contar(regioes, "01", "02", 0.65, "abertosMaisOutros")
    assert contagem.classificacao == {
        "semVotos": 1, "empate": 0, "folga": 0, "aDefender": 0, "alvoNaFrente": 0, "aVirar": 1, "dificil": 1,
    }
    assert contagem.viraveis == {"abertos": 0, "abertosMaisOutros": 1}
