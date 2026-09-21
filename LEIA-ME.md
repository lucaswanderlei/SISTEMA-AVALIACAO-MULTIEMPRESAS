# Dia específico na análise de IA — patch

Este pacote contém **somente** os 4 arquivos alterados. Preserve a estrutura
de pastas ao enviar para a raiz do seu repositório (sobrescrevendo os
existentes):

- `ai-report-data.ts` (raiz)
- `ai-reports.ts` (raiz)
- `src/server.ts`
- `src/components/PremiumAiReport.tsx`

## O que mudou

- Agora dá para escolher **"Dia específico"** no seletor de período da aba
  "IA — Premium", além de 7/30/90 dias. Aparece um campo de data (só permite
  até ontem, igual aos outros períodos).
- O relatório de um dia específico é comparado com o dia imediatamente
  anterior (mesma lógica que já existia: período atual x período anterior de
  mesma duração).
- Backend (`ai-reports.ts`, `ai-report-data.ts`) passou a aceitar `date`
  (formato `YYYY-MM-DD`) além de `days` no corpo do POST `/api/ai/reports`.
- Log de auditoria (`src/server.ts`) agora registra também a data quando
  usada.

## Como aplicar

1. Copie os 4 arquivos para as mesmas pastas no seu repositório GitHub
   (substituindo os atuais).
2. Faça commit e push.
3. Se o Render estiver com deploy automático ligado no branch, ele já
   builda e publica sozinho. Se não, entre no Render e clique em
   **Manual Deploy → Deploy latest commit**.
4. Depois do deploy, recarregue a página do sistema e confira a aba
   "IA — Premium": o seletor de período deve mostrar a opção
   "Dia específico".

Nenhuma variável de ambiente nova é necessária — continua usando o mesmo
`GEMINI_API_KEY`/`GEMINI_MODEL` já configurado.
