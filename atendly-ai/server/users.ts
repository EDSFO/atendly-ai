import { db } from './db';

// ========== USERS ==========

export async function getUsers(tenantId: number) {
  const result = await db.query(
    'SELECT id, tenant_id, email, name, role, is_active, created_at FROM users WHERE tenant_id = $1 ORDER BY name',
    [tenantId]
  );
  return result.rows;
}

export async function getUser(userId: number) {
  const result = await db.query(
    'SELECT id, tenant_id, email, name, role, is_active, created_at FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0];
}

export async function getUserByEmail(email: string) {
  const result = await db.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0];
}

export async function createUser(data: {
  tenant_id: number;
  email: string;
  password_hash: string;
  name: string;
  role?: string;
}) {
  const result = await db.query(
    `INSERT INTO users (tenant_id, email, password_hash, name, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, tenant_id, email, name, role, is_active, created_at`,
    [data.tenant_id, data.email, data.password_hash, data.name, data.role || 'user']
  );
  return result.rows[0];
}

export async function updateUser(userId: number, data: {
  name?: string;
  email?: string;
  is_active?: boolean;
}) {
  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${paramCount++}`);
    values.push(data.name);
  }
  if (data.email !== undefined) {
    updates.push(`email = $${paramCount++}`);
    values.push(data.email);
  }
  if (data.is_active !== undefined) {
    updates.push(`is_active = $${paramCount++}`);
    values.push(data.is_active);
  }

  if (updates.length === 0) {
    return getUser(userId);
  }

  values.push(userId);
  const result = await db.query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, tenant_id, email, name, role, is_active, created_at`,
    values
  );
  return result.rows[0];
}

export async function deleteUser(userId: number) {
  await db.query('DELETE FROM users WHERE id = $1', [userId]);
  return { success: true };
}

// ========== USER AGENTS ==========

export async function getUserAgents(userId: number) {
  const result = await db.query(`
    SELECT ua.*, ta.agent_id, ta.custom_personality, a.name as agent_name, a.agent_type, a.system_prompt, a.is_orchestrator
    FROM user_agents ua
    JOIN tenant_agents ta ON ua.tenant_agent_id = ta.id
    JOIN agents a ON ta.agent_id = a.id
    WHERE ua.user_id = $1 AND ua.is_active = true AND ta.is_active = true
    ORDER BY a.name
  `, [userId]);
  return result.rows;
}

export async function addUserAgent(userId: number, tenantAgentId: number) {
  const result = await db.query(
    `INSERT INTO user_agents (user_id, tenant_agent_id, is_active)
     VALUES ($1, $2, true)
     ON CONFLICT (user_id, tenant_agent_id) DO UPDATE SET is_active = true
     RETURNING *`,
    [userId, tenantAgentId]
  );
  return result.rows[0];
}

export async function removeUserAgent(userId: number, tenantAgentId: number) {
  await db.query(
    'UPDATE user_agents SET is_active = false WHERE user_id = $1 AND tenant_agent_id = $2',
    [userId, tenantAgentId]
  );
  return { success: true };
}

export async function getAvailableAgentsForUser(userId: number) {
  // Get tenant_id from user
  const user = await getUser(userId);
  if (!user) return [];

  // Get all active tenant agents
  const tenantAgents = await db.query(`
    SELECT ta.*, a.name as agent_name, a.agent_type
    FROM tenant_agents ta
    JOIN agents a ON ta.agent_id = a.id
    WHERE ta.tenant_id = $1 AND ta.is_active = true
  `, [user.tenant_id]);

  // Get user's current agents
  const userAgents = await getUserAgents(userId);
  const userAgentIds = new Set(userAgents.map((ua: any) => ua.tenant_agent_id));

  // Return those not yet assigned
  return tenantAgents.rows.filter((ta: any) => !userAgentIds.has(ta.id));
}