"""Geração dos arquivos de public/dados/ (CONTRATO §1–§2), versão determinística e gravação atômica.

Todo arquivo é JSON canônico: UTF-8, chaves ordenadas, sem espaços. A versão é o sha256 do conteúdo
de todos os arquivos (o índice entra sem `versao` e sem `geradoEm`), então duas rodadas com os mesmos
dados dão a mesma versão.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import shutil
from collections import defaultdict
from collections.abc import Iterable, Mapping, Sequence
from pathlib import Path

import pandas as pd

from etl.agregar import NOMINAL
from etl.geo import medoides_por_grupo

ESCALA_RESUMO = 20
ESCALA_QUADRADO = 1000
CASAS = 5
TAMANHO_VERSAO = 12
CAMPOS_FORA_DA_VERSAO = ("versao", "geradoEm")
_CEP_VALIDO = re.compile(r"^\d{8}$")
# Faixas de CEP por UF (5 primeiros dígitos), tabela pública dos Correios.
FAIXAS_CEP_UF: dict[str, tuple[tuple[int, int], ...]] = {
    "SP": ((1000, 19999),), "RJ": ((20000, 28999),), "ES": ((29000, 29999),), "MG": ((30000, 39999),),
    "BA": ((40000, 48999),), "SE": ((49000, 49999),), "PE": ((50000, 56999),), "AL": ((57000, 57999),),
    "PB": ((58000, 58999),), "RN": ((59000, 59999),), "CE": ((60000, 63999),), "PI": ((64000, 64999),),
    "MA": ((65000, 65999),), "PA": ((66000, 68899),), "AP": ((68900, 68999),), "AM": ((69000, 69299), (69400, 69899)),
    "RR": ((69300, 69399),), "AC": ((69900, 69999),), "DF": ((70000, 72799), (73000, 73699)),
    "GO": ((72800, 72999), (73700, 76799)), "RO": ((76800, 76999),), "TO": ((77000, 77999),),
    "MT": ((78000, 78899),), "MS": ((79000, 79999),), "PR": ((80000, 87999),), "SC": ((88000, 89999),),
    "RS": ((90000, 99999),),
}


def json_canonico(obj: object) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def arredondar(x: float) -> int:
    """Igual a Math.round do JS (meio arredonda para +∞), para o front decodificar igual."""
    return math.floor(x + 0.5)


def chave_celula(lat: float, lon: float, graus: float) -> str:
    return f"{math.floor(lat / graus)}_{math.floor(lon / graus)}"


def chave_quadrado(lat: float, lon: float) -> str:
    return f"{math.floor(lat)}_{math.floor(lon)}"


def codificar_pontos(pontos: Iterable[tuple[float, float]], escala: int) -> dict:
    pares = sorted({(arredondar(lat * escala), arredondar(lon * escala)) for lat, lon in pontos})
    d: list[int] = []
    anterior = (0, 0)
    for par in pares:
        d += [par[0] - anterior[0], par[1] - anterior[1]]
        anterior = par
    return {"escala": escala, "d": d}


def arquivos_celulas(regioes: Sequence[Mapping], graus: float) -> dict[str, list]:
    celulas: dict[str, list] = defaultdict(list)
    for regiao in regioes:
        celulas[chave_celula(regiao["lat"], regiao["lon"], graus)].append(regiao)
    return {f"celulas/{k}.json": sorted(v, key=lambda r: r["id"]) for k, v in sorted(celulas.items())}


def arquivos_pontos(regioes: Sequence[Mapping]) -> tuple[dict[str, dict], list[str]]:
    com_votos = [(r["lat"], r["lon"]) for r in regioes if r["votos"] is not None]
    quadrados: dict[str, list] = defaultdict(list)
    for lat, lon in com_votos:
        quadrados[chave_quadrado(lat, lon)].append((lat, lon))
    arquivos = {"pontos/resumo.json": codificar_pontos(com_votos, ESCALA_RESUMO)}
    arquivos |= {f"pontos/{k}.json": codificar_pontos(v, ESCALA_QUADRADO) for k, v in quadrados.items()}
    return arquivos, sorted(quadrados)


def arquivos_secoes(secoes: pd.DataFrame) -> dict[str, dict]:
    colunas = sorted(c for c in secoes.columns if c.startswith(NOMINAL))
    numeros = [c[len(NOMINAL):] for c in colunas]
    campos = ["aptos", "comparecimento", "brancos", "nulos"]
    arquivos: dict[str, dict] = defaultdict(dict)
    vetores = [secoes[c].to_numpy() for c in ["uf", "mun", "zona", "secao", *campos, *colunas]]
    for uf, mun, zona, secao, *valores in zip(*vetores, strict=True):
        caminho = f"secoes/{uf.lower()}/{mun}-{int(zona):04d}.json"
        fixos, votos = valores[: len(campos)], valores[len(campos):]
        arquivos[caminho][str(int(secao))] = {
            **{c: int(v) for c, v in zip(campos, fixos, strict=True)},
            "nominais": {n: int(v) for n, v in zip(numeros, votos, strict=True) if v > 0},
        }
    return {caminho: {"secoes": conteudo} for caminho, conteudo in sorted(arquivos.items())}


def _cep_valido(cep: str) -> bool:
    return bool(_CEP_VALIDO.match(cep)) and len(set(cep)) > 1


def cep_da_uf(cep: str, uf: str) -> bool:
    """O CEP (5 primeiros dígitos) cai na faixa dos Correios da UF do local? O cadastro do TSE tem CEP de outro
    estado (ex.: escola de Curitiba com 30150-000, que é de Belo Horizonte); publicado, a busca por esse CEP
    levaria a pessoa ao estado errado. Em 2026: 81 de 32.527 CEPs."""
    prefixo = int(cep[:5])
    return any(inicio <= prefixo <= fim for inicio, fim in FAIXAS_CEP_UF.get(uf, ()))


def _do_municipio_dominante(locais: pd.DataFrame) -> pd.DataFrame:
    """CEP genérico repetido em municípios diferentes: fica só o município com mais eleitores naquele CEP."""
    por_municipio = locais.groupby(["cep", "uf", "municipio"], as_index=False)["eleitores"].sum()
    ordem = por_municipio.sort_values(["cep", "eleitores", "uf", "municipio"], ascending=[True, False, True, True])
    dominante = ordem.drop_duplicates("cep")[["cep", "uf", "municipio"]]
    return locais.merge(dominante, on=["cep", "uf", "municipio"], how="inner")


def arquivos_cep(locais: pd.DataFrame) -> dict[str, dict]:
    """CEP dos locais (cadastro do TSE) → posição da região medoide dos locais do município dominante naquele CEP
    (CONTRATO §2.6, `etl/geo.py`); bairro do local com mais eleitores."""
    filtro = [_cep_valido(str(c)) and cep_da_uf(str(c), str(u)) for c, u in zip(locais["cep"], locais["uf"], strict=True)]
    validos = _do_municipio_dominante(locais[filtro])
    centros = medoides_por_grupo(validos, ["cep"]).set_index("cep")
    ordem = validos.sort_values(["cep", "eleitores", "municipio", "bairro"], ascending=[True, False, True, True])
    maiores = ordem.drop_duplicates("cep").set_index("cep")
    arquivos: dict[str, dict] = defaultdict(dict)
    for cep, centro in centros.iterrows():
        maior = maiores.loc[cep]
        arquivos[f"cep/{cep[:3]}.json"][cep] = {
            "lat": round(float(centro["lat"]), CASAS), "lon": round(float(centro["lon"]), CASAS),
            "m": maior["municipio"], "uf": maior["uf"], "b": maior["bairro"],
        }
    return dict(sorted(arquivos.items()))


def textos(arquivos: Mapping[str, object]) -> dict[str, str]:
    return {caminho: json_canonico(conteudo) for caminho, conteudo in arquivos.items()}


def calcular_versao(textos_arquivos: Mapping[str, str], indice: Mapping) -> str:
    resumo = hashlib.sha256()
    for caminho in sorted(textos_arquivos):
        resumo.update(f"{caminho}\n{textos_arquivos[caminho]}\n".encode())
    estavel = {k: v for k, v in indice.items() if k not in CAMPOS_FORA_DA_VERSAO}
    resumo.update(f"indice.json\n{json_canonico(estavel)}\n".encode())
    return resumo.hexdigest()[:TAMANHO_VERSAO]


def gravar(textos_arquivos: Mapping[str, str], destino: Path) -> None:
    """Grava numa pasta nova ao lado e troca de uma vez: nunca fica meia publicação em `destino`."""
    nova = destino.with_name(destino.name + ".novo")
    antiga = destino.with_name(destino.name + ".antigo")
    for pasta in (nova, antiga):
        shutil.rmtree(pasta, ignore_errors=True)
    for caminho, texto in textos_arquivos.items():
        alvo = nova / caminho
        alvo.parent.mkdir(parents=True, exist_ok=True)
        alvo.write_text(texto, encoding="utf-8", newline="")
    if destino.exists():
        destino.rename(antiga)
    nova.rename(destino)
    shutil.rmtree(antiga, ignore_errors=True)


def tamanhos(textos_arquivos: Mapping[str, str]) -> dict[str, dict]:
    """Por pasta de primeiro nível: nº de arquivos, bytes, maior arquivo."""
    resumo: dict[str, dict] = {}
    for caminho, texto in textos_arquivos.items():
        pasta = caminho.split("/", 1)[0]
        tamanho = len(texto.encode("utf-8"))
        atual = resumo.setdefault(pasta, {"arquivos": 0, "bytes": 0, "maior": caminho, "maiorBytes": -1})
        atual["arquivos"] += 1
        atual["bytes"] += tamanho
        if tamanho > atual["maiorBytes"]:
            atual["maior"], atual["maiorBytes"] = caminho, tamanho
    return resumo
