# Log do erro real da IA — patch

Arquivo alterado: `ai-reports.ts` (raiz).

## O que mudou

Antes, quando a chamada ao Gemini falhava por qualquer motivo (chave
inválida, modelo errado, cota estourada, etc.), o erro real era descartado
e nem aparecia no log do servidor — só a mensagem genérica ia pro cliente.
Agora o servidor grava no log (Render → aba Logs) uma linha assim:

```
[AI report] Falha ao chamar o Gemini: { status: ..., message: '...', model: '...' }
```

Só o status e uma mensagem curta (até 300 caracteres) — nunca o corpo da
requisição, que contém avaliações de clientes, nem a chave de API. Isso é
seguro de deixar nos logs.

## Como aplicar

1. Substitua `ai-reports.ts` no seu repositório.
2. Commit, push, deploy no Render.
3. No painel, gere uma análise de novo (mesmo que dê erro de novo, tudo
   bem — é isso que queremos ver).
4. No Render, abra a aba **Logs** do serviço e procure por
   `[AI report] Falha ao chamar o Gemini`. A mensagem ali vai dizer o
   motivo real (chave inválida, modelo não encontrado, cota excedida etc.).
