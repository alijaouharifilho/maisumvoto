"""Validação geográfica: ponto dentro do município (tolerância 2 km), reserva MIT com nome conferido."""

import json
import math

import pandas as pd
import pytest
from shapely.geometry import box, mapping

from etl import coordenadas as co

# Dois municípios vizinhos de 1°×1°: A = [0,1]×[0,1] (IBGE 1000001), B = [1,2]×[0,1] (IBGE 1000002).
MALHA = {"1000001": box(0, 0, 1, 1), "1000002": box(1, 0, 2, 1)}
IBGE = {"00001": "1000001", "00002": "1000002", "00003": "9999999"}
UM_KM = 1 / 111


def _locais(linhas):
    colunas = ["uf", "mun", "zona", "nr_local", "nome", "lat", "lon"]
    return pd.DataFrame([dict(zip(colunas, linha, strict=True)) for linha in linhas])


def _reserva(linhas):
    return pd.DataFrame(linhas, columns=["id", "nome", "lat", "lon"]).set_index("id")


UM_M = UM_KM / 1000


def _com_endereco(linhas):
    """Locais com endereço e bairro: (mun, nr, nome, lat, lon, endereço, bairro)."""
    colunas = ["uf", "mun", "zona", "nr_local", "nome", "lat", "lon", "endereco", "bairro"]
    return pd.DataFrame([dict(zip(colunas, ("XX", m, 1, nr, nome, lat, lon, e, b), strict=True))
                         for m, nr, nome, lat, lon, e, b in linhas])


def test_palavras_significativas_ignora_palavras_de_tipo_de_escola():
    assert co.palavras_significativas("E.M.E.F. Prof. João da Silva") == {"joao", "silva"}
    assert co.palavras_significativas("ESCOLA MUNICIPAL") == frozenset()


@pytest.mark.parametrize(
    ("a", "b", "esperado"),
    [
        ("ESCOLA MUNICIPAL JOAO DA SILVA", "EMEF JOAO DA SILVA", True),
        ("ESCOLA ESTADUAL MARIA JOSE", "ESCOLA ESTADUAL PEDRO ALVES", False),
        ("COLEGIO SANTA ANA DE JESUS PAULA", "COLEGIO SANTA ANA", True),
        ("ESCOLA MUNICIPAL", "ESCOLA MUNICIPAL", True),
        ("ESCOLA MUNICIPAL", "CRECHE MUNICIPAL", False),
    ],
)
def test_nomes_batem(a, b, esperado):
    assert co.nomes_batem(a, b) is esperado


def test_dentro_com_tolerancia():
    lat = [0.5, 0.5, 0.5, 0.5]
    lon = [0.5, 1.0 + 1.5 * UM_KM, 1.0 + 3 * UM_KM, 0.5]
    mun = ["00001", "00001", "00001", "00003"]
    estrito, tolerado = co.dentro_do_municipio(MALHA, IBGE, mun, lat, lon, 2.0)
    assert list(estrito) == [True, False, False, False]
    assert list(tolerado) == [True, True, False, False]


def test_coordenada_repetida_entre_municipios_e_suspeita():
    locais = _locais([
        ("XX", "00001", 1, 10, "A", 0.5, 0.99),
        ("XX", "00002", 1, 20, "B", 0.5, 0.99),
        ("XX", "00001", 1, 11, "C", 0.4, 0.4),
        ("XX", "00001", 2, 12, "D", 0.4, 0.4),
        ("XX", "00001", 1, 13, "E", math.nan, math.nan),
    ])
    assert list(co.coordenadas_compartilhadas(locais)) == [True, True, False, False, False]


def test_posicionar_cobre_todos_os_casos():
    locais = _locais([
        ("XX", "00001", 1, 1, "ESCOLA OK", 0.5, 0.5),                          # dentro → tse
        ("XX", "00001", 1, 2, "ESCOLA PERTO", 0.5, 1.0 + UM_KM),               # 1 km fora → tse (tolerância)
        ("XX", "00001", 1, 3, "ESCOLA JOAO", 5.0, 5.0),                         # longe, reserva com nome → reserva
        ("XX", "00001", 1, 4, "ESCOLA PEDRO", 5.0, 5.0),                        # longe, reserva com outro nome → sem
        ("XX", "00001", 1, 5, "ESCOLA MARIA", math.nan, math.nan),              # sem coordenada, reserva → reserva
        ("XX", "00001", 1, 6, "ESCOLA ANA", math.nan, math.nan),                # sem coordenada, sem reserva → sem
        ("XX", "00001", 1, 7, "ESCOLA LIA", 0.5, 1.0 + UM_KM / 2),              # compartilhada e fora → reserva fora
        ("XX", "00002", 1, 8, "ESCOLA RUI", 0.5, 1.0 + UM_KM / 2),              # compartilhada e dentro de B → tse
        ("XX", "00003", 1, 9, "ESCOLA SEM MALHA", 0.5, 0.5),                     # município sem polígono → sem
    ])
    reserva = _reserva([
        ("XX_00001_1_3", "EMEF JOAO", 0.2, 0.2),
        ("XX_00001_1_4", "ESCOLA JOSE", 0.3, 0.3),
        ("XX_00001_1_5", "E M MARIA", 0.6, 0.6),
        ("XX_00001_1_7", "ESCOLA LIA", 3.0, 3.0),
    ])
    saida = co.posicionar(locais, MALHA, IBGE, reserva, 2.0)
    assert list(saida.posicao) == ["tse", "tse", "reserva", "", "reserva", "", "", "tse", ""]
    assert list(saida.motivo) == ["", "", "fora_do_municipio", "fora_do_municipio", "sem_coordenada",
                                  "sem_coordenada", "suspeita", "", "municipio_sem_malha"]
    assert saida.loc[2, "lat"] == 0.2 and math.isnan(saida.loc[3, "lat"])
    assert saida.loc[0, "lat"] == 0.5
    assert len(saida) == len(locais)


def test_carregar_malha_e_correspondencia(tmp_path):
    malha = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"codarea": k}, "geometry": mapping(g)} for k, g in MALHA.items()]}
    (tmp_path / "m.geojson").write_text(json.dumps(malha), encoding="utf-8")
    geos = co.carregar_malha(tmp_path / "m.geojson")
    assert set(geos) == set(MALHA)
    cm = {"abr": [{"cd": "xx", "mu": [{"cd": "00001", "cdi": "1000001"}, {"cd": "00009"}]}]}
    (tmp_path / "cm.json").write_text(json.dumps(cm), encoding="utf-8")
    assert co.carregar_tse_ibge(tmp_path / "cm.json") == {"00001": "1000001"}


def test_carregar_reserva(tmp_path):
    df = pd.DataFrame({
        "id_local_votacao": ["XX_00001_1_3", "XX_00001_1_4", "XX_00001_1_5", "XX_00001_1_6"],
        "nm_local_votacao_consolidado": ["EMEF JOAO", "SEM COORD", "EM CHIQUITA MENDES", "EE JUSCELINO"],
        "latitude_final": [0.2, None, 0.4, 0.4], "longitude_final": [0.2, None, 0.4, 0.4],
        "status_geocodificacao": ["top1_auto", "sem_candidato", "top1_auto", "top1_auto"],
        "sg_uf": ["XX"] * 4,
    })
    df.to_parquet(tmp_path / "r.parquet")
    reserva = co.carregar_reserva(tmp_path / "r.parquet")
    assert list(reserva.index) == ["XX_00001_1_3", "XX_00001_1_5", "XX_00001_1_6"]
    assert reserva.loc["XX_00001_1_3", "nome"] == "EMEF JOAO"
    assert list(reserva["generica"]) == [False, True, True]


# ── coordenada-padrão no mesmo município (caso real: Centro Administrativo da Bahia, Salvador) ──

def _salvador():
    # Quatro escolas de bairros diferentes a menos de 3 m umas das outras; 0.5000 / 0.50005 cruzam a 4ª casa decimal.
    return _com_endereco([
        ("00001", 1, "ESCOLA PARIPE", 0.5, 0.5, "Rua A, 1", "Paripe"),
        ("00001", 2, "ESCOLA ITAPUA", 0.5 + 2 * UM_M, 0.5, "Rua B, 2", "Itapuã"),
        ("00001", 3, "ESCOLA STELLA", 0.5, 0.5 + 2 * UM_M, "Rua C, 3", "Stella Maris"),
        ("00001", 4, "ESCOLA FLAMENGO", 0.50005, 0.50005, "Rua D, 4", "Praia do Flamengo"),
        ("00001", 5, "ESCOLA LONGE", 0.8, 0.8, "Rua E, 5", "Outro"),
    ])


def test_coordenada_padrao_no_mesmo_municipio_e_marcada():
    reserva = _reserva([("XX_00001_1_1", "ESCOLA PARIPE", 0.6, 0.6)])  # a reserva põe Paripe a ~15 km dali
    assert list(co.coordenadas_padrao(_salvador(), reserva)) == [True, True, True, True, False]


def test_coordenada_padrao_vai_para_a_reserva_ou_fica_sem_posicao():
    reserva = _reserva([("XX_00001_1_1", "ESCOLA PARIPE", 0.6, 0.6), ("XX_00001_1_2", "ESCOLA ITAPUA", 0.7, 0.7)])
    saida = co.posicionar(_salvador(), MALHA, IBGE, reserva, 2.0)
    assert list(saida.motivo) == ["padrao", "padrao", "padrao", "padrao", ""]
    assert list(saida.posicao) == ["reserva", "reserva", "", "", "tse"]
    assert (saida.loc[0, "lat"], saida.loc[1, "lat"]) == (0.6, 0.7)


def test_predios_vizinhos_confirmados_pela_reserva_ficam():
    # Três locais da mesma praça (Guanhães-MG): a reserva confirma o ponto a 10–20 m.
    locais = _com_endereco([
        ("00001", 1, "ESCOLA PADRE CAFE", 0.5, 0.5, "Praça N, 145", "Centro"),
        ("00001", 2, "POSTO DO INSS", 0.5, 0.5, "Praça N, 179", "Centro"),
        ("00001", 3, "CASA DE CULTURA", 0.5, 0.5 + UM_M, "Praça JK", "Centro"),
    ])
    reserva = _reserva([("XX_00001_1_1", "ESCOLA PADRE CAFE", 0.5 + 10 * UM_M, 0.5),
                        ("XX_00001_1_2", "POSTO DO INSS", 0.5, 0.5 + 20 * UM_M)])
    assert not co.coordenadas_padrao(locais, reserva).any()
    longe = _reserva([("XX_00001_1_1", "ESCOLA PADRE CAFE", 0.5 + 10 * UM_M, 0.5),
                      ("XX_00001_1_2", "POSTO DO INSS", 0.6, 0.6)])
    assert co.coordenadas_padrao(locais, longe).all()


def test_coordenada_padrao_exige_tres_enderecos_e_o_mesmo_municipio():
    mesmo_endereco = _com_endereco([("00001", n, f"BLOCO {n}", 0.5, 0.5, "Campus, 1", "Centro") for n in (1, 2, 3)])
    assert not co.coordenadas_padrao(mesmo_endereco, _reserva([])).any()
    dois_municipios = _com_endereco([
        ("00001", 1, "A", 0.5, 0.99999, "Rua A", "X"), ("00001", 2, "B", 0.5, 0.99999, "Rua B", "Y"),
        ("00002", 3, "C", 0.5, 1.00001, "Rua C", "Z"),
    ])
    assert not co.coordenadas_padrao(dois_municipios, _reserva([])).any()
    sem_endereco = _locais([("XX", "00001", 1, n, f"E{n}", 0.5, 0.5) for n in (1, 2, 3)])
    assert not co.coordenadas_padrao(sem_endereco, _reserva([])).any()


def test_grupo_encadeado_alem_do_raio_entre_pontas():
    # A–B a 25 m e B–C a 25 m: o grupo é um só, mesmo com A–C a 50 m.
    locais = _com_endereco([
        ("00001", 1, "A", 0.5, 0.5, "Rua A", "X"), ("00001", 2, "B", 0.5 + 25 * UM_M, 0.5, "Rua B", "Y"),
        ("00001", 3, "C", 0.5 + 50 * UM_M, 0.5, "Rua C", "Z"),
    ])
    assert co.coordenadas_padrao(locais, _reserva([])).all()


# ── reserva com coordenada genérica ──

def test_coordenada_generica_da_reserva():
    nomes = ["EM CHIQUITA MENDES", "EE JUSCELINO", "EM ANA", "ESCOLA ANA", "EM X", "EE Y"]
    lat = [1.0, 1.0, 2.0, 2.0, 3.0, 3.0]
    lon = [1.0, 1.0, 2.0, 2.0, 3.0, 3.0]
    status = ["top1_auto", "top1_auto", "top1_auto", "top1_auto", "revisao_manual_aceito", "revisao_manual_aceito"]
    assert list(co.coordenadas_genericas(nomes, lat, lon, status)) == [True, True, False, False, False, False]


def test_reserva_generica_nao_posiciona_local():
    locais = _locais([("XX", "00001", 1, 3, "ESCOLA JOAO", 5.0, 5.0)])
    reserva = _reserva([("XX_00001_1_3", "EMEF JOAO", 0.2, 0.2)]).assign(generica=[True])
    saida = co.posicionar(locais, MALHA, IBGE, reserva, 2.0)
    assert list(saida.posicao) == [""]
