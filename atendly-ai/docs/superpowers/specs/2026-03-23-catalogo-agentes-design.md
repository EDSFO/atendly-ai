# Design: Sistema de Catálogo de Agentes

## Problema

Atualmente, os agentes são criados diretamente pelos tenants (clientes). A proposta é criar um modelo onde:
- Gestores do sistema criam agentes base (catálogo)
- Clientes ativam agentes do catálogo e personalizam apenas o RAG e ajustes de personalidade
- Sistema de pagamento por agente (pronto para ativação)

## Esquema Atual da Tabela `agents`

A tabela `agents` **já existe** com as colunas:
- `id`, `tenant_id`, `name`, `description`, `system_prompt`, `agent_type`, `personality` (JSONB), `is_global`, `parent_agent_id`, `is_active`, `created_at`

### Alterações na Tabela `agents`

```sql
ALTER TABLE agents ADD COLUMN is_catalog BOOLEAN DEFAULT false;
ALTER TABLE agents ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE agents ADD COLUMN monthly_price DECIMAL(10,2) DEFAULT 0;
```

- `is_catalog`: se true, é um agente disponível no catálogo (criado pelo gestor)
- `version`: controle de versões para updates
- `monthly_price`: preço mensal por agente (0 = gratuito)

**Nota:** `personality` é JSONB com estrutura `{ tone, vocabulary, greeting, closing, rules, forbidden }`

### Nova Tabela `tenant_agents`

```sql
CREATE TABLE tenant_agents (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  agent_id INTEGER NOT NULL REFERENCES agents(id),
  custom_personality JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, agent_id)
);
```

- Instância de um agente do catálogo para um tenant específico
- `custom_personality`: permite tenant personalizar tom, vocabulário, saudação, etc.
- Herda `system_prompt` e `personality` base do agente global (read-only)

### Nova Tabela `tenant_agent_subscriptions`

```sql
CREATE TABLE tenant_agent_subscriptions (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  agent_id INTEGER NOT NULL REFERENCES agents(id),
  status TEXT DEFAULT 'active',
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, agent_id)
);
```

- `status`: 'active', 'inactive', 'pending', 'cancelled'
- `expires_at`: para assinaturas recorrentes
- Sistema de pagamento desativado por padrão via flag `PAYMENT_SYSTEM_ACTIVE`

## Fluxo de Ativação

1. Gestor cria agente no catálogo (AdminDashboard)
2. Tenant acessa "Catálogo de Agentes" no seu painel
3. Vê agentes disponíveis com preview de descrição, tipo e preço
4. Clica "Ativar" →
   - Se `PAYMENT_SYSTEM_ACTIVE=true`: cria subscription com status 'pending' (agente fica inacessível até pagamento)
   - Se `PAYMENT_SYSTEM_ACTIVE=false`: cria subscription 'active' + cria `tenant_agent` imediatamente
5. **Se pagamento ativo:** gateway de pagamento chama webhook `POST /api/tenant-agents/:id/subscription/activate` → muda status para 'active'
6. Tenant personaliza personalidade + adiciona RAG

**Comportamento quando assinatura expira/cancela:**
- `tenant_agent.is_active` é setado para `false`
- Registro NÃO é deletado (histórico)
- Tenant é notificado para renovar

## Personalização Permitida ao Tenant

Tenant pode editar em `custom_personality`:
- `tone`: 'amigável', 'formal', 'profissional'
- `vocabulary`: array de palavras-chave
- `greeting`: saudação inicial
- `closing`: fechamento
- `rules`: array de regras
- `forbidden`: array de proibições

**Read-only para tenant:**
- `system_prompt` do agente global
- `agent_type`
- `description`

## API Endpoints

### Catálogo (Gestor)
```
GET    /api/catalog/agents              # Lista agentes do catálogo
POST   /api/catalog/agents              # Cria agente no catálogo
PUT    /api/catalog/agents/:id          # Atualiza agente do catálogo
DELETE /api/catalog/agents/:id          # Remove do catálogo
```

### Tenant Agents
```
GET    /api/tenants/:id/agents          # Lista agentes ativados (com personalização)
POST   /api/tenants/:id/agents/activate # Ativa agente do catálogo
DELETE /api/tenants/:id/agents/:agentId # Desativa agente
PUT    /api/tenant-agents/:id/personality # Atualiza personalidade
```

### RAG
```
GET    /api/tenant-agents/:id/documents # Lista RAG do agente para esse tenant
POST   /api/tenant-agents/:id/documents # Adiciona RAG
DELETE /api/tenant-agents/:id/documents/:docId # Remove RAG
```

### Pagamento (stub - para ativar posteriormente)
```
GET    /api/tenant-agents/:id/subscription # Status da assinatura
POST   /api/tenant-agents/:id/subscription/activate # Webhook do gateway de pagamento
```

**Stub atual:** apenas muda status para 'active'. Integração real com gateway (Stripe, Pagar.me, etc.) será adicionada quando `PAYMENT_SYSTEM_ACTIVE=true`.

## Lógica de Verificação de Pagamento

```typescript
const PAYMENT_SYSTEM_ACTIVE = process.env.PAYMENT_SYSTEM_ACTIVE === 'true';

async function checkAgentAccess(tenantId: number, agentId: number) {
  if (!PAYMENT_SYSTEM_ACTIVE) {
    return { allowed: true };
  }

  const sub = await db.query(
    'SELECT * FROM tenant_agent_subscriptions WHERE tenant_id = $1 AND agent_id = $2',
    [tenantId, agentId]
  );

  if (!sub.rows.length || sub.rows[0].status !== 'active') {
    return { allowed: false, payment_required: true };
  }

  return { allowed: true };
}
```

## Componentes Frontend Necessários

### Admin Dashboard (Gestor)
- `CatalogManager`: CRUD de agentes do catálogo
- `AgentEditor`: editor de system prompt e personalidade base
- `CatalogPreview`: visualização do agente como o tenant vê

### Tenant Dashboard
- `AgentCatalog`: lista de agentes disponíveis para ativar
- `MyAgents`: agentes ativados com opção de personalizar
- `PersonalityEditor`: editor de personalidade (tom, vocabulário, etc.)
- `AgentRAGManager`: upload de documentos e scan de sites

## Arquivos a Modificar

### Backend
- `server/db.ts`: adicionar colunas e tabelas
- `server/agents.ts`: adicionar lógica de catálogo
- `server.ts`: adicionar rotas de catálogo

### Frontend
- AdminDashboard: adicionar aba "Catálogo"
- Tenant Dashboard: adicionar "Catálogo de Agentes"

## Status

- [x] Design aprovado
- [ ] Implementation plan
- [ ] Implementação
- [ ] Testes
