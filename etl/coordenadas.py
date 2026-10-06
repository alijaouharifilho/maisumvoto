"""Posição confiável de cada local de votação.

1. Coordenada do cadastro do TSE dentro do polígono do município (malha IBGE), com tolerância de 2 km.
2. Coordenada repetida por locais de municípios diferentes é suspeita: só vale se cair *estritamente*
   dentro do município do local (sem a tolerância).
2b. Coordenada-padrão no mesmo município (`coordenadas_padrao`): 3 ou mais locais a até ~30 m uns dos outros
   (agrupados por proximidade, não por arredondamento) com 3 ou mais endereços diferentes não valem como estão, a
   não ser que a reserva MIT confirme o ponto (todo local do grupo que ela conhece está a até 500 m dali). Caso
   real: o cadastro de 2026 põe 27 escolas de bairros de Salvador (Paripe, Itapuã, Stella Maris…) a menos de 3 m
   umas das outras, no Centro Administrativo da Bahia; o mapa mostrava 135 mil eleitores num raio de 1 km de lá e os
   bairros vazios. A confirmação pela reserva salva prédios vizinhos de verdade (três locais da mesma praça do
   Centro de Guanhães-MG, a 10–20 m na reserva).
3. Senão, a reserva MIT (como-meus-vizinhos-votam), só se o nome do local bate e o ponto também passa no teste 1.
   Coordenada da reserva repetida por locais de nomes diferentes é genérica (centro da localidade) e não serve,
   salvo revisão manual aceita no próprio projeto (`coordenadas_genericas`).
4. Senão, o local fica sem posição (fora do mapa, contado no índice).

Distância ao polígono em graus × 111 km: superestima a distância no eixo leste-oeste (mais conservador).
"""

from __future__ import annotations

import itertools
import json
from collections.abc import Mapping, Sequence
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow.parquet as pq
import shapely
from shapely.geometry import shape
from shapely.geometry.base import BaseGeometry

from etl.busca import normalizar

KM_POR_GRAU = 111.0
TOLERANCIA_KM = 2.0
FRACAO_MINIMA_NOMES = 0.5
TAMANHO_MINIMO_PALAVRA = 3
CASAS_COMPARTILHADA = 6
# Coordenada-padrão no mesmo município (2b). Medido em 2026: 100 grupos, 482 locais, 411 mil eleitores; nos 8 grupos
# que a reserva confirma (16 mil eleitores) o ponto fica; nos outros, 290 dos 353 locais que a reserva conhece estão
# a mais de 1 km do ponto do cadastro.
RAIO_PADRAO_M = 30.0
MIN_LOCAIS_PADRAO = 3
MIN_ENDERECOS_PADRAO = 3
CONFIRMACAO_KM = 0.5
M_POR_GRAU = 111_320.0
STATUS_REVISADO = "revisao_manual_aceito"
PALAVRAS_FRACAS = frozenset({
    "escola", "municipal", "estadual", "federal", "ensino", "fundamental", "medio", "infantil", "colegio",
    "centro", "educacional", "educacao", "unidade", "creche", "emef", "emei", "emeif", "eeef", "eef", "eem",
    "eeem", "cmei", "prof", "professor", "professora", "dos", "das", "anexo", "predio", "sala", "extensao",
    "integral", "tempo", "basica",
})


def carregar_malha(caminho: Path) -> dict[str, BaseGeometry]:
    dados = json.loads(caminho.read_text(encoding="utf-8"))
    geometrias = {}
    for feicao in dados["features"]:
        geometria = shape(feicao["geometry"])
        shapely.prepare(geometria)
        geometrias[str(feicao["properties"]["codarea"])] = geometria
    return geometrias


def carregar_tse_ibge(caminho: Path) -> dict[str, str]:
    dados = json.loads(caminho.read_text(encoding="utf-8"))
    return {m["cd"]: m["cdi"] for a in dados["abr"] for m in a.get("mu", []) if m.get("cdi")}


def coordenadas_genericas(nomes: Sequence[str], lat: Sequence[float], lon: Sequence[float],
                          status: Sequence[str]) -> np.ndarray:
    """Coordenada da reserva repetida (6 casas) por locais cujos nomes não batem entre si: é o centro da localidade
    ou da rua, não o prédio (ex.: E.M. Chiquita Mendes posta sobre a E.E. Juscelino, a 29 km do ponto do TSE).
    A revisão manual aceita no projeto de origem vale mesmo repetida."""
    lat_txt = np.round(np.asarray(lat, dtype=float), CASAS_COMPARTILHADA).astype(str)
    lon_txt = np.round(np.asarray(lon, dtype=float), CASAS_COMPARTILHADA).astype(str)
    chave = pd.Series(lat_txt, dtype=object) + "|" + pd.Series(lon_txt, dtype=object)
    repetidas = chave[chave.duplicated(keep=False)]
    nomes_arr = np.asarray(nomes, dtype=object)
    ruins = {k for k, idx in repetidas.groupby(repetidas).groups.items()
             if not all(nomes_batem(a, b) for a, b in itertools.combinations(nomes_arr[list(idx)], 2))}
    revisado = pd.Series(np.asarray(status, dtype=object)) == STATUS_REVISADO
    return (chave.isin(ruins) & ~revisado).to_numpy()


def carregar_reserva(caminho: Path) -> pd.DataFrame:
    """Reserva MIT por id do local: nome, lat, lon e `generica` (coordenada que não serve para posicionar, mas
    ainda conta como indício de que o ponto do cadastro está longe; ver `coordenadas_padrao`)."""
    colunas = ["id_local_votacao", "nm_local_votacao_consolidado", "latitude_final", "longitude_final",
               "status_geocodificacao"]
    df = pq.read_table(caminho, columns=colunas).to_pandas()
    df = df.dropna(subset=["latitude_final", "longitude_final"]).drop_duplicates("id_local_votacao")
    df = df.assign(nm_local_votacao_consolidado=df["nm_local_votacao_consolidado"].fillna(""),
                   status_geocodificacao=df["status_geocodificacao"].fillna(""))
    generica = coordenadas_genericas(df["nm_local_votacao_consolidado"], df["latitude_final"], df["longitude_final"],
                                     df["status_geocodificacao"])
    return pd.DataFrame({
        "nome": df["nm_local_votacao_consolidado"].to_numpy(),
        "lat": df["latitude_final"].astype(float).to_numpy(),
        "lon": df["longitude_final"].astype(float).to_numpy(),
        "generica": generica,
    }, index=pd.Index(df["id_local_votacao"].to_numpy(), name="id"))


def palavras_significativas(nome: str) -> frozenset[str]:
    palavras = normalizar(nome).split()
    return frozenset(p for p in palavras if len(p) >= TAMANHO_MINIMO_PALAVRA and p not in PALAVRAS_FRACAS)


def nomes_batem(a: str, b: str) -> bool:
    """≥ 50% das palavras significativas do nome mais curto aparecem no outro."""
    pa_, pb = palavras_significativas(a), palavras_significativas(b)
    if not pa_ or not pb:
        return normalizar(a) == normalizar(b)
    return len(pa_ & pb) / min(len(pa_), len(pb)) >= FRACAO_MINIMA_NOMES


def dentro_do_municipio(
    malha: Mapping[str, BaseGeometry], ibge: Mapping[str, str], mun: Sequence[str],
    lat: Sequence[float], lon: Sequence[float], tolerancia_km: float,
) -> tuple[np.ndarray, np.ndarray]:
    """Para cada ponto: (estritamente dentro, dentro com tolerância). Ponto NaN ou sem polígono → False."""
    mun_arr = np.asarray(mun, dtype=object)
    lat_arr, lon_arr = np.asarray(lat, dtype=float), np.asarray(lon, dtype=float)
    estrito = np.zeros(len(mun_arr), dtype=bool)
    tolerado = np.zeros(len(mun_arr), dtype=bool)
    validos = ~(np.isnan(lat_arr) | np.isnan(lon_arr))
    for codigo in pd.unique(mun_arr[validos]):
        geometria = malha.get(ibge.get(codigo, ""))
        if geometria is None:
            continue
        idx = np.flatnonzero(validos & (mun_arr == codigo))
        dentro = shapely.contains_xy(geometria, lon_arr[idx], lat_arr[idx])
        estrito[idx] = dentro
        fora = idx[~dentro]
        if len(fora):
            distancia = shapely.distance(geometria, shapely.points(lon_arr[fora], lat_arr[fora])) * KM_POR_GRAU
            tolerado[fora] = distancia <= tolerancia_km
        tolerado[idx[dentro]] = True
    return estrito, tolerado


def coordenadas_compartilhadas(locais: pd.DataFrame) -> np.ndarray:
    """Mesma coordenada (6 casas) usada por locais de municípios diferentes."""
    chave = locais["lat"].round(CASAS_COMPARTILHADA).astype(str) + "|" + locais["lon"].round(CASAS_COMPARTILHADA).astype(str)
    validos = locais["lat"].notna() & locais["lon"].notna()
    municipios = locais[validos].groupby(chave[validos])["mun"].nunique()
    repetidas = set(municipios[municipios > 1].index)
    return (validos & chave.isin(repetidas)).to_numpy()


def _pares_proximos(locais: pd.DataFrame, raio_m: float) -> tuple[np.ndarray, np.ndarray]:
    """Pares (i, j), i < j, de locais do mesmo município a até `raio_m` metros (posições 0..n-1 de `locais`)."""
    validos = (locais["lat"].notna() & locais["lon"].notna()).to_numpy()
    idx = np.flatnonzero(validos)
    lat, lon = locais["lat"].to_numpy(dtype=float)[idx], locais["lon"].to_numpy(dtype=float)[idx]
    y, x = lat * M_POR_GRAU, lon * M_POR_GRAU * np.cos(np.radians(lat))
    base = pd.DataFrame({"i": idx, "mun": locais["mun"].to_numpy()[idx], "x": x, "y": y,
                         "cx": np.floor(x / raio_m).astype(np.int64), "cy": np.floor(y / raio_m).astype(np.int64)})
    pares = []
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            vizinho = base.assign(cx=base["cx"] + dx, cy=base["cy"] + dy)
            juntos = base.merge(vizinho, on=["mun", "cx", "cy"], suffixes=("", "_v"))
            perto = (juntos["x"] - juntos["x_v"]) ** 2 + (juntos["y"] - juntos["y_v"]) ** 2 <= raio_m**2
            pares.append(juntos.loc[perto & (juntos["i"] < juntos["i_v"]), ["i", "i_v"]])
    todos = pd.concat(pares, ignore_index=True).drop_duplicates()
    return todos["i"].to_numpy(dtype=np.int64), todos["i_v"].to_numpy(dtype=np.int64)


def _componentes(n: int, a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Rótulo do grupo de cada posição (o menor índice do grupo), ligando os pares (a[k], b[k])."""
    rotulo = np.arange(n)
    while True:
        menor = np.minimum(rotulo[a], rotulo[b])
        novo = rotulo.copy()
        np.minimum.at(novo, a, menor)
        np.minimum.at(novo, b, menor)
        novo = novo[novo]  # encurta as cadeias: cada um aponta para o rótulo do seu rótulo
        if np.array_equal(novo, rotulo):
            return rotulo
        rotulo = novo


def _texto_normalizado(locais: pd.DataFrame, coluna: str, idx: np.ndarray) -> list[str]:
    if coluna not in locais.columns:
        return [""] * len(idx)
    return [normalizar(str(v or "")) for v in locais[coluna].to_numpy()[idx]]


def _distancia_km(lat1, lon1, lat2, lon2) -> np.ndarray:
    """Equirretangular: basta para comparar com centenas de metros dentro de um município."""
    lat1, lon1, lat2, lon2 = (np.asarray(v, dtype=float) for v in (lat1, lon1, lat2, lon2))
    dx = (lon2 - lon1) * np.cos(np.radians((lat1 + lat2) / 2))
    return np.hypot(lat2 - lat1, dx) * M_POR_GRAU / 1000


def _distancia_na_reserva(locais: pd.DataFrame, idx: np.ndarray, reserva: pd.DataFrame) -> np.ndarray:
    """Distância (km) do ponto do cadastro ao da reserva, para os locais de `idx` que ela conhece pelo nome; NaN se não."""
    sub = locais.iloc[idx]
    ids = (sub["uf"] + "_" + sub["mun"] + "_" + sub["zona"].astype(str) + "_" + sub["nr_local"].astype(str)).to_numpy()
    distancia = np.full(len(idx), np.nan)
    conhecidos = np.flatnonzero(pd.Index(ids).isin(reserva.index))
    if len(conhecidos) == 0:
        return distancia
    alvo = reserva.loc[ids[conhecidos]]
    nomes = sub["nome"].to_numpy()[conhecidos]
    bate = np.array([nomes_batem(a, b) for a, b in zip(nomes, alvo["nome"], strict=True)], dtype=bool)
    km = _distancia_km(sub["lat"].to_numpy()[conhecidos], sub["lon"].to_numpy()[conhecidos], alvo["lat"], alvo["lon"])
    distancia[conhecidos[bate]] = km[bate]
    return distancia


def coordenadas_padrao(locais: pd.DataFrame, reserva: pd.DataFrame, raio_m: float = RAIO_PADRAO_M) -> np.ndarray:
    """Locais numa coordenada-padrão do mesmo município (regra 2b). Sem coluna de endereço, nenhum."""
    a, b = _pares_proximos(locais, raio_m)
    rotulo = _componentes(len(locais), a, b)
    tamanho = np.bincount(rotulo, minlength=len(locais))[rotulo]
    idx = np.flatnonzero(tamanho >= MIN_LOCAIS_PADRAO)  # só grupos que podem ser ponto-padrão
    grupos = pd.DataFrame({"g": rotulo[idx], "end": _texto_normalizado(locais, "endereco", idx),
                           "km": _distancia_na_reserva(locais, idx, reserva)})
    resumo = grupos.groupby("g").agg(enderecos=("end", "nunique"), conhecidos=("km", "count"), maior=("km", "max"))
    confirmado = (resumo["conhecidos"] > 0) & (resumo["maior"] <= CONFIRMACAO_KM)
    ruins = resumo[(resumo["enderecos"] >= MIN_ENDERECOS_PADRAO) & ~confirmado].index
    marcados = np.zeros(len(locais), dtype=bool)
    marcados[idx[grupos["g"].isin(ruins).to_numpy()]] = True
    return marcados


def _motivos(locais: pd.DataFrame, malha, ibge, reserva: pd.DataFrame, tolerancia_km: float) -> np.ndarray:
    estrito, tolerado = dentro_do_municipio(malha, ibge, locais["mun"], locais["lat"], locais["lon"], tolerancia_km)
    suspeita = coordenadas_compartilhadas(locais)
    padrao = coordenadas_padrao(locais, reserva)
    sem_malha = ~locais["mun"].map(lambda m: ibge.get(m, "") in malha).to_numpy()
    sem_coord = (locais["lat"].isna() | locais["lon"].isna()).to_numpy()
    motivo = np.full(len(locais), "", dtype=object)
    motivo[~tolerado] = "fora_do_municipio"
    motivo[suspeita & ~estrito] = "suspeita"
    motivo[padrao & (motivo == "")] = "padrao"
    motivo[sem_coord] = "sem_coordenada"
    motivo[sem_malha] = "municipio_sem_malha"
    return motivo


def _tentar_reserva(locais: pd.DataFrame, pendentes: np.ndarray, reserva: pd.DataFrame) -> pd.DataFrame:
    sub = locais.iloc[pendentes]
    ids = sub["uf"] + "_" + sub["mun"] + "_" + sub["zona"].astype(str) + "_" + sub["nr_local"].astype(str)
    uteis = reserva.index[~reserva["generica"]] if "generica" in reserva.columns else reserva.index
    achados = ids.isin(uteis).to_numpy()
    candidatos = sub[achados].assign(id_reserva=ids[achados].to_numpy())
    alvo = reserva.loc[candidatos["id_reserva"]]
    bate = [nomes_batem(a, b) for a, b in zip(candidatos["nome"], alvo["nome"], strict=True)]
    return candidatos.assign(lat_reserva=alvo["lat"].to_numpy(), lon_reserva=alvo["lon"].to_numpy(),
                             nome_bate=bate)


def posicionar(locais: pd.DataFrame, malha, ibge, reserva: pd.DataFrame, tolerancia_km: float = TOLERANCIA_KM) -> pd.DataFrame:
    """Devolve cópia de `locais` com lat/lon finais (NaN se sem posição), `posicao` e `motivo`."""
    base = locais.reset_index(drop=True)
    motivo = _motivos(base, malha, ibge, reserva, tolerancia_km)
    lat, lon = base["lat"].to_numpy(dtype=float).copy(), base["lon"].to_numpy(dtype=float).copy()
    posicao = np.where(motivo == "", "tse", "").astype(object)
    pendentes = np.flatnonzero((motivo != "") & (motivo != "municipio_sem_malha"))
    lat[motivo != ""], lon[motivo != ""] = np.nan, np.nan
    tentativas = _tentar_reserva(base, pendentes, reserva)
    tentativas = tentativas[tentativas["nome_bate"]]
    if len(tentativas):
        _, ok = dentro_do_municipio(malha, ibge, tentativas["mun"], tentativas["lat_reserva"],
                                    tentativas["lon_reserva"], tolerancia_km)
        aceitos = tentativas[ok]
        idx = aceitos.index.to_numpy()
        lat[idx], lon[idx] = aceitos["lat_reserva"].to_numpy(), aceitos["lon_reserva"].to_numpy()
        posicao[idx] = "reserva"
    return base.assign(lat=lat, lon=lon, posicao=posicao, motivo=motivo)
