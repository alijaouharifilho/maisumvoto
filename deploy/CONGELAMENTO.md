# Congelamento de publicação no período eleitoral

> **Não é parecer jurídico.** Regras derivadas da Lei 9.504/1997 e da Res. TSE 23.610/2019, a partir de
> fontes primárias. Validar com advogado eleitoralista antes de publicar.

## Datas (horário de Brasília, `America/Sao_Paulo`)

| Quando | O que vale |
|---|---|
| até 19/10 | Congelamento de **funcionalidades**: daqui em diante só correções e dados. |
| 22/10 | Começa a reta final. Nenhum conteúdo sintético novo (imagem ou voz de candidato). |
| **24/10, 20h** | **Último deploy normal.** O `deploy/publicar.sh` bloqueia a partir daqui (margem de 2 h). |
| **24/10, 22h → 26/10, 02h** | **Congelamento: nenhum deploy.** Só incidente, com `--forcar-emergencia` (abaixo). |
| 25/10 | Dia da votação. O site mostra só o que já estava publicado; a tela estática do dia da votação entra sozinha pela fase do calendário (precisa estar no ar antes de 24/10, 20h). |
| 26/10, 02h | Fim do congelamento (cobre o fechamento das urnas nos fusos UTC-4 e UTC-5). |
| até 31/10 | Apagar logs, dados por aparelho e segredos; manter só agregados (ver `deploy/README.md`). |

**Na Vercel:** o build de produção (`ferramentas/build-vercel.mjs`, chamado pelo `vercel.json`) recusa publicar nas 2 h antes do congelamento e durante ele; o deployment anterior continua no ar. Emergência: criar a variável `CONGELAMENTO_IGNORAR=1` no projeto da Vercel, publicar e apagar a variável em seguida. Prévias (branches) não são bloqueadas.

**Fonte da verdade:** `config/candidatura.json` → `calendario`. O congelamento começa no fim
da última fase listada em `fasesAbertas` e termina no fim da última fase com data.
`deploy/congelamento.mjs` faz a conta e o `deploy/publicar.sh` chama duas vezes: no começo e
de novo logo antes de trocar o symlink (um build que atravessa as 20h é barrado).

| Saída de `node deploy/congelamento.mjs` | Significado | O script |
|---|---|---|
| 0 | livre | publica |
| 10 | margem (entre 20h e 22h de 24/10) | bloqueia |
| 11 | congelado | bloqueia |
| 1 | calendário ilegível ou inválido | bloqueia (falha fechada, nem `--forcar-emergencia` passa) |

## Por quê

- **Lei 9.504/97, art. 39, §5º, IV:** é crime, no dia da eleição, "a publicação de novos
  conteúdos" nas aplicações de internet do art. 57-B, podendo continuar no ar o que foi
  publicado antes. Ver também Res. TSE 23.610/2019, art. 87.
- O plano (item E2) fecha a janela de 24/10, 22h a 26/10, 02h: nesse período, só conteúdo já
  publicado, sem marcação, compartilhamento ou contadores.
- As 2 h de margem existem para dar tempo de rodar a fumaça e, se preciso, reverter **antes**
  das 22h.

## Durante o congelamento

**Pode:**
- Monitorar: abrir o site, ler `/var/log/nginx/maisumvoto.erro.log`, olhar CPU, disco e tráfego.
- Manter o serviço de pé **sem mudar o conteúdo**: `sudo systemctl restart nginx`, renovar o
  certificado (`sudo certbot renew`), liberar disco, reiniciar o servidor.
- Reverter para uma release que **já estava no ar antes das 22h de 24/10**
  (`deploy/publicar.sh --reverter <release> --forcar-emergencia`), porque é conteúdo
  publicado antes. Registrar o motivo.
- Cumprir ordem judicial ou notificação da Justiça Eleitoral (tirar conteúdo do ar), com
  `--forcar-emergencia` e registro.

**Não pode:**
- Deploy de código, dados, textos, imagens ou configuração que mude o que o visitante vê.
- Mudar o `nginx.conf` (exceto para conter um incidente de segurança), o DNS ou o domínio.
- Abrir marcação, compartilhamento ou contadores, ou publicar orientação para abordar
  eleitores em 25/10.
- Impulsionar ou anunciar qualquer coisa (vedado ao site em qualquer data).

**Emergência:** `MOTIVO_EMERGENCIA="..." deploy/publicar.sh --forcar-emergencia`
(em terminal interativo, ainda pede para digitar `EMERGENCIA`). O motivo vai para
`$DEPLOY_DIR/publicacoes.log` no servidor, com data e a release anterior, sem IP. Antes de
usar, conversar com o responsável pelo site (e, se houver dúvida, com o advogado).

## Checklist até 24/10, 20h

- [ ] Último deploy feito, com a tela do dia da votação já no ar e testada mudando a data no
      ambiente de preview.
- [ ] Fumaça ok: `deploy/publicar.sh` terminou em "publicado".
- [ ] Release de reserva conhecida: `deploy/publicar.sh --listar` (anotar o nome da anterior).
- [ ] Certificado válido até depois de 26/10 com folga: `sudo certbot certificates`.
- [ ] Disco com folga (`df -h`), logs rotacionando (`ls -la /var/log/nginx`).
- [ ] Alerta de gasto ligado no provedor; tráfego do mês dentro do plano.
- [ ] Contatos do plano de incidente preenchidos (abaixo).

## Plano de incidente

**Contatos** (preencher antes de 24/10; nada de senha aqui):
- Responsável pelo site: o de `config/candidatura.json` → `site.responsavel`.
- Suporte do provedor da VPS: canal e número do contrato guardados fora do repositório.
- Advogado eleitoralista: nome e contato combinados com o responsável.

**Passos, em qualquer incidente:**
1. **Registrar** a hora (Brasília), o sintoma e quem percebeu, num arquivo de incidente fora
   do repositório público. Guardar o registro por 5 anos (plano, item F5).
2. **Conter** sem publicar conteúdo novo (ver "Pode" acima).
3. **Comunicar** o responsável pelo site.
4. **Depois**, escrever o que aconteceu, a causa e o que muda.

| Incidente | O que fazer |
|---|---|
| Site fora do ar | `curl -I https://maisumvoto.com.br/`; no servidor, `sudo systemctl status nginx`, `sudo nginx -t`, `df -h`; `sudo systemctl restart nginx`. Se for o provedor, abrir chamado. |
| Página quebrada depois de um deploy | `deploy/publicar.sh --reverter <anterior>` (com `--forcar-emergencia` se estiver no congelamento). |
| Certificado expirado | `sudo certbot renew && sudo systemctl reload nginx`. |
| Tráfego anormal (ataque, robô) | O `limit_req` já limita `/dados/`. Se não bastar, apertar a taxa só durante o ataque e registrar; o firewall do provedor também ajuda. Não guardar IP em disco. |
| Conteúdo errado no ar | Antes de 24/10, 22h: corrigir e publicar. Durante o congelamento: só reverter para a release anterior, se ela estava certa; senão, consultar o advogado. |
| Ordem judicial ou notificação | Cumprir no prazo, com `--forcar-emergencia` se preciso, e guardar a ordem com o registro. |
| Vazamento ou acesso indevido (LGPD) | Isolar (trocar chaves SSH, revogar acessos), avaliar se há risco ou dano relevante aos titulares e, se houver, comunicar à ANPD e aos titulares em até 3 dias úteis (Res. CD/ANPD 15/2024; prazo em dobro para agente de pequeno porte, Res. CD/ANPD 2/2022, art. 14, II). |
