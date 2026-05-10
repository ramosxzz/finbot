# FinBot no Render

Este projeto precisa rodar como um servico sempre ligado, porque o WhatsApp Web depende de uma sessao ativa.

## O que usar no Render

- Use **Blueprint** apontando para este repositorio, ou crie um **Web Service** com runtime Docker.
- Use plano **Starter** ou superior. O plano Free pode dormir depois de inatividade e nao serve bem para bot 24h.
- Mantenha o disco persistente em `/app/storage`, porque ali ficam:
  - sessao do WhatsApp: `/app/storage/.wwebjs_auth`
  - banco do FinBot: `/app/storage/data/finbot.db`

## Primeiro acesso

1. Faca o deploy no Render.
2. Abra a URL do servico, algo como `https://finbot.onrender.com`.
3. Acesse `https://finbot.onrender.com/qr`.
4. No WhatsApp, abra **Aparelhos conectados** e escaneie o QR.
5. Depois que conectar, mande `ajuda` para o numero do WhatsApp que foi conectado.

## Se pedir QR de novo

Confira se o disco persistente existe no servico e se esta montado em `/app/storage`.
Sem esse disco, o Render perde a sessao quando reinicia ou faz novo deploy.
