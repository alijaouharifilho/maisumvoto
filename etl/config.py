"""Leitura da configuração única (config/candidatura.json e config/busca.json).

Nenhum número ou nome de candidato vive no código: tudo vem destes arquivos.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

RAIZ = Path(__file__).resolve().parents[1]
CAMINHO_CANDIDATURA = RAIZ / "config" / "candidatura.json"
CAMINHO_BUSCA = RAIZ / "config" / "busca.json"

RegraViravel = Literal["abertos", "abertosMaisOutros"]


class ErroConfig(Exception):
    """Configuração ausente ou inválida."""


class _Imutavel(BaseModel):
    model_config = ConfigDict(frozen=True, extra="ignore", populate_by_name=True)


class Candidato(_Imutavel):
    numero: str
    nome_curto: str = Field(alias="nomeCurto")
    nome_urna: str = Field(alias="nomeUrna")
    partido: str

    @field_validator("numero")
    @classmethod
    def _dois_digitos(cls, valor: str) -> str:
        if len(valor) != 2 or not valor.isdigit():
            raise ValueError(f"número de candidato precisa de 2 dígitos: {valor!r}")
        return valor


class Eleicao(_Imutavel):
    ano: int
    codigo: str
    pleito: str
    turno: int
    cargo: str
    data_2t: str = Field(alias="data2T")


class Metricas(_Imutavel):
    raio_km: float = Field(alias="raioKm")
    celula_graus: float = Field(alias="celulaGraus")
    grade_link_graus: float = Field(alias="gradeLinkGraus")
    limiar_folga: float = Field(alias="limiarFolga")
    regra_viravel: RegraViravel = Field(alias="regraViravel")


class Candidatura(_Imutavel):
    esquema: Literal[1]
    eleicao: Eleicao
    alvo: Candidato
    adversario: Candidato
    reclassificar_como_nulo: tuple[str, ...] = Field(alias="reclassificarComoNulo")
    metricas: Metricas

    @model_validator(mode="after")
    def _alvo_diferente(self) -> Candidatura:
        if self.alvo.numero == self.adversario.numero:
            raise ValueError("alvo e adversário não podem ter o mesmo número")
        return self


class RegrasBusca(_Imutavel):
    tamanho_prefixo: int = Field(alias="tamanhoPrefixo")
    min_letras_palavra_chave: int = Field(alias="minLetrasPalavraChave")
    min_letras_reserva: int = Field(alias="minLetrasReserva")
    max_resultados: int = Field(alias="maxResultados")
    genericas: frozenset[str]


def _ler_json(caminho: Path) -> dict:
    try:
        return json.loads(caminho.read_text(encoding="utf-8"))
    except FileNotFoundError as erro:
        raise ErroConfig(f"arquivo de configuração ausente: {caminho}") from erro
    except json.JSONDecodeError as erro:
        raise ErroConfig(f"JSON inválido em {caminho}: {erro}") from erro


def ler_candidatura(caminho: Path | None = None) -> Candidatura:
    alvo = caminho or CAMINHO_CANDIDATURA
    try:
        return Candidatura.model_validate(_ler_json(alvo))
    except ValidationError as erro:
        raise ErroConfig(f"configuração inválida em {alvo}: {erro}") from erro


def ler_busca(caminho: Path | None = None) -> RegrasBusca:
    alvo = caminho or CAMINHO_BUSCA
    try:
        return RegrasBusca.model_validate(_ler_json(alvo))
    except ValidationError as erro:
        raise ErroConfig(f"regras de busca inválidas em {alvo}: {erro}") from erro
