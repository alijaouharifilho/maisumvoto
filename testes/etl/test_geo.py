"""Medoide ponderada (ponto da busca e do CEP) e o portão "todo ponto de busca tem região perto" (etl/geo.py)."""

import math

import pandas as pd
import pytest

from etl import geo

UM_KM = 1 / 111.32


def test_haversine_igual_ao_golden(golden):
    for caso in golden["geo"]["haversineKm"]:
        (lat1, lon1), (lat2, lon2) = caso["de"], caso["para"]
        assert geo.haversine_km(lat1, lon1, lat2, lon2) == pytest.approx(caso["km"], abs=1e-9)


def test_medoide_num_anel_cai_numa_regiao_e_nao_no_vazio_do_meio():
    # Quatro núcleos a 3 km do centro (o centro ponderado ficaria no meio, sem local nenhum a 1 km).
    lat = [3 * UM_KM, -3 * UM_KM, 0.0, 0.0]
    lon = [0.0, 0.0, 3 * UM_KM, -3 * UM_KM]
    i = geo.medoide(lat, lon, [10, 10, 10, 40])
    assert i == 3  # o núcleo mais pesado


def test_medoide_empate_fica_com_o_primeiro_e_vazio_falha():
    assert geo.medoide([0.0, 0.0], [0.0, 0.0], [1, 1]) == 0
    with pytest.raises(ValueError):
        geo.medoide([], [], [])


def test_medoide_em_blocos_da_o_mesmo_que_direto(monkeypatch):
    lat = [0.001 * k for k in range(30)]
    lon = [0.002 * (k % 7) for k in range(30)]
    peso = [1 + (k % 5) for k in range(30)]
    direto = geo.medoide(lat, lon, peso)
    monkeypatch.setattr(geo, "BLOCO_MEDOIDE", 4)
    assert geo.medoide(lat, lon, peso) == direto


def test_medoides_por_grupo_ignora_sem_posicao():
    locais = pd.DataFrame({
        "g": ["a", "a", "a", "b"],
        "lat_regiao": [1.0, 1.0, 2.0, math.nan], "lon_regiao": [1.0, 1.0, 2.0, math.nan],
        "eleitores": [10, 0, 5, 99],
    })
    r = geo.medoides_por_grupo(locais, ["g"])
    assert r.to_dict("records") == [{"g": "a", "lat": 1.0, "lon": 1.0}]


def test_pontos_sem_regiao():
    regioes = [(-25.0, -49.0), (-3.0, -60.0)]
    pontos = [("perto", -25.0 + 0.9 * UM_KM, -49.0), ("longe", -25.0 + 1.2 * UM_KM, -49.0),
              ("manaus", -3.0, -60.0 + 0.99 * UM_KM), ("vazio", 10.0, 10.0)]
    assert geo.pontos_sem_regiao(pontos, regioes, 1.0) == ["longe", "vazio"]
