"""Leitura dos CSVs do TSE: latin-1, ';', aspas, vírgula decimal e marcadores -1/#NULO#/#NE#."""

import io
import zipfile

import pytest

from etl import carregar_tse as c

CAB_DETALHE = ("DT_GERACAO;HH_GERACAO;CD_ELEICAO;SG_UF;CD_MUNICIPIO;NM_MUNICIPIO;NR_ZONA;NR_SECAO;CD_CARGO;QT_APTOS;"
               "QT_COMPARECIMENTO;QT_ABSTENCOES;QT_VOTOS_BRANCOS;QT_VOTOS_NULOS;NR_LOCAL_VOTACAO;ST_SECAO_INSTALADA")
CAB_VOTOS = "DT_GERACAO;HH_GERACAO;CD_ELEICAO;SG_UF;CD_MUNICIPIO;NR_ZONA;NR_SECAO;CD_CARGO;NR_VOTAVEL;QT_VOTOS"
CAB_CADASTRO = ("DT_GERACAO;HH_GERACAO;SG_UF;CD_MUNICIPIO;NM_MUNICIPIO;NR_ZONA;NR_SECAO;CD_TIPO_SECAO_AGREGADA;"
                "NR_LOCAL_VOTACAO;NM_LOCAL_VOTACAO;CD_TIPO_LOCAL;DS_TIPO_LOCAL;DS_ENDERECO;NM_BAIRRO;NR_CEP;NR_LATITUDE;NR_LONGITUDE;"
                "QT_ELEITOR_ELEICAO_FEDERAL")


def _gravar(caminho, cabecalho, linhas):
    texto = "\n".join([";".join(f'"{x}"' for x in cabecalho.split(";"))] + linhas) + "\n"
    caminho.write_bytes(texto.encode("latin-1"))
    return caminho


@pytest.fixture
def eleicao(candidatura):
    return candidatura.eleicao


def test_float_br():
    assert c.para_float_br("2,8292389") == pytest.approx(2.8292389)
    assert c.para_float_br(",9518967") == pytest.approx(0.9518967)
    assert c.para_float_br("-,5") == pytest.approx(-0.5)
    assert c.para_float_br("-1") is None
    assert c.para_float_br("-3") is None
    assert c.para_float_br("") is None
    assert c.para_float_br("#NULO#") is None
    assert c.para_float_br("abc") is None


def test_limpar_texto():
    assert c.limpar_texto("  ESCOLA   X ") == "ESCOLA X"
    assert c.limpar_texto("#NULO#") == ""
    assert c.limpar_texto("#NE") == ""
    assert c.limpar_texto(None) == ""


def test_localizar_csv_ou_zip(tmp_path):
    _gravar(tmp_path / "a.csv", "X", ['"1"'])
    assert c.localizar(tmp_path, "a.csv").entrada is None
    with zipfile.ZipFile(tmp_path / "b.zip", "w") as z:
        z.writestr("b.csv", '"X"\n"2"\n')
    origem = c.localizar(tmp_path, "b.csv")
    assert origem.entrada == "b.csv"
    with origem.abrir() as f:
        assert f.read().startswith(b'"X"')
    with pytest.raises(c.ErroEntrada):
        c.localizar(tmp_path, "nao.csv")


def test_ler_detalhe_filtra_eleicao_e_cargo(tmp_path, eleicao):
    linhas = [
        f'"05/10/2026";"10:15:16";{eleicao.codigo};"RR";3018;"BOA VISTA";1;7;{eleicao.cargo};259;200;59;3;4;-1;"Sim"',
        f'"05/10/2026";"10:15:16";{eleicao.codigo};"ZZ";29629;"X";1;3014;{eleicao.cargo};1;0;0;0;0;-1;"Não"',
        f'"05/10/2026";"10:15:16";9999;"RR";3018;"BOA VISTA";1;8;{eleicao.cargo};1;1;0;0;0;-1;"Sim"',
        f'"05/10/2026";"10:15:16";{eleicao.codigo};"RR";3018;"BOA VISTA";1;9;3;1;1;0;0;0;-1;"Sim"',
    ]
    origem = c.Origem(_gravar(tmp_path / "d.csv", CAB_DETALHE, linhas))
    df = c.ler_detalhe(origem, eleicao)
    assert len(df) == 2
    linha = df[df.uf == "RR"].iloc[0]
    assert (linha.mun, linha.zona, linha.secao, linha.aptos, linha.abstencao, linha.brancos, linha.nulos) == (
        "03018", 1, 7, 259, 59, 3, 4)
    assert bool(linha.instalada) is True
    assert bool(df[df.uf == "ZZ"].iloc[0].instalada) is False
    assert c.data_geracao(origem) == "05/10/2026 10:15:16"


def test_ler_detalhe_recusa_secao_duplicada(tmp_path, eleicao):
    linha = f'"05/10/2026";"10:15:16";{eleicao.codigo};"RR";3018;"B";1;7;{eleicao.cargo};9;9;0;0;0;-1;"Sim"'
    origem = c.Origem(_gravar(tmp_path / "d.csv", CAB_DETALHE, [linha, linha]))
    with pytest.raises(c.ErroEntrada):
        c.ler_detalhe(origem, eleicao)


def test_ler_votos_numero_com_dois_digitos(tmp_path, eleicao):
    linhas = [
        f'"05/10/2026";"09:50:34";{eleicao.codigo};"AC";1473;5;1;{eleicao.cargo};7;75',
        f'"05/10/2026";"09:50:34";{eleicao.codigo};"AC";1473;5;1;{eleicao.cargo};95;2',
        f'"05/10/2026";"09:50:34";{eleicao.codigo};"AC";1473;5;1;3;45;9',
    ]
    df = c.ler_votos(c.Origem(_gravar(tmp_path / "v.csv", CAB_VOTOS, linhas)), eleicao)
    assert list(df.numero) == ["07", "95"]
    assert list(df.votos) == [75, 2]
    assert df.iloc[0].mun == "01473"


def test_ler_cadastro_so_secoes_principais_e_coordenadas(tmp_path):
    linhas = [
        '"05/10/2026";"06:29:34";"RR";"03018";"BOA VISTA";1;7;1;1481;"ESCOLA  X ";1;"Convencional";"AV. Y, 1";'
        '"CANARINHO";"69306545";"2,8292389";"-60,6602466";257',
        '"05/10/2026";"06:29:34";"RR";"03018";"BOA VISTA";1;8;2;1481;"ESCOLA X";1;"Convencional";"AV. Y, 1";'
        '"CANARINHO";"69306545";"2,8292389";"-60,6602466";0',
        '"05/10/2026";"06:29:34";"RR";"03085";"RORAINOPOLIS";8;99;1;1000;"UNIDADE";3;"Preso provisório";"#NULO#";'
        '"#NULO#";"69373000";",9518967";"-1";32',
    ]
    df = c.ler_cadastro([c.Origem(_gravar(tmp_path / "e.csv", CAB_CADASTRO, linhas))])
    assert len(df) == 2
    primeira = df.iloc[0]
    assert (primeira.uf, primeira.mun, primeira.zona, primeira.secao, primeira.nr_local) == ("RR", "03018", 1, 7, 1481)
    assert primeira.nome == "ESCOLA X" and primeira.cep == "69306545" and primeira.eleitores == 257
    assert primeira.municipio == "BOA VISTA"
    assert primeira.lat == pytest.approx(2.8292389) and primeira.lon == pytest.approx(-60.6602466)
    segunda = df.iloc[1]
    assert segunda.bairro == "" and segunda.endereco == ""
    assert segunda.lat == pytest.approx(0.9518967)
    assert segunda.lon != segunda.lon  # NaN: sem coordenada
    assert (int(primeira.cd_tipo_local), primeira.tipo_local) == (1, "Convencional")
    assert (int(segunda.cd_tipo_local), segunda.tipo_local) == (3, "Preso provisório")


def test_ler_candidatos(tmp_path, eleicao):
    cab = "DT_GERACAO;HH_GERACAO;CD_ELEICAO;CD_CARGO;NR_CANDIDATO;NM_URNA_CANDIDATO;SG_PARTIDO"
    linhas = [
        f'"05/10/2026";"10:14:11";"{eleicao.codigo}";"{eleicao.cargo}";"70";"ESCRITOR FULANO";"AVANTE"',
        f'"05/10/2026";"10:14:11";"{eleicao.codigo}";"3";"45";"OUTRO";"PX"',
    ]
    cand = c.ler_candidatos(c.Origem(_gravar(tmp_path / "c.csv", cab, linhas)), eleicao)
    assert cand == {"70": {"nome": "ESCRITOR FULANO", "partido": "AVANTE"}}


def test_coluna_faltando_falha_alto(tmp_path, eleicao):
    origem = c.Origem(_gravar(tmp_path / "x.csv", "DT_GERACAO;HH_GERACAO;SG_UF", ['"a";"b";"RR"']))
    with pytest.raises(c.ErroEntrada):
        c.ler_detalhe(origem, eleicao)


def test_data_geracao_sem_linhas(tmp_path):
    assert c.data_geracao(c.Origem(_gravar(tmp_path / "x.csv", "DT_GERACAO;HH_GERACAO", []))) is None
    assert c.data_geracao(c.Origem(_gravar(tmp_path / "y.csv", "A;B", ['"1";"2"']))) is None


def test_zip_com_entrada_inexistente(tmp_path):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as z:
        z.writestr("outro.csv", "x")
    (tmp_path / "a.zip").write_bytes(buffer.getvalue())
    with pytest.raises(c.ErroEntrada):
        c.localizar(tmp_path, "a.csv")
