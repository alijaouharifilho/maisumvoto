"""Orquestrador: `npm run dados` (= node ferramentas/py.mjs -m etl.montar).

Baixa as fontes oficiais, valida, agrega e grava public/dados/ no formato de docs/CONTRATO.md.
Sai com erro e NÃO publica se algum portão falhar (totais ≠ resultado oficial, cobertura < 99,5%,
documento pessoal, telefone ou e-mail na saída, arquivo de seções ≥ 300 KB, candidato sem cadastro, ponto de busca ou de CEP sem
nenhuma região a até raioKm).

Flags: --sem-baixar (usa dados/bruto como está), --uf XX (rodada rápida; repetível),
       --saida DIR (padrão public/dados; com --uf, dados/intermediario/rodada-XX), --bruto DIR.
"""

from __future__ import annotations

import argparse
import json
import logging
import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

from etl import agregar, baixar, busca, conferir, etapas, fora_do_mapa, geo, publicar, zip_remoto
from etl.carregar_tse import ErroEntrada
from etl.config import Candidatura, ErroConfig, RegrasBusca, ler_busca, ler_candidatura
from etl.fontes import (CAMINHO_RESERVA, EXTERIOR, PASTA_BRUTO, PASTA_INTERMEDIARIO, PASTA_PUBLICA, UFS, Catalogo)

LOG = logging.getLogger("etl.montar")
COBERTURA_MINIMA = 0.995
LIMITE_SECOES_BYTES = 300_000
SAIDA_OK, SAIDA_PORTAO, SAIDA_ENTRADA = 0, 1, 2


@dataclass(frozen=True)
class Opcoes:
    bruto: Path = PASTA_BRUTO
    saida: Path = PASTA_PUBLICA
    intermediario: Path = PASTA_INTERMEDIARIO
    reserva: Path = CAMINHO_RESERVA
    ufs: tuple[str, ...] = UFS
    nacional: bool = True
    sem_baixar: bool = False


@dataclass(frozen=True)
class Resultado:
    ok: bool
    versao: str
    indice: dict
    falhas: list[str]
    relatorio: dict = field(default_factory=dict)


def _agora() -> datetime:
    return datetime.now(UTC)


def _conferencia(proc: etapas.Processado, ent: etapas.Entradas, cfg: Candidatura, op: Opcoes, brasil: dict) -> dict:
    calculados = {uf: agregar.totais(proc.secoes[proc.secoes["uf"] == uf]) for uf in op.ufs}
    exterior = agregar.totais(proc.exterior)
    if exterior["secoes"]:
        calculados[EXTERIOR] = exterior
    if op.nacional:
        calculados["BR"] = etapas.somar_totais(brasil, exterior)
    ok, diferencas = conferir.conferir(calculados, ent.oficiais, cfg.eleicao.cargo)
    oficial = ent.oficiais.get("BR") or next(iter(ent.oficiais.values()), None)
    return {"ok": ok, "referencia": conferir.referencia(oficial), "diferencas": diferencas}


def _candidatos(ent: etapas.Entradas, brasil: dict, exterior: dict) -> tuple[dict, list[str]]:
    numeros = sorted(set(brasil["nominais"]) | set(exterior["nominais"]))
    faltam = [n for n in numeros if n not in ent.candidatos]
    return {n: ent.candidatos[n] for n in numeros if n in ent.candidatos}, [f"candidato {n} sem cadastro" for n in faltam]


def _indice_base(proc, ent, cfg: Candidatura, op: Opcoes, quadrados: list[str]) -> tuple[dict, list[str]]:
    brasil = etapas.bloco_brasil(proc, cfg)
    exterior = agregar.totais(proc.exterior)
    candidatos, falhas = _candidatos(ent, brasil, exterior)
    indice = {
        "esquema": 1,
        "eleicao": {"codigo": cfg.eleicao.codigo, "pleito": cfg.eleicao.pleito, "turno": cfg.eleicao.turno,
                    "cargo": cfg.eleicao.cargo},
        "celulaGraus": cfg.metricas.celula_graus,
        "candidatos": candidatos,
        "brasil": brasil,
        "exterior": exterior,
        "ufs": etapas.bloco_ufs(proc, cfg, op.ufs),
        "quadrados": quadrados,
        "conferencia": _conferencia(proc, ent, cfg, op, brasil),
        "fontes": ent.fontes,
    }
    return indice, falhas


def _pontos_de_busca(itens: list[dict], ceps: dict[str, dict]) -> list[tuple[str, float, float]]:
    """Pontos que a busca e o CEP mandam o mapa abrir (municípios, bairros e CEPs), para o portão de raio."""
    agrupados = [(f"busca {i['t']}:{i['n']}/{i.get('m', '')}/{i['uf']}", i["lat"], i["lon"]) for i in itens if i["t"] != "l"]
    return agrupados + [(f"cep {c}", v["lat"], v["lon"]) for arquivo in ceps.values() for c, v in arquivo.items()]


def _arquivos(proc: etapas.Processado, cfg: Candidatura,
              regras: RegrasBusca) -> tuple[dict[str, str], list[str], list[tuple[str, float, float]]]:
    arquivos: dict[str, object] = dict(publicar.arquivos_celulas(proc.regioes, cfg.metricas.celula_graus))
    pontos, quadrados = publicar.arquivos_pontos(proc.regioes)
    arquivos |= pontos
    arquivos |= publicar.arquivos_secoes(proc.secoes)
    itens = busca.itens_busca(proc.locais)
    arquivos |= {f"busca/{busca.arquivo_da_busca(prefixo)}.json": lista for prefixo, lista in busca.indexar(itens, regras).items()}
    ceps = publicar.arquivos_cep(proc.locais[proc.locais["posicao"] != ""])
    arquivos |= ceps
    return publicar.textos(arquivos), quadrados, _pontos_de_busca(itens, ceps)


def _cobertura(indice: dict) -> float:
    """Fração do eleitorado que deveria estar no mapa e tem posição (fora do mapa por decisão não conta)."""
    fora = sum(indice["brasil"]["eleitoresForaDoMapa"].values())
    mapeavel = indice["brasil"]["aptos"] - fora
    sem = sum(u["eleitoresSemPosicao"] for u in indice["ufs"].values())
    return (mapeavel - sem) / mapeavel if mapeavel else 0.0


def _sem_regiao_perto(proc: etapas.Processado, pontos: list[tuple[str, float, float]], raio_km: float) -> list[str]:
    """Ponto de busca/CEP sem região a até raioKm: o site responderia "nenhum local" na busca pelo próprio lugar."""
    sem = geo.pontos_sem_regiao(pontos, [(r["lat"], r["lon"]) for r in proc.regioes], raio_km)
    return [f"{len(sem)} pontos de busca/CEP sem região a até {raio_km} km (ex.: {', '.join(sem[:3])})"] if sem else []


def _portoes(indice: dict, textos: dict[str, str], op: Opcoes) -> list[str]:
    falhas = [f"conferência: {d}" for d in indice["conferencia"]["diferencas"]]
    cobertura = _cobertura(indice)
    if op.nacional and cobertura < COBERTURA_MINIMA:
        falhas.append(f"cobertura de posição {cobertura:.4%} < {COBERTURA_MINIMA:.1%}")
    todos = {**textos, "indice.json": publicar.json_canonico(indice)}
    falhas += [f"possível documento pessoal em {c}" for c in conferir.documentos_na_saida(todos)]
    falhas += [f"possível telefone ou e-mail em {c}" for c in conferir.contatos_na_saida(todos)]
    secoes = {c: len(t.encode("utf-8")) for c, t in textos.items() if c.startswith("secoes/")}
    grandes = [f"{c} tem {b} bytes (limite {LIMITE_SECOES_BYTES})" for c, b in secoes.items() if b >= LIMITE_SECOES_BYTES]
    return falhas + grandes


def _relatorio(proc: etapas.Processado, indice: dict, textos: dict[str, str], tempos: dict[str, float]) -> dict:
    locais = proc.locais
    por_posicao = locais.groupby("posicao")["eleitores"].agg(["size", "sum"])
    por_motivo = locais.groupby(["motivo", "posicao"])["eleitores"].agg(["size", "sum"])
    return {
        "cobertura": round(_cobertura(indice), 6),
        "locais": {str(k or "sem"): {"locais": int(v["size"]), "eleitores": int(v["sum"])} for k, v in por_posicao.iterrows()},
        "motivos": {f"{m or 'ok'}/{p or 'sem'}": {"locais": int(v["size"]), "eleitores": int(v["sum"])}
                    for (m, p), v in por_motivo.iterrows()},
        "foraDoMapa": fora_do_mapa.resumo(proc.fora_do_mapa),
        "celulas": sum(1 for c in textos if c.startswith("celulas/")),
        "quadrados": len(indice["quadrados"]),
        "arquivos": len(textos) + 1,
        "tamanhos": publicar.tamanhos(textos),
        "avisos": proc.avisos,
        "tempos": {k: round(v, 1) for k, v in tempos.items()},
    }


def executar(op: Opcoes, cfg: Candidatura | None = None, regras: RegrasBusca | None = None,
             agora: Callable[[], datetime] = _agora) -> Resultado:
    cfg, regras = cfg or ler_candidatura(), regras or ler_busca()
    tempos: dict[str, float] = {}
    inicio = time.monotonic()
    if not op.sem_baixar:
        baixar.baixar_tudo(Catalogo.da_config(cfg), op.bruto)
    tempos["baixar"] = time.monotonic() - inicio
    ent = etapas.carregar(op.bruto, op.reserva, cfg, op.ufs, op.nacional)
    tempos["carregar"] = time.monotonic() - inicio - tempos["baixar"]
    proc = etapas.processar(ent, cfg, op.ufs)
    textos, quadrados, pontos_busca = _arquivos(proc, cfg, regras)
    indice, falhas = _indice_base(proc, ent, cfg, op, quadrados)
    falhas += _portoes(indice, textos, op) + _sem_regiao_perto(proc, pontos_busca, cfg.metricas.raio_km)
    versao = publicar.calcular_versao(textos, indice)
    indice = {**indice, "versao": versao, "geradoEm": agora().strftime("%Y-%m-%dT%H:%M:%SZ")}
    tempos["total"] = time.monotonic() - inicio
    relatorio = _relatorio(proc, indice, textos, tempos)
    _gravar(op, indice, textos, relatorio, falhas)
    return Resultado(not falhas, versao, indice, falhas, relatorio)


def _gravar(op: Opcoes, indice: dict, textos: dict[str, str], relatorio: dict, falhas: list[str]) -> None:
    """Relatório sempre; publicação só sem falhas (rodada por UF usa nomes com sufixo, sem sobrescrever a nacional)."""
    op.intermediario.mkdir(parents=True, exist_ok=True)
    sufixo = "" if op.nacional else "-" + "-".join(op.ufs).lower()
    (op.intermediario / f"relatorio{sufixo}.json").write_text(
        json.dumps({**relatorio, "falhas": falhas, "versao": indice["versao"]}, ensure_ascii=False, indent=1),
        encoding="utf-8")
    reprovado = op.intermediario / f"indice-reprovado{sufixo}.json"
    if falhas:
        reprovado.write_text(json.dumps(indice, ensure_ascii=False, indent=1), encoding="utf-8")
        return
    publicar.gravar({**textos, "indice.json": publicar.json_canonico(indice)}, op.saida)
    reprovado.unlink(missing_ok=True)


def _argumentos(argv: Sequence[str] | None) -> Opcoes:
    p = argparse.ArgumentParser(prog="etl.montar", description="Gera public/dados/ a partir dos dados do TSE.")
    p.add_argument("--sem-baixar", action="store_true", help="não acessa a rede; usa dados/bruto como está")
    p.add_argument("--uf", action="append", type=str.upper, choices=UFS, help="rodada rápida só desta UF (repetível)")
    p.add_argument("--saida", type=Path, help="pasta de saída (padrão: public/dados)")
    p.add_argument("--bruto", type=Path, default=PASTA_BRUTO, help="pasta dos arquivos baixados")
    p.add_argument("--intermediario", type=Path, default=PASTA_INTERMEDIARIO, help="pasta do relatório da rodada")
    a = p.parse_args(argv)
    ufs = tuple(sorted(set(a.uf))) if a.uf else UFS
    nacional = not a.uf
    saida = a.saida or (PASTA_PUBLICA if nacional else PASTA_INTERMEDIARIO / f"rodada-{'-'.join(ufs).lower()}")
    return Opcoes(bruto=a.bruto, saida=saida, intermediario=a.intermediario, ufs=ufs, nacional=nacional,
                  sem_baixar=a.sem_baixar)


def _resumir(r: Resultado, op: Opcoes) -> None:
    b = r.indice["brasil"]
    LOG.info("versão %s | seções %d | aptos %d | regiões %d (no mapa %d) | até %d",
             r.versao, b["secoes"], b["aptos"], b["regioes"], b["regioesNoMapa"], b["ate"])
    LOG.info("cobertura de posição %.3f%% | células %d | quadrados %d | arquivos %d | %.1fs",
             100 * r.relatorio["cobertura"], r.relatorio["celulas"], r.relatorio["quadrados"],
             r.relatorio["arquivos"], r.relatorio["tempos"]["total"])
    for aviso in r.relatorio["avisos"]:
        LOG.warning("aviso: %s", aviso)
    for falha in r.falhas:
        LOG.error("PORTÃO: %s", falha)
    LOG.info("%s", f"publicado em {op.saida}" if r.ok else "NADA publicado (portões falharam)")


def principal(argv: Sequence[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
    op = _argumentos(argv)
    try:
        resultado = executar(op)
    except (ErroConfig, ErroEntrada, baixar.ErroDownload, zip_remoto.ErroZip, FileNotFoundError) as erro:
        LOG.error("entrada inválida: %s", erro)
        return SAIDA_ENTRADA
    _resumir(resultado, op)
    return SAIDA_OK if resultado.ok else SAIDA_PORTAO


if __name__ == "__main__":
    raise SystemExit(principal())
