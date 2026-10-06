"""Download das fontes oficiais para dados/bruto/, com manifesto (ETag, tamanho, sha256).

Armadilha medida: o HEAD do CDN do TSE informa tamanho errado. O tamanho real vem do
Content-Range de um pedido com Range (e confere com o ETag, que traz o tamanho em hexadecimal).
Zips grandes: só as entradas necessárias, por Range. Só GET, com espaçamento por host.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import logging
import re
from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Protocol

from etl import fontes, zip_remoto
from etl.cliente_http import ClienteUrllib, ErroDownload, Resposta
from etl.fontes import Catalogo

__all__ = ["ClienteUrllib", "ErroDownload", "Resposta", "baixar_tudo", "consultar_zip"]

LOG = logging.getLogger("etl.baixar")
TAMANHO_CAUDA = 262144
NOME_MANIFESTO = "manifest.json"
COLUNAS_CANDIDATOS = (
    "DT_GERACAO", "HH_GERACAO", "ANO_ELEICAO", "CD_ELEICAO", "NR_TURNO", "SG_UF", "CD_CARGO", "DS_CARGO",
    "NR_CANDIDATO", "NM_URNA_CANDIDATO", "SG_PARTIDO", "NR_PARTIDO", "DS_SITUACAO_CANDIDATURA", "DS_SIT_TOT_TURNO",
)
_CONTENT_RANGE = re.compile(r"bytes (\d+)-(\d+)/(\d+)")
_ETAG_TAMANHO = re.compile(r'^(?:W/)?"([0-9a-f]+)-[0-9a-f]+"$')


class Cliente(Protocol):
    def obter(self, url: str, cabecalhos: Mapping[str, str] | None = None, destino: Path | None = None) -> Resposta: ...


@dataclass(frozen=True)
class EstadoRemoto:
    etag: str | None
    ultima_modificacao: str | None
    total: int
    cauda: bytes


def tamanho_pelo_etag(etag: str | None) -> int | None:
    casamento = _ETAG_TAMANHO.match(etag or "")
    return int(casamento.group(1), 16) if casamento else None


def total_pelo_content_range(valor: str | None) -> int | None:
    casamento = _CONTENT_RANGE.match(valor or "")
    return int(casamento.group(3)) if casamento else None


def _sha256_arquivo(caminho: Path) -> str:
    resumo = hashlib.sha256()
    with caminho.open("rb") as entrada:
        for bloco in iter(lambda: entrada.read(1 << 20), b""):
            resumo.update(bloco)
    return resumo.hexdigest()


def consultar_zip(cliente: Cliente, url: str) -> EstadoRemoto:
    """Um GET com Range na cauda: devolve ETag, tamanho real e os últimos bytes (diretório central)."""
    resposta = cliente.obter(url, {"Range": f"bytes=-{TAMANHO_CAUDA}"})
    total = total_pelo_content_range(resposta.cabecalhos.get("content-range"))
    if resposta.status != 206 or total is None:
        raise ErroDownload(f"{url}: o servidor não respondeu à faixa (status {resposta.status}); sem tamanho confiável")
    pelo_etag = tamanho_pelo_etag(resposta.cabecalhos.get("etag"))
    if pelo_etag is not None and pelo_etag != total:
        LOG.warning("%s: ETag indica %d bytes, Content-Range indica %d; vale o Content-Range", url, pelo_etag, total)
    return EstadoRemoto(resposta.cabecalhos.get("etag"), resposta.cabecalhos.get("last-modified"), total, resposta.corpo)


def _faixa(cliente: Cliente, url: str, estado: EstadoRemoto, inicio: int, fim: int) -> bytes:
    resposta = cliente.obter(url, {"Range": f"bytes={inicio}-{fim}"})
    faixa = _CONTENT_RANGE.match(resposta.cabecalhos.get("content-range") or "")
    if resposta.status != 206 or not faixa or int(faixa.group(1)) != inicio:
        raise ErroDownload(f"{url}: faixa {inicio}-{fim} não atendida (status {resposta.status})")
    if estado.etag and resposta.cabecalhos.get("etag") != estado.etag:
        raise ErroDownload(f"{url}: o arquivo mudou durante o download (ETag diferente); rode de novo")
    return resposta.corpo


def _entradas(cliente: Cliente, url: str, estado: EstadoRemoto) -> dict[str, zip_remoto.EntradaZip]:
    try:
        lista = zip_remoto.ler_diretorio(estado.cauda, estado.total)
    except zip_remoto.DiretorioForaDaCauda as falta:
        cauda = _faixa(cliente, url, estado, falta.inicio, estado.total - 1)
        lista = zip_remoto.ler_diretorio(cauda, estado.total)
    return {e.nome: e for e in lista}


def _baixar_entradas(cliente: Cliente, url: str, estado: EstadoRemoto, pedidos: Mapping[str, Path]) -> dict[str, str]:
    entradas = _entradas(cliente, url, estado)
    resumos: dict[str, str] = {}
    for nome, destino in pedidos.items():
        entrada = entradas.get(nome)
        if entrada is None:
            raise ErroDownload(f"{url}: entrada {nome} não existe no zip")
        inicio, fim = zip_remoto.faixa_da_entrada(entrada)
        bloco = _faixa(cliente, url, estado, inicio, min(fim, estado.total - 1))
        resumos[destino.name] = zip_remoto.extrair(bloco, entrada, destino)
        LOG.info("  %s: %.1f MB", nome, entrada.tamanho / 1e6)
    return resumos


def _baixar_zip_inteiro(cliente: Cliente, url: str, estado: EstadoRemoto, destino: Path) -> dict[str, str]:
    provisorio = destino.with_name(destino.name + ".parcial")
    resposta = cliente.obter(url, None, provisorio)
    tamanho = provisorio.stat().st_size if provisorio.exists() else -1
    if resposta.status != 200 or tamanho != estado.total:
        provisorio.unlink(missing_ok=True)
        raise ErroDownload(f"{url}: baixados {tamanho} bytes, esperados {estado.total} (status {resposta.status})")
    if estado.etag and resposta.cabecalhos.get("etag") not in (None, estado.etag):
        provisorio.unlink(missing_ok=True)
        raise ErroDownload(f"{url}: o arquivo mudou durante o download (ETag diferente); rode de novo")
    provisorio.replace(destino)
    return {destino.name: _sha256_arquivo(destino)}


def higienizar_candidatos(origem: Path, destino: Path) -> None:
    """Regrava o CSV de candidatos só com colunas não pessoais (sem CPF, título ou e-mail)."""
    with origem.open(encoding="latin-1", newline="") as entrada:
        leitor = csv.DictReader(entrada, delimiter=";")
        colunas = [c for c in COLUNAS_CANDIDATOS if c in (leitor.fieldnames or [])]
        saida = io.StringIO()
        escritor = csv.writer(saida, delimiter=";", quoting=csv.QUOTE_ALL, lineterminator="\n")
        escritor.writerow(colunas)
        escritor.writerows([linha[c] for c in colunas] for linha in leitor)
    destino.write_text(saida.getvalue(), encoding="latin-1", newline="")


def _arquivos_presentes(pasta: Path, registro: Mapping | None, nomes: Iterable[str]) -> bool:
    if not registro:
        return False
    arquivos = registro.get("arquivos", {})
    return all(n in arquivos and (pasta / n).exists() for n in nomes)


def _registro(url: str, estado: EstadoRemoto | None, arquivos: Mapping[str, str], etag: str | None = None) -> dict:
    return {
        "url": url,
        "etag": estado.etag if estado else etag,
        "ultimaModificacao": estado.ultima_modificacao if estado else None,
        "tamanho": estado.total if estado else None,
        "arquivos": dict(sorted(arquivos.items())),
        "baixadoEm": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


Acao = Callable[[Cliente, str, EstadoRemoto], dict[str, str]]


def _fonte_zip(cliente: Cliente, pasta: Path, manifesto: dict, ident: str, url: str, nomes: list[str], acao: Acao) -> None:
    estado = consultar_zip(cliente, url)
    anterior = manifesto.get(ident)
    if anterior and anterior.get("etag") == estado.etag and anterior.get("tamanho") == estado.total \
            and _arquivos_presentes(pasta, anterior, nomes):
        LOG.info("%s: sem mudança (ETag %s), mantido", ident, estado.etag)
        return
    LOG.info("%s: baixando (%.1f MB no servidor)", ident, estado.total / 1e6)
    manifesto[ident] = _registro(url, estado, acao(cliente, url, estado))


def _candidatos(pasta: Path, cat: Catalogo) -> Acao:
    def acao(cliente: Cliente, url: str, estado: EstadoRemoto) -> dict[str, str]:
        bruto = pasta / (cat.candidatos + ".bruto")
        try:
            _baixar_entradas(cliente, url, estado, {cat.candidatos: bruto})
            higienizar_candidatos(bruto, pasta / cat.candidatos)
        finally:
            bruto.unlink(missing_ok=True)
        return {cat.candidatos: _sha256_arquivo(pasta / cat.candidatos)}

    return acao


def _json_condicional(cliente: Cliente, pasta: Path, manifesto: dict, ident: str, url: str, nome: str) -> None:
    anterior = manifesto.get(ident)
    destino = pasta / nome
    cabecalhos = {"If-None-Match": anterior["etag"]} if anterior and anterior.get("etag") and destino.exists() else {}
    resposta = cliente.obter(url, cabecalhos)
    if resposta.status == 304:
        return
    if resposta.status != 200:
        raise ErroDownload(f"{url}: status {resposta.status}")
    json.loads(resposta.corpo)
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(resposta.corpo)
    sha = hashlib.sha256(resposta.corpo).hexdigest()
    manifesto[ident] = _registro(url, None, {nome: sha}, resposta.cabecalhos.get("etag"))


def _validar_malha(caminho: Path) -> None:
    try:
        malha = json.loads(caminho.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as erro:
        raise ErroDownload(f"malha do IBGE não é JSON válido: {erro}") from erro
    if malha.get("type") != "FeatureCollection" or not isinstance(malha.get("features"), list):
        raise ErroDownload("malha do IBGE não é um GeoJSON FeatureCollection")


def _malha(cliente: Cliente, pasta: Path, manifesto: dict) -> None:
    destino = pasta / fontes.NOME_MALHA
    if destino.exists() and "malha_ibge" in manifesto:
        LOG.info("malha_ibge: já presente, mantida")
        return
    provisorio = destino.with_name(destino.name + ".parcial")
    resposta = cliente.obter(fontes.URL_MALHA, None, provisorio)
    try:
        if resposta.status != 200:
            raise ErroDownload(f"malha do IBGE: status {resposta.status}")
        _validar_malha(provisorio)
    except ErroDownload:
        provisorio.unlink(missing_ok=True)
        raise
    provisorio.replace(destino)
    manifesto["malha_ibge"] = _registro(fontes.URL_MALHA, None, {destino.name: _sha256_arquivo(destino)})


def _ler_manifesto(pasta: Path) -> dict:
    caminho = pasta / NOME_MANIFESTO
    return json.loads(caminho.read_text(encoding="utf-8")) if caminho.exists() else {}


def _salvar_manifesto(pasta: Path, manifesto: dict) -> None:
    texto = json.dumps(manifesto, ensure_ascii=False, indent=1, sort_keys=True)
    (pasta / NOME_MANIFESTO).write_text(texto, encoding="utf-8")


def _passos(cat: Catalogo, pasta: Path, cliente: Cliente, manifesto: dict) -> list[Callable[[], None]]:
    cadastros = {f"eleitorado_local_votacao_{cat.ano}_{uf}.csv": pasta / cat.cadastro(uf) for uf in fontes.UFS}
    zip_votacao = cat.url_zip_votacao.rsplit("/", 1)[1]
    zips: list[tuple[str, str, list[str], Acao]] = [
        ("votacao_secao", cat.url_zip_votacao, [zip_votacao],
         lambda c, u, e: _baixar_zip_inteiro(c, u, e, pasta / zip_votacao)),
        ("detalhe_votacao_secao", cat.url_zip_detalhe, [cat.detalhe],
         lambda c, u, e: _baixar_entradas(c, u, e, {cat.detalhe: pasta / cat.detalhe})),
        ("eleitorado_local_votacao", cat.url_zip_cadastro, [p.name for p in cadastros.values()],
         lambda c, u, e: _baixar_entradas(c, u, e, cadastros)),
        ("consulta_cand", cat.url_zip_candidatos, [cat.candidatos], _candidatos(pasta, cat)),
    ]
    passos: list[Callable[[], None]] = [
        (lambda z=z: _fonte_zip(cliente, pasta, manifesto, *z)) for z in zips
    ]
    passos += [
        (lambda a=a: _json_condicional(cliente, pasta, manifesto, f"resultado_{a.lower()}", cat.url_resultado(a),
                                       cat.resultado(a)))
        for a in cat.abrangencias_resultado
    ]
    passos.append(lambda: _json_condicional(cliente, pasta, manifesto, "municipios_tse_ibge", cat.url_municipios,
                                            cat.municipios))
    passos.append(lambda: _malha(cliente, pasta, manifesto))
    return passos


def baixar_tudo(cat: Catalogo, pasta: Path, cliente: Cliente | None = None) -> dict:
    """Baixa (ou mantém, se não mudou) todas as fontes. Grava o manifesto a cada fonte e o devolve."""
    cliente = cliente or ClienteUrllib()
    pasta.mkdir(parents=True, exist_ok=True)
    manifesto = _ler_manifesto(pasta)
    for passo in _passos(cat, pasta, cliente, manifesto):
        passo()
        _salvar_manifesto(pasta, manifesto)
    return manifesto


def principal() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
    from etl.config import ler_candidatura

    try:
        baixar_tudo(Catalogo.da_config(ler_candidatura()), fontes.PASTA_BRUTO)
    except (ErroDownload, zip_remoto.ErroZip) as erro:
        LOG.error("download falhou: %s", erro)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
