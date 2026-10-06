"""Geometria pequena do ETL: haversine (CONTRATO §4), medoide ponderada e o portão "todo ponto de busca tem região perto".

O ponto que a busca e o CEP publicam (CONTRATO §2.5/§2.6) é a posição de uma região real: a medoide ponderada pelo
eleitorado do grupo. O centro ponderado (média) caía num vazio quando os locais formam um anel ou núcleos separados:
em 05/10/2026, 2.475 dos 5.571 municípios (Manaus, Guarulhos, Duque de Caxias…) não tinham local de votação a 1 km do
próprio ponto, e o site respondia "Nenhum local de votação a 1 km" justamente na busca pela cidade.
"""

from __future__ import annotations

import math
from collections import defaultdict
from collections.abc import Iterable, Sequence

import numpy as np
import pandas as pd

RAIO_TERRA_KM = 6371.0
KM_POR_GRAU = 111.0
# Linhas da matriz de distâncias calculadas por vez na medoide (São Paulo tem milhares de pontos).
BLOCO_MEDOIDE = 512
# Cos da maior latitude do Brasil (~33,75° S) com folga: garante que a caixa de vizinhança cobre o raio em longitude.
COS_LAT_MINIMO = 0.8


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Igual a nucleo/geo.ts: 12742 · asin(√h)."""
    f1, f2 = math.radians(lat1), math.radians(lat2)
    h = math.sin((f2 - f1) / 2) ** 2 + math.cos(f1) * math.cos(f2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * RAIO_TERRA_KM * math.asin(math.sqrt(min(1.0, h)))


def medoide(lat: Sequence[float], lon: Sequence[float], peso: Sequence[float]) -> int:
    """Índice do ponto que minimiza Σ peso × distância aos outros pontos (equirretangular, dentro de um município
    basta). Empate: o de menor índice (quem chama ordena os pontos, para a escolha ser determinística)."""
    la, lo, p = (np.asarray(v, dtype=float) for v in (lat, lon, peso))
    if len(la) == 0:
        raise ValueError("medoide de um conjunto vazio")
    y, x = la, lo * np.cos(np.radians(la.mean()))
    custos = np.concatenate([
        (np.hypot(x[i:i + BLOCO_MEDOIDE, None] - x[None, :], y[i:i + BLOCO_MEDOIDE, None] - y[None, :]) * p).sum(axis=1)
        for i in range(0, len(la), BLOCO_MEDOIDE)
    ])
    return int(np.argmin(custos))


def medoides_por_grupo(locais: pd.DataFrame, chave: list[str]) -> pd.DataFrame:
    """Por grupo de `chave`: lat/lon da região medoide. Pontos = regiões distintas (`lat_regiao`, `lon_regiao`) dos
    locais posicionados; peso = Σ eleitores dos locais do ponto (mínimo 1 por local). Grupo sem local posicionado
    não aparece. Colunas: `chave` + lat + lon."""
    posicionados = locais[locais["lat_regiao"].notna()]
    pontos = (posicionados.assign(_p=posicionados["eleitores"].clip(lower=1))
              .groupby([*chave, "lat_regiao", "lon_regiao"], sort=True)["_p"].sum().reset_index())
    linhas = []
    for valores, grupo in pontos.groupby(chave, sort=True):
        i = medoide(grupo["lat_regiao"], grupo["lon_regiao"], grupo["_p"])
        chaves = valores if isinstance(valores, tuple) else (valores,)
        linhas.append((*chaves, float(grupo["lat_regiao"].iloc[i]), float(grupo["lon_regiao"].iloc[i])))
    return pd.DataFrame(linhas, columns=[*chave, "lat", "lon"])


def pontos_sem_regiao(pontos: Iterable[tuple[str, float, float]], regioes: Iterable[tuple[float, float]],
                      raio_km: float) -> list[str]:
    """Rótulos dos pontos sem nenhuma região a até `raio_km` (haversine). Grade de células com lado ≥ o raio em
    latitude e em longitude (para |lat| ≤ ~36°), então basta olhar as 9 células em volta."""
    lado = raio_km / (KM_POR_GRAU * COS_LAT_MINIMO)
    grade: dict[tuple[int, int], list[tuple[float, float]]] = defaultdict(list)
    for lat, lon in regioes:
        grade[(math.floor(lat / lado), math.floor(lon / lado))].append((lat, lon))

    def tem_perto(lat: float, lon: float) -> bool:
        a, b = math.floor(lat / lado), math.floor(lon / lado)
        vizinhas = (grade.get((a + i, b + j), ()) for i in (-1, 0, 1) for j in (-1, 0, 1))
        return any(haversine_km(lat, lon, la, lo) <= raio_km for celula in vizinhas for la, lo in celula)

    return [rotulo for rotulo, lat, lon in pontos if not tem_perto(lat, lon)]
