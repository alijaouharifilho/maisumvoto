"""Telefone e e-mail no nome e no endereço do cadastro do TSE (casos reais de 2026)."""

import pytest

from etl import conferir
from etl.telefone import sem_telefone, sem_telefone_em, tem_contato


@pytest.mark.parametrize(("bruto", "limpo"), [
    ("Estrada Geral, S/N Fone (49) 91399550 99107 6761", "Estrada Geral, S/N"),
    ("Estrada Geral de Serra Grande F. (51) 96886583", "Estrada Geral de Serra Grande"),
    ("Rua 208 Esq. C/ 201 QD.37 Tel 62 3288-7579", "Rua 208 Esq. C/ 201 QD.37"),
    ("Av. Brasil, 2633 - Fone 3521-3644", "Av. Brasil, 2633"),
    ("BR. 317, KM 72 - Projeto Caquetá (Contato 9943-0082)", "BR. 317, KM 72 - Projeto Caquetá"),
    ("Av. Antônio da Rocha Viana, S/N, Horto FLORESTAL(3228-3326/9984-9354)", "Av. Antônio da Rocha Viana, S/N, Horto FLORESTAL"),
    ("Rua Hilario Maia, S/N, Fone (069) 3236-6415 (69) 3236-6456 (Público)", "Rua Hilario Maia, S/N"),
    ("Rua La Salle, 1557 Fone (49) 3622 0258(WHATS) - 3622 0382 - 3621 0014", "Rua La Salle, 1557"),
    ("Estrada Geral, S/N Fone 40621980 R.4128", "Estrada Geral, S/N"),
    ("Av. Rio de JANEIRO,4864 Pub 3225-0898 Dir. 3222-1337", "Av. Rio de JANEIRO,4864"),
    ("R. Eca de Queiroz, N. 4386 - 69-3412-2842", "R. Eca de Queiroz, N. 4386"),
    ("Rua do Rio, S/N - 9129-8018", "Rua do Rio, S/N"),
    ("Rua Carlos Nobre, 181 - Fone 5652004", "Rua Carlos Nobre, 181"),
    ("Av Rio Bahia, BR 116, KM 43, Fone 73-5301576, Entroncamento-Zona Rural",
     "Av Rio Bahia, BR 116, KM 43, Entroncamento-Zona Rural"),
    ("Colégio Jesus Maria José, (49) 3622 0757, 3622 4108", "Colégio Jesus Maria José"),
])
def test_tira_telefone(bruto, limpo):
    assert sem_telefone(bruto) == limpo
    assert not tem_contato(limpo)


@pytest.mark.parametrize("texto", [
    "Rua Vinte e Quatro, 1682-1872",          # faixa de numeração da rua, não telefone
    "R. Otávio Mangabeira, 1120-1178 - Zona Urbana",
    "Rua F, 123",
    "Estrada Geral, S/N",
    "Ao Lado da Propriedade da Dona Idê",
])
def test_nao_mexe_no_que_nao_e_telefone(texto):
    assert sem_telefone(texto) == texto


def test_sem_telefone_em_lista_mantem_ordem_e_repeticao():
    assert sem_telefone_em(["A - Fone 3521-3644", "B", "A - Fone 3521-3644"]) == ["A", "B", "A"]


def test_portao_acha_telefone_e_email_na_saida():
    textos = {
        "celulas/a.json": '[{"endereco":"Av. Brasil, 2633 - Fone 3521-3644"}]',
        "celulas/b.json": '[{"endereco":"Rua X, 10","nome":"contato@escola.br"}]',
        "celulas/c.json": '[{"endereco":"Rua Vinte e Quatro, 1682-1872","lat":-25.43,"lon":-49.27}]',
        "busca/hot.json": '[{"n":"Hotel Tel Aviv","e":1200}]',
    }
    assert conferir.contatos_na_saida(textos) == ["celulas/a.json", "celulas/b.json"]
