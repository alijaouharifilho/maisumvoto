"""Telefone e e-mail embutidos no nome e no endereço do cadastro do TSE.

O ETL não lê NR_TELEFONE_LOCAL de propósito, mas DS_ENDERECO às vezes traz o telefone no meio do texto
("Estrada Geral, S/N Fone (49) 91399550 99107 6761", "Av. Brasil, 2633 - Fone 3521-3644"); em 2026, 330 nomes e
endereços. Quase todos são fixos de escola, mas há número com cara de celular, possivelmente de pessoa. O CONTRATO
promete "nenhum dado pessoal": `sem_telefone` tira o número na leitura, e `tem_contato` é o portão que procura
telefone e e-mail no que vai ser publicado.

Faixa de numeração de rua ("Rua Vinte e Quatro, 1682-1872") não é telefone: a segunda parte é maior que a
primeira e por menos de 1000, e não começa por 0 ou 1 (telefone no Brasil começa por 2 a 9).
"""

from __future__ import annotations

import re
from collections.abc import Iterable

_DDD = r"(?:\(?0?\d{2}\)?[\s.-]?)"
# 8 ou 9 dígitos (com ou sem separador), 7 dígitos antigos ("Fone 5652004", "Fone 233-1856") e "2632 32 73".
_NUMERO = r"(?:9?\d{3,4}\s?[.-]?\s?\d{4}|\d{4}\s\d{2}\s\d{2})"
_FONE = rf"(?:{_DDD}?{_NUMERO})"
_ANOTACAO = r"(?:\s*\((?:whats\w*|p[uú]blico|orelh[aã]o)\))?"
_RAMAL = r"(?:\s*-?\s*(?:r|ramal)\b\.?\s*-?\s*\d{2,4})?"
_SEQUENCIA = rf"{_FONE}{_ANOTACAO}(?:\s*(?:[/,e–-]\s*)?(?:{_FONE}|\d{{4}}){_ANOTACAO})*{_RAMAL}"
_PALAVRA = r"\b(?:fones?|tel(?:efones?)?|f|cel(?:ular)?|contato|fax|pub|dir)\b\.?(?:\s*pub\b\.?)?\s*[:\-]?\s*"

_COM_PALAVRA = re.compile(rf"(?i){_PALAVRA}{_SEQUENCIA}")
_COM_DDD = re.compile(rf"(?i)(?:\(0?\d{{2}}\)\s?|\b\d{{2}}[\s-](?=\d{{4}}[\s.-]?\d{{4}}\b)){_NUMERO}"
                      rf"{_ANOTACAO}(?:\s*(?:[/,e–-]\s*)?(?:{_FONE}|\d{{4}}){_ANOTACAO})*{_RAMAL}")
_ENTRE_PARENTESES = re.compile(rf"(?i)\(\s*{_SEQUENCIA}\s*\)")
_NO_FIM = re.compile(r"(?:^|[,\-–)])\s*([2-9]\d{3})[\s-]?(\d{4})\s*$")
_SOBRA = re.compile(r"[\s,;/\-–]+$")
_FAIXA_MAXIMA = 1000

# Portão (conferir.py): o que ainda parece contato depois da limpeza.
_CONTATO = re.compile(
    r"(?i)\b(?:fones?|tel(?:efone)?|cel(?:ular)?|whats\w*)\b\.?\s*:?\s*\(?\d"
    r"|\(0?\d{2}\)\s?9?\d{4}[\s.-]?\d{4}"
    r"|[\w.+-]+@[\w-]+\.[\w.-]+"
)


def _fim(m: re.Match[str]) -> str:
    primeiro, segundo = int(m.group(1)), int(m.group(2))
    if 0 <= segundo - primeiro < _FAIXA_MAXIMA:  # faixa de numeração da rua
        return m.group(0)
    return ")" if m.group(0).startswith(")") else ""


def sem_telefone(texto: str) -> str:
    """Tira telefones (com palavra-chave, com DDD, entre parênteses ou soltos no fim) e a pontuação que sobra."""
    limpo = _COM_PALAVRA.sub("", texto)
    limpo = _COM_DDD.sub("", limpo)
    limpo = _ENTRE_PARENTESES.sub("", limpo)
    limpo = _NO_FIM.sub(_fim, limpo)
    if limpo == texto:
        return texto
    limpo = re.sub(r"\(\s*\)", "", limpo)
    limpo = re.sub(r"\s*,(?:\s*,)+", ",", limpo)
    return _SOBRA.sub("", re.sub(r"\s{2,}", " ", limpo)).strip()


def sem_telefone_em(valores: Iterable[str]) -> list[str]:
    """`sem_telefone` em cada valor, uma vez por valor diferente (o cadastro repete o local em cada seção)."""
    lista = list(valores)
    unicos = {v: sem_telefone(v) for v in dict.fromkeys(lista)}
    return [unicos[v] for v in lista]


def tem_contato(texto: str) -> bool:
    return _CONTATO.search(texto) is not None
