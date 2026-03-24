import { db } from './db';

// Flag para ativar sistema de pagamento (desativado por padrão)
const PAYMENT_SYSTEM_ACTIVE = process.env.PAYMENT_SYSTEM_ACTIVE === 'true';

// ========== CATALOG AGENTS (GESTOR) ==========

export async function getCatalogAgents() {
  const result = await db.query(`
    SELECT * FROM agents
    WHERE is_catalog = true
    ORDER BY is_orchestrator DESC, agent_order ASC, created_at DESC
  `);
  return result.rows;
}

export async function getCatalogAgentsWithSubAgents() {
  const agents = await getCatalogAgents();

  // Get orchestrators and their sub-agents
  const orchestrators = agents.filter(a => a.is_orchestrator);
  const subAgents = agents.filter(a => !a.is_orchestrator && a.parent_agent_id);

  // Group sub-agents under their orchestrators
  return orchestrators.map(orch => ({
    ...orch,
    sub_agents: subAgents.filter(sa => sa.parent_agent_id === orch.id)
  }));
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
  is_orchestrator?: boolean;
  sub_agents?: Array<{
    name: string;
    description?: string;
    system_prompt: string;
    agent_type: string;
    personality?: object;
    agent_order?: number;
  }>;
}) {
  // Create orchestrator (catalog agents use tenant_id = 1 as placeholder, is_catalog = true marks them as global)
  const isOrchestrator = data.is_orchestrator === true || data.is_orchestrator === 'true';
  const result = await db.query(
    `INSERT INTO agents (tenant_id, name, description, system_prompt, agent_type, personality, is_catalog, monthly_price, is_orchestrator, parent_agent_id, agent_order)
     VALUES (1, $1, $2, $3, $4, $5, true, $6, $7, NULL, 0)
     RETURNING *`,
    [
      data.name,
      data.description || null,
      data.system_prompt,
      data.agent_type,
      data.personality ? JSON.stringify(data.personality) : null,
      data.monthly_price || 0,
      isOrchestrator
    ]
  );
  const orchestrator = result.rows[0];

  // Create sub-agents if provided
  if (isOrchestrator && data.sub_agents && data.sub_agents.length > 0) {
    for (let i = 0; i < data.sub_agents.length; i++) {
      const sub = data.sub_agents[i];
      await db.query(
        `INSERT INTO agents (tenant_id, name, description, system_prompt, agent_type, personality, is_catalog, monthly_price, is_orchestrator, parent_agent_id, agent_order)
         VALUES (1, $1, $2, $3, $4, $5, true, 0, false, $6, $7)`,
        [
          sub.name,
          sub.description || null,
          sub.system_prompt,
          sub.agent_type,
          sub.personality ? JSON.stringify(sub.personality) : null,
          orchestrator.id,
          sub.agent_order || i
        ]
      );
    }
  }

  return orchestrator;
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

  updates.push(`version = version + 1`);
  values.push(agentId);

  const result = await db.query(
    `UPDATE agents SET ${updates.join(', ')} WHERE id = $${paramCount} AND is_catalog = true RETURNING *`,
    values
  );
  return result.rows[0];
}

export async function deleteCatalogAgent(agentId: number) {
  // Delete sub-agents first
  await db.query('DELETE FROM agents WHERE parent_agent_id = $1', [agentId]);
  // Delete orchestrator
  await db.query('DELETE FROM agents WHERE id = $1 AND is_catalog = true', [agentId]);
  return { success: true };
}

// ========== SUB-AGENTS ==========

export async function getSubAgents(orchestratorId: number) {
  const result = await db.query(
    'SELECT * FROM agents WHERE parent_agent_id = $1 ORDER BY agent_order ASC',
    [orchestratorId]
  );
  return result.rows;
}

export async function addSubAgent(orchestratorId: number, data: {
  name: string;
  description?: string;
  system_prompt: string;
  agent_type: string;
  personality?: object;
}) {
  // Get max order
  const maxOrder = await db.query(
    'SELECT COALESCE(MAX(agent_order), -1) + 1 as next_order FROM agents WHERE parent_agent_id = $1',
    [orchestratorId]
  );

  const result = await db.query(
    `INSERT INTO agents (name, description, system_prompt, agent_type, personality, is_catalog, monthly_price, is_orchestrator, parent_agent_id, agent_order)
     VALUES ($1, $2, $3, $4, $5, true, 0, false, $6, $7)
     RETURNING *`,
    [
      data.name,
      data.description || null,
      data.system_prompt,
      data.agent_type,
      data.personality ? JSON.stringify(data.personality) : null,
      orchestratorId,
      maxOrder.rows[0].next_order
    ]
  );
  return result.rows[0];
}

export async function updateSubAgent(subAgentId: number, data: {
  name?: string;
  description?: string;
  system_prompt?: string;
  personality?: object;
  agent_order?: number;
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
  if (data.agent_order !== undefined) {
    updates.push(`agent_order = $${paramCount++}`);
    values.push(data.agent_order);
  }

  if (updates.length === 0) {
    const result = await db.query('SELECT * FROM agents WHERE id = $1', [subAgentId]);
    return result.rows[0];
  }

  values.push(subAgentId);
  const result = await db.query(
    `UPDATE agents SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );
  return result.rows[0];
}

export async function deleteSubAgent(subAgentId: number) {
  await db.query('DELETE FROM agents WHERE id = $1 AND is_catalog = true', [subAgentId]);
  return { success: true };
}

// ========== TENANT AGENTS ==========

export async function getTenantAgents(tenantId: number) {
  const result = await db.query(`
    SELECT ta.*, a.name, a.description, a.system_prompt, a.agent_type,
           a.personality as base_personality, a.monthly_price, a.is_orchestrator, a.parent_agent_id
    FROM tenant_agents ta
    JOIN agents a ON ta.agent_id = a.id
    WHERE ta.tenant_id = $1
    ORDER BY a.is_orchestrator DESC, a.agent_order ASC
  `, [tenantId]);
  return result.rows;
}

export async function getTenantAgentsWithOrchestrator(tenantId: number) {
  const agents = await getTenantAgents(tenantId);

  // Group by orchestrator
  const orchestrators = agents.filter(a => a.is_orchestrator || !a.parent_agent_id);
  const subAgents = agents.filter(a => !a.is_orchestrator && a.parent_agent_id);

  return orchestrators.map(orch => ({
    ...orch,
    sub_agents: subAgents.filter(sa => sa.parent_agent_id === orch.agent_id)
  }));
}

export async function getTenantAgent(tenantAgentId: number) {
  const result = await db.query(`
    SELECT ta.*, a.name, a.description, a.system_prompt, a.agent_type,
           a.personality as base_personality, a.monthly_price, a.is_orchestrator, a.parent_agent_id
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

  // Check if already activated (as orchestrator)
  const existing = await db.query(
    'SELECT id FROM tenant_agents WHERE tenant_id = $1 AND agent_id = $2',
    [tenantId, agentId]
  );
  if (existing.rows.length > 0) {
    throw new Error('Agente já está ativado para este tenant');
  }

  const subscriptionStatus = PAYMENT_SYSTEM_ACTIVE ? 'pending' : 'active';

  // Create subscription
  await db.query(
    `INSERT INTO tenant_agent_subscriptions (tenant_id, agent_id, status)
     VALUES ($1, $2, $3)`,
    [tenantId, agentId, subscriptionStatus]
  );

  // Activate orchestrator
  await db.query(
    `INSERT INTO tenant_agents (tenant_id, agent_id, is_active)
     VALUES ($1, $2, true)`,
    [tenantId, agentId]
  );

  // If orchestrator, activate all sub-agents automatically
  if (agent.is_orchestrator) {
    const subAgents = await getSubAgents(agentId);
    for (const subAgent of subAgents) {
      // Check if sub-agent already activated
      const existingSub = await db.query(
        'SELECT id FROM tenant_agents WHERE tenant_id = $1 AND agent_id = $2',
        [tenantId, subAgent.id]
      );
      if (existingSub.rows.length === 0) {
        await db.query(
          `INSERT INTO tenant_agent_subscriptions (tenant_id, agent_id, status)
           VALUES ($1, $2, $3)`,
          [tenantId, subAgent.id, subscriptionStatus]
        );
        await db.query(
          `INSERT INTO tenant_agents (tenant_id, agent_id, is_active)
           VALUES ($1, $2, true)`,
          [tenantId, subAgent.id]
        );

        // Copy global documents from catalog sub-agent to tenant sub-agent
        await copyCatalogDocumentsToTenant(tenantId, subAgent.id, subAgent.id);
      }
    }
  }

  return { success: true, activated_sub_agents: agent.is_orchestrator ? true : false };
}

export async function deactivateTenantAgent(tenantId: number, agentId: number) {
  // Get agent info
  const agent = await getCatalogAgent(agentId);

  // Deactivate orchestrator and all sub-agents if orchestrator
  if (agent && agent.is_orchestrator) {
    const subAgents = await getSubAgents(agentId);
    for (const subAgent of subAgents) {
      await db.query(
        'UPDATE tenant_agents SET is_active = false WHERE tenant_id = $1 AND agent_id = $2',
        [tenantId, subAgent.id]
      );
      await db.query(
        "UPDATE tenant_agent_subscriptions SET status = 'cancelled' WHERE tenant_id = $1 AND agent_id = $2",
        [tenantId, subAgent.id]
      );
    }
  }

  // Deactivate the agent itself
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

export async function updateTenantSubAgentPersonality(subAgentId: number, customPersonality: object) {
  const result = await db.query(
    `UPDATE tenant_agents SET custom_personality = $1 WHERE id = $2 RETURNING *`,
    [JSON.stringify(customPersonality), subAgentId]
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

// ========== CATALOG SUB-AGENT DOCUMENTS (RAG) ==========

export async function getCatalogSubAgentDocuments(subAgentId: number) {
  const result = await db.query(
    'SELECT * FROM agent_documents WHERE agent_id = $1 AND tenant_id IS NULL ORDER BY created_at DESC',
    [subAgentId]
  );
  return result.rows;
}

export async function addCatalogSubAgentDocument(subAgentId: number, data: {
  source_type: string;
  content?: string;
  file_url?: string;
  website_url?: string;
}) {
  const result = await db.query(
    `INSERT INTO agent_documents (agent_id, source_type, content, file_url, website_url, is_global, tenant_id, processed_at)
     VALUES ($1, $2, $3, $4, $5, true, NULL, NOW())
     RETURNING *`,
    [
      subAgentId,
      data.source_type,
      data.content || null,
      data.file_url || null,
      data.website_url || null
    ]
  );
  return result.rows[0];
}

export async function deleteCatalogSubAgentDocument(documentId: number) {
  // Only delete if it's a catalog document (tenant_id IS NULL)
  await db.query('DELETE FROM agent_documents WHERE id = $1 AND tenant_id IS NULL', [documentId]);
  return { success: true };
}

// ========== TENANT SUB-AGENT DOCUMENTS (RAG) ==========

export async function getTenantSubAgentDocuments(tenantAgentId: number) {
  const tenantAgent = await getTenantAgent(tenantAgentId);
  if (!tenantAgent) {
    throw new Error('Tenant agent não encontrado');
  }

  // Get documents for the underlying catalog agent that belong to this tenant
  const result = await db.query(
    `SELECT ad.* FROM agent_documents ad
     WHERE ad.agent_id = $1 AND ad.tenant_id = $2
     ORDER BY ad.created_at DESC`,
    [tenantAgent.agent_id, tenantAgent.tenant_id]
  );
  return result.rows;
}

export async function addTenantSubAgentDocument(tenantAgentId: number, data: {
  source_type: string;
  content?: string;
  file_url?: string;
  website_url?: string;
}) {
  const tenantAgent = await getTenantAgent(tenantAgentId);
  if (!tenantAgent) {
    throw new Error('Tenant agent não encontrado');
  }

  // Add document as tenant-specific (tenant_id is set)
  const result = await db.query(
    `INSERT INTO agent_documents (agent_id, source_type, content, file_url, website_url, is_global, tenant_id, processed_at)
     VALUES ($1, $2, $3, $4, $5, false, $6, NOW())
     RETURNING *`,
    [
      tenantAgent.agent_id,
      data.source_type,
      data.content || null,
      data.file_url || null,
      data.website_url || null,
      tenantAgent.tenant_id
    ]
  );
  return result.rows[0];
}

export async function deleteTenantSubAgentDocument(documentId: number, tenantId: number) {
  // Only delete if it's a tenant-specific document
  await db.query('DELETE FROM agent_documents WHERE id = $1 AND tenant_id = $2', [documentId, tenantId]);
  return { success: true };
}

// Copy global documents from catalog sub-agents to tenant sub-agents when activating
async function copyCatalogDocumentsToTenant(tenantId: number, catalogAgentId: number, tenantAgentId: number) {
  const catalogDocs = await db.query(
    'SELECT * FROM agent_documents WHERE agent_id = $1 AND is_global = true AND tenant_id IS NULL',
    [catalogAgentId]
  );

  for (const doc of catalogDocs.rows) {
    await db.query(
      `INSERT INTO agent_documents (agent_id, source_type, content, file_url, website_url, is_global, tenant_id, processed_at)
       VALUES ($1, $2, $3, $4, $5, false, $6, $7)`,
      [
        tenantAgentId, // Use the tenant sub-agent's agent_id
        doc.source_type,
        doc.content,
        doc.file_url,
        doc.website_url,
        false,
        tenantId
      ]
    );
  }

  return { copied: catalogDocs.rows.length };
}
