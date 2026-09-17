# Atualização: assinatura, cartão recorrente, Pix e anual com desconto

Copie o conteúdo deste ZIP para a raiz do projeto, mantendo as pastas. Ele contém somente os arquivos novos ou alterados em relação ao último ZIP enviado nesta conversa. Não substitua pelo ZIP uma versão mais nova sem comparar os arquivos.

## O que foi incluído

- Página `/assinatura?empresa=ID`, acessível pelo proprietário em “Minha assinatura”.
- Contratação dos planos Básico, Pro e Premium, conforme os preços do SuperAdmin.
- Cartão com autorização no checkout do Mercado Pago e renovação mensal ou a cada 12 meses.
- Pix com QR Code e Copia e Cola, válido por 30 minutos. A confirmação é automática; o cliente precisa gerar/pagar um novo Pix a cada renovação. Esta integração não implementa débito automático Pix.
- Pagamento anual pelo total de 12 meses com desconto configurável no SuperAdmin. Não é parcelamento do anual.
- Histórico por empresa, acompanhamento financeiro no SuperAdmin e cancelamento de cobranças futuras.
- Login do proprietário para renovar mesmo após vencer; empresa suspensa administrativamente pode consultar/cancelar, mas não contratar até o suporte liberar.
- Banco de dados como fonte de preço, período, confirmação e acesso. Nenhum retorno do navegador libera o sistema.

## Configuração no servidor

No Render, abra o serviço do sistema → Environment e cadastre:

| Variável | Valor |
|---|---|
| `MP_ACCESS_TOKEN` | Access Token da aplicação Mercado Pago que receberá os pagamentos |
| `MP_COLLECTOR_ID` | ID numérico da conta vendedora correspondente ao token |
| `MP_WEBHOOK_SECRET` | Chave secreta exibida na configuração de Webhooks da mesma aplicação |
| `PUBLIC_APP_URL` | Origem HTTPS pública do sistema, sem caminho, por exemplo `https://app.seudominio.com.br` |
| `MP_LIVE_MODE` | `true` para produção; `false` somente no ambiente separado de testes |

Não coloque credenciais em variáveis VITE, arquivos do navegador, repositório ou mensagens. O servidor compara conta recebedora, ambiente, valor e moeda antes de conceder acesso. Se o token pertencer a outra conta, a integração recusará a confirmação.

Em “Suas integrações” do Mercado Pago, configure a URL:

`https://app.seudominio.com.br/api/billing/webhook`

Habilite notificações de pagamentos e assinaturas, incluindo os tópicos `payment`, `subscription_preapproval` e `subscription_authorized_payment`. Use o segredo da mesma configuração de ambiente. A URL deve ser pública, sem tela de login ou redirecionamento. O sistema valida a assinatura de cada notificação.

O pagamento por Pix exige que a conta vendedora esteja habilitada para receber Pix. Recursos e credenciais precisam ser validados com a conta que será usada em produção.

## Preços e desconto

1. Entre no SuperAdmin e confira os preços mensais em “Valores dos planos”. Esses valores agora determinam novas cobranças reais.
2. Em “Pagamentos — Mercado Pago”, defina o desconto anual desejado e salve.
3. O desconto inicia em **0%** para não escolher uma condição comercial por você. Exemplo ilustrativo: R$ 100 por mês e 20% de desconto geram uma cobrança anual de R$ 960.
4. Preço zero desabilita a contratação daquele plano. Alterações de preço/desconto valem para novas contratações. Cobranças já criadas e assinaturas recorrentes existentes mantêm seus valores registrados.

Não há cadastro público automático de empresas nesta atualização. Cadastre a empresa e seu proprietário no SuperAdmin e forneça o link de acesso.

## Publicação

A aplicação cria automaticamente três tabelas no PostgreSQL: `avaliacao_billing_orders`, `avaliacao_billing_payments` e `avaliacao_billing_events`. O usuário do banco precisa ter permissão de criação de tabelas/índices. Não apague nem reinicialize o banco.

Não há novas dependências de produção. Use os comandos existentes:

```sh
npm ci
npm run lint
npm test
npm run build
npm start
```

O trabalhador de conciliação roda dentro do processo Node a cada 30 segundos. As notificações ficam no PostgreSQL antes da resposta HTTP; falhas são repetidas. Há consultas periódicas de cobranças e pagamentos para recuperar eventos perdidos. O serviço precisa permanecer disponível; interrupções atrasam confirmações e conciliações, mas não geram acesso sem pagamento.

## Regras de acesso

- Somente pagamento efetivamente `approved`, consultado na API e validado, concede o período contratado.
- Uma autorização de assinatura sem pagamento não libera acesso.
- Pagamentos repetidos/notificações duplicadas não adicionam meses extras.
- Mensal concede um mês de calendário; anual concede 12 meses. Dias restantes são preservados. Pagamentos notificados com atraso usam a data da aprovação, não a data de recebimento do evento.
- Ao contratar cartão com acesso ainda válido, o início é programado para o vencimento atual quando ele estiver a mais de uma hora de distância. O checkout do Mercado Pago confirma as condições finais.
- Se uma renovação falhar, nenhum período novo é concedido. O acesso vence na data já registrada.
- Cancelar renovação mantém o período que já foi pago. Não realiza reembolso automático.
- Reembolso, mesmo parcial, ou contestação de um período concedido ainda vigente suspende a empresa para revisão do suporte. Reembolsos são feitos no Mercado Pago; a notificação atualiza o sistema. A suspensão não é removida automaticamente por outro pagamento.
- Suspender a empresa manualmente não cancela o contrato financeiro no Mercado Pago. Cancele também a recorrência quando essa for a intenção.
- Trocas de plano durante um período ativo não têm cálculo proporcional automático: aguarde o vencimento ou trate com o suporte. Cancele a recorrência existente antes de contratar outro período/meio.
- Empresas com histórico financeiro não podem ser excluídas pelo botão comum. Preserve o histórico e suspenda quando necessário.

## Operação e recuperação

O checkout de cartão pode ficar “Aguardando confirmação” se a API responder com atraso ou se a conexão cair. O sistema pesquisa a referência original para recuperar a assinatura; não cria outra automaticamente, evitando contratos duplicados. Se continuar assim, o administrador deve verificar a referência da cobrança no painel do Mercado Pago e investigar a resposta da API antes de encerrar ou criar outro contrato. Não exclua a linha da cobrança para forçar uma tentativa.

Falhas explícitas de validação/autorização na criação são registradas como recusadas e permitem uma nova tentativa após corrigir os dados/configuração. Pix usa chave de idempotência persistida para repetir a mesma solicitação com segurança.

O painel mostra as últimas 100 transações; os registros anteriores permanecem no banco. O MRR antigo segue sendo estimativa baseada em planos, não conciliação de receita líquida. Taxas do Mercado Pago não são descontadas no histórico desta atualização.

Faça backup completo do PostgreSQL. O backup JSON antigo da empresa não inclui estas tabelas financeiras, a fila de notificações ou os relatórios de IA. Não restaure somente o JSON para recuperar uma operação financeira.

## Validação feita e homologação pendente

Foram executadas verificação TypeScript, compilação e testes automatizados com PostgreSQL embarcado e respostas simuladas do provedor. Nenhuma credencial real foi fornecida; nenhum cartão foi cobrado e nenhum Pix real foi gerado.

Antes de disponibilizar aos clientes, em ambiente separado, confirme:

1. Cartão mensal: autorização, cobrança aprovada, renovação, falha e cancelamento.
2. Anual: total exibido com desconto, cobrança única por ciclo e 12 meses de acesso.
3. Pix: leitura do QR, pagamento, expiração, cancelamento e confirmação.
4. Webhooks válidos e inválidos, eventos duplicados, reinício durante confirmação.
5. Proprietário com assinatura vencida consegue pagar; gerente/visualizador não acessa finanças.
6. Reembolso e contestação suspendem o período ainda vigente.
7. Mesma cobrança não é renovada duas vezes após clicar em atualizar ou receber evento repetido.

Teste e produção devem usar bancos e credenciais separados. Um pagamento de teste só deve liberar uma empresa de teste. Após homologar, use credenciais de produção e `MP_LIVE_MODE=true`.

## Referências oficiais consultadas

- [Assinaturas do Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/overview)
- [Pix pela Payments API](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/payment-brick/payment-submission/pix)
- [Validação de Webhooks e consulta do recurso](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/additional-content/notifications/webhooks)
