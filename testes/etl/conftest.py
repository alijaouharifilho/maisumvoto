"""Fixtures compartilhadas dos testes do ETL."""

import json
from pathlib import Path

import pytest

from etl import config

RAIZ = Path(__file__).resolve().parents[2]
FIXTURES = Path(__file__).resolve().parent / "fixtures"


@pytest.fixture(scope="session")
def candidatura() -> config.Candidatura:
    return config.ler_candidatura()


@pytest.fixture(scope="session")
def regras_busca() -> config.RegrasBusca:
    return config.ler_busca()


@pytest.fixture(scope="session")
def golden() -> dict:
    return json.loads((RAIZ / "testes" / "golden" / "metricas.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def fixtures() -> Path:
    return FIXTURES
