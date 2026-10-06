"""Portões de qualidade: totais iguais ao resultado oficial do TSE e nada de documento pessoal, telefone ou e-mail
na saída."""

from __future__ import annotations

import json
import re
from collections.abc import Mapping
from pathlib import Path

from etl.telefone import tem_contato

CAMPOS = ("secoes", "aptos", "comparecimento", "abstencao", "brancos", "nulos")
# Sequências isoladas de 11+ dígitos (não dentro de um hash hexadecimal, por exemplo).
_SEQUENCIA = re.compile(r"(?<![0-9A-Za-z])\d{11,}(?![0-9A-Za-z])")
_TAMANHO_CPF, _TAMANHO_TITULO = 11, 12
_UFS_TITULO = range(1, 29)
_UFS_TITULO_DV_ZERO_VIRA_UM = ("01", "02")  # SP e MG


def ler_oficiais(caminhos: Mapping[str, Path]) -> dict[str, dict]:
    return {abr: json.loads(c.read_text(encoding="utf-8")) for abr, c in caminhos.items() if c.exists()}


def _candidatos(cargo: Mapping) -> dict[str, int]:
    votos: dict[str, int] = {}
    for agremiacao in cargo.get("agr", []):
        for partido in agremiacao.get("par", []):
            for cand in partido.get("cand", []):
                numero, vap = str(cand["n"]).zfill(2), int(cand.get("vap") or 0)
                if vap > 0:
                    votos[numero] = votos.get(numero, 0) + vap
    return dict(sorted(votos.items()))


def totais_oficiais(oficial: Mapping, cargo: str) -> dict:
    """Totais do JSON de resultado (resultados.tse.jus.br) no mesmo formato de `agregar.totais`."""
    escolhido = next((c for c in oficial.get("carg", []) if str(c.get("cd")) == str(cargo)), {})
    return {
        "secoes": int(oficial["s"]["ts"]),
        "aptos": int(oficial["e"]["te"]),
        "comparecimento": int(oficial["e"]["c"]),
        "abstencao": int(oficial["e"]["a"]),
        "brancos": int(oficial["v"]["vb"]),
        "nulos": int(oficial["v"]["tvn"]),
        "nominais": _candidatos(escolhido),
    }


def comparar(rotulo: str, calculado: Mapping, oficial: Mapping) -> list[str]:
    diferencas = [
        f"{rotulo}.{campo}: calculado {calculado[campo]}, oficial {oficial[campo]}"
        for campo in CAMPOS if calculado[campo] != oficial[campo]
    ]
    numeros = sorted(set(calculado["nominais"]) | set(oficial["nominais"]))
    for n in numeros:
        c, o = calculado["nominais"].get(n, 0), oficial["nominais"].get(n, 0)
        if c != o:
            diferencas.append(f"{rotulo}.nominais.{n}: calculado {c}, oficial {o}")
    return diferencas


def conferir(calculados: Mapping[str, Mapping], oficiais: Mapping[str, Mapping], cargo: str) -> tuple[bool, list[str]]:
    diferencas: list[str] = []
    for abrangencia in sorted(calculados):
        oficial = oficiais.get(abrangencia)
        if oficial is None:
            diferencas.append(f"{abrangencia}: resultado oficial ausente")
            continue
        diferencas += comparar(abrangencia, calculados[abrangencia], totais_oficiais(oficial, cargo))
    return not diferencas, diferencas


def referencia(oficial: Mapping | None) -> str:
    if not oficial:
        return "resultados.tse.jus.br"
    return f"resultados.tse.jus.br (gerado em {oficial.get('dg')} {oficial.get('hg')})"


def cpf_valido(n: str) -> bool:
    if len(n) != _TAMANHO_CPF or len(set(n)) == 1:
        return False
    d = [int(c) for c in n]
    for k in (9, 10):
        resto = sum(d[i] * (k + 1 - i) for i in range(k)) * 10 % 11
        if resto % 10 != d[k]:
            return False
    return True


def _dv_titulo(soma: int, uf: str) -> int:
    resto = soma % 11
    dv = 0 if resto == 10 else resto
    return 1 if dv == 0 and uf in _UFS_TITULO_DV_ZERO_VIRA_UM else dv


def titulo_valido(n: str) -> bool:
    if len(n) != _TAMANHO_TITULO or int(n[8:10]) not in _UFS_TITULO:
        return False
    d, uf = [int(c) for c in n], n[8:10]
    dv1 = _dv_titulo(sum(d[i] * (i + 2) for i in range(8)), uf)
    dv2 = _dv_titulo(d[8] * 7 + d[9] * 8 + dv1 * 9, uf)
    return d[10] == dv1 and d[11] == dv2


def parece_documento(sequencia: str) -> bool:
    """CPF válido (11), título válido (12) ou qualquer sequência maior (conservador)."""
    if len(sequencia) > _TAMANHO_TITULO:
        return True
    return cpf_valido(sequencia) or titulo_valido(sequencia)


def documentos_na_saida(textos: Mapping[str, str]) -> list[str]:
    """Arquivos com algo que tem forma de CPF ou título de eleitor (dígitos verificadores conferem). Deve ser vazio."""
    return sorted(c for c, texto in textos.items() if any(parece_documento(m) for m in _SEQUENCIA.findall(texto)))


def contatos_na_saida(textos: Mapping[str, str]) -> list[str]:
    """Arquivos com algo que parece telefone ou e-mail (o cadastro do TSE traz telefone no endereço). Deve ser vazio."""
    return sorted(c for c, texto in textos.items() if tem_contato(texto))
