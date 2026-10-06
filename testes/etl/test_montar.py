"""Ponta a ponta no recorte real (AC, RR e exterior): portões, formato do contrato e versão estável."""

import json
import re
import shutil
from datetime import UTC, datetime

import pytest

from etl import conferir, montar, publicar

AGORA = lambda: datetime(2026, 10, 6, 12, 0, tzinfo=UTC)  # noqa: E731
CAMPOS_REGIAO = {"id", "uf", "mun", "municipio", "bairro", "lat", "lon", "posicao", "locais", "eleitores", "secoes", "votos"}
ID_REGIAO = re.compile(r"^[a-z]{2}-\d{5}-\d{4}-\d{4}$")


def _opcoes(fixtures, base, bruto=None):
    return montar.Opcoes(bruto=bruto or fixtures / "bruto", saida=base / "dados", intermediario=base / "inter",
                         reserva=fixtures / "reserva.parquet", ufs=("AC", "RR"), nacional=False, sem_baixar=True)


@pytest.fixture(scope="module")
def rodada(tmp_path_factory, fixtures):
    base = tmp_path_factory.mktemp("rodada")
    op = _opcoes(fixtures, base)
    return montar.executar(op, agora=AGORA), op


def _publicados(op):
    return {p.relative_to(op.saida).as_posix(): p.read_text(encoding="utf-8") for p in op.saida.rglob("*.json")}


def test_portoes_passam_e_totais_batem_com_o_oficial(rodada):
    resultado, _ = rodada
    assert resultado.falhas == []
    assert resultado.ok
    assert resultado.indice["conferencia"]["ok"] is True
    assert resultado.indice["conferencia"]["diferencas"] == []
    assert resultado.indice["exterior"]["secoes"] == 1351


def test_indice_gravado_igual_ao_resultado(rodada):
    resultado, op = rodada
    indice = json.loads((op.saida / "indice.json").read_text(encoding="utf-8"))
    assert indice == resultado.indice
    assert indice["geradoEm"] == "2026-10-06T12:00:00Z"
    assert re.fullmatch(r"[0-9a-f]{12}", indice["versao"])
    assert set(indice["ufs"]) == {"AC", "RR"}
    assert indice["esquema"] == 1 and indice["celulaGraus"] == 0.25


def test_todo_arquivo_e_json_canonico_e_sem_documento(rodada):
    _, op = rodada
    for caminho, texto in _publicados(op).items():
        assert publicar.json_canonico(json.loads(texto)) == texto, caminho
    assert conferir.documentos_na_saida(_publicados(op)) == []


def test_celulas_no_formato_do_contrato(rodada):
    resultado, op = rodada
    publicados = _publicados(op)
    regioes = []
    for caminho, texto in publicados.items():
        if caminho.startswith("celulas/"):
            lista = json.loads(texto)
            assert [r["id"] for r in lista] == sorted(r["id"] for r in lista)
            for r in lista:
                assert set(r) == CAMPOS_REGIAO and ID_REGIAO.match(r["id"]) and r["posicao"] in ("tse", "reserva")
                assert caminho == f"celulas/{publicar.chave_celula(r['lat'], r['lon'], 0.25)}.json"
            regioes += lista
    assert len(regioes) == resultado.indice["brasil"]["regioesNoMapa"]
    ufs = resultado.indice["ufs"].values()
    sem_posicao = sum(u["eleitoresSemPosicao"] for u in ufs)
    fora = sum(sum(u["eleitoresForaDoMapa"].values()) for u in ufs)
    assert sum(r["eleitores"] for r in regioes) + sem_posicao + fora == resultado.indice["brasil"]["aptos"]


def test_municipio_em_caixa_de_titulo(rodada):
    _, op = rodada
    regioes = [r for c, t in _publicados(op).items() if c.startswith("celulas/") for r in json.loads(t)]
    municipios = {r["municipio"] for r in regioes}
    assert "Boa Vista" in municipios and "Rio Branco" in municipios
    assert all(m != m.upper() for m in municipios)


def test_reclassificado_nao_aparece_em_nominais(rodada, candidatura):
    resultado, op = rodada
    for numero in candidatura.reclassificar_como_nulo:
        assert numero not in resultado.indice["brasil"]["nominais"]
        for caminho, texto in _publicados(op).items():
            if caminho.startswith("secoes/"):
                assert all(numero not in s["nominais"] for s in json.loads(texto)["secoes"].values())
            if caminho.startswith("celulas/"):
                assert all(numero not in (r["votos"] or {}).get("nominais", {}) for r in json.loads(texto))


def test_candidatos_vem_do_cadastro(rodada, candidatura):
    resultado, _ = rodada
    candidatos = resultado.indice["candidatos"]
    assert {candidatura.alvo.numero, candidatura.adversario.numero} <= set(candidatos)
    assert candidatos[candidatura.alvo.numero]["partido"] == candidatura.alvo.partido


def test_classificacao_soma_regioes_com_votos(rodada, candidatura):
    resultado, _ = rodada
    finalistas = (candidatura.alvo.numero, candidatura.adversario.numero)
    brasil = resultado.indice["brasil"]
    assert sum(brasil["classificacao"].values()) <= brasil["regioes"]
    assert set(brasil["viraveis"]) == {"abertos", "abertosMaisOutros"}
    assert brasil["viraveis"]["abertos"] <= brasil["viraveis"]["abertosMaisOutros"]
    assert brasil["ate"] == brasil["abstencao"] + brasil["brancos"] + brasil["nulos"] + sum(
        v for n, v in brasil["nominais"].items() if n not in finalistas)


def test_pontos_e_quadrados_coerentes(rodada):
    resultado, op = rodada
    publicados = _publicados(op)
    arquivos = sorted(c[len("pontos/"):-len(".json")] for c in publicados if c.startswith("pontos/") and "resumo" not in c)
    assert arquivos == resultado.indice["quadrados"]
    assert json.loads(publicados["pontos/resumo.json"])["escala"] == 20


def test_secoes_busca_e_cep(rodada):
    resultado, op = rodada
    publicados = _publicados(op)
    secoes = [c for c in publicados if c.startswith("secoes/")]
    assert secoes and max(len(publicados[c].encode()) for c in secoes) < 300_000
    assert sum(len(json.loads(publicados[c])["secoes"]) for c in secoes) == resultado.indice["brasil"]["secoes"]
    vista = json.loads(publicados["busca/vis.json"])  # "Boa Vista": palavra-chave mais longa é "vista"
    assert any(i["t"] == "m" and i["n"] == "Boa Vista" and i["uf"] == "RR" for i in vista)
    assert [i["e"] for i in vista] == sorted((i["e"] for i in vista), reverse=True)
    assert any(c.startswith("cep/") for c in publicados)


def test_duas_rodadas_mesma_versao(rodada, tmp_path, fixtures):
    resultado, _ = rodada
    outra = montar.executar(_opcoes(fixtures, tmp_path), agora=lambda: datetime(2027, 1, 1, tzinfo=UTC))
    assert outra.versao == resultado.versao


def test_total_diferente_do_oficial_nao_publica(tmp_path, fixtures):
    bruto = tmp_path / "bruto"
    shutil.copytree(fixtures / "bruto", bruto)
    caminho = bruto / "resultado" / "rr-c0001-e006257-u.json"
    oficial = json.loads(caminho.read_text(encoding="utf-8"))
    oficial["e"]["te"] = str(int(oficial["e"]["te"]) + 1)
    caminho.write_text(json.dumps(oficial), encoding="utf-8")
    op = _opcoes(fixtures, tmp_path, bruto)
    op.saida.mkdir(parents=True)
    (op.saida / "anterior.json").write_text("{}", encoding="utf-8")
    resultado = montar.executar(op, agora=AGORA)
    assert not resultado.ok
    assert any("RR.aptos" in f for f in resultado.falhas)
    assert resultado.indice["conferencia"]["ok"] is False
    assert [p.name for p in op.saida.iterdir()] == ["anterior.json"]
    assert (op.intermediario / "indice-reprovado-ac-rr.json").exists()
    assert (op.intermediario / "relatorio-ac-rr.json").exists()
    ok = montar.executar(_opcoes(fixtures, tmp_path), agora=AGORA)
    assert ok.ok and not (op.intermediario / "indice-reprovado-ac-rr.json").exists()
    assert json.loads((op.saida / "indice.json").read_text(encoding="utf-8"))["versao"] == ok.versao


def test_cli_rodada_de_uma_uf(tmp_path, fixtures):
    saida = tmp_path / "saida"
    codigo = montar.principal(["--sem-baixar", "--uf", "rr", "--saida", str(saida), "--bruto", str(fixtures / "bruto"),
                               "--intermediario", str(tmp_path / "inter")])
    assert codigo == 0
    indice = json.loads((saida / "indice.json").read_text(encoding="utf-8"))
    assert list(indice["ufs"]) == ["RR"]


def test_cli_sem_arquivos_sai_com_erro_de_entrada(tmp_path):
    codigo = montar.principal(["--sem-baixar", "--uf", "RR", "--saida", str(tmp_path / "s"), "--bruto", str(tmp_path),
                               "--intermediario", str(tmp_path / "inter")])
    assert codigo == montar.SAIDA_ENTRADA


# Locais reais do recorte de RR (cadastro do TSE, CD_TIPO_LOCAL 2 e 3): Boa Vista, zona 1, local 3794 (voto em
# trânsito, 4 seções) e Rorainópolis, zona 8, local 1236 (unidade prisional, 1 seção).
FORA_RR = {("03018", 1, 3794), ("03085", 8, 1236)}


def test_fora_do_mapa_contado_no_indice_por_uf_e_no_brasil(rodada):
    resultado, _ = rodada
    indice = resultado.indice
    assert indice["ufs"]["RR"]["eleitoresForaDoMapa"] == {"presoProvisorio": 32, "votoEmTransito": 1267}
    assert indice["ufs"]["AC"]["eleitoresForaDoMapa"] == {"presoProvisorio": 0, "votoEmTransito": 0}
    assert indice["brasil"]["eleitoresForaDoMapa"] == {"presoProvisorio": 32, "votoEmTransito": 1267}
    assert resultado.relatorio["foraDoMapa"]["votoEmTransito"] == {"locais": 1, "secoes": 4, "eleitores": 1267}


def test_fora_do_mapa_nao_aparece_em_celulas_busca_nem_cep(rodada):
    _, op = rodada
    publicados = _publicados(op)
    regioes = [r for c, t in publicados.items() if c.startswith("celulas/") for r in json.loads(t)]
    locais = {(r["mun"], loc["zona"], loc["nr"]) for r in regioes for loc in r["locais"]}
    assert not locais & FORA_RR
    itens = [i for c, t in publicados.items() if c.startswith("busca/") for i in json.loads(t)]
    assert not [i for i in itens if i["t"] == "l" and "Prisional" in i["n"]]
    assert any(i["t"] == "m" and i["n"] == "Rorainópolis" for i in itens)  # o município continua na busca


def test_fora_do_mapa_continua_nos_totais_e_nas_secoes(rodada):
    resultado, op = rodada
    secoes_rr = json.loads(_publicados(op)["secoes/rr/03085-0008.json"])["secoes"]
    assert "99" in secoes_rr  # seção da unidade prisional: fica no arquivo de seções e na soma do estado
    assert resultado.indice["conferencia"]["ok"] is True


def test_ponto_de_busca_e_de_cep_e_sempre_uma_regiao_publicada(rodada):
    # Município, bairro e CEP abrem o mapa na região medoide: sempre há local de votação no raio (CONTRATO §2.5/§2.6).
    _, op = rodada
    publicados = _publicados(op)
    regioes = {(r["lat"], r["lon"]) for c, t in publicados.items() if c.startswith("celulas/") for r in json.loads(t)}
    itens = [i for c, t in publicados.items() if c.startswith("busca/") for i in json.loads(t) if i["t"] != "l"]
    ceps = [v for c, t in publicados.items() if c.startswith("cep/") for v in json.loads(t).values()]
    assert itens and ceps
    assert all((i["lat"], i["lon"]) in regioes for i in itens + ceps)


def test_portao_ponto_de_busca_sem_regiao_no_raio():
    from types import SimpleNamespace

    proc = SimpleNamespace(regioes=[{"lat": -3.1, "lon": -60.0}])
    pontos = [("busca m:Manaus//AM", -3.1 + 1.61 / 111.2, -60.0), ("cep 69005000", -3.1, -60.0)]
    falhas = montar._sem_regiao_perto(proc, pontos, 1.0)
    assert len(falhas) == 1 and "1 pontos de busca/CEP" in falhas[0] and "Manaus" in falhas[0]
    assert montar._sem_regiao_perto(proc, pontos[1:], 1.0) == []
