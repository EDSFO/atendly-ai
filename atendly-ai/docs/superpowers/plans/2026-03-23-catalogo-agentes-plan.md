# Catálogo de Agentes - Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar sistema de catálogo de agentes onde gestores criam agentes base e tenants ativam/personalizam via RAG.

**Architecture:** Backend-only primeiro (API + DB). Frontend será adicionado quando código-fonte React estiver disponível. Sistema de pagamento stub (desativado por padrão).

**Tech Stack:** Node.js, Express, TypeScript, PostgreSQL (Supabase)

---

## Arquitetura de Arquivos

```
server/
├── db.ts           # Migrations (novas tabelas + colunas)
├── agents.ts       # Funções de catálogo (criar, ativar, personalizar)
├── catalog.ts      # NOVO: Lógica específica do catálogo
└── server.ts       # Novas rotas

docs/superpowers/
├── specs/2026-03-23-catalogo-agentes-design.md  # Design reference
└── plans/2026-03-23-catalogo-agentes-plan.md   # This plan
```

---

## Tarefas

### Task 1: Migrations de Banco de Dados

**Files:**
- Modify: `server/db.ts:51-260`

- [ ] **Step 1: Adicionar colunas na tabela agents**

No `initDb()`, após a criação da tabela `agents`, adicionar:

```typescript
// Migration: Add catalog columns to agents
try {
  await db.query(`ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_catalog BOOLEAN DEFAULT false`);
  await db.query(`ALTER TABLE agents ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1`);
  await db.query(`ALTER TABLE agents ADD COLUMN IF NOT EXISTS monthly_price DECIMAL(10,2) DEFAULT 0`);
  console.log("Migration: catalog columns added to agents");
} catch (err) {
  console.log("Migration: agents catalog columns may already exist");
}
```

- [ ] **Step 2: Criar tabela tenant_agents**

```typescript
// tenant_agents - instância de agente do catálogo por tenant
try {
  await db.query(`
    CREATE TABLE IF NOT EXISTS tenant_agents (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      agent_id INTEGER NOT NULL REFERENCES agents(id),
      custom_personality JSONB,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, agent_id)
    )
  `);
  console.log("tenant_agents table created/verified");
} catch (err) {
  console.log("tenant_agents table may already exist:", err);
}
```

- [ ] **Step 3: Criar tabela tenant_agent_subscriptions**

```typescript
// tenant_agent_subscriptions - controle de pagamento
try {
  await db.query(`
    CREATE TABLE IF NOT EXISTS tenant_agent_subscriptions (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      agent_id INTEGER NOT NULL REFERENCES agents(id),
      status TEXT DEFAULT 'active',
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, agent_id)
    )
  `);
  console.log("tenant_agent_subscriptions table created/verified");
} catch (err) {
  console.log("tenant_agent_subscriptions table may already exist:", err);
}
```

- [ ] **Step 4: Commit**

```bash
git add server/db.ts
git commit -m "feat: add catalog agents database migrations

- Add is_catalog, version, monthly_price to agents table
- Create tenant_agents table
- Create tenant_agent_subscriptions table

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Módulo de Catálogo (server/catalog.ts)

**Files:**
- Create: `server/catalog.ts`

- [ ] **Step 1: Criar arquivo com funções de catálogo**

```typescript
import { db } from './db';

// Flag para ativar sistema de pagamento (desativado por padrão)
const PAYMENT_SYSTEM_ACTIVE = process.env.PAYMENT_SYSTEM_ACTIVE === 'true';

// ========== CATALOG AGENTS (GESTOR) ==========

export async function getCatalogAgents() {
  const result = await db.query(
    'SELECT * FROM agents WHERE is_catalog = true ORDER BY created_at DESC'
  );
  return result.rows;
}

export async function getCatalogAgent(agentId: number) {
  const result = await db.query(
    'SELECT * FROM agents WHERE id = $1 AND is_catalog = true',
    [agentId]
  );
  return result.rows[0];
}

export async function createCatalogAgent(data: {
  name: string;
  description?: string;
  system_prompt: string;
  agent_type: string;
  personality?: object;
  monthly_price?: number;
}) {
  const result = await db.query(
    `INSERT INTO agents (name, description, system_prompt, agent_type, personality, is_catalog, monthly_price)
     VALUES ($1, $2, $3, $4, $5, true, $6)
     RETURNING *`,
    [
      data.name,
      data.description || null,
      data.system_prompt,
      data.agent_type,
      data.personality ? JSON.stringify(data.personality) : null,
      data.monthly_price || 0
    ]
  );
  return result.rows[0];
}

export async function updateCatalogAgent(agentId: number, data: {
  name?: string;
  description?: string;
  system_prompt?: string;
  personality?: object;
  is_active?: boolean;
  monthly_price?: number;
}) {
  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${paramCount++}`);
    values.push(data.name);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramCount++}`);
    values.push(data.description);
  }
  if (data.system_prompt !== undefined) {
    updates.push(`system_prompt = $${paramCount++}`);
    values.push(data.system_prompt);
  }
  if (data.personality !== undefined) {
    updates.push(`personality = $${paramCount++}`);
    values.push(typeof data.personality === 'string' ? data.personality : JSON.stringify(data.personality));
  }
  if (data.is_active !== undefined) {
    updates.push(`is_active = $${paramCount++}`);
    values.push(data.is_active);
  }
  if (data.monthly_price !== undefined) {
    updates.push(`monthly_price = $${paramCount++}`);
    values.push(data.monthly_price);
  }

  if (updates.length === 0) {
    return getCatalogAgent(agentId);
  }

  updates.push(`version = version + 1`); // Incrementar versão
  values.push(agentId);

  const result = await db.query(
    `UPDATE agents SET ${updates.join(', ')} WHERE id = $${paramCount} AND is_catalog = true RETURNING *`,
    values
  );
  return result.rows[0];
}

export async function deleteCatalogAgent(agentId: number) {
  await db.query('DELETE FROM agents WHERE id = $1 AND is_catalog = true', [agentId]);
  return { success: true };
}

// ========== TENANT AGENTS ==========

export async function getTenantAgents(tenantId: number) {
  // Retorna agentes ativados + dados do agente base
  const result = await db.query(`
    SELECT ta.*, a.name, a.description, a.system_prompt, a.agent_type, a.personality as base_personality, a.monthly_price
    FROM tenant_agents ta
    JOIN agents a ON ta.agent_id = a.id
    WHERE ta.tenant_id = $1
    ORDER BY ta.created_at DESC
  `, [tenantId]);
  return result.rows;
}

export async function getTenantAgent(tenantAgentId: number) {
  const result = await db.query(`
    SELECT ta.*, a.name, a.description, a.system_prompt, a.agent_type, a.personality as base_personality, a.monthly_price
    FROM tenant_agents ta
    JOIN agents a ON ta.agent_id = a.id
    WHERE ta.id = $1
  `, [tenantAgentId]);
  return result.rows[0];
}

export async function activateTenantAgent(tenantId: number, agentId: number) {
  // Verificar se agente existe no catálogo
  const agent = await getCatalogAgent(agentId);
  if (!agent) {
    throw new Error('Agente não encontrado no catálogo');
  }

  // Verificar se já está ativado
  const existing = await db.query(
    'SELECT id FROM tenant_agents WHERE tenant_id = $1 AND agent_id = $2',
    [tenantId, agentId]
  );
  if (existing.rows.length > 0) {
    throw new Error('Agente já está ativado para este tenant');
  }

  // Criar subscription (status depende do sistema de pagamento)
  const subscriptionStatus = PAYMENT_SYSTEM_ACTIVE ? 'pending' : 'active';
  await db.query(
    `INSERT INTO tenant_agent_subscriptions (tenant_id, agent_id, status)
     VALUES ($1, $2, $3)`,
    [tenantId, agentId, subscriptionStatus]
  );

  // Criar tenant_agent
  const result = await db.query(
    `INSERT INTO tenant_agents (tenant_id, agent_id, is_active)
     VALUES ($1, $2, true)
     RETURNING *`,
    [tenantId, agentId]
  );

  return result.rows[0];
}

export async function deactivateTenantAgent(tenantId: number, agentId: number) {
  // Não deletar, apenas desativar
  await db.query(
    'UPDATE tenant_agents SET is_active = false WHERE tenant_id = $1 AND agent_id = $2',
    [tenantId, agentId]
  );
  await db.query(
    "UPDATE tenant_agent_subscriptions SET status = 'cancelled' WHERE tenant_id = $1 AND agent_id = $2",
    [tenantId, agentId]
  );
  return { success: true };
}

export async function updateTenantAgentPersonality(tenantAgentId: number, customPersonality: object) {
  const result = await db.query(
    `UPDATE tenant_agents SET custom_personality = $1 WHERE id = $2 RETURNING *`,
    [JSON.stringify(customPersonality), tenantAgentId]
  );
  return result.rows[0];
}

// ========== VERIFICAÇÃO DE ACESSO (PAGAMENTO) ==========

export async function checkAgentAccess(tenantId: number, agentId: number) {
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

export async function activateSubscription(tenantAgentId: number) {
  const tenantAgent = await getTenantAgent(tenantAgentId);
  if (!tenantAgent) {
    throw new Error('Tenant agent não encontrado');
  }

  await db.query(
    `UPDATE tenant_agent_subscriptions SET status = 'active' WHERE tenant_id = $1 AND agent_id = $2`,
    [tenantAgent.tenant_id, tenantAgent.agent_id]
  );

  return { success: true };
}

// ========== SUBSCRIPTIONS ==========

export async function getSubscription(tenantAgentId: number) {
  const tenantAgent = await getTenantAgent(tenantAgentId);
  if (!tenantAgent) return null;

  const result = await db.query(
    'SELECT * FROM tenant_agent_subscriptions WHERE tenant_id = $1 AND agent_id = $2',
    [tenantAgent.tenant_id, tenantAgent.agent_id]
  );
  return result.rows[0];
}
```

- [ ] **Step 2: Commit**

```bash
git add server/catalog.ts
git commit -m "feat: add catalog agents module

- Catalog CRUD (getCatalogAgents, create, update, delete)
- Tenant agent activation/deactivation
- Personality customization
- Payment check stub (PAYMENT_SYSTEM_ACTIVE flag)
- Subscription management

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Rotas de Catálogo (server.ts)

**Files:**
- Modify: `server/server.ts:1-60` (imports)
- Modify: `server/server.ts` (add routes after existing agent routes ~line 536)

- [ ] **Step 1: Adicionar imports**

```typescript
import {
  getCatalogAgents,
  getCatalogAgent,
  createCatalogAgent,
  updateCatalogAgent,
  deleteCatalogAgent,
  getTenantAgents,
  getTenantAgent,
  activateTenantAgent,
  deactivateTenantAgent,
  updateTenantAgentPersonality,
  checkAgentAccess,
  activateSubscription,
  getSubscription
} from "./server/catalog";
```

- [ ] **Step 2: Adicionar rotas de catálogo (após rotas de agentes globais ~line 536)**

```typescript
// ========== CATALOG AGENTS API (GESTOR) ==========

// Get all catalog agents
app.get("/api/catalog/agents", async (req, res) => {
  try {
    const agents = await getCatalogAgents();
    res.json(agents);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to get catalog agents" });
  }
});

// Create catalog agent
app.post("/api/catalog/agents", async (req, res) => {
  try {
    const { name, description, system_prompt, agent_type, personality, monthly_price } = req.body;
    if (!name || !system_prompt || !agent_type) {
      return res.status(400).json({ error: "name, system_prompt, and agent_type are required" });
    }
    const agent = await createCatalogAgent({ name, description, system_prompt, agent_type, personality, monthly_price });
    res.json(agent);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create catalog agent" });
  }
});

// Update catalog agent
app.put("/api/catalog/agents/:id", async (req, res) => {
  try {
    const agentId = parseInt(req.params.id);
    const { name, description, system_prompt, personality, is_active, monthly_price } = req.body;
    const agent = await updateCatalogAgent(agentId, { name, description, system_prompt, personality, is_active, monthly_price });
    if (!agent) {
      return res.status(404).json({ error: "Catalog agent not found" });
    }
    res.json(agent);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update catalog agent" });
  }
});

// Delete catalog agent
app.delete("/api/catalog/agents/:id", async (req, res) => {
  try {
    const agentId = parseInt(req.params.id);
    await deleteCatalogAgent(agentId);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete catalog agent" });
  }
});

// ========== TENANT AGENTS API ==========

// Get tenant's activated agents
app.get("/api/tenants/:tenantId/agents", async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    const agents = await getTenantAgents(tenantId);
    res.json(agents);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to get tenant agents" });
  }
});

// Activate agent from catalog
app.post("/api/tenants/:tenantId/agents/activate", async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    const { agent_id } = req.body;
    if (!agent_id) {
      return res.status(400).json({ error: "agent_id is required" });
    }

    // Check payment if active
    const access = await checkAgentAccess(tenantId, agent_id);
    if (!access.allowed) {
      return res.status(402).json({ error: "Payment required", payment_required: true });
    }

    const tenantAgent = await activateTenantAgent(tenantId, agent_id);
    res.json(tenantAgent);
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ error: error.message || "Failed to activate agent" });
  }
});

// Deactivate agent
app.delete("/api/tenants/:tenantId/agents/:agentId", async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    const agentId = parseInt(req.params.agentId);
    await deactivateTenantAgent(tenantId, agentId);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to deactivate agent" });
  }
});

// Update tenant agent personality
app.put("/api/tenant-agents/:id/personality", async (req, res) => {
  try {
    const tenantAgentId = parseInt(req.params.id);
    const { custom_personality } = req.body;
    if (!custom_personality) {
      return res.status(400).json({ error: "custom_personality is required" });
    }
    const agent = await updateTenantAgentPersonality(tenantAgentId, custom_personality);
    if (!agent) {
      return res.status(404).json({ error: "Tenant agent not found" });
    }
    res.json(agent);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update personality" });
  }
});

// Get subscription status
app.get("/api/tenant-agents/:id/subscription", async (req, res) => {
  try {
    const tenantAgentId = parseInt(req.params.id);
    const subscription = await getSubscription(tenantAgentId);
    res.json(subscription);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to get subscription" });
  }
});

// Activate subscription (webhook callback)
app.post("/api/tenant-agents/:id/subscription/activate", async (req, res) => {
  try {
    const tenantAgentId = parseInt(req.params.id);
    await activateSubscription(tenantAgentId);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to activate subscription" });
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add server/server.ts
git commit -m "feat: add catalog agents API routes

- GET/POST/PUT/DELETE /api/catalog/agents
- GET /api/tenants/:id/agents
- POST /api/tenants/:id/agents/activate
- DELETE /api/tenants/:id/agents/:agentId
- PUT /api/tenant-agents/:id/personality
- GET/POST /api/tenant-agents/:id/subscription

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Testar API

**Files:**
- Test: API endpoints manually or via curl

- [ ] **Step 1: Verificar se servidor está rodando**

```bash
curl http://localhost:3002/api/health
```

Expected: `{"status":"ok","dbStatus":"connected"...}`

- [ ] **Step 2: Criar agente de catálogo**

```bash
curl -X POST http://localhost:3002/api/catalog/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Agente de Marketing Pro",
    "description": "Agente especializado em marketing",
    "system_prompt": "Você é um assistente de marketing especializado...",
    "agent_type": "marketing",
    "monthly_price": 29.90
  }'
```

- [ ] **Step 3: Listar agentes do catálogo**

```bash
curl http://localhost:3002/api/catalog/agents
```

- [ ] **Step 4: Ativar agente para um tenant**

```bash
curl -X POST http://localhost:3002/api/tenants/1/agents/activate \
  -H "Content-Type: application/json" \
  -d '{"agent_id": <id_do_agente>}'
```

- [ ] **Step 5: Listar agentes do tenant**

```bash
curl http://localhost:3002/api/tenants/1/agents
```

---

## Resumo

| Task | Descrição | Status |
|------|-----------|--------|
| 1 | Migrations (db.ts) | Pending |
| 2 | Módulo catalog.ts | Pending |
| 3 | Rotas em server.ts | Pending |
| 4 | Testes manuais | Pending |

## Notas

- **Frontend:** Código React não está disponível (apenas `dist/` compilado). Frontend do catálogo será implementado quando código-fonte estiver acessível.
- **Pagamento:** Sistema stub está pronto, apenas definir `PAYMENT_SYSTEM_ACTIVE=true` para ativar verificação de pagamento.
