# Congelamento de publicação no período eleitoral

> **Não é parecer jurídico.** Regras derivadas da Lei 9.504/1997 e da Res. TSE 23.610/2019, a partir de
> fontes primárias. Validar com advogado eleitoralista.

## Datas (horário de Brasília, `America/Sao_Paulo`)

| Quando | O que vale |
|---|---|
| até 19/10 | Congelamento de **funcionalidades**: daqui em diante só correções e dados. |
| 22/10 | Começa a reta final. Nenhum conteúdo sintético novo (imagem ou voz de candidato). |
| **24/10, 20h** | **Último deploy normal.** A trava do build de produção recusa a partir daqui (margem de 2 h). |
| **24/10, 22h → 26/10, 02h** | **Congelamento: nenhum deploy.** Só incidente (abaixo). |
| 25/10 | Dia da votação. O site mostra só o que já estava publicado; a tela estática do dia da votação entra sozinha pela fase do calendário (precisa estar no ar antes de 24/10, 20h). |
| 26/10, 02h | Fim do congelamento (cobre o fechamento das urnas nos fusos UTC-4 e UTC-5). |
| até 31/10 | Apagar o que estiver sob nosso controle, como promete o aviso de privacidade (`src/conteudo/privacidade.md`). |

## Como a trava funciona

O build de produção na Vercel (`ferramentas/build-vercel.mjs`, chamado pelo `vercel.json`) recusa publicar nas 2 h
antes do congelamento e durante ele; o deployment anterior continua no ar. Prévias (branches) não são bloqueadas.

**Fonte da verdade:** `config/candidatura.json` → `calendario`. O congelamento começa no fim da última fase listada
em `fasesAbertas` e termina no fim da última fase com data. `deploy/congelamento.mjs` faz a conta; calendário
ilegível ou inválido bloqueia (falha fechada).

## Por quê

- **Lei 9.504/97, art. 39, §5º, IV:** é crime, no dia da eleição, "a publicação de novos
  conteúdos" nas aplicações de internet do art. 57-B, podendo continuar no ar o que foi
  publicado antes. Ver também Res. TSE 23.610/2019, art. 87.
- O plano (item E2) fecha a janela de 24/10, 22h a 26/10, 02h: nesse período, só conteúdo já
  publicado, sem marcação, compartilhamento ou contadores.
- As 2 h de margem existem para dar tempo de conferir o site no ar e, se preciso, reverter **antes**
  das 22h.

## Durante o congelamento

**Pode:**
- Monitorar: abrir o site e acompanhar o painel da Vercel (deployments, uso e erros).
- Voltar para um deployment que **já estava no ar antes das 22h de 24/10** (Vercel → Deployments →
  *Instant Rollback*), porque é conteúdo publicado antes. Registrar o motivo.
- Cumprir ordem judicial ou notificação da Justiça Eleitoral (tirar conteúdo do ar), com registro.

**Não pode:**
- Deploy de código, dados, textos, imagens ou configuração que mude o que o visitante vê.
- Mudar o domínio ou o DNS.
- Abrir marcação, compartilhamento ou contadores, ou publicar orientação para abordar
  eleitores em 25/10.
- Impulsionar ou anunciar qualquer coisa (vedado ao site em qualquer data).

**Emergência:** criar a variável `CONGELAMENTO_IGNORAR=1` no projeto da Vercel, publicar e apagar a variável em
seguida. Antes de usar, conversar com o responsável pelo site (e, se houver dúvida, com o advogado) e registrar o
motivo.

## Checklist até 24/10, 20h

- [ ] Último deploy feito, com a tela do dia da votação já no ar e testada mudando a data numa prévia.
- [ ] Deployment de reserva conhecido: anotar, no painel da Vercel, o anterior que estava certo.
- [ ] Limite de gasto ligado na Vercel; uso do mês dentro do plano.
- [ ] Contatos do plano de incidente preenchidos (abaixo).

## Plano de incidente

**Contatos** (preencher antes de 24/10; nada de senha aqui):
- Responsável pelo site: o de `config/candidatura.json` → `site.responsavel`.
- Suporte da Vercel: pelo painel da conta.
- Advogado eleitoralista: nome e contato combinados com o responsável.

**Passos, em qualquer incidente:**
1. **Registrar** a hora (Brasília), o sintoma e quem percebeu, num arquivo de incidente fora
   do repositório público. Guardar o registro por 5 anos (plano, item F5).
2. **Conter** sem publicar conteúdo novo (ver "Pode" acima).
3. **Comunicar** o responsável pelo site.
4. **Depois**, escrever o que aconteceu, a causa e o que muda.

| Incidente | O que fazer |
|---|---|
| Site fora do ar | Abrir o site e a página de status da Vercel (https://www.vercel-status.com). Se for a Vercel, aguardar ou abrir chamado. |
| Página quebrada depois de um deploy | *Instant Rollback* para o deployment anterior (no congelamento, só para um que já estava no ar antes de 24/10, 22h). |
| Tráfego anormal (ataque, robô) | Ligar o *Attack Challenge Mode* no painel da Vercel enquanto durar e registrar. Não guardar IP. |
| Conteúdo errado no ar | Antes de 24/10, 22h: corrigir e publicar. Durante o congelamento: só voltar para um deployment anterior, se ele estava certo; senão, consultar o advogado. |
| Ordem judicial ou notificação | Cumprir no prazo e guardar a ordem com o registro. |
| Vazamento ou acesso indevido (LGPD) | Isolar (trocar senhas e tokens da Vercel e do GitHub, revogar acessos), avaliar se há risco ou dano relevante aos titulares e, se houver, comunicar à ANPD e aos titulares em até 3 dias úteis (Res. CD/ANPD 15/2024; prazo em dobro para agente de pequeno porte, Res. CD/ANPD 2/2022, art. 14, II). |
