# IA exclusiva do Premium — Avalia e Ganha

Aplique este pacote sobre a última atualização de itens consumidos entregue nesta conversa. Ele contém somente os arquivos novos/modificados. Preserve a estrutura de pastas ao enviar para a raiz do GitHub.

## Ativação no Render

1. Envie os arquivos e faça o deploy com os comandos existentes: `npm ci && npm run build`, seguido de `npm start`.
2. Nas variáveis de ambiente do serviço, cadastre:

| Variável | Valor |
| --- | --- |
| `GEMINI_API_KEY` | Sua chave válida da Gemini API. É segredo do servidor; não envie ao GitHub nem use prefixo VITE_. |
| `GEMINI_MODEL` | Identificador de um modelo de texto disponível na sua conta que suporte `generateContent` com saída estruturada JSON. Não há modelo fixo no código para evitar dependência de um identificador descontinuado. |

Consulte a [documentação oficial de saída estruturada do Gemini](https://ai.google.dev/gemini-api/docs/generate-content/structured-output) para os modelos e formato suportados. A integração usa o pacote `@google/genai` que já existe no projeto. Uso e cobrança do provedor seguem a conta associada à chave; o sistema não inclui créditos de IA.

3. No SuperAdmin, selecione o plano **Premium** para a empresa e mantenha a assinatura ativa.
4. Atualize a página do painel. A nova aba é **IA — Premium**.

Sem chave ou modelo, a aba Premium continua visível e informa que aguarda ativação. Relatórios anteriores permanecem consultáveis. Basic e Pro não recebem a aba e são bloqueados pela API, inclusive quando o solicitante tem sessão SuperAdmin. Uma mudança de plano é conferida novamente antes de salvar/entregar uma geração.

## Funcionamento

- Roteiro com as onze seções do texto fornecido: resumo, positivos, atenção, evolução, comentários, produtos, atendimento, horários, recomendações, prioridade e fechamento.
- Períodos de 7, 30 ou 90 dias completos, até ontem, no fuso de São Paulo. Comparação com intervalo anterior de mesma duração.
- Médias, contagens e diferenças calculadas no servidor a partir do PostgreSQL da empresa; o cliente não envia os dados a serem analisados nem o plano.
- O texto da IA referencia evidências calculadas pelo sistema, disponíveis em “Ver evidências”. Valores numéricos ficam nas evidências, evitando números inventados no texto narrativo. Isso não elimina a necessidade de revisar interpretações da IA.
- Até vinte relatórios salvos por empresa, com reaproveitamento de análise quando dados/período/modelo/prompt forem iguais. Reaproveitar não consome outra geração.
- Limite de dez tentativas de geração por empresa/dia, com intervalo mínimo de um minuto. Falhas do provedor também contam como tentativa. O botão “Gerar novamente” força uma nova tentativa.
- Usuários de consulta podem ler o histórico; proprietário/gerente podem gerar.
- Sem avaliações no período: não chama o provedor. Com menos de dez: informa amostra insuficiente. Diferenças abaixo de três décimos não são tratadas como diferenças descritivas relevantes; isso é uma regra de apresentação, não um teste de significância.
- Produtos consumidos são analisados por frequência nas avaliações. Não existem notas individuais por produto nesta base, portanto não são criados rankings de qualidade ou de evolução por produto.
- Vouchers resgatados referem-se ao estado atual do grupo de vouchers emitidos pelas avaliações do período, não a todos os resgates feitos durante o período.
- Os horários são de envio da avaliação, não necessariamente da visita.

## Dados enviados ao provedor

O servidor envia agregados, evidências e até oitenta avaliações recentes com texto. Campos de nome/telefone/IDs de clientes e códigos de vouchers não são enviados. Comentários passam por remoção automática de nomes conhecidos, contatos, links e padrões de endereço; texto livre pode conter identificadores não reconhecidos, portanto essa filtragem não equivale a anonimização garantida. Atendentes usam aliases na entrada do modelo; sua correspondência com nomes é exibida somente no painel.

O relatório não reproduz comentários literalmente. A seleção de comentários e seu tamanho são indicados, sem extrapolar contagens de temas para todas as avaliações. A chave fica no servidor. Nenhuma chamada real ao provedor foi feita durante a criação deste pacote.

## Validação realizada

- 46 testes automatizados aprovados (incluindo os 26 anteriores).
- Compilação de produção e verificação TypeScript concluídas.
- Testes de dados, isolamento de empresa, cache, quotas, plano Basic/Pro, downgrade durante a geração, ausência de chave/dados e rejeição de saída inválida.
- SQL exercitado em PostgreSQL embarcado/PGlite; respostas do provedor foram simuladas explicitamente nos testes.
- Não houve deploy nem teste com chave Gemini real, banco do Render ou navegador de produção. Após ativar, gere uma análise em uma empresa Premium com avaliações em dias anteriores.

As tabelas `avaliacao_ai_reports` e `avaliacao_ai_usage` são criadas no início do servidor. Não apague o banco nem reimporte os JSON antigos. Inclua essas tabelas nos backups completos do PostgreSQL; o exportador JSON anterior da empresa não foi ampliado nesta atualização para incluir o histórico de IA.
