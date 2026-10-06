import json

import pytest

from etl import config


def test_le_candidatura_do_arquivo_unico(candidatura):
    bruto = json.loads((config.RAIZ / "config" / "candidatura.json").read_text(encoding="utf-8"))
    assert candidatura.alvo.numero == bruto["alvo"]["numero"]
    assert candidatura.adversario.numero == bruto["adversario"]["numero"]
    assert candidatura.reclassificar_como_nulo == tuple(bruto["reclassificarComoNulo"])
    assert candidatura.metricas.celula_graus == bruto["metricas"]["celulaGraus"]
    assert candidatura.metricas.regra_viravel == bruto["metricas"]["regraViravel"]
    assert candidatura.eleicao.codigo == bruto["eleicao"]["codigo"]


def test_le_regras_de_busca(regras_busca):
    bruto = json.loads((config.RAIZ / "config" / "busca.json").read_text(encoding="utf-8"))
    assert regras_busca.tamanho_prefixo == bruto["tamanhoPrefixo"]
    assert "jardim" in regras_busca.genericas
    assert isinstance(regras_busca.genericas, frozenset)


def test_candidatura_e_imutavel(candidatura):
    with pytest.raises(Exception):
        candidatura.alvo.numero = "99"  # type: ignore[misc]


def _candidatura_bruta() -> dict:
    return json.loads((config.RAIZ / "config" / "candidatura.json").read_text(encoding="utf-8"))


def test_recusa_numero_de_candidato_fora_do_formato(tmp_path):
    bruto = _candidatura_bruta()
    bruto["alvo"]["numero"] = "1"
    caminho = tmp_path / "c.json"
    caminho.write_text(json.dumps(bruto), encoding="utf-8")
    with pytest.raises(config.ErroConfig):
        config.ler_candidatura(caminho)


def test_recusa_alvo_igual_ao_adversario(tmp_path):
    bruto = _candidatura_bruta()
    bruto["adversario"]["numero"] = bruto["alvo"]["numero"]
    caminho = tmp_path / "c.json"
    caminho.write_text(json.dumps(bruto), encoding="utf-8")
    with pytest.raises(config.ErroConfig):
        config.ler_candidatura(caminho)


def test_recusa_arquivo_ausente(tmp_path):
    with pytest.raises(config.ErroConfig):
        config.ler_candidatura(tmp_path / "nao-existe.json")


def test_recusa_regra_viravel_desconhecida(tmp_path):
    bruto = _candidatura_bruta()
    bruto["metricas"]["regraViravel"] = "tudo"
    caminho = tmp_path / "c.json"
    caminho.write_text(json.dumps(bruto), encoding="utf-8")
    with pytest.raises(config.ErroConfig):
        config.ler_candidatura(caminho)
