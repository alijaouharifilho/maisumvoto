#!/usr/bin/env bash
# Lado do servidor do deploy. O deploy/publicar.sh copia este arquivo para
# $DEPLOY_DIR/bin/remoto.sh a cada publicação e chama os subcomandos por ssh:
#   remoto.sh <subcomando> <DEPLOY_DIR> [args]
#
# Layout no servidor:
#   releases/<versao-dados>-<git-sha>/   conteúdo do dist/ (nunca alterado depois de ativado)
#   releases/.<release>.parcial/         release em montagem; some no "finalizar"
#   current -> releases/<release>        raiz do nginx; trocado de forma atômica
#   publicacoes.log                      data, release, anterior, motivo de emergência (sem IP)
#
# Requer bash, GNU coreutils (cp -al, mv -T, readlink, stat), findutils, sha256sum e GNU
# tar. "verificar" testa tudo isso antes de qualquer mudança.
set -euo pipefail
shopt -s inherit_errexit

VERIF_TMP=""
trap '[ -z "$VERIF_TMP" ] || rm -rf "$VERIF_TMP"' EXIT

erro() { printf 'remoto: %s\n' "$*" >&2; exit 1; }

validar_dir() {
  [[ "$1" =~ ^/[A-Za-z0-9._/-]+$ && "$1" != *..* && "$1" != "/" ]] || erro "DEPLOY_DIR inválido: $1"
}

validar_release() {
  [[ "$1" =~ ^[0-9a-f]{12}-[0-9a-f]{7,40}$ ]] || erro "nome de release inválido: $1"
}

release_ativa() { # nome da release apontada por current (vazio se não houver)
  local alvo
  alvo="$(readlink "$1/current" 2>/dev/null || true)"
  printf '%s' "${alvo##*/}"
}

parcial() { printf '%s/releases/.%s.parcial' "$1" "$2"; }

cmd_verificar() {
  local t
  VERIF_TMP="$(mktemp -d)"
  t="$VERIF_TMP"
  mkdir -p "$t/a/sub" "$t/b" && printf 'x' > "$t/a/sub/f"
  cp -al "$t/a/." "$t/b/" || erro "cp -al não funciona"
  [ "$(stat -c %i "$t/a/sub/f")" = "$(stat -c %i "$t/b/sub/f")" ] || erro "cp -al não criou hardlink"
  # Como no envio real: o tar só leva arquivos (lista do manifesto), sem entradas de diretório.
  tar -cf - -C "$t/a" ./sub/f | tar -xf - -U -C "$t/b" || erro "GNU tar com -U não funciona"
  [ "$(stat -c %i "$t/a/sub/f")" != "$(stat -c %i "$t/b/sub/f")" ] || erro "tar -U escreveu no hardlink"
  ln -s a "$t/cur.novo" && mv -T "$t/cur.novo" "$t/cur" || erro "mv -T não funciona"
  [ "$(readlink "$t/cur")" = "a" ] || erro "readlink não funciona"
  sha256sum "$t/a/sub/f" >/dev/null || erro "sha256sum ausente"
  mkdir -p "$1" && [ -w "$1" ] || erro "sem permissão de escrita em $1"
  printf 'remoto: ferramentas ok\n'
}

cmd_estado() { release_ativa "$1"; printf '\n'; }

cmd_manifesto() { # sha256 de cada arquivo da release ativa (vazio na primeira publicação)
  cd "$1/current" 2>/dev/null || return 0
  find . -type f -print0 | sort -z | xargs -0 -r sha256sum
}

cmd_preparar() { # preparar <dir> <release> <rsync|tar>
  local dir="$1" rel="$2" modo="$3" p
  validar_release "$rel"
  [ ! -e "$dir/releases/$rel" ] || erro "a release $rel já existe (para reativá-la: --reverter $rel)"
  p="$(parcial "$dir" "$rel")"
  rm -rf -- "$p"
  mkdir -p "$p"
  # Modo tar: parte da release ativa em hardlinks e só recebe o que mudou.
  if [ "$modo" = "tar" ] && [ -d "$dir/current/" ]; then cp -al "$dir/current/." "$p/"; fi
  printf 'remoto: %s pronta para receber (%s)\n' "${p##*/}" "$modo"
}

cmd_remover() { # lê caminhos "./..." da entrada padrão e apaga da release parcial
  local p f n=0
  validar_release "$2"
  p="$(parcial "$1" "$2")"
  [ -d "$p" ] || erro "release parcial ausente"
  while IFS= read -r f; do
    [[ "$f" == ./* && "$f" != *..* ]] || erro "caminho recusado: $f"
    rm -f -- "$p/${f#./}"
    n=$((n + 1))
  done
  printf 'remoto: %d arquivo(s) removido(s)\n' "$n"
}

cmd_receber() { # tar pela entrada padrão; -U desfaz o hardlink antes de escrever, para não alterar a release ativa
  local p
  validar_release "$2"
  p="$(parcial "$1" "$2")"
  [ -d "$p" ] || erro "release parcial ausente"
  tar -xf - -U --no-same-owner -C "$p"
}

trazer_assets() { # assets da release ativa que não existem na nova: abas abertas continuam achando os chunks
  local ant="$1/current/assets" destino="$2/assets" f n=0
  [ -d "$ant" ] || { printf '0'; return 0; }
  while IFS= read -r -d '' f; do
    f="${f#./}"
    [ -e "$destino/$f" ] && continue
    mkdir -p "$(dirname "$destino/$f")"
    ln "$ant/$f" "$destino/$f"
    n=$((n + 1))
  done < <(cd "$ant" && find . -type f -print0)
  printf '%d' "$n"
}

cmd_finalizar() {
  local dir="$1" rel="$2" p n
  validar_release "$rel"
  p="$(parcial "$dir" "$rel")"
  [ -f "$p/index.html" ] || erro "release parcial sem index.html"
  n="$(trazer_assets "$dir" "$p")"
  find "$p" -mindepth 1 -type d -empty -delete
  chmod -R u=rwX,go=rX "$p"
  mv -T "$p" "$dir/releases/$rel"
  printf 'remoto: release %s montada (%s asset(s) da anterior mantidos)\n' "$rel" "$n"
}

cmd_ativar() { # ativar <dir> <release>; motivo (opcional) pela entrada padrão
  local dir="$1" rel="$2" anterior motivo
  validar_release "$rel"
  [ -f "$dir/releases/$rel/index.html" ] || erro "release $rel não existe ou está incompleta"
  anterior="$(release_ativa "$dir")"
  motivo="$(head -c 300 | tr -d '\r\n\t' || true)"
  ln -sfn "releases/$rel" "$dir/current.novo"
  mv -T "$dir/current.novo" "$dir/current"
  printf '%s\tativada=%s\tanterior=%s\tmotivo=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$rel" \
    "${anterior:--}" "${motivo:--}" >> "$dir/publicacoes.log"
  printf 'remoto: current -> releases/%s (anterior: %s)\n' "$rel" "${anterior:-nenhuma}"
}

cmd_podar() { # mantém a ativa e as N mais recentes além dela
  local dir="$1" manter="$2" ativa r
  [[ "$manter" =~ ^[0-9]+$ ]] || erro "quantidade inválida: $manter"
  ativa="$(release_ativa "$dir")"
  cd "$dir/releases"
  while IFS= read -r r; do
    validar_release "$r"
    rm -rf -- "$r"
    printf 'remoto: release antiga apagada: %s\n' "$r"
  done < <(ls -1t | grep -v '^\.' | grep -vxF "${ativa:-/}" | tail -n +"$((manter + 1))")
}

cmd_listar() {
  local dir="$1" ativa r
  ativa="$(release_ativa "$dir")"
  [ -d "$dir/releases" ] || { printf 'remoto: nenhuma release\n'; return 0; }
  while IFS= read -r r; do
    if [ "$r" = "$ativa" ]; then printf '* %s (ativa)\n' "$r"; else printf '  %s\n' "$r"; fi
  done < <(ls -1t "$dir/releases" | grep -v '^\.')
  [ -f "$dir/publicacoes.log" ] && { printf -- '--- últimas publicações:\n'; tail -n 5 "$dir/publicacoes.log"; }
  return 0
}

principal() {
  local sub="${1:-}" dir="${2:-}"
  [ -n "$sub" ] && [ -n "$dir" ] || erro "uso: remoto.sh <subcomando> <DEPLOY_DIR> [args]"
  validar_dir "$dir"
  shift 2
  case "$sub" in
    verificar|estado|manifesto|preparar|remover|receber|finalizar|ativar|podar|listar) "cmd_$sub" "$dir" "$@" ;;
    *) erro "subcomando desconhecido: $sub" ;;
  esac
}

principal "$@"
