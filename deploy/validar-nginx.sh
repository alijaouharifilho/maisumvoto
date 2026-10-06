#!/usr/bin/env bash
# Valida deploy/nginx.conf num nginx de verdade, dentro de um container descartável.
#   1. `nginx -t` com um certificado autoassinado gerado na hora (pasta temporária, apagada
#      no fim);
#   2. com --funcional: roda o nginx DENTRO do container (--network none, nenhuma porta
#      publicada no host), serve um dist de teste pré-comprimido e confere com curl lá dentro
#      cabeçalhos, cache, compressão, 404, redirecionamentos, limit_req e log sem IP.
#
# Uso: deploy/validar-nginx.sh [--funcional] [--imagem nginx:alpine]
# Requer: docker, node, openssl. Não baixa imagem: use uma que já exista localmente.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONF="$RAIZ/deploy/nginx.conf"
IMAGEM="nginx:alpine"
FUNCIONAL=0

erro() { printf 'ERRO: %s\n' "$*" >&2; exit 1; }

# Docker Desktop e o openssl do Git Bash são binários Windows: precisam de C:/... e não de /tmp/...
nativo() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
ajuda() { awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "${BASH_SOURCE[0]}"; }

ler_argumentos() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --funcional) FUNCIONAL=1 ;;
      --imagem) IMAGEM="${2:?--imagem precisa de um valor}"; shift ;;
      -h|--ajuda) ajuda; exit 0 ;;
      *) erro "argumento desconhecido: $1" ;;
    esac
    shift
  done
}

dominio() {
  node -e 'const c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(c.site.dominio)' \
    "$(nativo "$RAIZ/config/candidatura.json")"
}

gerar_certificado() {
  local destino="$1" dom="$2"
  mkdir -p "$destino"
  MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=$dom" \
    -addext "subjectAltName=DNS:$dom,DNS:www.$dom" \
    -keyout "$(nativo "$destino/privkey.pem")" -out "$(nativo "$destino/fullchain.pem")" 2>/dev/null
}

texto_repetido() { # linhas do texto $2 repetidas $1 vezes (para passar de 1 KB)
  local i
  for ((i = 0; i < $1; i++)); do printf '%s\n' "$2"; done
}

gerar_dist_teste() {
  local d="$1"
  mkdir -p "$d/assets" "$d/dados/celulas" "$d/mapa/maplibre-1.2.3"
  { printf '<!doctype html><html lang="pt-BR"><head><title>teste</title>'
    printf '<script type="module" src="/assets/app-teste.js"></script></head><body>\n'
    texto_repetido 60 '<p>conteúdo de teste para passar de 1 KB</p>'
    printf '</body></html>\n'; } > "$d/index.html"
  texto_repetido 80 'export const linha = "conteúdo de teste";' > "$d/assets/app-teste.js"
  texto_repetido 80 'self.onmessage = () => {};' > "$d/assets/worker-teste.mjs"
  printf '{"esquema":1,"versao":"a1b2c3d4e5f6","conferencia":{"ok":true}}' > "$d/dados/indice.json"
  { printf '['; texto_repetido 80 '{"id":"pr-75353-0001-1015","eleitores":100},'; printf '{}]'; } > "$d/dados/celulas/1_2.json"
  printf '{"version":8,"sources":{},"layers":[]}' > "$d/mapa/estilo.json"
  texto_repetido 80 'export const mapa = "biblioteca de teste";' > "$d/mapa/maplibre-1.2.3/maplibre-gl.mjs"
  node "$(nativo "$RAIZ/ferramentas/precomprimir.mjs")" "$(nativo "$d")"
}

rodar_container() { # rodar_container <certs> [args extras do docker] -- <comando...>
  local certs="$1"; shift
  local extras=()
  while [ "$1" != "--" ]; do extras+=("$1"); shift; done
  shift
  MSYS_NO_PATHCONV=1 docker run --rm --network none \
    -v "$(nativo "$CONF"):/etc/nginx/conf.d/default.conf:ro" \
    -v "$(nativo "$certs"):/etc/letsencrypt/live/$DOMINIO:ro" \
    "${extras[@]}" "$IMAGEM" "$@"
}

principal() {
  ler_argumentos "$@"
  command -v docker >/dev/null || erro "docker não encontrado"
  docker image inspect "$IMAGEM" >/dev/null 2>&1 || erro "imagem $IMAGEM não existe localmente (não vou baixar)"
  DOMINIO="$(dominio)"
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  gerar_certificado "$TMP/certs" "$DOMINIO"

  printf '== nginx -t (%s)\n' "$IMAGEM"
  rodar_container "$TMP/certs" -- nginx -t
  [ "$FUNCIONAL" = 1 ] || return 0

  printf '\n== checagem funcional (nginx dentro do container, sem rede)\n'
  gerar_dist_teste "$TMP/dist"
  rodar_container "$TMP/certs" \
    -v "$(nativo "$TMP/dist"):/srv/maisumvoto/current:ro" \
    -v "$(nativo "$RAIZ/deploy/testes/nginx-funcional.sh"):/teste/checar.sh:ro" \
    -- sh /teste/checar.sh "$DOMINIO"
}

principal "$@"
