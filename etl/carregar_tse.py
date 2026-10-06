"""Leitura dos arquivos de dados abertos do TSE (latin-1, ';', aspas, marcadores -1/#NULO#/#NE#).

Cada leitor devolve um DataFrame com nomes de coluna próprios e tipos já convertidos.
Nada de CPF, título ou e-mail entra aqui: as colunas lidas são escolhidas uma a uma. Telefone embutido no nome ou no
endereço do local sai na leitura (`etl/telefone.py`).
"""

from __future__ import annotations

import csv
import io
import re
import zipfile
from collections.abc import Iterator, Mapping, Sequence
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import IO

import pandas as pd
import pyarrow as pa
import pyarrow.csv as pacsv

from etl.config import Eleicao
from etl.telefone import sem_telefone_em

MARCADORES_TEXTO = {"#NULO#", "#NULO", "#NE#", "#NE"}
MARCADORES_NUMERO = {"-1", "-3"}
SECAO_PRINCIPAL = 1
_ESPACOS = re.compile(r"\s+")
_BLOCO_CSV = 1 << 24
_INT = pa.int64()
_TEXTO = pa.string()


class ErroEntrada(Exception):
    """Arquivo de entrada ausente, incompleto ou incoerente."""


@dataclass(frozen=True)
class Origem:
    caminho: Path
    entrada: str | None = None

    @contextmanager
    def abrir(self) -> Iterator[IO[bytes]]:
        if self.entrada is None:
            with self.caminho.open("rb") as arquivo:
                yield arquivo
            return
        with zipfile.ZipFile(self.caminho) as z, z.open(self.entrada) as arquivo:
            yield arquivo

    def __str__(self) -> str:
        return f"{self.caminho.name}:{self.entrada}" if self.entrada else self.caminho.name


def localizar(pasta: Path, nome_csv: str) -> Origem:
    """`nome.csv` solto ou dentro de `nome.zip` (assim fixtures e dados reais usam o mesmo caminho)."""
    solto = pasta / nome_csv
    if solto.exists():
        return Origem(solto)
    compactado = pasta / (Path(nome_csv).stem + ".zip")
    if compactado.exists():
        with zipfile.ZipFile(compactado) as z:
            if nome_csv in z.namelist():
                return Origem(compactado, nome_csv)
        raise ErroEntrada(f"{compactado.name} não contém {nome_csv}")
    raise ErroEntrada(f"arquivo ausente: {solto} (rode sem --sem-baixar)")


def para_float_br(texto: str | None) -> float | None:
    bruto = (texto or "").strip()
    if not bruto or bruto in MARCADORES_NUMERO or bruto in MARCADORES_TEXTO:
        return None
    try:
        return float(bruto.replace(",", "."))
    except ValueError:
        return None


def limpar_texto(texto: str | None) -> str:
    bruto = _ESPACOS.sub(" ", texto or "").strip()
    return "" if bruto in MARCADORES_TEXTO else bruto


def ler_tabela(origem: Origem, colunas: Mapping[str, pa.DataType]) -> pd.DataFrame:
    leitura = pacsv.ReadOptions(encoding="latin1", block_size=_BLOCO_CSV)
    conversao = pacsv.ConvertOptions(include_columns=list(colunas), column_types=dict(colunas))
    try:
        with origem.abrir() as arquivo:
            tabela = pacsv.read_csv(arquivo, read_options=leitura,
                                    parse_options=pacsv.ParseOptions(delimiter=";"), convert_options=conversao)
    except (pa.ArrowInvalid, KeyError) as erro:
        raise ErroEntrada(f"{origem}: {erro}") from erro
    return tabela.to_pandas()


def data_geracao(origem: Origem) -> str | None:
    """'DD/MM/AAAA HH:MM:SS' da primeira linha (colunas DT_GERACAO e HH_GERACAO)."""
    with origem.abrir() as arquivo:
        leitor = csv.DictReader(io.TextIOWrapper(arquivo, encoding="latin-1"), delimiter=";")
        primeira = next(leitor, None)
    if not primeira or "DT_GERACAO" not in primeira or "HH_GERACAO" not in primeira:
        return None
    return f"{primeira['DT_GERACAO']} {primeira['HH_GERACAO']}"


def _da_eleicao(df: pd.DataFrame, eleicao: Eleicao) -> pd.DataFrame:
    filtro = (df["CD_ELEICAO"] == int(eleicao.codigo)) & (df["CD_CARGO"] == int(eleicao.cargo))
    return df[filtro]


def _chave(df: pd.DataFrame) -> pd.DataFrame:
    return pd.DataFrame({
        "uf": df["SG_UF"].astype(str).to_numpy(),
        "mun": df["CD_MUNICIPIO"].astype(int).astype(str).str.zfill(5).to_numpy(),
        "zona": df["NR_ZONA"].astype(int).to_numpy(),
        "secao": df["NR_SECAO"].astype(int).to_numpy(),
    })


def ler_detalhe(origem: Origem, eleicao: Eleicao) -> pd.DataFrame:
    colunas = {"CD_ELEICAO": _INT, "CD_CARGO": _INT, "SG_UF": _TEXTO, "CD_MUNICIPIO": _INT, "NR_ZONA": _INT,
               "NR_SECAO": _INT, "QT_APTOS": _INT, "QT_COMPARECIMENTO": _INT, "QT_ABSTENCOES": _INT,
               "QT_VOTOS_BRANCOS": _INT, "QT_VOTOS_NULOS": _INT, "ST_SECAO_INSTALADA": _TEXTO}
    bruto = _da_eleicao(ler_tabela(origem, colunas), eleicao)
    df = _chave(bruto).assign(
        aptos=bruto["QT_APTOS"].to_numpy(), comparecimento=bruto["QT_COMPARECIMENTO"].to_numpy(),
        abstencao=bruto["QT_ABSTENCOES"].to_numpy(), brancos=bruto["QT_VOTOS_BRANCOS"].to_numpy(),
        nulos=bruto["QT_VOTOS_NULOS"].to_numpy(), instalada=(bruto["ST_SECAO_INSTALADA"] == "Sim").to_numpy(),
    )
    repetidas = df.duplicated(["uf", "mun", "zona", "secao"])
    if repetidas.any():
        raise ErroEntrada(f"{origem}: {int(repetidas.sum())} seções repetidas no detalhe")
    return df.reset_index(drop=True)


def ler_votos(origem: Origem, eleicao: Eleicao) -> pd.DataFrame:
    colunas = {"CD_ELEICAO": _INT, "CD_CARGO": _INT, "SG_UF": _TEXTO, "CD_MUNICIPIO": _INT, "NR_ZONA": _INT,
               "NR_SECAO": _INT, "NR_VOTAVEL": _INT, "QT_VOTOS": _INT}
    bruto = _da_eleicao(ler_tabela(origem, colunas), eleicao)
    return _chave(bruto).assign(
        numero=bruto["NR_VOTAVEL"].astype(str).str.zfill(2).to_numpy(), votos=bruto["QT_VOTOS"].to_numpy(),
    ).reset_index(drop=True)


_COLUNAS_CADASTRO = {
    "SG_UF": _TEXTO, "CD_MUNICIPIO": _INT, "NM_MUNICIPIO": _TEXTO, "NR_ZONA": _INT, "NR_SECAO": _INT,
    "CD_TIPO_SECAO_AGREGADA": _INT,
    "NR_LOCAL_VOTACAO": _INT, "NM_LOCAL_VOTACAO": _TEXTO, "CD_TIPO_LOCAL": _INT, "DS_TIPO_LOCAL": _TEXTO,
    "DS_ENDERECO": _TEXTO,
    "NM_BAIRRO": _TEXTO, "NR_CEP": _TEXTO, "NR_LATITUDE": _TEXTO, "NR_LONGITUDE": _TEXTO,
    "QT_ELEITOR_ELEICAO_FEDERAL": _INT,
}


def _ler_um_cadastro(origem: Origem) -> pd.DataFrame:
    bruto = ler_tabela(origem, _COLUNAS_CADASTRO)
    bruto = bruto[bruto["CD_TIPO_SECAO_AGREGADA"] == SECAO_PRINCIPAL]
    return _chave(bruto).assign(
        municipio=[limpar_texto(x) for x in bruto["NM_MUNICIPIO"]],
        nr_local=bruto["NR_LOCAL_VOTACAO"].to_numpy(),
        nome=sem_telefone_em(limpar_texto(x) for x in bruto["NM_LOCAL_VOTACAO"]),
        cd_tipo_local=bruto["CD_TIPO_LOCAL"].to_numpy(),
        tipo_local=[limpar_texto(x) for x in bruto["DS_TIPO_LOCAL"]],
        endereco=sem_telefone_em(limpar_texto(x) for x in bruto["DS_ENDERECO"]),
        bairro=[limpar_texto(x) for x in bruto["NM_BAIRRO"]],
        cep=[limpar_texto(x) for x in bruto["NR_CEP"]],
        lat=[para_float_br(x) for x in bruto["NR_LATITUDE"]],
        lon=[para_float_br(x) for x in bruto["NR_LONGITUDE"]],
        eleitores=bruto["QT_ELEITOR_ELEICAO_FEDERAL"].to_numpy(),
    )


def ler_cadastro(origens: Sequence[Origem]) -> pd.DataFrame:
    """Só seções principais (a agregada não tem urna própria; o eleitorado dela já está na principal)."""
    partes = [_ler_um_cadastro(o) for o in origens]
    df = pd.concat(partes, ignore_index=True) if partes else pd.DataFrame()
    df["lat"] = df["lat"].astype(float)
    df["lon"] = df["lon"].astype(float)
    return df


def ler_candidatos(origem: Origem, eleicao: Eleicao) -> dict[str, dict[str, str]]:
    colunas = {"CD_ELEICAO": _INT, "CD_CARGO": _INT, "NR_CANDIDATO": _INT, "NM_URNA_CANDIDATO": _TEXTO,
               "SG_PARTIDO": _TEXTO}
    df = _da_eleicao(ler_tabela(origem, colunas), eleicao)
    return {
        str(n).zfill(2): {"nome": limpar_texto(nome), "partido": limpar_texto(partido)}
        for n, nome, partido in zip(df["NR_CANDIDATO"], df["NM_URNA_CANDIDATO"], df["SG_PARTIDO"], strict=True)
    }
