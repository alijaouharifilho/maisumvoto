#!/usr/bin/env bash
# Teste ponta a ponta do deploy/publicar.sh no modo tar (o do Windows), sem servidor real:
#   - "servidor" = container Debian descartável (--network none, GNU coreutils como no Ubuntu);
#   - "ssh" = script que repassa o comando por `docker exec -i`;
#   - projeto = cópia mínima em pasta temporária (git próprio, config com responsável de teste).
# Publica 3 versões, confere envio incremental, hardlinks, assets mantidos, poda, reversão e
# o log de publicações. Tudo é apagado no fim.
# Uso: deploy/testes/publicar-e2e.sh [imagem Debian/Ubuntu já baixada; padrão python:3.12-slim]
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
IMAGEM="${1:-python:3.12-slim}"
CONTAINER="muv-deploy-teste-$$"
DIR_REMOTO="/srv/maisumvoto"
TMP="$(mktemp -d)"
falhas=0

limpar() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap limpar EXIT

ok() { printf 'ok     %s\n' "$1"; }
falha() { printf 'FALHA  %s\n' "$1"; falhas=$((falhas + 1)); }
no_servidor() { MSYS_NO_PATHCONV=1 docker exec -i "$CONTAINER" bash -c "$1"; }
confere() { if no_servidor "$2" >/dev/null 2>&1; then ok "$1"; else falha "$1"; fi; }

montar_projeto() {
  local p="$TMP/projeto"
  mkdir -p "$p/deploy" "$p/ferramentas" "$p/config" "$p/public"
  cp "$RAIZ"/deploy/*.mjs "$RAIZ"/deploy/*.sh "$p/deploy/"
  cp "$RAIZ"/ferramentas/{precomprimir,conferir-dist,checar-publicacao}.mjs "$p/ferramentas/"
  node -e 'const fs=require("fs");const c=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
    c.site.responsavel={nome:"Pessoa de Teste",contato:"teste@example.invalid"};c.site.hospedagem="Provedor de Teste (Brasil)";
    fs.writeFileSync(process.argv[2],JSON.stringify(c,null,2))' \
    "$(cygpath -m "$RAIZ/config/candidatura.json" 2>/dev/null || echo "$RAIZ/config/candidatura.json")" \
    "$(cygpath -m "$p/config/candidatura.json" 2>/dev/null || echo "$p/config/candidatura.json")"
  # Citações: o conferidor real precisa do PDF e do Python; aqui o teste é a mecânica do deploy.
  printf '{"name":"t","private":true,"type":"module","scripts":{"checar:publicacao":"node ferramentas/checar-publicacao.mjs","conferir:citacoes":"node -e 0"}}' > "$p/package.json"
  mkdir -p "$p/src/conteudo"
  printf '# Aprovação (teste)\n\n- [x] tudo lido\n\nAprovado por: Pessoa de Teste  Data: 20/10/2026\n' > "$p/src/conteudo/APROVACAO.md"
  printf 'public/dados/\n' > "$p/.gitignore"
  (cd "$p" && git init -q && git config core.autocrlf false && git add -A && git -c user.email=t@t -c user.name=t commit -qm teste)
}

montar_dist() { # montar_dist <dir> <versao 12 hex> <sufixo do asset>
  local d="$1" i
  rm -rf "$d" && mkdir -p "$d/assets" "$d/dados/celulas" "$TMP/projeto/public/dados"
  printf '<!doctype html><script type="module" src="/assets/app-%s.js"></script>' "$3" > "$d/index.html"
  for ((i = 0; i < 60; i++)); do printf 'export const v%s = "%s";\n' "$i" "$3"; done > "$d/assets/app-$3.js"
  for ((i = 0; i < 40; i++)); do printf '{"id":%s,"nome":"local fixo"},' "$i"; done | sed 's/^/[/; s/,$/]/' > "$d/dados/celulas/fixa.json"
  printf '{"versao":"%s"}' "$2" > "$d/dados/celulas/muda.json"
  printf '{"esquema":1,"versao":"%s","conferencia":{"ok":true}}' "$2" > "$d/dados/indice.json"
  cp "$d/dados/indice.json" "$TMP/projeto/public/dados/indice.json"
}

publicar() { # publicar <dist> [args extras]
  local d="$1"; shift
  DEPLOY_HOST=servidor-teste DEPLOY_USER=deploy DEPLOY_DIR="$DIR_REMOTO" DEPLOY_MODO=tar \
    DEPLOY_SSH="$TMP/ssh-falso" MUV_CONTAINER="$CONTAINER" \
    bash "$TMP/projeto/deploy/publicar.sh" --dist "$d" --sem-fumaca "$@"
}

preparar_servidor() {
  cat > "$TMP/ssh-falso" <<'EOF'
#!/usr/bin/env bash
while [ $# -gt 0 ]; do case "$1" in -o|-p) shift 2 ;; -*) shift ;; *) break ;; esac; done
shift
MSYS_NO_PATHCONV=1 exec docker exec -i "$MUV_CONTAINER" bash -c "$*"
EOF
  chmod +x "$TMP/ssh-falso"
  docker image inspect "$IMAGEM" >/dev/null 2>&1 || { echo "imagem $IMAGEM não existe localmente"; exit 1; }
  docker run -d --rm --network none --name "$CONTAINER" "$IMAGEM" sleep 600 >/dev/null
}

ativa() { no_servidor "readlink $DIR_REMOTO/current"; }

principal() {
  preparar_servidor
  montar_projeto
  local sha
  sha="$(git -C "$TMP/projeto" rev-parse --short=12 HEAD)"

  printf '\n### publicação 1\n'
  montar_dist "$TMP/d1" aaaaaaaaaaa1 v1
  publicar "$TMP/d1"
  [ "$(ativa)" = "releases/aaaaaaaaaaa1-$sha" ] && ok "current aponta para a release 1" || falha "current após a 1"
  confere "release 1 tem .gz pré-comprimido" "test -f $DIR_REMOTO/current/assets/app-v1.js.gz"

  printf '\n### publicação 2 (dados e asset mudam)\n'
  montar_dist "$TMP/d2" aaaaaaaaaaa2 v2
  local saida
  saida="$(publicar "$TMP/d2" 2>&1)" || { printf '%s\n' "$saida"; falha "publicação 2"; }
  printf '%s\n' "$saida" | grep -E 'manifesto:|remoto:' || true
  grep -q 'manifesto: 6 para enviar' <<< "$saida" && ok "envio incremental: só os 6 arquivos alterados" || falha "envio incremental"
  local r1="$DIR_REMOTO/releases/aaaaaaaaaaa1-$sha" r2="$DIR_REMOTO/releases/aaaaaaaaaaa2-$sha"
  confere "arquivo igual vira hardlink (mesmo inode)" "[ \$(stat -c %i $r1/dados/celulas/fixa.json) = \$(stat -c %i $r2/dados/celulas/fixa.json) ]"
  confere "arquivo alterado não mexeu na release anterior" "grep -q aaaaaaaaaaa1 $r1/dados/celulas/muda.json"
  confere "asset da release anterior mantido na nova" "test -f $r2/assets/app-v1.js && test -f $r2/assets/app-v2.js"
  confere "permissões legíveis pelo nginx" "[ \$(stat -c %a $r2/index.html) = 644 ] && [ \$(stat -c %a $r2/assets) = 755 ]"
  confere "sem release parcial sobrando" "! ls -A $DIR_REMOTO/releases | grep -q parcial"

  printf '\n### mesma release de novo: não reenvia\n'
  saida="$(publicar "$TMP/d2" 2>&1)" || true
  grep -q 'já está no ar' <<< "$saida" && ok "republicar a ativa só confere" || falha "republicar a ativa"
  grep -q 'manifesto:' <<< "$saida" && falha "republicar a ativa reenviou arquivos" || ok "republicar a ativa não envia nada"

  printf '\n### publicações 3 e 4: poda mantém a ativa + 2 anteriores\n'
  montar_dist "$TMP/d3" aaaaaaaaaaa3 v3 && publicar "$TMP/d3" >/dev/null
  montar_dist "$TMP/d4" aaaaaaaaaaa4 v4 && publicar "$TMP/d4" >/dev/null
  confere "3 releases no servidor" "[ \$(ls -1 $DIR_REMOTO/releases | wc -l) = 3 ]"
  confere "a mais antiga foi podada" "! test -e $r1"

  printf '\n### reversão\n'
  publicar "$TMP/d4" --reverter "aaaaaaaaaaa3-$sha" >/dev/null
  [ "$(ativa)" = "releases/aaaaaaaaaaa3-$sha" ] && ok "--reverter reativa a release 3" || falha "--reverter"
  confere "log de publicações registra a reversão" "tail -n 1 $DIR_REMOTO/publicacoes.log | grep -q 'ativada=aaaaaaaaaaa3-$sha.*anterior=aaaaaaaaaaa4-$sha'"

  testar_recusas
  testar_congelamento
  printf '\n%s falha(s)\n' "$falhas"
  return "$falhas"
}

testar_recusas() {
  printf '\n### recusas\n'
  publicar "$TMP/d4" --reverter "nao-existe" >/dev/null 2>&1 && falha "nome inválido aceito" || ok "nome de release inválido recusado"
  DEPLOY_HOST=h DEPLOY_USER=u DEPLOY_DIR="/srv/../etc" bash "$TMP/projeto/deploy/publicar.sh" --listar >/dev/null 2>&1 &&
    falha "DEPLOY_DIR com .. aceito" || ok "DEPLOY_DIR com .. recusado"
}

calendario_relativo() { # calendario_relativo <horas até o fim da última fase aberta> <horas até o fim>
  local cfg="$TMP/projeto/config/candidatura.json"
  node -e 'const fs=require("fs");const [arq,a,b]=process.argv.slice(1);const c=JSON.parse(fs.readFileSync(arq,"utf8"));
    const em=(h)=>new Date(Date.now()+Number(h)*3600e3).toISOString();
    c.calendario.fases=[{id:"campanha",ate:em(a)},{id:"votacao",ate:em(b)},{id:"encerrada",ate:null}];
    c.calendario.fasesAbertas=["campanha"];fs.writeFileSync(arq,JSON.stringify(c,null,2))' \
    "$(cygpath -m "$cfg" 2>/dev/null || echo "$cfg")" "$1" "$2"
  (cd "$TMP/projeto" && git -c user.email=t@t -c user.name=t commit -qam "calendário $1 $2")
}

testar_congelamento() {
  local saida
  printf '\n### congelamento\n'
  montar_dist "$TMP/d5" aaaaaaaaaaa5 v5
  calendario_relativo -1 5
  saida="$(publicar "$TMP/d5" 2>&1)" && falha "publicou dentro do congelamento" || ok "congelado: publicação bloqueada"
  grep -q 'bloqueado pelo calendário' <<< "$saida" && ok "mensagem cita o calendário" || falha "mensagem do bloqueio"
  publicar "$TMP/d5" --forcar-emergencia >/dev/null 2>&1 < /dev/null &&
    falha "emergência sem motivo aceita" || ok "emergência exige MOTIVO_EMERGENCIA"
  MOTIVO_EMERGENCIA="teste de emergencia" publicar "$TMP/d5" --forcar-emergencia >/dev/null 2>&1 < /dev/null &&
    ok "emergência com motivo publica" || falha "emergência com motivo"
  confere "motivo registrado no log" "tail -n 1 $DIR_REMOTO/publicacoes.log | grep -q 'motivo=teste de emergencia'"
  calendario_relativo 1 5
  publicar "$TMP/d5" >/dev/null 2>&1 && falha "publicou na margem das 2 h" || ok "margem de 2 h antes do congelamento bloqueia"
  calendario_relativo -5 -1
  saida="$(publicar "$TMP/d5" 2>&1)" && ok "depois do fim do congelamento volta a publicar" || falha "pós-congelamento: $saida"
}

principal
