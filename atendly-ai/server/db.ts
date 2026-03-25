import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

console.log("DB Config:", {
  connectionString: connectionString.replace(/:[^:@]*@/, ":****@"),
  timeout: 30000
});

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  max: 20 // Allow concurrent connections
});

pool.on('connect', () => {
  console.log('DB Pool: New client connected');
});

pool.on('error', (err) => {
  console.error('DB Pool: Unexpected error on idle client', err);
});

export const db = {
  query: async (text: string, params?: any[]) => {
    const start = Date.now();
    // console.log(`DB Query Start: ${text.substring(0, 50)}...`);
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      // console.log(`DB Query End (${duration}ms)`);
      return res;
    } catch (error) {
      console.error('Error executing query', { text, error });
      throw error;
    }
  },
};

export async function initDb() {
  try {
    console.log("Initializing DB tables...");
    
    // Tenants (Empresas)
    console.log("Creating tenants table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        segment TEXT NOT NULL,
        theme_color TEXT DEFAULT '#000000',
        ai_context TEXT,
        default_agent_id INTEGER REFERENCES agents(id)
      );
    `);
    console.log("Tenants table created/verified");

    // Add default_agent_id column if not exists (migration for existing tables)
    try {
      await db.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS default_agent_id INTEGER REFERENCES agents(id)`);
      console.log("Migration: default_agent_id column added to tenants");
    } catch (err) {
      console.log("Migration: default_agent_id column may already exist or agents table not ready");
    }

    // Professionals (Profissionais)
    console.log("Creating professionals table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS professionals (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id),
        name TEXT NOT NULL,
        specialty TEXT,
        bio TEXT
      );
    `);
    console.log("Professionals table created/verified");

    // Services (Serviços)
    console.log("Creating services table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS services (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id),
        name TEXT NOT NULL,
        description TEXT,
        duration_minutes INTEGER NOT NULL,
        price DECIMAL(10, 2) NOT NULL
      );
    `);
    console.log("Services table created/verified");

    // Appointments (Agendamentos)
    console.log("Creating appointments table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id),
        professional_id INTEGER NOT NULL REFERENCES professionals(id),
        service_id INTEGER NOT NULL REFERENCES services(id),
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        start_time TIMESTAMP NOT NULL,
        status TEXT DEFAULT 'confirmed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Appointments table created/verified");

    // WhatsApp Configuration
    console.log("Creating whatsapp_config table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_config (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id),
        instance_key TEXT NOT NULL,
        webhook_url TEXT,
        access_token TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("whatsapp_config table created/verified");

    // Messages (Chat History)
    console.log("Creating messages table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id),
        contact_id TEXT NOT NULL, -- Phone number for WA, Session ID for Web
        role TEXT NOT NULL, -- 'user', 'assistant', 'system'
        content TEXT NOT NULL,
        platform TEXT NOT NULL, -- 'whatsapp', 'web'
        agent_id INTEGER REFERENCES agents(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("messages table created/verified");

    // Migration: Add agent_id column if not exists
    try {
      await db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS agent_id INTEGER REFERENCES agents(id)`);
      console.log("Migration: agent_id column added to messages");
    } catch (err) {
      console.log("Migration: messages agent_id column may already exist");
    }

    // Agents (Multi-Agent System)
    console.log("Creating agents table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id),
        name TEXT NOT NULL,
        description TEXT,
        system_prompt TEXT,
        agent_type TEXT NOT NULL DEFAULT 'custom',
        personality JSONB,
        is_global BOOLEAN DEFAULT false,
        parent_agent_id INTEGER REFERENCES agents(id),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("agents table created/verified");

    // Migration: Add personality, is_global, parent_agent_id columns if not exists
    try {
      await db.query(`ALTER TABLE agents ADD COLUMN IF NOT EXISTS personality JSONB`);
      await db.query(`ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false`);
      await db.query(`ALTER TABLE agents ADD COLUMN IF NOT EXISTS parent_agent_id INTEGER REFERENCES agents(id)`);
      console.log("Migration: personality, is_global, parent_agent_id columns added to agents");
    } catch (err) {
      console.log("Migration: agents columns may already exist");
    }

    // Migration: Add catalog columns to agents
    try {
      await db.query(`ALTER TABLE agents ADD COLUMN is_catalog BOOLEAN DEFAULT false`);
      console.log("Migration: is_catalog column added");
    } catch (err: any) {
      if (!err.message.includes('already exists')) console.log("Migration: is_catalog may already exist");
    }
    try {
      await db.query(`ALTER TABLE agents ADD COLUMN version INTEGER DEFAULT 1`);
      console.log("Migration: version column added");
    } catch (err: any) {
      if (!err.message.includes('already exists')) console.log("Migration: version may already exist");
    }
    try {
      await db.query(`ALTER TABLE agents ADD COLUMN monthly_price DECIMAL(10,2) DEFAULT 0`);
      console.log("Migration: monthly_price column added");
    } catch (err: any) {
      if (!err.message.includes('already exists')) console.log("Migration: monthly_price may already exist");
    }
    try {
      await db.query(`ALTER TABLE agents ADD COLUMN is_orchestrator BOOLEAN DEFAULT false`);
      console.log("Migration: is_orchestrator column added");
    } catch (err: any) {
      if (!err.message.includes('already exists')) console.log("Migration: is_orchestrator may already exist");
    }
    try {
      await db.query(`ALTER TABLE agents ADD COLUMN agent_order INTEGER DEFAULT 0`);
      console.log("Migration: agent_order column added");
    } catch (err: any) {
      if (!err.message.includes('already exists')) console.log("Migration: agent_order may already exist");
    }

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

    // Migration: Create users table (funcionários da empresa)
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL REFERENCES tenants(id),
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT,
          name TEXT NOT NULL,
          role TEXT DEFAULT 'user',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("users table created/verified");
    } catch (err) {
      console.log("users table may already exist:", err);
    }

    // Migration: Create user_agents table (agentes liberados por usuário)
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS user_agents (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          tenant_agent_id INTEGER NOT NULL REFERENCES tenant_agents(id),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, tenant_agent_id)
        )
      `);
      console.log("user_agents table created/verified");
    } catch (err) {
      console.log("user_agents table may already exist:", err);
    }

    // Agent Documents (RAG)
    console.log("Creating agent_documents table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS agent_documents (
        id SERIAL PRIMARY KEY,
        agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        source_type TEXT NOT NULL,
        content TEXT,
        file_url TEXT,
        website_url TEXT,
        is_global BOOLEAN DEFAULT false,
        processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("agent_documents table created/verified");

    // Migration: Add is_global column if not exists
    try {
      await db.query(`ALTER TABLE agent_documents ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false`);
      console.log("Migration: is_global column added to agent_documents");
    } catch (err) {
      console.log("Migration: agent_documents is_global column may already exist");
    }

    // Migration: Add tenant_id column for multi-tenant RAG documents
    try {
      await db.query(`ALTER TABLE agent_documents ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id)`);
      console.log("Migration: tenant_id column added to agent_documents");
    } catch (err: any) {
      if (!err.message.includes('already exists')) console.log("Migration: agent_documents tenant_id may already exist");
    }

    // Try to enable pgvector extension (may require superuser)
    try {
      console.log("Attempting to enable pgvector extension...");
      await db.query(`CREATE EXTENSION IF NOT EXISTS vector`);
      console.log("pgvector extension enabled");

      // Create embeddings table
      console.log("Creating agent_documents_embeddings table...");
      await db.query(`
        CREATE TABLE IF NOT EXISTS agent_documents_embeddings (
          id SERIAL PRIMARY KEY,
          document_id INTEGER NOT NULL REFERENCES agent_documents(id) ON DELETE CASCADE,
          chunk_index INTEGER NOT NULL DEFAULT 0,
          embedding vector(1024),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log("agent_documents_embeddings table created/verified");

      // Create index for vector similarity search
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_embeddings_cosine
        ON agent_documents_embeddings
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
      `);
      console.log("Vector index created");
    } catch (err) {
      console.log("pgvector not available, skipping embeddings table:", err);
    }

    // Seed data if empty
    console.log("Checking for existing data...");
    const res = await db.query('SELECT count(*) as count FROM tenants');
    const count = parseInt(res.rows[0].count);
    console.log(`Found ${count} tenants`);
    
    if (count === 0) {
      console.log('Seeding database...');
      // ... seeding code ...
    }
  } catch (err) {
    console.error('Error initializing database:', err);
    throw err;
  }
}

export default db;
