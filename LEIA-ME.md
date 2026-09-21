# Intervalo personalizado na análise de IA — patch

Este pacote contém **somente** os 4 arquivos alterados. Preserve a estrutura
de pastas ao enviar para a raiz do seu repositório (sobrescrevendo os
existentes):

- `ai-report-data.ts` (raiz)
- `ai-reports.ts` (raiz)
- `src/server.ts`
- `src/components/PremiumAiReport.tsx`

## O que mudou

- Agora dá para escolher **"Escolher intervalo (de/até)"** no seletor de
  período da aba "IA — Premium", além de 7/30/90 dias. Aparecem dois campos
  de data: "De" e "Até" (ambos limitados até ontem; "Até" não pode ser
  antes de "De").
- Funciona tanto para um único dia (De = Até) quanto para um intervalo de
  vários dias.
- O relatório do intervalo escolhido é comparado com o período
  imediatamente anterior de mesma duração (mesma lógica que já existia
  entre "período atual" e "período anterior").
- Backend (`ai-reports.ts`, `ai-report-data.ts`) passou a aceitar `start` e
  `end` (formato `YYYY-MM-DD`) além de `days` no corpo do POST
  `/api/ai/reports`.
- Log de auditoria (`src/server.ts`) agora registra também `start`/`end`
  quando usados.

## Como aplicar

1. Copie os 4 arquivos para as mesmas pastas no seu repositório GitHub
   (substituindo os atuais).
2. Faça commit e push.
3. Se o Render estiver com deploy automático ligado no branch, ele já
   builda e publica sozinho. Se não, entre no Render e clique em
   **Manual Deploy → Deploy latest commit**.
4. Depois do deploy, recarregue a página do sistema e confira a aba
   "IA — Premium": o seletor de período deve mostrar a opção
   "Escolher intervalo (de/até)".

Nenhuma variável de ambiente nova é necessária — continua usando o mesmo
`GEMINI_API_KEY`/`GEMINI_MODEL` já configurado.

## Se você já tinha aplicado o patch anterior (dia único)

Este pacote substitui aquele: a opção antiga "Dia específico" (campo único
de data, parâmetro `date`) foi trocada por este seletor de intervalo
"De/Até" (parâmetros `start`/`end`), que cobre também o caso de um único
dia. Basta sobrescrever os arquivos de novo com os desta pasta.
