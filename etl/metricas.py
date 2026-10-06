"""Métricas do CONTRATO §3 — espelho exato de nucleo/metricas.ts.

Os dois lados passam pelos mesmos casos de testes/golden/metricas.json.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field

CLASSES = ("semVotos", "empate", "folga", "aDefender", "alvoNaFrente", "aVirar", "dificil")
REGRAS = ("abertos", "abertosMaisOutros")


@dataclass(frozen=True)
class Derivadas:
    validos: int
    alvo: int
    adversario: int
    outros: int
    abertos: int
    ate: int
    pct_alvo: float | None


@dataclass(frozen=True)
class Contagem:
    classificacao: dict[str, int] = field(default_factory=dict)
    viraveis: dict[str, int] = field(default_factory=dict)


def derivar(votos: Mapping, alvo: str, adversario: str) -> Derivadas:
    nominais: Mapping[str, int] = votos.get("nominais") or {}
    a = int(nominais.get(alvo, 0))
    d = int(nominais.get(adversario, 0))
    validos = int(sum(nominais.values()))
    outros = validos - a - d
    abertos = int(votos["brancos"]) + int(votos["nulos"]) + int(votos["abstencao"])
    return Derivadas(
        validos=validos,
        alvo=a,
        adversario=d,
        outros=outros,
        abertos=abertos,
        ate=abertos + outros,
        pct_alvo=(a / validos) if validos > 0 else None,
    )


def reservatorio(d: Derivadas, regra: str) -> int:
    if regra == "abertos":
        return d.abertos
    if regra == "abertosMaisOutros":
        return d.abertos + d.outros
    raise ValueError(f"regra de virável desconhecida: {regra!r}")


def _classificar_derivadas(d: Derivadas, limiar_folga: float, regra: str) -> str:
    r = reservatorio(d, regra)
    if d.validos == 0:
        return "semVotos"
    if d.alvo == d.adversario:
        return "empate"
    if d.alvo > d.adversario:
        if d.pct_alvo is not None and d.pct_alvo >= limiar_folga:
            return "folga"
        return "aDefender" if r > d.alvo - d.adversario else "alvoNaFrente"
    return "aVirar" if r > d.adversario - d.alvo else "dificil"


def classificar(votos: Mapping, alvo: str, adversario: str, limiar_folga: float, regra: str) -> str:
    return _classificar_derivadas(derivar(votos, alvo, adversario), limiar_folga, regra)


def _viravel_derivadas(d: Derivadas, regra: str) -> bool:
    return d.adversario > d.alvo and reservatorio(d, regra) > d.adversario - d.alvo


def viravel(votos: Mapping, alvo: str, adversario: str, regra: str) -> bool:
    return _viravel_derivadas(derivar(votos, alvo, adversario), regra)


def contar(lista_votos: Iterable[Mapping], alvo: str, adversario: str, limiar_folga: float, regra: str) -> Contagem:
    """Conta regiões por classificação (com a regra da config) e viráveis pelas duas regras."""
    classes = dict.fromkeys(CLASSES, 0)
    viraveis = dict.fromkeys(REGRAS, 0)
    for votos in lista_votos:
        d = derivar(votos, alvo, adversario)
        classes[_classificar_derivadas(d, limiar_folga, regra)] += 1
        for r in REGRAS:
            viraveis[r] += int(_viravel_derivadas(d, r))
    return Contagem(classificacao=classes, viraveis=viraveis)
