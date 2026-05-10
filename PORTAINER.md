# Rodar o FinBot no Umbrel com Portainer

Use este caminho para deixar o FinBot rodando no seu servidor, sem depender do seu PC.

## Pelo Portainer usando Git

1. Abra o Portainer no Umbrel.
2. Va em **Stacks**.
3. Clique em **Add stack**.
4. Nome da stack: `finbot`.
5. Escolha **Repository**.
6. Repository URL:
   `https://github.com/ramosxzz/finbot.git`
7. Branch: `master`
8. Compose path:
   `docker-compose.yml`
9. Clique em **Deploy the stack**.

## Primeiro acesso

Depois que subir, abra no navegador:

`http://IP_DO_SEU_UMBREL:3000/qr`

No WhatsApp, va em **Aparelhos conectados** e escaneie o QR Code.

Depois disso, mande `ajuda` para o numero conectado.

## Importante

- Nao exponha a porta `3000` publicamente na internet. Use apenas na rede local ou via VPN/Tailscale.
- O volume `finbot-storage` guarda a sessao do WhatsApp e o banco de gastos. Nao apague esse volume se nao quiser escanear o QR de novo e perder dados.
- Se trocar de servidor, faca backup do volume antes.
