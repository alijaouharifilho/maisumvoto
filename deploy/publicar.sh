#!/usr/bin/env bash
# Publica o site estático na VPS (passo a passo e setup do servidor em deploy/README.md).
#
#   build -> dados em dist/dados -> conferir-dist -> precomprimir -> envio incremental para
#   releases/<versao-dados>-<git-sha>/ -> assets da release anterior mantidos -> troca
#   atômica do symlink current -> poda (ativa + 2 anteriores) -> fumaça (curl -I).
#
# Uso:
#   deploy/publicar.sh                     publica (bloqueia no congelamento eleitoral)
#   deploy/publicar.sh --simular           faz tudo localmente e mostra o plano; não envia
#   deploy/publicar.sh --dist DIR          usa um dist já construído (pula o build)
#   deploy/publicar.sh --reverter RELEASE  reativa uma release que já está no servidor
#   deploy/publicar.sh --listar            lista as releases do servidor
#   deploy/publicar.sh --forcar-emergencia publica DURANTE o congelamento (exige
#                                          MOTIVO_EMERGENCIA, registrado no servidor)
#
# Ambiente (nunca neste arquivo): DEPLOY_HOST, DEPLOY_USER, DEPLOY_DIR (absoluto, ex.
# /srv/maisumvoto). Opcionais: DEPLOY_PORTA (22), DEPLOY_URL (https://<site.dominio>),
# DEPLOY_MODO (rsync|tar; padrão: rsync se existir), DEPLOY_SSH (cliente ssh), MOTIVO_EMERGENCIA.
set -euo pipefail
shopt -s inherit_errexit

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$RAIZ/dist"
MANTER_ANTERIORES=2
FORCAR=0 SIMULAR=0 SEM_BUILD=0 SEM_FUMACA=0 CONFIRMADO=0
ACAO="publicar" ALVO_REVERSAO=""
TMP=""
trap '[ -z "$TMP" ] || rm -rf "$TMP"' EXIT

erro() { printf '\nERRO: %s\n' "$*" >&2; exit 1; }
aviso() { printf 'AVISO: %s\n' "$*" >&2; }
passo() { printf '\n== %s\n' "$*"; }
nativo() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
ajuda() { awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "${BASH_SOURCE[0]}"; }

ler_argumentos() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --forcar-emergencia) FORCAR=1 ;;
      --simular) SIMULAR=1 ;;
      --dist) DIST="$(cd "${2:?--dist precisa de um diretório}" && pwd)"; SEM_BUILD=1; shift ;;
      --reverter) ACAO="reverter"; ALVO_REVERSAO="${2:?--reverter precisa do nome da release}"; shift ;;
      --listar) ACAO="listar" ;;
      --sem-fumaca) SEM_FUMACA=1 ;; # só para diagnóstico/teste do envio
      -h|--ajuda) ajuda; exit 0 ;;
      *) erro "argumento desconhecido: $1 (veja --ajuda)" ;;
    esac
    shift
  done
}

json() { # json <arquivo> <campo.campo>: lê um valor de um JSON
  node -e 'let v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));for(const k of process.argv[2].split("."))v=v?.[k];if(v==null)process.exit(3);process.stdout.write(String(v))' \
    "$(nativo "$1")" "$2"
}

confirmar_emergencia() {
  [ -n "${MOTIVO_EMERGENCIA:-}" ] || erro "--forcar-emergencia exige MOTIVO_EMERGENCIA=\"...\" (fica no publicacoes.log do servidor)"
  [ "$CONFIRMADO" = 1 ] && return 0
  if [ -t 0 ]; then
    local resposta
    read -r -p "Publicar DURANTE o congelamento eleitoral? Digite EMERGENCIA para seguir: " resposta
    [ "$resposta" = "EMERGENCIA" ] || erro "cancelado"
  fi
  CONFIRMADO=1
  aviso "publicação de emergência: $MOTIVO_EMERGENCIA"
}

checar_congelamento() {
  local codigo=0
  node "$RAIZ/deploy/congelamento.mjs" || codigo=$?
  case "$codigo" in
    0) return 0 ;;
    10|11)
      [ "$SIMULAR" = 1 ] && { aviso "simulação: um deploy real seria bloqueado agora"; return 0; }
      [ "$FORCAR" = 1 ] || erro "bloqueado pelo calendário (deploy/CONGELAMENTO.md). Só incidente: --forcar-emergencia"
      confirmar_emergencia ;;
    *) erro "calendário de config/candidatura.json ilegível; publicação bloqueada (falha fechada)" ;;
  esac
}

checar_ambiente() {
  local v
  for v in DEPLOY_HOST DEPLOY_USER DEPLOY_DIR; do
    [ -n "${!v:-}" ] || erro "defina $v no ambiente (ver deploy/README.md); nunca no arquivo"
  done
  [[ "$DEPLOY_DIR" =~ ^/[A-Za-z0-9._/-]+$ && "$DEPLOY_DIR" != *..* && "$DEPLOY_DIR" != "/" ]] ||
    erro "DEPLOY_DIR precisa ser um caminho absoluto simples (ex.: /srv/maisumvoto)"
  [[ "$DEPLOY_HOST$DEPLOY_USER" =~ ^[A-Za-z0-9._@:-]+$ ]] || erro "DEPLOY_HOST/DEPLOY_USER com caracteres inválidos"
  SSH=("${DEPLOY_SSH:-ssh}" -o BatchMode=yes -o ConnectTimeout=15 -p "${DEPLOY_PORTA:-22}")
}

checar_git() {
  local sujo
  sujo="$(git -C "$RAIZ" status --porcelain)"
  [ -z "$sujo" ] && return 0
  [ "$SIMULAR" = 1 ] && { aviso "árvore git com mudanças não commitadas"; return 0; }
  erro "há mudanças não commitadas; a release leva o sha do commit, então commite antes de publicar"
}

construir() {
  local codigo=0
  (cd "$RAIZ" && npm run --silent checar:publicacao) || codigo=$?
  if [ "$codigo" != 0 ]; then
    [ "$SIMULAR" = 1 ] && aviso "simulação: o portão checar:publicacao bloquearia" || erro "portão checar:publicacao falhou"
  fi
  # O Sobre promete: "Um programa confere cada trecho contra a página do PDF antes de publicar." É aqui.
  codigo=0
  (cd "$RAIZ" && npm run --silent conferir:citacoes) || codigo=$?
  if [ "$codigo" != 0 ]; then
    [ "$SIMULAR" = 1 ] && aviso "simulação: as citações do plano não conferem com o PDF" || erro "citações do plano não conferem com o PDF"
  fi
  if [ "$SEM_BUILD" = 0 ]; then (cd "$RAIZ" && npm run build); fi
  if [ ! -f "$DIST/dados/indice.json" ] && [ -d "$RAIZ/public/dados" ]; then
    aviso "o Vite não copiou public/dados; copiando para dist/dados"
    cp -R "$RAIZ/public/dados" "$DIST/dados"
  fi
  node "$RAIZ/ferramentas/conferir-dist.mjs" "$(nativo "$DIST")" || erro "dist reprovado (ver acima)"
  UV_THREADPOOL_SIZE="${UV_THREADPOOL_SIZE:-$(node -p 'require("os").availableParallelism()')}" \
    node "$RAIZ/ferramentas/precomprimir.mjs" "$(nativo "$DIST")"
}

nome_release() {
  local versao sha
  versao="$(json "$DIST/dados/indice.json" versao)" || erro "dist/dados/indice.json sem versao"
  sha="$(git -C "$RAIZ" rev-parse --short=12 HEAD)"
  [[ "$versao" =~ ^[0-9a-f]{12}$ ]] || erro "versao dos dados fora do formato: $versao"
  RELEASE="$versao-$sha"
}

remoto() { "${SSH[@]}" "$DEPLOY_USER@$DEPLOY_HOST" "$@"; }
rs() { local sub="$1"; shift; remoto "bash '$DEPLOY_DIR/bin/remoto.sh' $sub '$DEPLOY_DIR' $*"; }

instalar_remoto() {
  # tr -d '\r': no Windows (core.autocrlf) o arquivo pode estar com CRLF, que o bash do servidor não aceita.
  tr -d '\r' < "$RAIZ/deploy/remoto.sh" | remoto "mkdir -p '$DEPLOY_DIR/bin' && cat > '$DEPLOY_DIR/bin/remoto.sh'"
  rs verificar < /dev/null
}

enviar_rsync() { # enviar_rsync <release ativa ou vazio>
  # -c compara por conteúdo (o build regrava as datas); arquivo igual à release ativa vira hardlink.
  local base=()
  [ -z "$1" ] || base=(--link-dest="$DEPLOY_DIR/releases/$1/")
  rsync -rlpc --chmod=D755,F644 --info=stats1 "${base[@]}" \
    -e "${SSH[*]}" "$DIST/" "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_DIR/releases/.$RELEASE.parcial/"
}

enviar_tar() {
  # Sem rsync (Git Bash no Windows): compara sha256 com a release ativa e manda só o que mudou.
  TMP="$(mktemp -d)"
  node "$RAIZ/deploy/manifesto.mjs" gerar "$(nativo "$DIST")" > "$TMP/local.sha256"
  rs manifesto < /dev/null > "$TMP/remoto.sha256"
  node "$RAIZ/deploy/manifesto.mjs" diferenca "$(nativo "$TMP/local.sha256")" "$(nativo "$TMP/remoto.sha256")" \
    "$(nativo "$TMP/enviar.txt")" "$(nativo "$TMP/remover.txt")"
  rs remover "$RELEASE" < "$TMP/remover.txt"
  (cd "$DIST" && tar -cf - -T "$TMP/enviar.txt") | rs receber "$RELEASE"
}

enviar() { # enviar <release ativa ou vazio>
  local modo="${DEPLOY_MODO:-}"
  if [ -z "$modo" ]; then if command -v rsync >/dev/null 2>&1; then modo=rsync; else modo=tar; fi; fi
  [ "$modo" = rsync ] || [ "$modo" = tar ] || erro "DEPLOY_MODO deve ser rsync ou tar"
  passo "envio incremental ($modo) para releases/$RELEASE"
  rs preparar "$RELEASE" "$modo" < /dev/null
  if [ "$modo" = rsync ]; then enviar_rsync "$1"; else enviar_tar; fi
  rs finalizar "$RELEASE" < /dev/null
}

ativar() { # ativar <release>
  checar_congelamento
  passo "troca atômica: current -> releases/$1"
  printf '%s' "${MOTIVO_EMERGENCIA:-}" | rs ativar "$1"
}

checar_url() { # checar_url <url> <regex de cabeçalho>...
  local url="$1" cab p
  shift
  cab="$(curl -sS -I --max-time 20 -H 'Accept-Encoding: br, gzip' "$url" | tr -d '\r')" || { aviso "sem resposta: $url"; return 1; }
  grep -qE '^HTTP/[0-9.]+ 200' <<< "$cab" || { aviso "não respondeu 200: $url"; return 1; }
  for p in "$@"; do grep -qiE "^$p" <<< "$cab" || { aviso "$url sem o cabeçalho esperado: $p"; return 1; }; done
  printf 'ok  %s\n' "$url"
}

fumaca() { # fumaca <release anterior, para a dica de reversão>
  [ "$SEM_FUMACA" = 1 ] && { aviso "fumaça pulada (--sem-fumaca)"; return 0; }
  local base asset falhou=0
  base="${DEPLOY_URL:-https://$(json "$RAIZ/config/candidatura.json" site.dominio)}"
  passo "fumaça em $base"
  checar_url "$base/" 'cache-control: no-cache' 'content-security-policy: ' 'strict-transport-security: ' || falhou=1
  checar_url "$base/dados/indice.json" 'cache-control: public, max-age=60' || falhou=1
  asset="$(cd "$DIST/assets" 2>/dev/null && ls -1 -- *.js.gz 2>/dev/null | head -n 1 || true)"
  if [ -n "$asset" ] && [ "$ACAO" = publicar ]; then
    checar_url "$base/assets/${asset%.gz}" 'cache-control: public, max-age=31536000, immutable' 'content-encoding: (br|gzip)' || falhou=1
  fi
  [ "$falhou" = 0 ] && return 0
  erro "fumaça falhou. Para voltar: deploy/publicar.sh --reverter ${1:-<release>} (ver deploy/CONGELAMENTO.md)"
}

publicar() {
  passo "calendário"
  checar_congelamento
  [ "$SIMULAR" = 1 ] || checar_ambiente
  checar_git
  passo "build e conferência"
  construir
  nome_release
  if [ "$SIMULAR" = 1 ]; then
    passo "simulação: publicaria releases/$RELEASE em ${DEPLOY_DIR:-<DEPLOY_DIR>} (nada foi enviado)"
    return 0
  fi
  passo "servidor $DEPLOY_HOST"
  instalar_remoto
  local anterior
  anterior="$(rs estado < /dev/null)"
  [[ -z "$anterior" || "$anterior" =~ ^[0-9a-f]{12}-[0-9a-f]{7,40}$ ]] || erro "release ativa com nome inesperado: $anterior"
  if [ "$anterior" = "$RELEASE" ]; then
    printf 'A release %s já está no ar; só conferindo.\n' "$RELEASE"
  else
    enviar "$anterior"
    ativar "$RELEASE"
    rs podar "$MANTER_ANTERIORES" < /dev/null
  fi
  fumaca "$anterior"
  passo "publicado: $RELEASE"
}

principal() {
  ler_argumentos "$@"
  case "$ACAO" in
    publicar) publicar ;;
    listar) checar_ambiente; instalar_remoto; rs listar < /dev/null ;;
    reverter)
      [[ "$ALVO_REVERSAO" =~ ^[0-9a-f]{12}-[0-9a-f]{7,40}$ ]] || erro "nome de release inválido: $ALVO_REVERSAO"
      checar_ambiente
      instalar_remoto
      local anterior
      anterior="$(rs estado < /dev/null)"
      ativar "$ALVO_REVERSAO"
      fumaca "$anterior" ;;
  esac
}

principal "$@"
