# Rodar o FinBot no Umbrel com Portainer e Telegram

Use este caminho para deixar o FinBot rodando no seu servidor, sem depender do seu PC e sem precisar de outro numero de WhatsApp.

## 1. Criar o bot no Telegram

1. Abra o Telegram.
2. Procure por `@BotFather`.
3. Envie `/newbot`.
4. Escolha um nome, por exemplo `FinBot`.
5. Escolha um username que termine com `bot`, por exemplo `meu_finbot_bot`.
6. Copie o token que o BotFather enviar.

O token tem um formato parecido com:

`123456789:AA...`

## 2. Atualizar a stack no Portainer

1. Abra o Portainer no Umbrel.
2. Va em **Stacks**.
3. Abra a stack `finbot`.
4. Use o repositorio:
   `https://github.com/ramosxzz/finbot.git`
5. Repository reference:
   `refs/heads/master`
6. Compose path:
   `docker-compose.yml`
7. Em **Environment variables**, adicione:
   - name: `TELEGRAM_BOT_TOKEN`
   - value: o token enviado pelo BotFather
   - name: `NVIDIA_API_KEY`
   - value: sua chave da NVIDIA
   - name: `NVIDIA_MODEL`
   - value: `meta/llama-3.1-8b-instruct`
8. Clique em **Update the stack**.

## 3. Usar

Abra o bot no Telegram e envie:

`/start`

Depois teste:

`gastei 50 de almoco`

Com a NVIDIA configurada, o bot tambem entende frases mais naturais, por exemplo:

- `caiu 2000 da solaire dia 06/05`
- `a raquel me pagou 150 ontem`
- `mercado deu 247,90 no cartao`
- `pix enviado para paola 10,17 uber`

Outros comandos:

- `ajuda`
- `resumo`
- `ultimos 5`
- `categorias`
- `relatorio`

## Importante

- Nao publique o token do Telegram em prints ou mensagens.
- O volume `finbot-storage` guarda o banco de gastos. Nao apague esse volume se nao quiser perder dados.
