"""Etapas do ETL: carregar as fontes, processar (seção → local → região) e montar os blocos do índice."""

from __future__ import annotations

import hashlib
import json
import logging
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from etl import agregar, carregar_tse, coordenadas, fontes, fora_do_mapa, metricas
from etl.config import Candidatura
from etl.fontes import EXTERIOR, Catalogo

LOG = logging.getLogger("etl.etapas")


@dataclass(frozen=True)
class Entradas:
    detalhe: pd.DataFrame
    votos: pd.DataFrame
    cadastro: pd.DataFrame
    candidatos: dict[str, dict[str, str]]
    malha: dict
    ibge: dict[str, str]
    reserva: pd.DataFrame
    oficiais: dict[str, dict]
    fontes: list[dict]


@dataclass(frozen=True)
class Processado:
    secoes: pd.DataFrame  # seções das UFs da rodada (sem exterior)
    exterior: pd.DataFrame
    locais: pd.DataFrame  # locais do mapa, com posicao/motivo e, se posicionados, regiao/lat_regiao/lon_regiao
    sem_cadastro: pd.DataFrame
    regioes: list[dict]
    avisos: list[str]
    fora_do_mapa: pd.DataFrame  # locais de voto em trânsito e de preso provisório (etl/fora_do_mapa.py)


# ── fontes ──


def _sha256(caminho: Path) -> str:
    resumo = hashlib.sha256()
    with caminho.open("rb") as entrada:
        for bloco in iter(lambda: entrada.read(1 << 20), b""):
            resumo.update(bloco)
    return resumo.hexdigest()


def _sha256_varios(caminhos: Sequence[Path]) -> str:
    linhas = "".join(f"{c.name}:{_sha256(c)}\n" for c in sorted(caminhos, key=lambda c: c.name))
    return hashlib.sha256(linhas.encode()).hexdigest()


def _data_json(dados: Mapping | None) -> str | None:
    return f"{dados['dg']} {dados['hg']}" if dados and dados.get("dg") else None


def _fontes(cat: Catalogo, origens: Mapping[str, carregar_tse.Origem], cadastros: Sequence[carregar_tse.Origem],
            bruto: Path, oficiais: Mapping[str, dict], reserva: Path) -> list[dict]:
    resultados = sorted(bruto.glob("resultado/*.json"))
    municipios = json.loads((bruto / cat.municipios).read_text(encoding="utf-8"))
    oficial_ref = oficiais.get("BR") or next(iter(oficiais.values()), None)
    return [
        {"id": "votacao_secao", "url": cat.url_zip_votacao, "sha256": _sha256(origens["votacao"].caminho),
         "dataGeracao": carregar_tse.data_geracao(origens["votacao"])},
        {"id": "detalhe_votacao_secao", "url": cat.url_zip_detalhe, "sha256": _sha256(origens["detalhe"].caminho),
         "dataGeracao": carregar_tse.data_geracao(origens["detalhe"])},
        {"id": "eleitorado_local_votacao", "url": cat.url_zip_cadastro,
         "sha256": _sha256_varios([o.caminho for o in cadastros]),
         "dataGeracao": carregar_tse.data_geracao(cadastros[0]) if cadastros else None},
        {"id": "consulta_cand", "url": cat.url_zip_candidatos, "sha256": _sha256(origens["candidatos"].caminho),
         "dataGeracao": carregar_tse.data_geracao(origens["candidatos"])},
        {"id": "resultado_oficial", "url": cat.url_resultado("BR"), "sha256": _sha256_varios(resultados),
         "dataGeracao": _data_json(oficial_ref)},
        {"id": "municipios_tse_ibge", "url": cat.url_municipios, "sha256": _sha256(bruto / cat.municipios),
         "dataGeracao": _data_json(municipios)},
        {"id": "malha_ibge", "url": fontes.URL_MALHA, "sha256": _sha256(bruto / fontes.NOME_MALHA), "dataGeracao": None},
        {"id": "como_meus_vizinhos", "url": fontes.URL_RESERVA, "sha256": _sha256(reserva), "dataGeracao": None},
    ]


# ── carregar ──


def carregar(bruto: Path, reserva: Path, cfg: Candidatura, ufs: Sequence[str], nacional: bool) -> Entradas:
    cat = Catalogo.da_config(cfg)
    origens = {
        "votacao": carregar_tse.localizar(bruto, cat.votacao),
        "detalhe": carregar_tse.localizar(bruto, cat.detalhe),
        "candidatos": carregar_tse.localizar(bruto, cat.candidatos),
    }
    cadastros = [carregar_tse.localizar(bruto, cat.cadastro(uf)) for uf in ufs]
    abrangencias = (["BR"] if nacional else []) + list(ufs) + [EXTERIOR]
    oficiais = {}
    for abr in abrangencias:
        caminho = bruto / cat.resultado(abr)
        if caminho.exists():
            oficiais[abr] = json.loads(caminho.read_text(encoding="utf-8"))
    LOG.info("lendo votos, detalhe e cadastro (%d UFs)", len(ufs))
    return Entradas(
        detalhe=carregar_tse.ler_detalhe(origens["detalhe"], cfg.eleicao),
        votos=carregar_tse.ler_votos(origens["votacao"], cfg.eleicao),
        cadastro=carregar_tse.ler_cadastro(cadastros),
        candidatos=carregar_tse.ler_candidatos(origens["candidatos"], cfg.eleicao),
        malha=coordenadas.carregar_malha(bruto / fontes.NOME_MALHA),
        ibge=coordenadas.carregar_tse_ibge(bruto / cat.municipios),
        reserva=coordenadas.carregar_reserva(reserva),
        oficiais=oficiais,
        fontes=_fontes(cat, origens, cadastros, bruto, oficiais, reserva),
    )


# ── processar ──


def processar(entradas: Entradas, cfg: Candidatura, ufs: Sequence[str]) -> Processado:
    secoes, avisos = agregar.secoes_com_votos(entradas.detalhe, entradas.votos, cfg.reclassificar_como_nulo)
    avisos += fora_do_mapa.validar_tipos(entradas.cadastro)
    das_ufs = secoes[secoes["uf"].isin(ufs)].reset_index(drop=True)
    exterior = secoes[secoes["uf"] == EXTERIOR].reset_index(drop=True)
    todos_locais, sem_cadastro = agregar.montar_locais(das_ufs, entradas.cadastro)
    locais, fora = fora_do_mapa.separar(todos_locais)
    if not sem_cadastro.empty:
        avisos.append(f"{len(sem_cadastro)} seções sem local no cadastro ({int(sem_cadastro['aptos'].sum())} eleitores)")
    LOG.info("validando a posição de %d locais", len(locais))
    posicionados = coordenadas.posicionar(locais, entradas.malha, entradas.ibge, entradas.reserva)
    com_posicao = agregar.atribuir_regioes(posicionados[posicionados["posicao"] != ""])
    sem_posicao = posicionados[posicionados["posicao"] == ""]
    todos = pd.concat([com_posicao, sem_posicao], ignore_index=True)
    regioes = agregar.montar_regioes(com_posicao)
    return Processado(das_ufs, exterior, todos, sem_cadastro, regioes, avisos, fora)


# ── blocos do índice ──


def _ate(totais: Mapping, cfg: Candidatura) -> int:
    return metricas.derivar(totais, cfg.alvo.numero, cfg.adversario.numero).ate


def votos_sem_posicao(proc: Processado) -> list[dict]:
    colunas = agregar.colunas_nominais(proc.locais)
    sem = proc.locais[proc.locais["posicao"] == ""].to_dict("records")
    return [v for v in (agregar.votos_de_locais([loc], colunas) for loc in sem) if v is not None]


def bloco_brasil(proc: Processado, cfg: Candidatura) -> dict:
    totais = agregar.totais(proc.secoes)
    lista = [r["votos"] for r in proc.regioes if r["votos"] is not None] + votos_sem_posicao(proc)
    m = cfg.metricas
    contagem = metricas.contar(lista, cfg.alvo.numero, cfg.adversario.numero, m.limiar_folga, m.regra_viravel)
    n_sem = int((proc.locais["posicao"] == "").sum())
    return {
        **totais,
        "regioes": len(proc.regioes) + n_sem,
        "regioesNoMapa": len(proc.regioes),
        "ate": _ate(totais, cfg),
        "classificacao": contagem.classificacao,
        "viraveis": contagem.viraveis,
        "eleitoresForaDoMapa": fora_do_mapa.contar(proc.fora_do_mapa),
    }


def bloco_ufs(proc: Processado, cfg: Candidatura, ufs: Sequence[str]) -> dict[str, dict]:
    locais = proc.locais
    blocos = {}
    for uf in ufs:
        secoes = proc.secoes[proc.secoes["uf"] == uf]
        da_uf = locais[locais["uf"] == uf]
        orfas = proc.sem_cadastro[proc.sem_cadastro["uf"] == uf]
        no_mapa = sum(1 for r in proc.regioes if r["uf"] == uf)
        sem = da_uf[da_uf["posicao"] == ""]
        blocos[uf] = {
            "secoes": len(secoes),
            "aptos": int(secoes["aptos"].sum()),
            "regioes": no_mapa + len(sem),
            "regioesNoMapa": no_mapa,
            "eleitoresSemPosicao": int(sem["eleitores"].sum()) + int(orfas["aptos"].sum()),
            # Por região, como o aviso da ficha (agregar._regiao): Σ eleitores das regiões com posicao "reserva".
            "eleitoresPosicaoReserva": sum(int(r["eleitores"]) for r in proc.regioes
                                           if r["uf"] == uf and r["posicao"] == "reserva"),
            "eleitoresForaDoMapa": fora_do_mapa.contar(proc.fora_do_mapa, [uf]),
            "ate": _ate(agregar.totais(secoes), cfg),
        }
    return blocos


def somar_totais(*partes: Mapping) -> dict:
    soma = {c: sum(int(p[c]) for p in partes) for c in ["secoes", "aptos", *agregar.CAMPOS_SOMA]}
    nominais: dict[str, int] = {}
    for p in partes:
        for n, v in p["nominais"].items():
            nominais[n] = nominais.get(n, 0) + int(v)
    return {**soma, "nominais": dict(sorted(nominais.items()))}
