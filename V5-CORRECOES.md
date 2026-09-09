# V5 - Correções efetivas

- O botão Gerência do Super Admin agora usa a rota dedicada `/gerencia?empresa=ID&config=1`.
- A rota `/gerencia` abre diretamente o fluxo de autenticação da gerência da empresa selecionada.
- Após autenticar pelo PIN, a gerência abre diretamente em **Configurações**.
- Em Configurações há seletor de ícone de avaliação com: Estrelas, Coxinhas, Brigadeiros, Fatias de bolo e Fatias de pizza.
- O ícone escolhido é salvo em `settings.ratingIcon` e usado nos quatro pilares da avaliação do cliente.
