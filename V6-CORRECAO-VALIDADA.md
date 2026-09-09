# V6 - correção validada

- O botão Gerência do Super Admin usa a rota raiz com `gerencia=1`, evitando qualquer problema de fallback do servidor em `/gerencia`.
- A aplicação já inicia em modo Gerência quando `gerencia=1` está na URL, antes mesmo do primeiro effect do React.
- `config=1` abre diretamente a aba Configurações depois do PIN.
- A tela de Configurações contém seletor por empresa para: Estrelas, Coxinhas, Brigadeiros, Fatias de bolo e Fatias de pizza.
- O ícone escolhido é salvo em `settings.ratingIcon` e usado nos quatro pilares e na nota do garçom.
- Incluído marcador visual `v6` para confirmar que o deploy correto está no ar.
