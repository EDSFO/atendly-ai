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
  const agent = await getCatalogAgent(agentId);
  if (!agent) {
    throw new Error('Agente não encontrado no catálogo');
  }

  const existing = await db.query(
    'SELECT id FROM tenant_agents WHERE tenant_id = $1 AND agent_id = $2',
    [tenantId, agentId]
  );
  if (existing.rows.length > 0) {
    throw new Error('Agente já está ativado para este tenant');
  }

  const subscriptionStatus = PAYMENT_SYSTEM_ACTIVE ? 'pending' : 'active';
  await db.query(
    `INSERT INTO tenant_agent_subscriptions (tenant_id, agent_id, status)
     VALUES ($1, $2, $3)`,
    [tenantId, agentId, subscriptionStatus]
  );

  const result = await db.query(
    `INSERT INTO tenant_agents (tenant_id, agent_id, is_active)
     VALUES ($1, $2, true)
     RETURNING *`,
    [tenantId, agentId]
  );

  return result.rows[0];
}

export async function deactivateTenantAgent(tenantId: number, agentId: number) {
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