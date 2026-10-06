"""Gera o recorte REAL usado pelos testes (AC, RR e exterior), a partir de dados/bruto/ (rode `npm run dados` antes).

Uso: .venv/Scripts/python.exe -X utf8 testes/etl/fixtures/gerar_fixtures.py

Mantém o formato original dos arquivos do TSE (mesmas colunas, latin-1, ';'); só filtra linhas.
Os CSVs grandes vão dentro de zips com o mesmo nome, como o ETL aceita (`etl.carregar_tse.localizar`).
"""

from __future__ import annotations

import json
import logging
import shutil
import zipfile
from pathlib import Path

import pyarrow.parquet as pq

RAIZ = Path(__file__).resolve().parents[3]
BRUTO = RAIZ / "dados" / "bruto"
DESTINO = Path(__file__).resolve().parent / "bruto"
UFS = ("AC", "RR")
ABRANGENCIAS = (*UFS, "ZZ")
ANO, ELEICAO = 2026, "e006257"


def _linhas_das_ufs(linhas: list[bytes], coluna_uf: int, ufs: tuple[str, ...]) -> list[bytes]:
    alvos = {f'"{uf}"'.encode() for uf in ufs}
    return [linha for linha in linhas if linha.split(b";")[coluna_uf] in alvos]


def _cortar_csv(conteudo: bytes, ufs: tuple[str, ...]) -> bytes:
    linhas = conteudo.splitlines(keepends=True)
    cabecalho = linhas[0].decode("latin-1").strip().split(";")
    coluna_uf = cabecalho.index('"SG_UF"')
    return linhas[0] + b"".join(_linhas_das_ufs(linhas[1:], coluna_uf, ufs))


def _zipar(nome_csv: str, conteudo: bytes) -> None:
    with zipfile.ZipFile(DESTINO / (Path(nome_csv).stem + ".zip"), "w", compression=zipfile.ZIP_DEFLATED,
                         compresslevel=9) as z:
        z.writestr(nome_csv, conteudo)


def _votacao() -> None:
    nome = f"votacao_secao_{ANO}_BR.csv"
    with zipfile.ZipFile(BRUTO / f"votacao_secao_{ANO}_BR.zip") as z:
        _zipar(nome, _cortar_csv(z.read(nome), ABRANGENCIAS))


def _detalhe_e_cadastro() -> None:
    nome = f"detalhe_votacao_secao_{ANO}_BR.csv"
    _zipar(nome, _cortar_csv((BRUTO / nome).read_bytes(), ABRANGENCIAS))
    for uf in UFS:
        nome = f"eleitorado_local_votacao_{ANO}_{uf}.csv"
        _zipar(nome, (BRUTO / nome).read_bytes())


def _jsons() -> None:
    (DESTINO / "resultado").mkdir(exist_ok=True)
    for abr in ABRANGENCIAS:
        nome = f"resultado/{abr.lower()}-c0001-{ELEICAO}-u.json"
        shutil.copyfile(BRUTO / nome, DESTINO / nome)
    cm = json.loads((BRUTO / f"mun-{ELEICAO}-cm.json").read_text(encoding="utf-8"))
    cm["abr"] = [a for a in cm["abr"] if a["cd"].upper() in ABRANGENCIAS]
    (DESTINO / f"mun-{ELEICAO}-cm.json").write_text(json.dumps(cm, ensure_ascii=False), encoding="utf-8")
    ibge = {m["cdi"] for a in cm["abr"] for m in a["mu"] if m.get("cdi")}
    malha = json.loads((BRUTO / "malha_municipios.geojson").read_text(encoding="utf-8"))
    malha["features"] = [f for f in malha["features"] if f["properties"]["codarea"] in ibge]
    (DESTINO / "malha_municipios.geojson").write_text(json.dumps(malha, separators=(",", ":")), encoding="utf-8")


def _candidatos_e_reserva() -> None:
    shutil.copyfile(BRUTO / f"consulta_cand_{ANO}_BR.csv", DESTINO / f"consulta_cand_{ANO}_BR.csv")
    origem = RAIZ / "etl" / "terceiros" / "como_meus_vizinhos" / "locais_votacao_2018_2022.parquet"
    tabela = pq.read_table(origem).to_pandas()
    recorte = tabela[tabela["sg_uf"].isin(UFS)]
    recorte.to_parquet(DESTINO.parent / "reserva.parquet", index=False)


def main() -> None:
    shutil.rmtree(DESTINO, ignore_errors=True)
    DESTINO.mkdir(parents=True)
    _votacao()
    _detalhe_e_cadastro()
    _jsons()
    _candidatos_e_reserva()
    total = sum(p.stat().st_size for p in DESTINO.parent.rglob("*") if p.is_file())
    logging.getLogger("fixtures").info("fixtures gravadas em %s (%.2f MB)", DESTINO.parent, total / 1e6)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    main()
