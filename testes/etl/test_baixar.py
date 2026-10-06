"""Download: tamanho real por ETag/Content-Range, entradas por Range, manifesto e pulo do que não mudou."""

import csv
import gzip
import io
import json
import re
import urllib.error
import zipfile
from dataclasses import dataclass, field

import pytest

from etl import baixar, fontes
from etl.fontes import Catalogo

CAT = Catalogo(ano=2026, codigo="6257", cargo="1")


def _zip(entradas: dict[str, bytes]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as z:
        for nome, dados in entradas.items():
            z.writestr(nome, dados)
    return buffer.getvalue()


def _csv(cabecalho: list[str], linhas: list[list[str]]) -> bytes:
    saida = io.StringIO()
    escritor = csv.writer(saida, delimiter=";", quoting=csv.QUOTE_ALL, lineterminator="\n")
    escritor.writerow(cabecalho)
    escritor.writerows(linhas)
    return saida.getvalue().encode("latin-1")


CABECALHO_CAND = ["DT_GERACAO", "HH_GERACAO", "CD_ELEICAO", "CD_CARGO", "NR_CANDIDATO", "NM_URNA_CANDIDATO",
                  "SG_PARTIDO", "NR_CPF_CANDIDATO", "NR_TITULO_ELEITORAL_CANDIDATO", "DS_EMAIL"]


@dataclass
class ServidorFalso:
    """Cliente HTTP falso: serve bytes por URL, com ETag, Range e If-None-Match."""

    arquivos: dict[str, bytes]
    etags: dict[str, str] = field(default_factory=dict)
    pedidos: list[tuple[str, dict]] = field(default_factory=list)

    def obter(self, url, cabecalhos=None, destino=None):
        cabecalhos = dict(cabecalhos or {})
        self.pedidos.append((url, cabecalhos))
        corpo = self.arquivos[url]
        etag = self.etags.get(url, f'"{len(corpo):x}-abc"')
        if cabecalhos.get("If-None-Match") == etag:
            return baixar.Resposta(304, {"etag": etag}, b"")
        resposta = self._faixa(corpo, cabecalhos.get("Range"), etag)
        if destino is not None:
            destino.write_bytes(resposta.corpo)
            return baixar.Resposta(resposta.status, resposta.cabecalhos, b"")
        return resposta

    @staticmethod
    def _faixa(corpo, faixa, etag):
        if not faixa:
            return baixar.Resposta(200, {"etag": etag, "content-length": "1"}, corpo)
        cauda = re.fullmatch(r"bytes=-(\d+)", faixa)
        if cauda:
            inicio = max(0, len(corpo) - int(cauda.group(1)))
            fim = len(corpo) - 1
        else:
            a, b = re.fullmatch(r"bytes=(\d+)-(\d+)", faixa).groups()
            inicio, fim = int(a), min(int(b), len(corpo) - 1)
        cabecalhos = {"etag": etag, "content-range": f"bytes {inicio}-{fim}/{len(corpo)}", "content-length": "1"}
        return baixar.Resposta(206, cabecalhos, corpo[inicio : fim + 1])


def _servidor() -> ServidorFalso:
    linha = ["05/10/2026", "10:15:16"]
    detalhe = _csv(["DT_GERACAO", "HH_GERACAO", "SG_UF"], [linha + ["RR"]])
    cadastro = {f"eleitorado_local_votacao_2026_{uf}.csv": _csv(["DT_GERACAO", "HH_GERACAO", "SG_UF"], [linha + [uf]])
                for uf in fontes.UFS}
    candidatos = _csv(CABECALHO_CAND, [linha + ["6257", "1", "99", "FULANO", "XX", "12345678901", "123456789012", "a@b.c"]])
    arquivos = {
        CAT.url_zip_votacao: _zip({CAT.votacao: _csv(["DT_GERACAO", "HH_GERACAO"], [linha]), "leiame.pdf": b"x"}),
        CAT.url_zip_detalhe: _zip({"detalhe_votacao_secao_2026_SP.csv": b"a" * 5000, CAT.detalhe: detalhe}),
        CAT.url_zip_cadastro: _zip({**cadastro, "eleitorado_local_votacao_2026_BRASIL.csv": b"b" * 9000}),
        CAT.url_zip_candidatos: _zip({CAT.candidatos: candidatos, "consulta_cand_2026_SP.csv": b"c"}),
        CAT.url_municipios: json.dumps({"dg": "02/10/2026", "hg": "18:30:22", "abr": []}).encode(),
        fontes.URL_MALHA: b'{"type":"FeatureCollection","features":[]}',
    }
    for abr in CAT.abrangencias_resultado:
        arquivos[CAT.url_resultado(abr)] = json.dumps({"dg": "05/10/2026", "hg": "12:51:47", "cdabr": abr.lower()}).encode()
    return ServidorFalso(arquivos)


def test_tamanho_pelo_etag_e_content_range():
    assert baixar.tamanho_pelo_etag('"54201a9-65d149432870a"') == 88211881
    assert baixar.tamanho_pelo_etag('"2da19dbacd44746287f057d454ed01f0"') is None
    assert baixar.tamanho_pelo_etag(None) is None
    assert baixar.total_pelo_content_range("bytes 88080809-88211880/88211881") == 88211881
    assert baixar.total_pelo_content_range(None) is None
    assert baixar.total_pelo_content_range("bytes */*") is None


def test_baixa_tudo_e_grava_manifesto(tmp_path):
    servidor = _servidor()
    manifesto = baixar.baixar_tudo(CAT, tmp_path, servidor)
    assert (tmp_path / CAT.detalhe).read_bytes().startswith(b'"DT_GERACAO"')
    assert (tmp_path / "votacao_secao_2026_BR.zip").exists()
    assert all((tmp_path / CAT.cadastro(uf)).exists() for uf in fontes.UFS)
    assert (tmp_path / CAT.resultado("rr")).exists()
    assert (tmp_path / fontes.NOME_MALHA).exists()
    assert json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8")) == manifesto
    assert manifesto["detalhe_votacao_secao"]["tamanho"] > 0
    nao_pediu_brasil = all("BRASIL" not in str(c.get("Range", "")) for _, c in servidor.pedidos)
    assert nao_pediu_brasil


def test_candidatos_sem_cpf_titulo_ou_email(tmp_path):
    baixar.baixar_tudo(CAT, tmp_path, _servidor())
    texto = (tmp_path / CAT.candidatos).read_text(encoding="latin-1")
    assert "CPF" not in texto and "TITULO" not in texto and "EMAIL" not in texto
    assert "12345678901" not in texto and "a@b.c" not in texto
    assert "FULANO" in texto
    assert not list(tmp_path.glob("*.bruto"))


def test_segunda_rodada_nao_rebaixa_o_que_nao_mudou(tmp_path):
    servidor = _servidor()
    baixar.baixar_tudo(CAT, tmp_path, servidor)
    servidor.pedidos.clear()
    baixar.baixar_tudo(CAT, tmp_path, servidor)
    faixas = [c.get("Range") for _, c in servidor.pedidos]
    assert all(f is not None and f.startswith("bytes=-") for f in faixas if f is not None)
    assert not any(u == CAT.url_zip_votacao and "Range" not in c for u, c in servidor.pedidos)
    assert all("If-None-Match" in c for u, c in servidor.pedidos if u.endswith(".json"))


def test_etag_novo_rebaixa(tmp_path):
    servidor = _servidor()
    baixar.baixar_tudo(CAT, tmp_path, servidor)
    servidor.etags[CAT.url_zip_detalhe] = '"novo-1"'
    servidor.pedidos.clear()
    baixar.baixar_tudo(CAT, tmp_path, servidor)
    faixas = [c.get("Range") for u, c in servidor.pedidos if u == CAT.url_zip_detalhe]
    assert any(f and not f.startswith("bytes=-") for f in faixas)


def test_arquivo_que_muda_no_meio_do_download_falha(tmp_path):
    servidor = _servidor()
    original = servidor.obter

    def obter_trocando(url, cabecalhos=None, destino=None):
        resposta = original(url, cabecalhos, destino)
        faixa = (cabecalhos or {}).get("Range", "")
        if url == CAT.url_zip_detalhe and faixa and not faixa.startswith("bytes=-"):
            return baixar.Resposta(resposta.status, {**resposta.cabecalhos, "etag": '"outro"'}, resposta.corpo)
        return resposta

    servidor.obter = obter_trocando
    with pytest.raises(baixar.ErroDownload):
        baixar.baixar_tudo(CAT, tmp_path, servidor)


def test_zip_inteiro_com_tamanho_errado_falha(tmp_path):
    servidor = _servidor()
    original = servidor.obter

    def obter_truncado(url, cabecalhos=None, destino=None):
        resposta = original(url, cabecalhos, destino)
        if url == CAT.url_zip_votacao and destino is not None:
            destino.write_bytes(destino.read_bytes()[:-10])
        return resposta

    servidor.obter = obter_truncado
    with pytest.raises(baixar.ErroDownload):
        baixar.baixar_tudo(CAT, tmp_path, servidor)
    assert not (tmp_path / "votacao_secao_2026_BR.zip").exists()


def test_resposta_sem_content_range_falha():
    class SemFaixa:
        def obter(self, url, cabecalhos=None, destino=None):
            return baixar.Resposta(200, {"etag": '"x"'}, b"tudo")

    with pytest.raises(baixar.ErroDownload):
        baixar.consultar_zip(SemFaixa(), "http://x/a.zip")


# ── cliente urllib (sem rede: a função de abertura é injetada) ──


class _RespostaUrllib:
    def __init__(self, status, cabecalhos, corpo):
        self.status = status
        self.headers = cabecalhos
        self._corpo = io.BytesIO(corpo)

    def read(self, n=-1):
        return self._corpo.read(n)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def test_cliente_urllib_le_gzip_espaca_e_repete_em_erro_de_servidor():
    corpo = gzip.compress(b'{"ok":1}')
    chamadas, esperas = [], []

    def abrir(pedido, timeout):
        chamadas.append(pedido)
        if len(chamadas) == 1:
            raise urllib.error.HTTPError(pedido.full_url, 503, "ocupado", {}, None)
        return _RespostaUrllib(200, {"Content-Encoding": "gzip", "ETag": '"e"'}, corpo)

    cliente = baixar.ClienteUrllib(abrir=abrir, dormir=esperas.append, relogio=lambda: 0.0)
    resposta = cliente.obter("https://resultados.tse.jus.br/a.json", {"If-None-Match": '"x"'})
    assert resposta.corpo == b'{"ok":1}'
    assert resposta.cabecalhos["etag"] == '"e"'
    assert len(chamadas) == 2 and esperas


def test_cliente_urllib_304_e_404():
    def abrir_304(pedido, timeout):
        raise urllib.error.HTTPError(pedido.full_url, 304, "igual", {"ETag": '"e"'}, None)

    cliente = baixar.ClienteUrllib(abrir=abrir_304, dormir=lambda s: None)
    assert cliente.obter("https://x/a.json").status == 304

    def abrir_404(pedido, timeout):
        raise urllib.error.HTTPError(pedido.full_url, 404, "não há", {}, None)

    with pytest.raises(baixar.ErroDownload):
        baixar.ClienteUrllib(abrir=abrir_404, dormir=lambda s: None).obter("https://x/b.json")


def test_cliente_urllib_grava_em_arquivo_e_desiste_depois_das_tentativas(tmp_path):
    def abrir(pedido, timeout):
        return _RespostaUrllib(200, {}, b"abc" * 1000)

    destino = tmp_path / "x.bin"
    resposta = baixar.ClienteUrllib(abrir=abrir, dormir=lambda s: None).obter("https://x/a", destino=destino)
    assert resposta.status == 200 and destino.read_bytes() == b"abc" * 1000

    def abrir_falhando(pedido, timeout):
        raise urllib.error.URLError("sem rede")

    with pytest.raises(baixar.ErroDownload):
        baixar.ClienteUrllib(abrir=abrir_falhando, dormir=lambda s: None, tentativas=2).obter("https://x/a")


def test_malha_invalida_falha_e_manifesto_parcial_sobrevive(tmp_path):
    servidor = _servidor()
    servidor.arquivos[fontes.URL_MALHA] = b'{"erro": "formato"}'
    with pytest.raises(baixar.ErroDownload):
        baixar.baixar_tudo(CAT, tmp_path, servidor)
    assert not (tmp_path / fontes.NOME_MALHA).exists()
    manifesto = json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8"))
    assert "votacao_secao" in manifesto and "malha_ibge" not in manifesto
    servidor.arquivos[fontes.URL_MALHA] = b'{"type":"FeatureCollection","features":[]}'
    servidor.pedidos.clear()
    baixar.baixar_tudo(CAT, tmp_path, servidor)
    assert not any(u == CAT.url_zip_votacao and "Range" not in c for u, c in servidor.pedidos)
    assert (tmp_path / fontes.NOME_MALHA).exists()


def test_malha_que_nao_e_json_falha(tmp_path):
    servidor = _servidor()
    servidor.arquivos[fontes.URL_MALHA] = b"<html>erro</html>"
    with pytest.raises(baixar.ErroDownload):
        baixar.baixar_tudo(CAT, tmp_path, servidor)


def test_cliente_urllib_descomprime_gzip_ao_gravar_em_arquivo(tmp_path):
    corpo = b'{"type":"FeatureCollection"}' * 100

    def abrir(pedido, timeout):
        return _RespostaUrllib(200, {"Content-Encoding": "gzip"}, gzip.compress(corpo))

    destino = tmp_path / "m.json"
    baixar.ClienteUrllib(abrir=abrir, dormir=lambda s: None).obter("https://x/m", destino=destino)
    assert destino.read_bytes() == corpo
