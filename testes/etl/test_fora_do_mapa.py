"""Locais fora do mapa (voto em trânsito e preso provisório): critério pelo campo do TSE, validação e contagem."""

import pandas as pd
import pytest

from etl import fora_do_mapa as f
from etl.carregar_tse import ErroEntrada


def _cadastro(linhas):
    return pd.DataFrame(linhas, columns=["uf", "mun", "zona", "nr_local", "cd_tipo_local", "tipo_local"])


def _locais(linhas):
    return pd.DataFrame(linhas, columns=["uf", "mun", "zona", "nr_local", "nome", "cd_tipo_local", "eleitores", "n_secoes"])


CADASTRO_OK = _cadastro([
    ("RR", "03018", 1, 1015, 1, "Convencional"),
    ("RR", "03018", 1, 3794, 2, "Voto em trânsito"),
    ("RR", "03085", 8, 1236, 3, "Preso provisório"),
    ("RR", "03018", 1, 2000, 4, "Temporário"),
])

LOCAIS = _locais([
    ("RR", "03018", 1, 1015, "Escola A", 1, 900, 3),
    ("RR", "03018", 1, 3794, "Escola Estadual Lobo D'Almada", 2, 1267, 4),
    ("RR", "03085", 8, 1236, "Unidade Prisional de Rorainópolis", 3, 32, 1),
    ("RR", "03018", 1, 2000, "Colégio Temporário", 4, 400, 1),
    ("AC", "01392", 1, 1100, "Fundação Casa", 3, 50, 1),
])


def test_tipos_conhecidos_passam_sem_aviso():
    assert f.validar_tipos(CADASTRO_OK) == []


def test_descricao_trocada_para_o_etl():
    trocado = _cadastro([("RR", "03018", 1, 1015, 2, "Convencional")])
    with pytest.raises(ErroEntrada, match="tipo de local 2"):
        f.validar_tipos(trocado)


def test_codigo_novo_para_o_etl():
    novo = _cadastro([("RR", "03018", 1, 1015, 9, "Hospital")])
    with pytest.raises(ErroEntrada, match="desconhecido"):
        f.validar_tipos(novo)


def test_local_com_tipos_misturados_vira_aviso():
    misturado = _cadastro([("RR", "03018", 1, 1015, 1, "Convencional"), ("RR", "03018", 1, 1015, 4, "Temporário")])
    assert f.validar_tipos(misturado) == ["1 locais com seções de tipos diferentes (vale o tipo da 1ª seção)"]


def test_separar_tira_so_transito_e_preso_provisorio():
    no_mapa, fora = f.separar(LOCAIS)
    assert list(no_mapa["nr_local"]) == [1015, 2000]  # convencional e temporário ficam
    assert list(zip(fora["nr_local"], fora[f.COLUNA_MOTIVO], strict=True)) == [
        (3794, "votoEmTransito"), (1236, "presoProvisorio"), (1100, "presoProvisorio")]


def test_nome_parecido_com_presidio_nao_tira_do_mapa():
    escola = _locais([("BA", "36820", 37, 1023, "Colégio Estadual Fernando Presídio", 1, 1680, 5)])
    no_mapa, fora = f.separar(escola)
    assert len(no_mapa) == 1 and fora.empty


def test_contar_por_motivo_no_brasil_e_por_uf():
    _, fora = f.separar(LOCAIS)
    assert f.contar(fora) == {"presoProvisorio": 82, "votoEmTransito": 1267}
    assert f.contar(fora, ["RR"]) == {"presoProvisorio": 32, "votoEmTransito": 1267}
    assert f.contar(fora, ["SP"]) == {"presoProvisorio": 0, "votoEmTransito": 0}


def test_contar_e_resumo_sem_nenhum_local_fora():
    _, fora = f.separar(LOCAIS.iloc[[0]])
    assert f.contar(fora) == {"presoProvisorio": 0, "votoEmTransito": 0}
    assert f.resumo(fora) == {m: {"locais": 0, "secoes": 0, "eleitores": 0} for m in f.MOTIVOS_PUBLICADOS}


def test_resumo_para_o_relatorio():
    _, fora = f.separar(LOCAIS)
    assert f.resumo(fora) == {
        "presoProvisorio": {"locais": 2, "secoes": 2, "eleitores": 82},
        "votoEmTransito": {"locais": 1, "secoes": 4, "eleitores": 1267},
    }
