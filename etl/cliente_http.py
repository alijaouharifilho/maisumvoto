"""Cliente HTTP mínimo (urllib): só GET, espaçamento por host, novas tentativas e gzip.

A função que abre a conexão é injetável, para os testes rodarem sem rede.
"""

from __future__ import annotations

import gzip
import logging
import time
import urllib.error
import zlib
import urllib.request
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from http.client import IncompleteRead
from pathlib import Path
from urllib.parse import urlparse

LOG = logging.getLogger("etl.http")
AGENTE = "maisumvoto-etl/0.1 (ETL de dados abertos do TSE; download espacado)"
INTERVALOS_PADRAO = {"resultados.tse.jus.br": 1.0, "cdn.tse.jus.br": 0.5, "servicodados.ibge.gov.br": 1.0}
_BLOCO = 1 << 20
_SEM_NOVA_TENTATIVA = {400, 401, 403, 404, 410, 416}


class ErroDownload(Exception):
    """Falha de rede ou resposta inesperada de uma fonte oficial."""


@dataclass(frozen=True)
class Resposta:
    status: int
    cabecalhos: Mapping[str, str]
    corpo: bytes


def _minusculas(cabecalhos) -> dict[str, str]:
    return {str(k).lower(): str(v) for k, v in (cabecalhos or {}).items()}


def _gravar(resposta, destino: Path, comprimido: bool) -> None:
    descompressor = zlib.decompressobj(16 + zlib.MAX_WBITS) if comprimido else None
    with destino.open("wb") as saida:
        for bloco in iter(lambda: resposta.read(_BLOCO), b""):
            saida.write(descompressor.decompress(bloco) if descompressor else bloco)
        if descompressor:
            saida.write(descompressor.flush())


@dataclass
class ClienteUrllib:
    abrir: Callable = urllib.request.urlopen
    dormir: Callable[[float], None] = time.sleep
    relogio: Callable[[], float] = time.monotonic
    intervalos: Mapping[str, float] = field(default_factory=lambda: dict(INTERVALOS_PADRAO))
    tentativas: int = 4
    espera_base: float = 2.0
    tempo_limite: float = 180.0
    _ultimo: dict[str, float] = field(default_factory=dict)

    def _espacar(self, host: str) -> None:
        intervalo = self.intervalos.get(host, 1.0)
        falta = self._ultimo.get(host, -1e9) + intervalo - self.relogio()
        if falta > 0:
            self.dormir(falta)
        self._ultimo[host] = self.relogio()

    def _uma_vez(self, url: str, cabecalhos: Mapping[str, str], destino: Path | None) -> Resposta:
        pedido = urllib.request.Request(url, headers={"User-Agent": AGENTE, **cabecalhos}, method="GET")
        with self.abrir(pedido, timeout=self.tempo_limite) as resposta:
            cab = _minusculas(resposta.headers)
            if destino is not None:
                _gravar(resposta, destino, cab.get("content-encoding") == "gzip")
                return Resposta(resposta.status, cab, b"")
            corpo = resposta.read()
        if cab.get("content-encoding") == "gzip":
            corpo = gzip.decompress(corpo)
        return Resposta(resposta.status, cab, corpo)

    def obter(self, url: str, cabecalhos: Mapping[str, str] | None = None, destino: Path | None = None) -> Resposta:
        host = urlparse(url).hostname or ""
        ultimo_erro: Exception | None = None
        for tentativa in range(self.tentativas):
            self._espacar(host)
            try:
                return self._uma_vez(url, cabecalhos or {}, destino)
            except urllib.error.HTTPError as erro:
                if erro.code == 304:
                    return Resposta(304, _minusculas(erro.headers), b"")
                if erro.code in _SEM_NOVA_TENTATIVA:
                    raise ErroDownload(f"{url}: HTTP {erro.code}") from erro
                ultimo_erro = erro
            except (urllib.error.URLError, TimeoutError, ConnectionError, IncompleteRead, OSError) as erro:
                ultimo_erro = erro
            LOG.warning("%s: tentativa %d falhou (%s)", url, tentativa + 1, ultimo_erro)
            self.dormir(self.espera_base * 2**tentativa)
        raise ErroDownload(f"{url}: desisti depois de {self.tentativas} tentativas ({ultimo_erro})")
