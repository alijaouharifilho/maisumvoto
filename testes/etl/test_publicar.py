"""Arquivos publicados (CONTRATO §1–§2): chaves, pontos em delta, seções, CEP, JSON canônico e versão."""

import json

import pandas as pd
import pytest

from etl import publicar as pub


def test_chaves_batem_com_golden(golden):
    c = golden["geo"]["celulaGraus"]
    for caso in golden["geo"]["chaves"]:
        assert pub.chave_celula(caso["lat"], caso["lon"], c) == caso["celula"]
        assert pub.chave_quadrado(caso["lat"], caso["lon"]) == caso["quadrado"]


def test_arredondar_como_math_round_do_js():
    assert [pub.arredondar(x) for x in (2.5, -2.5, -2.6, 0.49, -0.5)] == [3, -2, -3, 0, 0]


def _decodificar(pontos):
    la = lo = 0
    saida = []
    d = pontos["d"]
    for i in range(0, len(d), 2):
        la += d[i]
        lo += d[i + 1]
        saida.append((la / pontos["escala"], lo / pontos["escala"]))
    return saida


def test_pontos_em_delta_unicos_e_ordenados():
    pontos = pub.codificar_pontos([(-25.4284, -49.2733), (-25.4284, -49.2733), (-23.5505, -46.6333)], 1000)
    assert pontos["escala"] == 1000
    assert _decodificar(pontos) == [(-25.428, -49.273), (-23.55, -46.633)]  # -23550.5 arredonda para cima, como no JS
    assert pontos["d"][:2] == [-25428, -49273]
    assert pub.codificar_pontos([], 20) == {"escala": 20, "d": []}


def test_json_canonico_ordena_chaves_e_compacta():
    assert pub.json_canonico({"b": 1, "a": {"d": [1, 2], "c": "ç"}}) == '{"a":{"c":"ç","d":[1,2]},"b":1}'
    with pytest.raises(ValueError):
        pub.json_canonico({"x": float("nan")})


def _regiao(id_, lat, lon, votos=True):
    return {"id": id_, "uf": "XX", "mun": "00001", "municipio": "M", "bairro": "", "lat": lat, "lon": lon,
            "posicao": "tse", "locais": [], "eleitores": 10, "secoes": 1,
            "votos": {"aptos": 10, "comparecimento": 8, "abstencao": 2, "brancos": 0, "nulos": 0, "nominais": {}}
            if votos else None}


def test_celulas_ordenadas_por_id_e_pontos_so_com_votos():
    regioes = [_regiao("xx-2", -25.4284, -49.2733), _regiao("xx-1", -25.4300, -49.2700), _regiao("xx-3", 2.8235, -60.6758, False)]
    arquivos = pub.arquivos_celulas(regioes, 0.25)
    assert [r["id"] for r in arquivos["celulas/-102_-198.json"]] == ["xx-1", "xx-2"]
    assert "celulas/11_-243.json" in arquivos
    pontos, quadrados = pub.arquivos_pontos(regioes)
    assert quadrados == ["-26_-50"]
    assert pontos["pontos/resumo.json"]["escala"] == 20
    assert len(_decodificar(pontos["pontos/-26_-50.json"])) == 2


def test_arquivos_secoes_por_municipio_e_zona():
    secoes = pd.DataFrame([
        {"uf": "XX", "mun": "00001", "zona": 1, "secao": 12, "aptos": 10, "comparecimento": 8, "abstencao": 2,
         "brancos": 1, "nulos": 0, "instalada": True, "n:01": 4, "n:02": 3, "n:03": 0},
        {"uf": "XX", "mun": "00001", "zona": 1, "secao": 3, "aptos": 5, "comparecimento": 5, "abstencao": 0,
         "brancos": 0, "nulos": 0, "instalada": True, "n:01": 5, "n:02": 0, "n:03": 0},
        {"uf": "XX", "mun": "00001", "zona": 20, "secao": 1, "aptos": 1, "comparecimento": 0, "abstencao": 1,
         "brancos": 0, "nulos": 0, "instalada": True, "n:01": 0, "n:02": 0, "n:03": 0},
    ])
    arquivos = pub.arquivos_secoes(secoes)
    assert set(arquivos) == {"secoes/xx/00001-0001.json", "secoes/xx/00001-0020.json"}
    zona1 = arquivos["secoes/xx/00001-0001.json"]["secoes"]
    assert zona1["12"] == {"aptos": 10, "comparecimento": 8, "brancos": 1, "nulos": 0, "nominais": {"01": 4, "02": 3}}
    assert zona1["3"]["nominais"] == {"01": 5}


def test_arquivos_cep_regiao_medoide_e_ignora_invalidos():
    locais = pd.DataFrame([
        {"cep": "80010000", "lat_regiao": -25.0, "lon_regiao": -49.0, "eleitores": 300, "municipio": "Curitiba",
         "uf": "PR", "bairro": "Centro"},
        {"cep": "80010000", "lat_regiao": -25.4, "lon_regiao": -49.4, "eleitores": 100, "municipio": "Curitiba",
         "uf": "PR", "bairro": "Rebouças"},
        {"cep": "00000000", "lat_regiao": 1.0, "lon_regiao": 1.0, "eleitores": 1, "municipio": "X", "uf": "XX", "bairro": ""},
        {"cep": "123", "lat_regiao": 1.0, "lon_regiao": 1.0, "eleitores": 1, "municipio": "X", "uf": "XX", "bairro": ""},
    ])
    arquivos = pub.arquivos_cep(locais)
    assert set(arquivos) == {"cep/800.json"}
    assert arquivos["cep/800.json"]["80010000"] == {"lat": -25.0, "lon": -49.0, "m": "Curitiba", "uf": "PR", "b": "Centro"}


def test_versao_ignora_gerado_em_e_muda_com_conteudo():
    textos = {"celulas/a.json": "[1]", "busca/abc.json": "[]"}
    indice = {"esquema": 1, "geradoEm": "2026-10-06T00:00:00Z", "brasil": {"ate": 1}}
    v1 = pub.calcular_versao(textos, indice)
    v2 = pub.calcular_versao(dict(reversed(list(textos.items()))), {**indice, "geradoEm": "outro"})
    assert v1 == v2 and len(v1) == 12
    assert pub.calcular_versao({**textos, "celulas/a.json": "[2]"}, indice) != v1
    assert pub.calcular_versao(textos, {**indice, "brasil": {"ate": 2}}) != v1


def test_gravar_troca_a_pasta_inteira(tmp_path):
    destino = tmp_path / "dados"
    destino.mkdir()
    (destino / "velho.json").write_text("{}", encoding="utf-8")
    pub.gravar({"indice.json": '{"a":1}', "celulas/x.json": "[]"}, destino)
    assert not (destino / "velho.json").exists()
    assert json.loads((destino / "indice.json").read_text(encoding="utf-8")) == {"a": 1}
    assert (destino / "celulas" / "x.json").read_text(encoding="utf-8") == "[]"
    assert not list(tmp_path.glob("*.novo*")) and not list(tmp_path.glob("*.antigo*"))


def test_tamanhos_por_pasta():
    tamanhos = pub.tamanhos({"secoes/xx/a.json": "x" * 10, "secoes/yy/b.json": "x" * 30, "indice.json": "{}"})
    assert tamanhos["secoes"] == {"arquivos": 2, "bytes": 40, "maior": "secoes/yy/b.json", "maiorBytes": 30}
    assert tamanhos["indice.json"]["arquivos"] == 1


def test_cep_compartilhado_por_municipios_usa_so_o_municipio_dominante():
    locais = pd.DataFrame([
        {"cep": "80000000", "lat_regiao": -25.4, "lon_regiao": -49.2, "eleitores": 900, "municipio": "Curitiba",
         "uf": "PR", "bairro": "Centro", "mun": "75353"},
        {"cep": "80000000", "lat_regiao": -25.5, "lon_regiao": -49.3, "eleitores": 100, "municipio": "Curitiba",
         "uf": "PR", "bairro": "Centro", "mun": "75353"},
        {"cep": "80000000", "lat_regiao": -12.0, "lon_regiao": -38.0, "eleitores": 950, "municipio": "Outra",
         "uf": "BA", "bairro": "X", "mun": "38490"},
    ])
    item = pub.arquivos_cep(locais)["cep/800.json"]["80000000"]
    assert (item["m"], item["uf"], item["lat"], item["lon"]) == ("Curitiba", "PR", -25.4, -49.2)


def test_cep_de_outro_estado_nao_entra_no_indice_de_cep():
    # Caso real do cadastro de 2026: escola de Curitiba (PR) com o CEP 30150-000, que é de Belo Horizonte (MG).
    locais = pd.DataFrame([
        {"cep": "30150000", "lat_regiao": -25.47083, "lon_regiao": -49.2756, "eleitores": 3100, "municipio": "Curitiba",
         "uf": "PR", "bairro": "Guaira", "mun": "75353"},
        {"cep": "80630000", "lat_regiao": -25.47, "lon_regiao": -49.27, "eleitores": 500, "municipio": "Curitiba",
         "uf": "PR", "bairro": "Guaira", "mun": "75353"},
    ])
    arquivos = pub.arquivos_cep(locais)
    assert set(arquivos) == {"cep/806.json"}
    assert "30150000" not in str(arquivos)


def test_faixas_de_cep_cobrem_as_27_ufs_e_os_extremos():
    assert len(pub.FAIXAS_CEP_UF) == 27
    assert pub.cep_da_uf("01001000", "SP") and pub.cep_da_uf("19999999", "SP") and not pub.cep_da_uf("20000000", "SP")
    assert pub.cep_da_uf("69301000", "RR") and not pub.cep_da_uf("69301000", "AM")
    assert pub.cep_da_uf("69400000", "AM") and pub.cep_da_uf("69099999", "AM")
    assert pub.cep_da_uf("73000000", "DF") and pub.cep_da_uf("73700000", "GO") and not pub.cep_da_uf("73700000", "DF")
    assert pub.cep_da_uf("99999999", "RS") and not pub.cep_da_uf("80010000", "XX")
