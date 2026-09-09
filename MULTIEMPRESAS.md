# Versão Multiempresas

Esta cópia foi preparada para operar separada do sistema original do Sr. Coxita.

## Como funciona
- A empresa é identificada por `?empresa=slug` na URL e pelo header `X-Company-Id` nas APIs.
- Firestore: `companies/{empresaId}/reviews`, `rewards`, `waiters` e `settings/restaurant`.
- PostgreSQL: nova tabela `avaliacao_empresas`, uma linha JSONB por empresa.
- localStorage/sessionStorage são isolados por empresa.
- QR Codes carregam automaticamente `empresa=<slug>`.
- O banco legado `avaliacao_dados` não é apagado.

## Administrador geral
Defina no Render a variável `SUPER_ADMIN_KEY` com uma senha forte.

Endpoints:
- `GET /api/admin/companies`
- `POST /api/admin/companies` com `{ "name": "Empresa X", "slug": "empresa-x" }`
- `PATCH /api/admin/companies/:id/status` com `{ "ativo": false }`

Todos exigem header `X-Super-Admin-Key`.

## Primeira empresa
Acesse a nova implantação com `?empresa=empresa-x`. O painel e os QR Codes dessa empresa ficarão isolados das demais.

## Importante
Use um NOVO serviço no Render e, de preferência, um NOVO banco PostgreSQL/Firebase para esta plataforma. Não aponte esta cópia para a produção do Sr. Coxita se a intenção é manter o sistema original completamente independente.
