#!/bin/sh
# Roda DENTRO do container do deploy/validar-nginx.sh --funcional (sh do Alpine/busybox).
# Sobe o nginx, faz as requisições pelo loopback e sai com o número de falhas.
set -u
D="$1"
B="https://$D"
falhas=0

nginx || exit 1
sleep 1

cabecalhos() { # cabecalhos <url> [args do curl...]
  url="$1"; shift
  curl -sk --http1.1 -o /dev/null -D - --max-time 5 \
    --resolve "$D:443:127.0.0.1" --resolve "www.$D:443:127.0.0.1" --resolve "$D:80:127.0.0.1" \
    "$@" "$url" | tr -d '\r'
}

espera() { # espera <descrição> <url> <regex do cabeçalho> [args do curl...]
  desc="$1"; url="$2"; padrao="$3"; shift 3
  if cabecalhos "$url" "$@" | grep -qiE "$padrao"; then
    echo "ok     $desc"
  else
    echo "FALHA  $desc"; falhas=$((falhas + 1))
  fi
}

confere() { # confere <descrição> <comando...> (ok se o comando der sucesso)
  desc="$1"; shift
  if "$@" >/dev/null 2>&1; then echo "ok     $desc"; else echo "FALHA  $desc"; falhas=$((falhas + 1)); fi
}

# Página e cabeçalhos de segurança
espera "home 200" "$B/" '^HTTP/1.1 200'
espera "home Cache-Control no-cache" "$B/" '^cache-control: no-cache$'
espera "/index.html no-cache" "$B/index.html" '^cache-control: no-cache$'
espera "CSP" "$B/" "^content-security-policy: default-src 'self'; script-src 'self'; style-src 'self';"
espera "HSTS 1 ano sem preload" "$B/" '^strict-transport-security: max-age=31536000; includeSubDomains$'
espera "nosniff" "$B/" '^x-content-type-options: nosniff$'
espera "Referrer-Policy" "$B/" '^referrer-policy: strict-origin-when-cross-origin$'
espera "Permissions-Policy geolocation=(self)" "$B/" '^permissions-policy: geolocation=\(self\)'
espera "X-Frame-Options DENY" "$B/" '^x-frame-options: DENY$'
espera "server_tokens off" "$B/" '^server: nginx$'
espera "HTML em utf-8" "$B/" '^content-type: text/html; charset=utf-8$'

# Assets
espera "asset imutável" "$B/assets/app-teste.js" '^cache-control: public, max-age=31536000, immutable$'
espera "asset gzip pré-comprimido" "$B/assets/app-teste.js" '^content-encoding: gzip$' -H 'Accept-Encoding: gzip'
espera "asset Vary: Accept-Encoding" "$B/assets/app-teste.js" '^vary: accept-encoding$' -H 'Accept-Encoding: gzip'
espera "asset sem compressão se o cliente não pede" "$B/assets/app-teste.js" '^content-length: [0-9]+$'
espera ".mjs como JavaScript" "$B/assets/worker-teste.mjs" '^content-type: text/javascript'
espera "asset inexistente 404" "$B/assets/nao-existe.js" '^HTTP/1.1 404'
espera "asset inexistente no-store" "$B/assets/nao-existe.js" '^cache-control: no-store$'

# Dados
espera "índice 60 s" "$B/dados/indice.json" '^cache-control: public, max-age=60$'
espera "índice com ?v também 60 s" "$B/dados/indice.json?v=x" '^cache-control: public, max-age=60$'
espera "dados imutáveis" "$B/dados/celulas/1_2.json?v=a1b2c3d4e5f6" '^cache-control: public, max-age=31536000, immutable$'
espera "dados gzip" "$B/dados/celulas/1_2.json" '^content-encoding: gzip$' -H 'Accept-Encoding: br, gzip'
espera "JSON como application/json" "$B/dados/celulas/1_2.json" '^content-type: application/json'
espera "dados 404" "$B/dados/celulas/9_9.json" '^HTTP/1.1 404'
espera "dados 404 no-store" "$B/dados/celulas/9_9.json" '^cache-control: no-store$'
espera "404 também leva CSP" "$B/dados/celulas/9_9.json" '^content-security-policy: '
espera "estilo do mapa 5 min" "$B/mapa/estilo.json" '^cache-control: public, max-age=300$'
espera "MapLibre versionado imutável" "$B/mapa/maplibre-1.2.3/maplibre-gl.mjs" '^cache-control: public, max-age=31536000, immutable$'
espera "MapLibre .mjs como JavaScript" "$B/mapa/maplibre-1.2.3/maplibre-gl.mjs" '^content-type: text/javascript'
espera "MapLibre inexistente no-store" "$B/mapa/maplibre-1.2.3/nao-existe.mjs" '^cache-control: no-store$'

# Roteamento e redirecionamentos
espera "sem fallback de SPA" "$B/perto/qualquer" '^HTTP/1.1 404'
espera "diretório sem listagem" "$B/dados/" '^HTTP/1.1 404'
espera "arquivo oculto 404" "$B/.env" '^HTTP/1.1 404'
espera "www → apex" "https://www.$D/x?y=1" "^location: https://$D/x\\?y=1$"
espera "http → https" "http://$D/a?b=1" "^location: https://$D/a\\?b=1$"
espera "HTTP/2 negociado" "$B/" '^HTTP/2 200' --http2
confere "SNI desconhecido: handshake recusado" sh -c "! curl -sk --max-time 5 --resolve outro.test:443:127.0.0.1 https://outro.test/"
confere "Host desconhecido na 80: conexão fechada" sh -c "! curl -s --max-time 5 --resolve outro.test:80:127.0.0.1 http://outro.test/"

# limit_req: 400 pedidos simultâneos de um só IP em /dados/ têm de gerar algum 429
i=0
: > /tmp/urls.cfg
while [ $i -lt 400 ]; do
  printf 'url = "%s/dados/indice.json?i=%s"\noutput = "/dev/null"\n' "$B" "$i" >> /tmp/urls.cfg
  i=$((i + 1))
done
n429=$(curl -sk --parallel --parallel-max 100 --resolve "$D:443:127.0.0.1" -K /tmp/urls.cfg -w '%{http_code}\n' | grep -c '^429$' || true)
confere "limit_req devolve 429 sob rajada ($n429 de 400)" test "$n429" -gt 0

# Só GET/HEAD e sem corpo, recusados antes da checagem de tamanho (que logaria o IP do cliente)
espera "POST recusado com 405" "$B/" '^HTTP/1.1 405' -X POST --data x
espera "405 também leva CSP" "$B/" '^content-security-policy: ' -X POST --data x
espera "GET com corpo grande recusado com 400" "$B/" '^HTTP/1.1 400' -H 'Content-Length: 2000000'
espera "POST na porta 80 recusado com 405" "http://$D/" '^HTTP/1.1 405' -X POST --data x
curl -sk --max-time 5 --resolve "$D:443:127.0.0.1" -o /dev/null -X POST -H 'Content-Length: 2000000' "$B/" || true
curl -s --max-time 5 --resolve "$D:80:127.0.0.1" -o /dev/null -X POST -H 'Content-Length: 2000000' "http://$D/" || true

# Logs: esvazia o buffer (quit) e procura o IP do cliente
nginx -s quit
sleep 1
confere "log de acesso tem linhas" test -s /var/log/nginx/maisumvoto.acesso.log
confere "log de acesso sem IP" sh -c "! grep -q '127.0.0.1' /var/log/nginx/maisumvoto.acesso.log"
confere "log de erro sem IP (429 em info; corpo de 2 MB recusado antes)" sh -c "! grep -q '127.0.0.1' /var/log/nginx/maisumvoto.erro.log 2>/dev/null"
confere "log de erro geral sem IP (porta 80)" sh -c "! grep -q '127.0.0.1' /var/log/nginx/error.log 2>/dev/null"
echo "--- amostra do log de acesso:"
tail -n 3 /var/log/nginx/maisumvoto.acesso.log

echo "falhas: $falhas"
exit "$falhas"
