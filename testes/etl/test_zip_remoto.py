"""Leitura de zip remoto por partes (diretório central na cauda + uma entrada por Range)."""

import hashlib
import io
import zipfile
import zlib

import pytest

from etl import zip_remoto


def _zip(entradas: dict[str, bytes], metodo=zipfile.ZIP_DEFLATED) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=metodo) as z:
        for nome, dados in entradas.items():
            z.writestr(nome, dados)
    return buffer.getvalue()


ENTRADAS = {
    "a_AC.csv": b"linha;1\n" * 500,
    "a_RR.csv": "ção;2\n".encode("latin-1") * 300,
    "leiame.pdf": b"%PDF" + bytes(range(256)) * 4,
}


def test_lista_entradas_pela_cauda():
    dados = _zip(ENTRADAS)
    entradas = zip_remoto.ler_diretorio(dados[-4096:], len(dados))
    assert [e.nome for e in entradas] == list(ENTRADAS)
    assert entradas[0].tamanho == len(ENTRADAS["a_AC.csv"])
    assert entradas[0].crc == zlib.crc32(ENTRADAS["a_AC.csv"])


def test_cauda_curta_demais_pede_o_deslocamento_do_diretorio():
    dados = _zip(ENTRADAS)
    with pytest.raises(zip_remoto.DiretorioForaDaCauda) as erro:
        zip_remoto.ler_diretorio(dados[-60:], len(dados))
    assert 0 < erro.value.inicio < len(dados) - 60


def test_sem_fim_de_diretorio_falha():
    with pytest.raises(zip_remoto.ErroZip):
        zip_remoto.ler_diretorio(b"x" * 100, 100)


@pytest.mark.parametrize("metodo", [zipfile.ZIP_DEFLATED, zipfile.ZIP_STORED])
def test_extrai_uma_entrada_a_partir_do_bloco_da_faixa(tmp_path, metodo):
    dados = _zip(ENTRADAS, metodo)
    entrada = zip_remoto.ler_diretorio(dados[-4096:], len(dados))[1]
    inicio, fim = zip_remoto.faixa_da_entrada(entrada)
    destino = tmp_path / "saida.csv"
    resumo = zip_remoto.extrair(dados[inicio : fim + 1], entrada, destino)
    assert destino.read_bytes() == ENTRADAS["a_RR.csv"]
    assert resumo == hashlib.sha256(ENTRADAS["a_RR.csv"]).hexdigest()


def test_crc_errado_nao_grava(tmp_path):
    dados = bytearray(_zip(ENTRADAS, zipfile.ZIP_STORED))
    entrada = zip_remoto.ler_diretorio(bytes(dados[-4096:]), len(dados))[0]
    inicio, fim = zip_remoto.faixa_da_entrada(entrada)
    bloco = bytearray(dados[inicio : fim + 1])
    bloco[60] ^= 0xFF
    destino = tmp_path / "saida.csv"
    with pytest.raises(zip_remoto.ErroZip):
        zip_remoto.extrair(bytes(bloco), entrada, destino)
    assert not destino.exists()


def test_bloco_que_nao_comeca_no_cabecalho_local_falha(tmp_path):
    dados = _zip(ENTRADAS)
    entrada = zip_remoto.ler_diretorio(dados[-4096:], len(dados))[0]
    with pytest.raises(zip_remoto.ErroZip):
        zip_remoto.extrair(b"lixo" * 100, entrada, tmp_path / "x")


def test_zip64_e_lido():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED, allowZip64=True) as z:
        with z.open("grande.csv", "w", force_zip64=True) as f:
            f.write(b"abc;1\n" * 1000)
    dados = buffer.getvalue()
    entradas = zip_remoto.ler_diretorio(dados[-4096:], len(dados))
    assert entradas[0].nome == "grande.csv"
    assert entradas[0].tamanho == 6000
