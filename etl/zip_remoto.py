"""Leitura de zip por partes: diretório central a partir da cauda e extração de uma entrada.

Permite baixar por HTTP Range só a entrada que interessa de um zip grande do CDN do TSE.
"""

from __future__ import annotations

import hashlib
import struct
import zlib
from dataclasses import dataclass
from pathlib import Path

_FIM_DIRETORIO = b"PK\x05\x06"
_FIM_DIRETORIO_64 = b"PK\x06\x06"
_CABECALHO_CENTRAL = 0x02014B50
_CABECALHO_LOCAL = b"PK\x03\x04"
_TAM_CABECALHO_LOCAL = 30
_TAM_CABECALHO_CENTRAL = 46
_EXTRA_ZIP64 = 0x0001
_MAXIMO_32 = 0xFFFFFFFF
_MAXIMO_16 = 0xFFFF
_FOLGA_CABECALHO_LOCAL = 65536
_BLOCO = 1 << 20
_UTF8 = 0x800


class ErroZip(Exception):
    """Zip malformado ou entrada corrompida."""


class DiretorioForaDaCauda(ErroZip):
    """A cauda baixada não contém o diretório central inteiro; `inicio` diz de onde pedir."""

    def __init__(self, inicio: int) -> None:
        super().__init__(f"diretório central começa em {inicio}, fora da cauda")
        self.inicio = inicio


@dataclass(frozen=True)
class EntradaZip:
    nome: str
    metodo: int
    crc: int
    tamanho_comprimido: int
    tamanho: int
    deslocamento: int


def _localizar_diretorio(cauda: bytes) -> tuple[int, int, int]:
    i = cauda.rfind(_FIM_DIRETORIO)
    if i < 0:
        raise ErroZip("fim do diretório central não encontrado")
    _, _, _, _, total, tamanho, deslocamento, _ = struct.unpack("<IHHHHIIH", cauda[i : i + 22])
    if deslocamento == _MAXIMO_32 or total == _MAXIMO_16 or tamanho == _MAXIMO_32:
        j = cauda.rfind(_FIM_DIRETORIO_64, 0, i)
        if j < 0:
            raise ErroZip("registro zip64 não encontrado")
        total, tamanho, deslocamento = struct.unpack("<QQQ", cauda[j + 32 : j + 56])
    return total, tamanho, deslocamento


def _valores_zip64(extra: bytes, tamanho: int, comprimido: int, deslocamento: int) -> tuple[int, int, int]:
    k = 0
    while k + 4 <= len(extra):
        ident, comprimento = struct.unpack("<HH", extra[k : k + 4])
        if ident == _EXTRA_ZIP64:
            valores = list(struct.unpack("<" + "Q" * (comprimento // 8), extra[k + 4 : k + 4 + comprimento]))
            if tamanho == _MAXIMO_32:
                tamanho = valores.pop(0)
            if comprimido == _MAXIMO_32:
                comprimido = valores.pop(0)
            if deslocamento == _MAXIMO_32:
                deslocamento = valores.pop(0)
        k += 4 + comprimento
    return tamanho, comprimido, deslocamento


def _ler_entradas(diretorio: bytes, total: int) -> list[EntradaZip]:
    entradas: list[EntradaZip] = []
    p = 0
    for _ in range(total):
        campos = struct.unpack("<IHHHHHHIIIHHHHHII", diretorio[p : p + _TAM_CABECALHO_CENTRAL])
        if campos[0] != _CABECALHO_CENTRAL:
            raise ErroZip(f"assinatura inválida no diretório central (posição {p})")
        flags, metodo, crc, comprimido, tamanho = campos[3], campos[4], campos[7], campos[8], campos[9]
        n_nome, n_extra, n_comentario, deslocamento = campos[10], campos[11], campos[12], campos[16]
        bruto_nome = diretorio[p + 46 : p + 46 + n_nome]
        nome = bruto_nome.decode("utf-8" if flags & _UTF8 else "cp437")
        extra = diretorio[p + 46 + n_nome : p + 46 + n_nome + n_extra]
        tamanho, comprimido, deslocamento = _valores_zip64(extra, tamanho, comprimido, deslocamento)
        entradas.append(EntradaZip(nome, metodo, crc, comprimido, tamanho, deslocamento))
        p += _TAM_CABECALHO_CENTRAL + n_nome + n_extra + n_comentario
    return entradas


def ler_diretorio(cauda: bytes, total_arquivo: int) -> list[EntradaZip]:
    """Lê as entradas a partir dos últimos bytes do zip (`cauda`) e do tamanho total do arquivo."""
    total, tamanho, deslocamento = _localizar_diretorio(cauda)
    base = total_arquivo - len(cauda)
    if deslocamento < base:
        raise DiretorioForaDaCauda(deslocamento)
    inicio = deslocamento - base
    return _ler_entradas(cauda[inicio : inicio + tamanho], total)


def faixa_da_entrada(entrada: EntradaZip) -> tuple[int, int]:
    """Faixa de bytes (inclusiva) que cobre o cabeçalho local e os dados comprimidos da entrada."""
    fim = entrada.deslocamento + _TAM_CABECALHO_LOCAL + len(entrada.nome.encode("utf-8"))
    return entrada.deslocamento, fim + _FOLGA_CABECALHO_LOCAL + entrada.tamanho_comprimido - 1


def _dados_comprimidos(bloco: bytes, entrada: EntradaZip) -> memoryview:
    if bloco[:4] != _CABECALHO_LOCAL:
        raise ErroZip(f"{entrada.nome}: o bloco não começa no cabeçalho local")
    n_nome, n_extra = struct.unpack("<HH", bloco[26:30])
    inicio = _TAM_CABECALHO_LOCAL + n_nome + n_extra
    dados = memoryview(bloco)[inicio : inicio + entrada.tamanho_comprimido]
    if len(dados) != entrada.tamanho_comprimido:
        raise ErroZip(f"{entrada.nome}: bloco incompleto ({len(dados)} de {entrada.tamanho_comprimido} bytes)")
    return dados


def _descompressor(metodo: int, nome: str):
    if metodo == 0:
        return None
    if metodo == 8:
        return zlib.decompressobj(-15)
    raise ErroZip(f"{nome}: método de compressão {metodo} não suportado")


def extrair(bloco: bytes, entrada: EntradaZip, destino: Path) -> str:
    """Descomprime a entrada para `destino` conferindo CRC e tamanho. Devolve o sha256 do conteúdo."""
    dados = _dados_comprimidos(bloco, entrada)
    descompressor = _descompressor(entrada.metodo, entrada.nome)
    provisorio = destino.with_name(destino.name + ".parcial")
    crc, tamanho, resumo = 0, 0, hashlib.sha256()
    with provisorio.open("wb") as saida:
        for i in range(0, len(dados), _BLOCO):
            parte = bytes(dados[i : i + _BLOCO])
            pedaco = descompressor.decompress(parte) if descompressor else parte
            crc, tamanho = zlib.crc32(pedaco, crc), tamanho + len(pedaco)
            resumo.update(pedaco)
            saida.write(pedaco)
        if descompressor:
            final = descompressor.flush()
            crc, tamanho = zlib.crc32(final, crc), tamanho + len(final)
            resumo.update(final)
            saida.write(final)
    if crc != entrada.crc or tamanho != entrada.tamanho:
        provisorio.unlink(missing_ok=True)
        raise ErroZip(f"{entrada.nome}: CRC/tamanho não conferem (crc {crc:08x}≠{entrada.crc:08x}, {tamanho}≠{entrada.tamanho})")
    provisorio.replace(destino)
    return resumo.hexdigest()
