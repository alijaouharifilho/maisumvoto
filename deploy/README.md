# Publicação: VPS no Brasil com nginx

Site 100% estático: `dist/` do Vite com `public/dados/` dentro (`dist/dados`), servido por
nginx numa VPS **no Brasil**, sem CDN estrangeira na frente. O mapa busca tiles, fontes e
sprites em `https://tiles.openfreemap.org` (está na CSP).

> Regras do período eleitoral: [`CONGELAMENTO.md`](CONGELAMENTO.md). Último deploy normal:
> **24/10, 20h**. Nada de 24/10, 22h até 26/10, 02h.

## Arquivos

| Arquivo | Para quê |
|---|---|
| `nginx.conf` | Server block completo: HTTPS, redirecionamentos, cabeçalhos de segurança, cache por caminho, pré-comprimidos, log sem IP, `limit_req` em `/dados/` |
| `nginx-brotli.conf` | `brotli_static on;`, só se o módulo brotli existir no servidor |
| `cabecalhos-seguranca.json` | Os mesmos cabeçalhos de segurança do `nginx.conf` (o teste exige igualdade); serve para o `vite preview` usar a mesma CSP no E2E |
| `publicar.sh` | Build, conferência, pré-compressão, envio incremental, troca atômica, poda e fumaça |
| `remoto.sh` | Lado do servidor do `publicar.sh` (copiado a cada publicação para `$DEPLOY_DIR/bin/`) |
| `congelamento.mjs` | Lê o calendário de `config/candidatura.json` e diz se pode publicar |
| `manifesto.mjs` | sha256 dos arquivos, para o envio incremental sem rsync |
| `validar-nginx.sh` | `nginx -t` e checagem funcional num container descartável |
| `testes/` | Testes (`node --test`), checagem funcional do nginx e teste ponta a ponta do deploy |

Ferramentas usadas aqui: `ferramentas/precomprimir.mjs` (gera `.br` e `.gz`) e
`ferramentas/conferir-dist.mjs` (barra `.map`, segredo, CPF, script inline etc.).

## Como fica no servidor

```
/srv/maisumvoto/                       ($DEPLOY_DIR, dono: usuário deploy)
├── bin/remoto.sh
├── releases/
│   ├── <versao-dados>-<git-sha>/      uma por publicação; arquivos iguais viram hardlink
│   └── ...                            ficam a ativa + as 2 anteriores
├── current -> releases/<...>          raiz do nginx; trocado com mv -T (atômico)
└── publicacoes.log                    data, release, anterior, motivo de emergência (sem IP)
```

Cada release nova recebe também os `assets/` da anterior que não existem nela: uma aba aberta
antes do deploy continua achando os chunks antigos. Eles acumulam ao longo da campanha
(poucos MB) e somem quando a release é podada.

## 1. Contratar o servidor

- Provedor estabelecido no Brasil, **datacenter no Brasil**, sem failover automático para fora
  (plano, item B1).
- Preço fixo com tráfego incluso. Domínio + servidor entram no teto de gastos do plano
  (item C3): **configure o alerta de gasto no painel do provedor** logo na contratação.
- Tamanho: 1 vCPU, 1 a 2 GB de RAM e 20 GB de disco bastam para arquivos estáticos (cada
  release tem algumas centenas de MB antes dos hardlinks). Medir no teste de carga (seção 9).
- DNS: registros `A` (e `AAAA`, se houver IPv6) de `maisumvoto.com.br` e
  `www.maisumvoto.com.br` para o IP da VPS.

## 2. Sistema (Ubuntu LTS)

Com o usuário administrativo que o provedor criar (não o root, se der):

```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y unattended-upgrades rsync
sudo dpkg-reconfigure -plow unattended-upgrades
sudo timedatectl set-timezone America/Sao_Paulo
```

O `remoto.sh` usa `cp -al`, `mv -T`, `readlink`, `stat`, GNU tar e `sha256sum`. Ele testa
tudo isso sozinho (subcomando `verificar`) antes de mexer em qualquer arquivo.

## 3. Usuário de deploy (sem senha, só chave)

Na sua máquina: `ssh-keygen -t ed25519 -C "deploy maisumvoto"`. No servidor:

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
echo "ssh-ed25519 AAAA... deploy maisumvoto" | sudo tee /home/deploy/.ssh/authorized_keys >/dev/null
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys && sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo install -d -m 755 -o deploy -g deploy /srv/maisumvoto
```

O `deploy` não tem sudo: só escreve em `/srv/maisumvoto`. O nginx (`www-data`) só lê.

SSH só com chave (`/etc/ssh/sshd_config.d/10-endurecer.conf`):

```
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
```

`sudo sshd -t && sudo systemctl reload ssh`. **Antes de fechar a sessão**, confirme num
segundo terminal que o seu usuário administrativo entra por chave.

## 4. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # 80 e 443; o perfil existe depois de instalar o nginx (seção 5)
sudo ufw enable
```

Se o provedor tiver firewall próprio, liberar só 22, 80 e 443 lá também.

## 5. nginx

```bash
sudo apt install -y nginx
nginx -v                                          # >= 1.25.1 por causa de "http2 on;"
apt-cache policy libnginx-mod-http-brotli-static  # há pacote nesta versão do Ubuntu?
sudo apt install -y libnginx-mod-http-brotli-static   # só se houver
```

- **nginx 1.24 (Ubuntu 24.04):** no `nginx.conf`, apague as linhas `http2 on;` e troque
  `listen 443 ssl;` por `listen 443 ssl http2;` (o cabeçalho do arquivo explica).
- **Sem pacote brotli:** tudo funciona só com `gzip_static`; não copie o `nginx-brotli.conf`.

Ajustes no `/etc/nginx/nginx.conf` (bloco `http`), porque o padrão do Ubuntu loga IP:

```nginx
access_log off;                          # no lugar de "access_log /var/log/nginx/access.log;"
error_log /var/log/nginx/error.log warn; # nível warn (o info traz IP de cliente)
```

Remova o site padrão (ele também quer ser `default_server`):
`sudo rm /etc/nginx/sites-enabled/default`.

Rotação de logs (`/etc/logrotate.d/nginx`): trocar `rotate 14` por `rotate 7` (diária: 7 dias,
prazo que a página de privacidade promete para o registro de erros). O log de acesso do site
não tem IP. O de erro, em `warn`, raramente tem: o `nginx.conf` recusa método que não é
GET/HEAD e pedido com corpo antes da checagem de tamanho (que logaria `client: <IP>`), mas
corpo chunked inválido e falhas de TLS em nível `crit` ainda trazem o IP. A privacidade diz
isso (src/conteudo/privacidade.md); se quiser zerar, mande o `error_log` para o syslog com
uma regra do rsyslog que troque `client: [^,]+` por `client: -`.

## 6. Certificado (certbot, webroot)

O `nginx.conf` aponta para certificados que ainda não existem, então a primeira emissão usa
um server só HTTP:

```bash
sudo apt install -y certbot
sudo install -d -m 755 /var/www/certbot
sudo tee /etc/nginx/conf.d/maisumvoto.conf >/dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name maisumvoto.com.br www.maisumvoto.com.br;
    location ^~ /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 404; }
}
EOF
sudo nginx -t && sudo systemctl reload nginx
sudo certbot certonly --webroot -w /var/www/certbot \
  -d maisumvoto.com.br -d www.maisumvoto.com.br \
  --email <e-mail do responsável> --no-eff-email --deploy-hook "systemctl reload nginx"
```

Depois, a configuração definitiva (copie os arquivos com `scp` para `/tmp` antes):

```bash
sudo install -m 644 /tmp/nginx.conf /etc/nginx/conf.d/maisumvoto.conf
sudo install -m 644 /tmp/nginx-brotli.conf /etc/nginx/snippets/maisumvoto-brotli.conf  # só com brotli
sudo nginx -t && sudo systemctl reload nginx
sudo certbot renew --dry-run   # a renovação usa o mesmo webroot, servido pelo server da porta 80
```

Se o domínio ou o `DEPLOY_DIR` forem outros, ajuste no `nginx.conf` (domínio: em todos os
`server_name`, `return 301` e caminhos do certificado; raiz: `root`). O teste
`deploy/testes/nginx-conf.test.mjs` falha se o domínio divergir de `config/candidatura.json`.

## 7. Publicar

Uma vez, na sua máquina: confira a impressão digital da chave do servidor (no console do
provedor) e só então aceite-a:

```bash
ssh-keyscan -t ed25519 <ip> | ssh-keygen -lf -   # compare com o console do provedor
ssh deploy@<ip> true                              # responde "yes" se a impressão bater
```

A cada publicação:

```bash
export DEPLOY_HOST=<ip ou nome> DEPLOY_USER=deploy DEPLOY_DIR=/srv/maisumvoto
npm run dados                    # gera public/dados (falha se os totais não baterem)
deploy/publicar.sh --simular     # tudo local: build, conferência, pré-compressão, nome da release
deploy/publicar.sh               # publica e roda a fumaça
deploy/publicar.sh --listar      # releases no servidor e últimas publicações
deploy/publicar.sh --reverter <release>
```

As variáveis ficam no ambiente, nunca no repositório (se quiser um arquivo, use um
`.env.deploy` local: o `.gitignore` já ignora `.env.*`). O script exige árvore git limpa
(o nome da release leva o sha do commit) e roda o portão `npm run checar:publicacao`.

**Windows.** O Git Bash não tem rsync; o script cai sozinho no modo `tar`: gera o sha256 de
cada arquivo, compara com a release ativa e envia por `tar | ssh` só o que mudou (o servidor
parte de uma cópia em hardlinks da release ativa). Alternativa: rodar `deploy/publicar.sh`
dentro do WSL, com `sudo apt install rsync` lá e a chave SSH no `~/.ssh` do WSL; aí o modo é
`rsync --link-dest` (força com `DEPLOY_MODO=rsync` ou `tar`).

A pré-compressão (`brotli` 11 + `gzip` 9) mediu 24 s para ~6,8 mil arquivos (100 MB de dados
sintéticos, máquina de 16 núcleos); rodar de novo sobre o mesmo `dist/` leva ~2 s (ela
confere o conteúdo e não refaz). Com os dados reais, o tempo muda com o tamanho.

## 8. Como validar a configuração

Local, sem servidor (precisa do Docker com a imagem `nginx:alpine` já baixada; o script não
baixa nada e não publica porta nenhuma no host):

```bash
node --test "deploy/testes/*.test.mjs"    # guarda estática do nginx.conf + ferramentas
deploy/validar-nginx.sh                   # nginx -t com certificado autoassinado temporário
deploy/validar-nginx.sh --funcional       # 39 checagens com curl dentro do container
deploy/testes/publicar-e2e.sh             # deploy ponta a ponta (modo tar) num container Debian
```

No servidor, depois de publicar:

```bash
sudo nginx -t
curl -sI https://maisumvoto.com.br/ | grep -iE 'content-security|strict-transport|cache-control'
curl -sI -H 'Accept-Encoding: br, gzip' https://maisumvoto.com.br/assets/<um>.js | grep -iE 'content-encoding|cache-control'
curl -sI https://maisumvoto.com.br/dados/nao-existe.json | grep -i cache-control   # no-store
curl -sI http://www.maisumvoto.com.br/x | grep -i location                         # https://maisumvoto.com.br/x
sudo tail -n 5 /var/log/nginx/maisumvoto.acesso.log                                # sem IP
```

Abrir o site no navegador com o console aberto: nenhum erro de CSP ao abrir o mapa, buscar,
abrir a Ficha e copiar o link.

## 9. Teste de carga leve

De **outra máquina** (não do servidor), por 30 s, por exemplo com
[`oha`](https://github.com/hatoo/oha):

```bash
oha -z 30s -c 50 -H 'Accept-Encoding: br, gzip' https://maisumvoto.com.br/
oha -z 30s -c 50 -H 'Accept-Encoding: br, gzip' https://maisumvoto.com.br/assets/<maior>.js
oha -z 20s -c 20 https://maisumvoto.com.br/dados/indice.json   # de um IP só, acima de ~40 req/s vem 429: é o limit_req
```

Durante o teste, no servidor: `htop` (CPU e memória) e o painel de tráfego do provedor. Anote
latência p95, CPU de pico e bytes por visita (aba Rede do navegador, primeira visita com o
mapa aberto). Bytes por visita × visitas esperadas tem de caber no tráfego do plano.

## 10. Depois da eleição (até 31/10)

Apagar os logs do nginx e as chaves de deploy que não forem mais usadas, e decidir com o
responsável se o site fica no ar como arquivo estático ou sai do ar (aí, cancelar o
servidor). O `publicacoes.log` não tem dado pessoal.

## Decisões (o porquê, para não re-litigar)

| Decisão | Por quê |
|---|---|
| Domínio canônico sem www | Link mais curto no WhatsApp; numa VPS não há limitação de CNAME no apex |
| HSTS 1 ano, `includeSubDomains`, sem preload | Preload é difícil de desfazer e o site é temporário |
| CSP sem `unsafe-inline` | O MapLibre só mexe em estilo via CSSOM e a doc dele pede só `worker-src 'self'` e `img-src data: blob:`; o `conferir-dist` barra script/estilo inline no HTML |
| `Cache-Control` por `map "$status:$uri"` e um único `add_header` | `add_header` numa location anula os do server; e 404 precisa de `no-store` |
| Sem fallback de SPA | Roteamento por hash; arquivo que não existe é 404 (sem HTML no lugar de JSON) |
| `limit_req` 40 r/s, rajada 200, por IP, só em `/dados/` | Barra abuso sem derrubar quem sai pelo mesmo IP no 4G (CGNAT); zona só em memória |
| Log de acesso sem IP, sem User-Agent, sem query | LGPD: o mínimo para medir carga e erro |
| Releases com hardlink + troca atômica + assets anteriores | Publicação incremental, reversão instantânea e abas abertas sem tela branca |
| Modo `tar` com manifesto sha256 | O Windows não tem rsync; envio continua incremental |
