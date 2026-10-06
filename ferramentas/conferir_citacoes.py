"""Confere, página a página, os trechos citados do plano de governo contra o PDF registrado no TSE.

Uso (sempre pelo Python do venv):
  npm run py -- ferramentas/conferir_citacoes.py                # src/conteudo/plano.json + roteiros.json
  npm run py -- ferramentas/conferir_citacoes.py --autoteste    # testes da própria ferramenta
  npm run py -- ferramentas/conferir_citacoes.py --fonte outro=dados/fontes/outro.pdf arquivo.json
Saída: 0 = tudo confere; 1 = algum trecho falhou; 2 = faltou PDF, hash ou pdftotext.

Regra: todo objeto JSON com "trecho" e "pagina" é uma citação. O trecho, com espaços normalizados, tem de
aparecer na página indicada do PDF (texto do pdftotext -layout; quebra de linha com hífen tolerada) e ter
no máximo 25 palavras. "fonte" ausente = "plano".
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
MAX_PALAVRAS = 25
MIN_PROPOSTAS, MAX_PROPOSTAS = 3, 6
FONTE_PADRAO = "plano"
CONTEUDO_PADRAO = ("src/conteudo/plano.json", "src/conteudo/roteiros.json")
PDFTOTEXT_CONHECIDOS = (
    r"C:\Program Files\Git\mingw64\bin\pdftotext.exe",
    "/mingw64/bin/pdftotext",
    "/usr/bin/pdftotext",
)


class ErroAmbiente(Exception):
    """Falta algo para conferir (PDF, hash, pdftotext): não dá para afirmar nada sobre os trechos."""


@dataclass(frozen=True)
class Citacao:
    origem: str
    trecho: str
    pagina: int
    fonte: str


def normalizar(texto: str, juntar_hifen: bool = False) -> str:
    t = unicodedata.normalize("NFC", texto).replace("\u00ad", "").replace("\u00a0", " ").replace("\f", " ")
    t = re.sub(r"-[ \t]*\r?\n\s*", "" if juntar_hifen else "-", t)
    return re.sub(r"\s+", " ", t).strip()


def contar_palavras(trecho: str) -> int:
    return len(trecho.split())


def trecho_na_pagina(trecho: str, pagina: str) -> bool:
    alvo = normalizar(trecho)
    if not alvo:
        return False
    return alvo in normalizar(pagina) or alvo in normalizar(pagina, juntar_hifen=True)


def coletar_citacoes(dado: object, origem: str) -> list[Citacao]:
    achadas: list[Citacao] = []
    if isinstance(dado, dict):
        if "trecho" in dado and "pagina" in dado:
            pagina = dado["pagina"]
            achadas.append(Citacao(origem, str(dado["trecho"]), pagina if isinstance(pagina, int) else -1,
                                   str(dado.get("fonte", FONTE_PADRAO))))
        for chave, valor in dado.items():
            achadas.extend(coletar_citacoes(valor, _juntar(origem, f".{chave}")))
    elif isinstance(dado, list):
        for i, valor in enumerate(dado):
            achadas.extend(coletar_citacoes(valor, _juntar(origem, f"[{i}]")))
    return achadas


def _juntar(origem: str, passo: str) -> str:
    if " › " not in origem:
        return f"{origem} › {passo.lstrip('.')}"
    return origem + passo


def checar_plano(plano: dict) -> list[str]:
    problemas: list[str] = []
    for capitulo in plano.get("capitulos", []):
        chave = capitulo.get("chave", "?")
        propostas = capitulo.get("propostas", [])
        if not MIN_PROPOSTAS <= len(propostas) <= MAX_PROPOSTAS:
            problemas.append(f"capítulo {chave}: {len(propostas)} propostas "
                             f"(o mínimo é {MIN_PROPOSTAS}, o máximo é {MAX_PROPOSTAS})")
        ini, fim = capitulo.get("paginas", [0, 0])
        for i, proposta in enumerate(propostas):
            pagina = proposta.get("pagina")
            if not isinstance(pagina, int) or not ini <= pagina <= fim:
                problemas.append(f"capítulo {chave}: proposta {i + 1} na página {pagina}, fora de {ini}–{fim}")
    return problemas


def ler_hash(texto: str) -> str:
    for linha in texto.splitlines():
        linha = linha.strip()
        if linha and not linha.startswith("#"):
            return linha.split()[0].lower()
    raise ErroAmbiente("arquivo .sha256 sem hash")


def sha256_arquivo(caminho: Path) -> str:
    h = hashlib.sha256()
    with caminho.open("rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def achar_pdftotext(indicado: str | None) -> str:
    candidatos = [indicado, os.environ.get("PDFTOTEXT"), shutil.which("pdftotext"), *PDFTOTEXT_CONHECIDOS]
    for c in candidatos:
        if c and Path(c).is_file():
            return c
    raise ErroAmbiente("pdftotext não encontrado (instale poppler ou use --pdftotext CAMINHO)")


def conferir_pdf(pdf: Path) -> None:
    """Exige o PDF e o hash ao lado (plano-NN.sha256); o hash prova que é o documento registrado."""
    if not pdf.is_file():
        raise ErroAmbiente(f"PDF não encontrado: {pdf} (ver {pdf.with_suffix('.sha256')} para a origem)")
    arquivo_hash = pdf.with_suffix(".sha256")
    if not arquivo_hash.is_file():
        raise ErroAmbiente(f"falta {arquivo_hash}")
    esperado = ler_hash(arquivo_hash.read_text(encoding="utf-8"))
    obtido = sha256_arquivo(pdf)
    if obtido != esperado:
        raise ErroAmbiente(f"SHA-256 de {pdf.name} não confere: {obtido} ≠ {esperado}")


class Paginas:
    """Texto de cada página, extraído uma vez só."""

    def __init__(self, pdftotext: str, pdf: Path) -> None:
        self._pdftotext, self._pdf, self._cache = pdftotext, pdf, {}

    def texto(self, n: int) -> str:
        if n not in self._cache:
            comando = [self._pdftotext, "-layout", "-enc", "UTF-8", "-f", str(n), "-l", str(n), str(self._pdf), "-"]
            r = subprocess.run(comando, capture_output=True, check=False)
            if r.returncode != 0:
                raise ErroAmbiente(f"pdftotext falhou na página {n}: {r.stderr.decode('utf-8', 'replace').strip()}")
            self._cache[n] = r.stdout.decode("utf-8")
        return self._cache[n]


def motivo_falha(c: Citacao, paginas: dict[str, Paginas]) -> str | None:
    if c.fonte not in paginas:
        return f"fonte '{c.fonte}' sem PDF configurado"
    if c.pagina < 1:
        return "página inválida"
    if contar_palavras(c.trecho) > MAX_PALAVRAS:
        return f"{contar_palavras(c.trecho)} palavras (máximo {MAX_PALAVRAS})"
    texto = paginas[c.fonte].texto(c.pagina)
    if not normalizar(texto):
        return "página vazia ou inexistente no PDF"
    if not trecho_na_pagina(c.trecho, texto):
        return "trecho não aparece na página"
    return None


def conferir_arquivos(arquivos: list[Path], paginas: dict[str, Paginas], hash_plano: str) -> int:
    falhas = total = 0
    for arquivo in arquivos:
        dado = json.loads(arquivo.read_text(encoding="utf-8"))
        problemas = checar_plano(dado) if "capitulos" in dado else []
        sha_doc = dado.get("documento", {}).get("sha256") if isinstance(dado.get("documento"), dict) else None
        if sha_doc is not None and sha_doc != hash_plano:
            problemas.append(f"documento.sha256 ({sha_doc}) difere do hash do PDF ({hash_plano})")
        for p in problemas:
            falhas += 1
            print(f"FALHA {arquivo.name}: {p}")
        for c in coletar_citacoes(dado, arquivo.name):
            total += 1
            motivo = motivo_falha(c, paginas)
            falhas += motivo is not None
            marca = "OK   " if motivo is None else "FALHA"
            print(f"{marca} p{c.pagina:>3} {contar_palavras(c.trecho):>2}p  {c.origem}" + (f"  → {motivo}" if motivo else ""))
    print(f"{total} trechos conferidos, {falhas} falhas")
    return 1 if falhas else 0


def pdf_padrao() -> Path:
    cfg = json.loads((RAIZ / "config" / "candidatura.json").read_text(encoding="utf-8"))
    return RAIZ / "dados" / "fontes" / f"plano-{cfg['alvo']['numero']}.pdf"


def _argumentos(argv: list[str]) -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Confere citações literais contra o PDF, página a página.")
    ap.add_argument("arquivos", nargs="*", help="JSONs a conferir (padrão: plano.json e roteiros.json)")
    ap.add_argument("--pdf", type=Path, help="PDF da fonte 'plano' (padrão: dados/fontes/plano-<alvo>.pdf)")
    ap.add_argument("--fonte", action="append", default=[], metavar="ID=PDF", help="outra fonte citada")
    ap.add_argument("--pdftotext", help="caminho do executável pdftotext")
    ap.add_argument("--autoteste", action="store_true", help="roda só os testes da ferramenta")
    return ap.parse_args(argv)


def principal(argv: list[str]) -> int:
    args = _argumentos(argv)
    if args.autoteste:
        return _autoteste()
    try:
        exe = achar_pdftotext(args.pdftotext)
        fontes = {FONTE_PADRAO: args.pdf or pdf_padrao()}
        fontes.update({i: Path(p) for i, _, p in (f.partition("=") for f in args.fonte)})
        for pdf in fontes.values():
            conferir_pdf(pdf)
        arquivos = [Path(a) for a in args.arquivos] or [RAIZ / a for a in CONTEUDO_PADRAO]
        hash_plano = sha256_arquivo(fontes[FONTE_PADRAO])
        return conferir_arquivos(arquivos, {i: Paginas(exe, p) for i, p in fontes.items()}, hash_plano)
    except (ErroAmbiente, OSError, json.JSONDecodeError) as erro:
        print(f"ERRO: {erro}", file=sys.stderr)
        return 2


def _autoteste() -> int:
    casos = 0

    def igual(obtido: object, esperado: object, nome: str) -> None:
        nonlocal casos
        casos += 1
        if obtido != esperado:
            raise AssertionError(f"{nome}: esperado {esperado!r}, obtido {obtido!r}")

    pagina = "Vamos   ampliar\n as parcerias público-\n   privadas e a ma-\nnutenção\u00a0das escolas.\n\n  13\n"
    igual(normalizar("a  b\n\tc"), "a b c", "espaços colapsam")
    igual(normalizar("público-\n   privadas"), "público-privadas", "hífen de quebra mantém o hífen")
    igual(normalizar("ma-\nnutenção", juntar_hifen=True), "manutenção", "hífen de sílaba some")
    igual(normalizar("e\u0301"), "\u00e9", "acento decomposto vira composto (NFC)")
    igual(normalizar("x\u00ady"), "xy", "hífen invisível some")
    igual(trecho_na_pagina("as parcerias público-privadas", pagina), True, "acha com hífen de quebra")
    igual(trecho_na_pagina("a manutenção das escolas.", pagina), True, "acha com sílaba partida e nbsp")
    igual(trecho_na_pagina("as parcerias público privadas", pagina), False, "não aceita trecho alterado")
    igual(trecho_na_pagina("", pagina), False, "trecho vazio nunca confere")
    igual(contar_palavras(" Vamos  ampliar as Escolas Cívico-Militares "), 5, "conta palavras")
    dado = {"capitulos": [{"propostas": [{"trecho": "a", "pagina": 3}, {"titulo": "sem trecho"}]}],
            "pontes": [{"citacoes": [{"trecho": "b", "pagina": 9, "fonte": "outro"}]}]}
    achadas = coletar_citacoes(dado, "x.json")
    igual([(c.origem, c.trecho, c.pagina, c.fonte) for c in achadas],
          [("x.json › capitulos[0].propostas[0]", "a", 3, "plano"),
           ("x.json › pontes[0].citacoes[0]", "b", 9, "outro")], "coleta citações aninhadas")
    plano = {"capitulos": [{"chave": "c1", "paginas": [10, 12], "propostas": [
        {"trecho": "t", "pagina": 10}, {"trecho": "t", "pagina": 13}, {"trecho": "t", "pagina": 12}]}]}
    igual(checar_plano(plano), ["capítulo c1: proposta 2 na página 13, fora de 10–12"], "página fora do capítulo")
    curto = {"capitulos": [{"chave": "c2", "paginas": [1, 2], "propostas": [{"trecho": "t", "pagina": 1}]}]}
    igual(checar_plano(curto), ["capítulo c2: 1 propostas (o mínimo é 3, o máximo é 6)"], "poucas propostas")
    igual(ler_hash("# comentário\nABCDEF0123  plano.pdf\n# origem: x\n"), "abcdef0123", "lê o hash ignorando comentários")
    igual(motivo_falha(Citacao("o", "a " * 26, 1, "plano"), {"plano": _PaginasFixas("a " * 30)}),
          "26 palavras (máximo 25)", "trecho longo demais")
    igual(motivo_falha(Citacao("o", "a", 1, "outra"), {}), "fonte 'outra' sem PDF configurado", "fonte desconhecida")
    igual(motivo_falha(Citacao("o", "a", 99, "plano"), {"plano": _PaginasFixas("")}),
          "página vazia ou inexistente no PDF", "página fora do PDF")
    print(f"autoteste: {casos} casos ok")
    return 0


class _PaginasFixas(Paginas):
    """Dublê de teste: devolve sempre o mesmo texto, sem chamar o pdftotext."""

    def __init__(self, texto: str) -> None:
        super().__init__("", Path())
        self._fixo = texto

    def texto(self, n: int) -> str:
        return self._fixo


if __name__ == "__main__":
    sys.exit(principal(sys.argv[1:]))
