"""Catálogo das fontes: URLs oficiais e nomes dos arquivos em dados/bruto/.

Os nomes dependem só do ano, do código da eleição e do cargo (config/candidatura.json).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from etl.config import RAIZ, Candidatura

CDN = "https://cdn.tse.jus.br/estatistica/sead/odsele/"
RESULTADOS = "https://resultados.tse.jus.br/oficial/"
URL_MALHA = (
    "https://servicodados.ibge.gov.br/api/v4/malhas/paises/BR"
    "?formato=application/vnd.geo%2Bjson&intrarregiao=municipio&qualidade=intermediaria"
)
URL_RESERVA = (
    "https://github.com/juliosaulo/como-meus-vizinhos-votam/blob/"
    "578d1bbce94986a2110b7b518993479dfeef1c0d/dados_importados/locais_votacao_2018_2022.parquet"
)
CAMINHO_RESERVA = RAIZ / "etl" / "terceiros" / "como_meus_vizinhos" / "locais_votacao_2018_2022.parquet"
NOME_MALHA = "malha_municipios.geojson"
PASTA_BRUTO = RAIZ / "dados" / "bruto"
PASTA_INTERMEDIARIO = RAIZ / "dados" / "intermediario"
PASTA_PUBLICA = RAIZ / "public" / "dados"

UFS = (
    "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA",
    "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
)
EXTERIOR = "ZZ"


@dataclass(frozen=True)
class Catalogo:
    ano: int
    codigo: str
    cargo: str

    @classmethod
    def da_config(cls, cfg: Candidatura) -> Catalogo:
        return cls(ano=cfg.eleicao.ano, codigo=cfg.eleicao.codigo, cargo=cfg.eleicao.cargo)

    # ── nomes locais (dados/bruto) ──
    @property
    def votacao(self) -> str:
        return f"votacao_secao_{self.ano}_BR.csv"

    @property
    def detalhe(self) -> str:
        return f"detalhe_votacao_secao_{self.ano}_BR.csv"

    def cadastro(self, uf: str) -> str:
        return f"eleitorado_local_votacao_{self.ano}_{uf}.csv"

    @property
    def candidatos(self) -> str:
        return f"consulta_cand_{self.ano}_BR.csv"

    def resultado(self, abrangencia: str) -> str:
        a = abrangencia.lower()
        return f"resultado/{a}-c{int(self.cargo):04d}-e{int(self.codigo):06d}-u.json"

    @property
    def municipios(self) -> str:
        return f"mun-e{int(self.codigo):06d}-cm.json"

    # ── URLs ──
    @property
    def url_zip_votacao(self) -> str:
        return f"{CDN}votacao_secao/votacao_secao_{self.ano}_BR.zip"

    @property
    def url_zip_detalhe(self) -> str:
        return f"{CDN}detalhe_votacao_secao/detalhe_votacao_secao_{self.ano}.zip"

    @property
    def url_zip_cadastro(self) -> str:
        return f"{CDN}eleitorado_locais_votacao/eleitorado_local_votacao_{self.ano}.zip"

    @property
    def url_zip_candidatos(self) -> str:
        return f"{CDN}consulta_cand/consulta_cand_{self.ano}.zip"

    def url_resultado(self, abrangencia: str) -> str:
        a = abrangencia.lower()
        nome = f"{a}-c{int(self.cargo):04d}-e{int(self.codigo):06d}-u.json"
        return f"{RESULTADOS}ele{self.ano}/{int(self.codigo)}/dados/{a}/{nome}"

    @property
    def url_municipios(self) -> str:
        return f"{RESULTADOS}ele{self.ano}/{int(self.codigo)}/config/{self.municipios}"

    @property
    def abrangencias_resultado(self) -> tuple[str, ...]:
        return ("BR", *UFS, EXTERIOR)


def caminho(pasta: Path, nome: str) -> Path:
    return pasta / nome
