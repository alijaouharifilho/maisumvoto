"""Portões: totais iguais ao resultado oficial, nenhum documento pessoal na saída, tamanhos."""

import json

from etl import conferir


def _oficial(**sobre):
    base = {
        "dg": "05/10/2026", "hg": "12:51:47",
        "s": {"ts": "3"}, "e": {"te": "180", "c": "140", "a": "40"}, "v": {"vb": "3", "tvn": "9"},
        "carg": [{"cd": "1", "agr": [
            {"par": [{"cand": [{"n": "01", "vap": "50"}]}]},
            {"par": [{"cand": [{"n": "02", "vap": "70"}, {"n": "03", "vap": "8"}]}]},
            {"par": [{"cand": [{"n": "09", "vap": "0"}]}]},
        ]}],
    }
    base.update(sobre)
    return base


CALCULADO = {"secoes": 3, "aptos": 180, "comparecimento": 140, "abstencao": 40, "brancos": 3, "nulos": 9,
             "nominais": {"01": 50, "02": 70, "03": 8}}


def test_totais_oficiais():
    assert conferir.totais_oficiais(_oficial(), "1") == CALCULADO


def test_comparar_igual_nao_tem_diferenca():
    assert conferir.comparar("XX", CALCULADO, conferir.totais_oficiais(_oficial(), "1")) == []


def test_comparar_lista_cada_diferenca():
    calc = {**CALCULADO, "nulos": 8, "nominais": {"01": 50, "02": 71, "03": 8, "77": 1}}
    dif = conferir.comparar("XX", calc, conferir.totais_oficiais(_oficial(), "1"))
    assert dif == ["XX.nulos: calculado 8, oficial 9", "XX.nominais.02: calculado 71, oficial 70",
                   "XX.nominais.77: calculado 1, oficial 0"]


def test_conferir_varias_abrangencias_e_oficial_ausente():
    ok, dif = conferir.conferir({"XX": CALCULADO, "YY": CALCULADO}, {"XX": _oficial()}, "1")
    assert not ok
    assert dif == ["YY: resultado oficial ausente"]
    ok, dif = conferir.conferir({"XX": CALCULADO}, {"XX": _oficial()}, "1")
    assert ok and dif == []


def test_cpf_e_titulo_validos():
    assert conferir.cpf_valido("52998224725")
    assert not conferir.cpf_valido("52998224726")
    assert not conferir.cpf_valido("11111111111")
    assert not conferir.cpf_valido("37030020023")  # nº de unidade consumidora num endereço do cadastro (PI)
    assert conferir.titulo_valido("004356870906")
    assert conferir.titulo_valido("102358012704")
    assert not conferir.titulo_valido("004356870907")
    assert not conferir.titulo_valido("004356879906")  # UF 99 não existe


def test_documentos_na_saida():
    textos = {
        "a.json": '{"cep":"80010000","lat":-25.12345}',
        "b.json": '{"x":"529.982.247-25 ou 52998224725"}',
        "c.json": '{"sha256":"ab52998224725cd"}',
        "d.json": '{"n":004356870906}',
        "e.json": '{"endereco":"Rua X, S/N (UC- 37030020023)"}',
        "f.json": '{"n":"1234567890123"}',
    }
    assert conferir.documentos_na_saida(textos) == ["b.json", "d.json", "f.json"]


def test_referencia_da_conferencia():
    assert conferir.referencia(_oficial()) == "resultados.tse.jus.br (gerado em 05/10/2026 12:51:47)"
    assert conferir.referencia(None) == "resultados.tse.jus.br"


def test_ler_oficiais(tmp_path):
    pasta = tmp_path / "resultado"
    pasta.mkdir()
    (pasta / "xx.json").write_text(json.dumps(_oficial()), encoding="utf-8")
    lidos = conferir.ler_oficiais({"XX": pasta / "xx.json", "YY": pasta / "yy.json"})
    assert set(lidos) == {"XX"}
