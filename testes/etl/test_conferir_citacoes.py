"""O conferidor de citações do plano (ferramentas/conferir_citacoes.py) passa no próprio autoteste.

A conferência de verdade (trechos × PDF) roda em `npm run conferir:citacoes`, que precisa do PDF e do pdftotext;
aqui só a lógica da ferramenta, sem PDF, para o pytest pegar uma regressão nela.
"""

import importlib.util
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
CAMINHO = RAIZ / "ferramentas" / "conferir_citacoes.py"


def _carregar():
    spec = importlib.util.spec_from_file_location("conferir_citacoes", CAMINHO)
    assert spec is not None and spec.loader is not None
    modulo = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = modulo  # @dataclass procura o módulo em sys.modules
    spec.loader.exec_module(modulo)
    return modulo


def test_autoteste_da_ferramenta_sai_com_zero(capsys):
    assert _carregar().principal(["--autoteste"]) == 0
    assert "casos ok" in capsys.readouterr().out


def test_trecho_alterado_nao_confere():
    ferramenta = _carregar()
    pagina = "Vamos dobrar os investimentos federais em segurança pública.\n"
    assert ferramenta.trecho_na_pagina("dobrar os investimentos federais", pagina)
    assert not ferramenta.trecho_na_pagina("triplicar os investimentos federais", pagina)
