# V4 — Gerência corrigida + ícones de avaliação

Alterações desta versão:

- Corrigido o botão **Gerência** do Super Admin. Agora ele abre a empresa com `?gerencia=1` e solicita o PIN da própria empresa, em vez de cair na tela pública de avaliação.
- Adicionada configuração **Ícone da avaliação (1 a 5)** no painel da empresa.
- Opções disponíveis: **Estrelas, Coxinhas, Brigadeiros, Fatias de bolo e Fatias de pizza**.
- O ícone selecionado é salvo nas configurações da empresa e usado nos 4 pilares da avaliação do cliente.
- Empresas já existentes continuam usando Coxinhas até que sejam alteradas; novas empresas começam com Estrelas.
- O isolamento por `empresaId` permanece intacto.
