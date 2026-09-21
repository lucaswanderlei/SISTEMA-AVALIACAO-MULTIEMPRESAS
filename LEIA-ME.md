# Onboarding guiado + Conta de demonstração — patch

Este pacote contém os arquivos novos/alterados para duas funcionalidades:

## Arquivos

- `demo-seed.ts` (raiz) — **NOVO**: gera avaliações fictícias realistas.
- `server.ts` (raiz) — rotas novas para gerar/remover os dados fictícios.
- `src/types.ts` — campo `isDemoData` adicionado ao tipo `Review`.
- `src/components/OnboardingChecklist.tsx` — **NOVO**: checklist de primeiros passos.
- `src/components/ManagerDashboard.tsx` — mostra o checklist na aba "Métricas".
- `src/components/SuperAdmin.tsx` — botões "Gerar demo" / "Limpar demo" por empresa.

## 1) Onboarding guiado para primeiro uso

Quando o dono/gerente entra no painel (aba "Métricas"), aparece um cartão
"Primeiros passos" com 5 itens, marcados automaticamente conforme o uso real
(não é preciso marcar manualmente):

1. Personalizar a empresa (logo) → checado quando `settings.logoUrl` existe
2. Cadastrar atendentes → checado quando há pelo menos 1 garçom cadastrado
3. Configurar o brinde da roleta → checado quando há pelo menos 1 brinde habilitado
4. Gerar e imprimir as placas de QR Code → checado ao clicar em "Gerar placas"
   (abre a tela de Placas & Totens QR)
5. Fazer uma avaliação de teste → checado quando existe pelo menos 1 avaliação

Cada item tem um botão que leva direto pra aba certa. O card pode ser fechado
a qualquer momento (fica escondido depois, por empresa, salvo no navegador) e
reaparece se a pessoa limpar os dados do navegador — não é nada no banco de
dados, então é seguro.

## 2) Conta de demonstração com dados fictícios

Pensado para quando um vendedor for apresentar o sistema pessoalmente: em vez
de mostrar um painel vazio, gera ~120 avaliações fictícias (nomes, notas,
comentários, brindes resgatados) espalhadas nos últimos 45 dias, para o
painel, os relatórios e (se Premium) a análise de IA aparecerem com dados de
verdade na tela.

**Como usar:**
1. Crie uma empresa normal no SuperAdmin (ex.: "Restaurante Demo"), no plano
   que você quiser mostrar (Pro ou Premium mostra mais recursos).
2. Entre nela e cadastre pelo menos 1 atendente e 1 brinde habilitado — o
   gerador reaproveita o que já está cadastrado, pra ficar coerente. Cadastrar
   alguns itens de cardápio também deixa mais realista (opcional).
3. Volte pro SuperAdmin, ache essa empresa na lista e clique em **"Gerar
   demo"**. Ele cria as avaliações fictícias na hora.
4. Pra apresentar de novo mais tarde com dados "frescos", clique em "Gerar
   demo" de novo — ele soma mais avaliações fictícias. Se quiser começar do
   zero, use "Limpar demo" antes (remove só as fictícias, nunca mexe em
   avaliações reais).

As avaliações fictícias ficam marcadas internamente com `isDemoData: true` —
por isso "Limpar demo" nunca apaga avaliação real, mesmo que a empresa já
tenha clientes de verdade avaliando por engano.

**Importante:** essa geração é feita direto no banco de dados pelo SuperAdmin
— não passa pelas mesmas checagens de limite mensal por plano, então funciona
mesmo numa empresa recém-criada.

## Como aplicar

1. Copie os arquivos deste pacote para os mesmos caminhos no seu repositório
   (mantendo `demo-seed.ts` e `server.ts` na raiz).
2. Commit, push.
3. Deploy no Render (automático, ou Manual Deploy → Deploy latest commit).
4. Teste: entre em qualquer empresa e veja o cartão de primeiros passos na
   aba Métricas; no SuperAdmin, teste "Gerar demo" numa empresa de teste.
