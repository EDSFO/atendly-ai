# Agent Workspace Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar área central para exibição de conteúdo rico gerado pelos agentes, coexistindo com chat widget.

**Architecture:** Backend com novo endpoint `/api/agent/chat` retorna conteúdo rico. Frontend com `AgentWorkspace`, `CentralPanel`, e renderizadores de conteúdo. Chat widget continua funcionando normalmente.

**Tech Stack:** React + TypeScript, Express.js, PostgreSQL

---

## File Structure

```
server/
├── db.ts                    # Migrations: users, user_agents
├── agents.ts               # Funções de usuários e agentes
├── server.ts               # Rotas: /api/users, /api/user/agents, /api/agent/chat

src/
├── types.ts                 # Adicionar: User, UserAgent, RichContent interfaces
├── hooks/
│   └── useAgentWorkspace.ts # Hook para gerenciar estado do workspace
├── components/
│   ├── AgentWorkspace.tsx  # Container principal (nova página/route)
│   ├── CentralPanel.tsx     # Painel central para conteúdo rico
│   ├── AgentSidebar.tsx    # Lista de agentes disponíveis
│   ├── AgentChatPanel.tsx  # Painel lateral de chat alternativo
│   ├── RichContentRenderer.tsx  # Renderizador de conteúdo
│   │   ├── TextRenderer.tsx
│   │   ├── ImageRenderer.tsx
│   │   ├── CardRenderer.tsx
│   │   ├── CarouselRenderer.tsx
│   │   ├── LinkRenderer.tsx
│   │   ├── CodeRenderer.tsx
│   │   └── CompositeRenderer.tsx
│   └── ChatWidget.tsx      # Modificar: receber callbacks para rich content
└── App.tsx                 # Adicionar rota: /workspace/:tenantSlug
```

---

## Tasks

### Task 1: Database Migrations - Tabelas users e user_agents

**Files:**
- Modify: `server/db.ts:1-50` (imports)

- [ ] **Step 1: Adicionar migrations das tabelas users e user_agents em db.ts**

Adicionar após a criação da tabela `agents`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add server/db.ts
git commit -m "feat: add users and user_agents tables for B2B workspace

- users: funcionários da empresa com email, password, role
- user_agents: agentes liberados por usuário

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Backend - Types e Interfaces

**Files:**
- Modify: `src/types.ts:1-40` (adicionar no final)

- [ ] **Step 1: Adicionar interfaces de User e RichContent**

```typescript
// User (funcionário)
export interface User {
  id: number;
  tenant_id: number;
  email: string;
  name: string;
  role: 'user' | 'manager' | 'admin';
  is_active: boolean;
  created_at: string;
}

// User Agent (agente liberado para usuário)
export interface UserAgent {
  id: number;
  user_id: number;
  tenant_agent_id: number;
  is_active: boolean;
}

// Rich Content Types
export type RichContentType = 'text' | 'image' | 'card' | 'carousel' | 'link' | 'code' | 'composite';

export interface RichContent {
  type: RichContentType;
  content: any;
  panel?: 'marketing' | 'sales' | 'support' | 'default';
}

export interface AgentChatResponse {
  text: string;
  rich_content?: RichContent;
  panel_to_open?: string;
  agent_used?: {
    id: number;
    name: string;
    sub_agent_id?: number;
    sub_agent_name?: string;
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add User, UserAgent, and RichContent types

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Backend - Functions de Users e UserAgents

**Files:**
- Create: `server/users.ts`

- [ ] **Step 1: Criar arquivo server/users.ts**

```typescript
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
    SELECT ua.*, ta.agent_id, ta.custom_personality, a.name as agent_name, a.agent_type, a.system_prompt
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
```

- [ ] **Step 2: Commit**

```bash
git add server/users.ts
git commit -m "feat: add users and user_agents management functions

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Backend - Rotas de Users e UserAgents

**Files:**
- Modify: `server/server.ts:1-60` (imports)
- Modify: `server/server.ts` (add routes after catalog routes ~line 600)

- [ ] **Step 1: Adicionar imports**

Adicionar no início do arquivo `server/server.ts` com os outros imports:

```typescript
import {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getUserAgents,
  addUserAgent,
  removeUserAgent,
  getAvailableAgentsForUser
} from "./server/users";
```

- [ ] **Step 2: Adicionar rotas de users**

Adicionar após as rotas de catalog sub-agent documents (após a linha `// Delete document from catalog sub-agent` ~linha 620):

```typescript
// ========== USERS API (MANAGER) ==========

// Get users for tenant
app.get("/api/tenants/:tenantId/users", async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    const users = await getUsers(tenantId);
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to get users" });
  }
});

// Create user
app.post("/api/users", async (req, res) => {
  try {
    const { tenant_id, email, password_hash, name, role } = req.body;
    if (!tenant_id || !email || !password_hash || !name) {
      return res.status(400).json({ error: "tenant_id, email, password_hash, and name are required" });
    }
    const user = await createUser({ tenant_id, email, password_hash, name, role });
    res.json(user);
  } catch (error: any) {
    console.error(error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: "Failed to create user" });
  }
});

// Update user
app.put("/api/users/:id", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { name, email, is_active } = req.body;
    const user = await updateUser(userId, { name, email, is_active });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// Delete user
app.delete("/api/users/:id", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    await deleteUser(userId);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// ========== USER AGENTS API ==========

// Get agents available for a user
app.get("/api/users/:userId/agents/available", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const agents = await getAvailableAgentsForUser(userId);
    res.json(agents);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to get available agents" });
  }
});

// Get user's assigned agents
app.get("/api/users/:userId/agents", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const agents = await getUserAgents(userId);
    res.json(agents);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to get user agents" });
  }
});

// Assign agent to user
app.post("/api/users/:userId/agents", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { tenant_agent_id } = req.body;
    if (!tenant_agent_id) {
      return res.status(400).json({ error: "tenant_agent_id is required" });
    }
    const userAgent = await addUserAgent(userId, tenant_agent_id);
    res.json(userAgent);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to assign agent" });
  }
});

// Remove agent from user
app.delete("/api/users/:userId/agents/:tenantAgentId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const tenantAgentId = parseInt(req.params.tenantAgentId);
    await removeUserAgent(userId, tenantAgentId);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to remove agent" });
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add server/server.ts
git commit -m "feat: add users and user_agents API routes

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Backend - Endpoint de Chat com Rich Content

**Files:**
- Modify: `server/server.ts` (add new endpoint around line 680 after catalog routes)
- Modify: `server/ai.ts` (add handleAgentChat function after handleMultiAgentChat ~line 565)

- [ ] **Step 1: Adicionar imports necessários no início de ai.ts**

Adicionar import de getUserAgents:
```typescript
// Importar getUserAgents de users.ts (criado na Task 3)
import { getUserAgents } from './users';
```

- [ ] **Step 2: Adicionar função handleAgentChat em ai.ts**

Adicionar após handleMultiAgentChat (aproximadamente linha 565):

```typescript
// Handle Agent Chat with Rich Content Response
export async function handleAgentChat(
  message: string,
  tenant_id: number,
  user_id: number,
  agent_id: number,
  history: any[],
  options: {
    return_rich_content?: boolean;
    preferred_panel?: string;
  } = {}
): Promise<{
  text: string;
  rich_content?: {
    type: string;
    content: any;
    panel?: string;
  };
  panel_to_open?: string;
  agent_used?: {
    id: number;
    name: string;
    sub_agent_id?: number;
    sub_agent_name?: string;
  };
}> {
  // Get user's agents to find available orchestrator
  const userAgents = await getUserAgents(user_id);
  const orchestrator = userAgents.find((ua: any) => ua.is_orchestrator);

  if (!orchestrator) {
    // Fallback to regular chat if no orchestrator found
    const response = await handleChat(message, tenant_id, history, agent_id);
    return { text: response };
  }

  // Get RAG context for the tenant
  const ragContext = await buildRAGContext(orchestrator.agent_id, tenant_id);

  // Build system prompt with RAG context
  let systemPrompt = orchestrator.system_prompt || '';
  if (ragContext) {
    systemPrompt += `\n\n${ragContext}`;
  }

  // Use handleChat to process the message
  const response = await handleChat(message, tenant_id, history, orchestrator.agent_id);

  // Determine content type based on agent_type
  let contentType = 'text';
  let panel = 'default';

  if (orchestrator.agent_type === 'marketing') {
    contentType = 'carousel';
    panel = 'marketing';
  } else if (orchestrator.agent_type === 'sales') {
    contentType = 'card';
    panel = 'sales';
  } else if (orchestrator.agent_type === 'suporte') {
    contentType = 'text';
    panel = 'support';
  }

  // Build rich content based on response and agent type
  // NOTE: This is a basic implementation. For production, consider:
  // 1. Using LLM to structure the response into proper format
  // 2. JSON parsing if the LLM returns structured JSON
  // 3. Different prompts per agent type for better formatting
  const richContent = options.return_rich_content ? {
    type: contentType,
    content: buildRichContentFromResponse(response, orchestrator.agent_type),
    panel
  } : undefined;

  return {
    text: response,
    rich_content: richContent,
    panel_to_open: richContent?.panel,
    agent_used: {
      id: orchestrator.agent_id,
      name: orchestrator.agent_name,
      sub_agent_id: orchestrator.id,
      sub_agent_name: orchestrator.agent_name
    }
  };
}

/**
 * Build rich content structure from text response.
 * This is a basic implementation - for production, enhance with LLM-guided formatting.
 */
function buildRichContentFromResponse(text: string, agentType: string): any {
  // Try to parse as JSON if response looks like JSON
  try {
    if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
      const parsed = JSON.parse(text);
      return parsed;
    }
  } catch (e) {
    // Not JSON, continue with text processing
  }

  // Default: wrap text in simple structure based on agent type
  if (agentType === 'marketing') {
    // Split by double newlines or numbered items to create carousel
    const items = text.split(/\n\n|\n(?=\d+\.)/).filter(s => s.trim());
    return {
      items: items.slice(0, 5).map((item, idx) => ({
        title: `Item ${idx + 1}`,
        caption: item.trim()
      }))
    };
  } else if (agentType === 'sales') {
    return {
      title: 'Proposta',
      description: text,
      actions: [
        { label: 'Copiar', type: 'copy', data: text }
      ]
    };
  }
  return { content: text };
}
```

- [ ] **Step 2: Adicionar rota /api/agent/chat em server.ts**

Adicionar após rotas de users:

```typescript
// ========== AGENT CHAT API (RICH CONTENT) ==========

app.post("/api/agent/chat", async (req, res) => {
  try {
    const { message, tenant_id, user_id, agent_id, history, return_rich_content } = req.body;

    if (!message || !tenant_id || !user_id) {
      return res.status(400).json({ error: "message, tenant_id, and user_id are required" });
    }

    const result = await handleAgentChat(message, tenant_id, user_id, agent_id, history || [], {
      return_rich_content: return_rich_content !== false
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Chat failed" });
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add server/ai.ts server/server.ts
git commit -m "feat: add /api/agent/chat endpoint with rich content support

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Frontend - RichContentRenderer Components

**Files:**
- Create: `src/components/RichContentRenderer.tsx`

- [ ] **Step 1: Criar RichContentRenderer.tsx**

```typescript
import { RichContent } from '../types';
import TextRenderer from './renderers/TextRenderer';
import ImageRenderer from './renderers/ImageRenderer';
import CardRenderer from './renderers/CardRenderer';
import CarouselRenderer from './renderers/CarouselRenderer';
import LinkRenderer from './renderers/LinkRenderer';
import CodeRenderer from './renderers/CodeRenderer';
import CompositeRenderer from './renderers/CompositeRenderer';

interface Props {
  content: RichContent;
  onAction?: (action: string, data: any) => void;
}

export default function RichContentRenderer({ content, onAction }: Props) {
  switch (content.type) {
    case 'text':
      return <TextRenderer content={content.content} />;
    case 'image':
      return <ImageRenderer content={content.content} />;
    case 'card':
      return <CardRenderer content={content.content} onAction={onAction} />;
    case 'carousel':
      return <CarouselRenderer content={content.content} onAction={onAction} />;
    case 'link':
      return <LinkRenderer content={content.content} />;
    case 'code':
      return <CodeRenderer content={content.content} />;
    case 'composite':
      return <CompositeRenderer content={content.content} onAction={onAction} />;
    default:
      return <TextRenderer content={String(content.content)} />;
  }
}
```

- [ ] **Step 2: Criar renderers/TextRenderer.tsx**

```typescript
interface Props {
  content: { content: string } | string;
}

export default function TextRenderer({ content }: Props) {
  const text = typeof content === 'string' ? content : content.content;

  return (
    <div className="prose prose-invert max-w-none">
      <p className="text-white whitespace-pre-wrap">{text}</p>
    </div>
  );
}
```

- [ ] **Step 3: Criar renderers/CarouselRenderer.tsx**

```typescript
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CarouselItem {
  title?: string;
  image?: string;
  caption?: string;
  description?: string;
}

interface Props {
  content: { items: CarouselItem[] } | CarouselItem[];
  onAction?: (action: string, data: any) => void;
}

export default function CarouselRenderer({ content, onAction }: Props) {
  const items = Array.isArray(content) ? content : content.items;
  const [currentIndex, setCurrentIndex] = useState(0);

  const prev = () => setCurrentIndex((i) => (i === 0 ? items.length - 1 : i - 1));
  const next = () => setCurrentIndex((i) => (i === items.length - 1 ? 0 : i + 1));

  if (!items || items.length === 0) {
    return <p className="text-neutral-500">Nenhum conteúdo disponível</p>;
  }

  const current = items[currentIndex];

  return (
    <div className="relative">
      <div className="bg-[#0A0A0A] border border-white/10 p-4">
        {current.image && (
          <img src={current.image} alt={current.title || ''} className="w-full h-48 object-cover mb-3" />
        )}
        {current.title && (
          <h4 className="text-white font-medium text-lg mb-2">{current.title}</h4>
        )}
        {current.caption && (
          <p className="text-neutral-300 text-sm mb-2">{current.caption}</p>
        )}
        {current.description && (
          <p className="text-neutral-400 text-xs">{current.description}</p>
        )}
      </div>

      {items.length > 1 && (
        <div className="flex justify-center items-center gap-4 mt-4">
          <button onClick={prev} className="p-2 border border-white/10 hover:border-white/30">
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>
          <span className="text-neutral-500 text-xs font-mono">
            {currentIndex + 1} / {items.length}
          </span>
          <button onClick={next} className="p-2 border border-white/10 hover:border-white/30">
            <ChevronRight className="w-4 h-4 text-white" />
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Criar renderers/CardRenderer.tsx**

```typescript
interface CardContent {
  title?: string;
  description?: string;
  image?: string;
  actions?: Array<{ label: string; type: string; data?: any }>;
}

interface Props {
  content: CardContent;
  onAction?: (action: string, data: any) => void;
}

export default function CardRenderer({ content, onAction }: Props) {
  return (
    <div className="bg-[#0A0A0A] border border-white/10 overflow-hidden">
      {content.image && (
        <img src={content.image} alt={content.title || ''} className="w-full h-32 object-cover" />
      )}
      <div className="p-4">
        {content.title && (
          <h4 className="text-white font-medium text-lg mb-2">{content.title}</h4>
        )}
        {content.description && (
          <p className="text-neutral-400 text-sm mb-4">{content.description}</p>
        )}
        {content.actions && content.actions.length > 0 && (
          <div className="flex gap-2">
            {content.actions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => onAction?.(action.type, action.data)}
                className="px-3 py-1 text-[10px] font-mono uppercase border border-[#F97316]/50 text-[#F97316] hover:bg-[#F97316]/10"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Criar outros renderers simplificados**

**renderers/ImageRenderer.tsx:**
```typescript
interface Props {
  content: { url: string; caption?: string } | { url: string };
}

export default function ImageRenderer({ content }: Props) {
  const url = typeof content === 'string' ? content : content.url;
  const caption = typeof content === 'string' ? undefined : content.caption;

  return (
    <div>
      <img src={url} alt={caption || ''} className="max-w-full" />
      {caption && <p className="text-neutral-500 text-xs mt-2">{caption}</p>}
    </div>
  );
}
```

**renderers/LinkRenderer.tsx:**
```typescript
interface Props {
  content: { url: string; title?: string; description?: string };
}

export default function LinkRenderer({ content }: Props) {
  return (
    <a
      href={content.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-[#0A0A0A] border border-white/10 p-4 hover:border-[#F97316]/50 transition-colors"
    >
      {content.title && <h4 className="text-white font-medium">{content.title}</h4>}
      {content.description && <p className="text-neutral-400 text-sm">{content.description}</p>}
      <span className="text-[#F97316] text-xs font-mono">{content.url}</span>
    </a>
  );
}
```

**renderers/CodeRenderer.tsx:**
```typescript
interface Props {
  content: { language?: string; code: string } | string;
}

export default function CodeRenderer({ content }: Props) {
  const language = typeof content === 'string' ? 'text' : content.language || 'text';
  const code = typeof content === 'string' ? content : content.code;

  return (
    <pre className="bg-[#0A0A0A] border border-white/10 p-4 overflow-x-auto">
      <code className="text-green-400 text-xs font-mono">{code}</code>
    </pre>
  );
}
```

**renderers/CompositeRenderer.tsx:**
```typescript
import RichContentRenderer from '../RichContentRenderer';

interface Props {
  content: { elements: any[] };
  onAction?: (action: string, data: any) => void;
}

export default function CompositeRenderer({ content, onAction }: Props) {
  return (
    <div className="space-y-4">
      {content.elements.map((element, idx) => (
        <RichContentRenderer key={idx} content={element} onAction={onAction} />
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Criar arquivo index para export**

Criar `src/components/renderers/index.ts`:
```typescript
export { default as TextRenderer } from './TextRenderer';
export { default as ImageRenderer } from './ImageRenderer';
export { default as CardRenderer } from './CardRenderer';
export { default as CarouselRenderer } from './CarouselRenderer';
export { default as LinkRenderer } from './LinkRenderer';
export { default as CodeRenderer } from './CodeRenderer';
export { default as CompositeRenderer } from './CompositeRenderer';
```

- [ ] **Step 7: Commit**

```bash
git add src/components/RichContentRenderer.tsx src/components/renderers/
git commit -m "feat: add RichContentRenderer and content type components

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Frontend - CentralPanel Component

**Files:**
- Create: `src/components/CentralPanel.tsx`

- [ ] **Step 1: Criar CentralPanel.tsx**

```typescript
import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { RichContent } from '../types';
import RichContentRenderer from './RichContentRenderer';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  content?: RichContent;
  agentName?: string;
  isLoading?: boolean;
  error?: string;
}

export default function CentralPanel({ isOpen, onClose, content, agentName, isLoading, error }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div className="relative flex-1 ml-auto w-2/3 max-w-4xl bg-[#0A0A0A] border-l border-white/10 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-white/5">
          <div>
            <span className="text-[10px] font-mono uppercase text-neutral-500 tracking-widest">
              {agentName || 'Agente'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-[#F97316]" />
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <p className="text-red-500">{error}</p>
            </div>
          )}

          {!isLoading && !error && content && (
            <RichContentRenderer content={content} />
          )}

          {!isLoading && !error && !content && (
            <div className="flex items-center justify-center h-full">
              <p className="text-neutral-500">Aguardando resposta do agente...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CentralPanel.tsx
git commit -m "feat: add CentralPanel component for rich content display

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Frontend - AgentSidebar Component

**Files:**
- Create: `src/components/AgentSidebar.tsx`

- [ ] **Step 1: Criar AgentSidebar.tsx**

```typescript
import { Bot } from 'lucide-react';

interface UserAgent {
  id: number;
  agent_id: number;
  agent_name: string;
  agent_type: string;
  is_orchestrator: boolean;
}

interface Props {
  agents: UserAgent[];
  selectedAgentId?: number;
  onSelectAgent: (agent: UserAgent) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function AgentSidebar({ agents, selectedAgentId, onSelectAgent, isCollapsed, onToggleCollapse }: Props) {
  if (isCollapsed) {
    return (
      <div className="w-16 bg-[#0A0A0A] border-r border-white/5 flex flex-col items-center py-4">
        <button onClick={onToggleCollapse} className="p-2 hover:bg-white/5">
          <Bot className="w-5 h-5 text-neutral-500" />
        </button>
        {agents.slice(0, 5).map((agent) => (
          <button
            key={agent.id}
            onClick={() => onSelectAgent(agent)}
            className="p-2 mt-2 hover:bg-white/5"
          >
            <div className="w-8 h-8 bg-[#F97316]/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-[#F97316]" />
            </div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="w-64 bg-[#0A0A0A] border-r border-white/5 flex flex-col">
      <div className="p-4 border-b border-white/5">
        <h3 className="text-white text-sm font-medium uppercase tracking-tight">
          Meus Agentes
        </h3>
        <p className="text-neutral-500 text-xs mt-1">
          {agents.length} agente(s)
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => onSelectAgent(agent)}
            className={`w-full p-3 flex items-center gap-3 transition-colors ${
              selectedAgentId === agent.agent_id
                ? 'bg-[#F97316]/10 border border-[#F97316]/30'
                : 'hover:bg-white/5 border border-transparent'
            }`}
          >
            <div className={`w-10 h-10 flex items-center justify-center ${
              selectedAgentId === agent.agent_id ? 'bg-[#F97316]' : 'bg-white/10'
            }`}>
              <Bot className={`w-5 h-5 ${selectedAgentId === agent.agent_id ? 'text-black' : 'text-neutral-400'}`} />
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{agent.agent_name}</p>
              <p className="text-neutral-500 text-xs uppercase">{agent.agent_type}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AgentSidebar.tsx
git commit -m "feat: add AgentSidebar component for agent selection

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 9: Frontend - useAgentWorkspace Hook

**Files:**
- Create: `src/hooks/useAgentWorkspace.ts`

- [ ] **Step 1: Criar useAgentWorkspace.ts**

```typescript
import { useState, useEffect } from 'react';
import { RichContent } from '../types';

interface User {
  id: number;
  tenant_id: number;
  name: string;
  email: string;
}

interface UserAgent {
  id: number;
  agent_id: number;
  agent_name: string;
  agent_type: string;
  is_orchestrator: boolean;
  custom_personality?: any;
  system_prompt?: string;
}

export function useAgentWorkspace(userId: number | null) {
  const [user, setUser] = useState<User | null>(null);
  const [agents, setAgents] = useState<UserAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<UserAgent | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user and agents
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    Promise.all([
      fetch(`/api/users/${userId}`).then(r => r.json()),
      fetch(`/api/users/${userId}/agents`).then(r => r.json())
    ]).then(([userData, agentsData]) => {
      setUser(userData);
      setAgents(agentsData);

      // Auto-select orchestrator if available
      const orchestrator = agentsData.find((a: UserAgent) => a.is_orchestrator);
      if (orchestrator) {
        setSelectedAgent(orchestrator);
      } else if (agentsData.length > 0) {
        setSelectedAgent(agentsData[0]);
      }
    }).catch(err => {
      console.error('Error fetching workspace data:', err);
    }).finally(() => {
      setLoading(false);
    });
  }, [userId]);

  return { user, agents, selectedAgent, setSelectedAgent, loading };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useAgentWorkspace.ts
git commit -m "feat: add useAgentWorkspace hook for state management

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 10: Frontend - AgentWorkspace Component

**Files:**
- Create: `src/components/AgentWorkspace.tsx`

- [ ] **Step 1: Criar AgentWorkspace.tsx**

```typescript
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import CentralPanel from './CentralPanel';
import AgentSidebar from './AgentSidebar';
import { RichContent, AgentChatResponse } from '../types';
import { useAgentWorkspace } from '../hooks/useAgentWorkspace';

interface Props {
  userId: number;
  tenantId: number;
  onLogout: () => void;
}

export default function AgentWorkspace({ userId, tenantId, onLogout }: Props) {
  const { user, agents, selectedAgent, setSelectedAgent, loading } = useAgentWorkspace(userId);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelContent, setPanelContent] = useState<RichContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAgentResponse = (response: AgentChatResponse) => {
    if (response.rich_content) {
      setPanelContent(response.rich_content);
      setIsPanelOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#F97316]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <p className="text-white">Usuário não encontrado</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex">
      {/* Sidebar */}
      <AgentSidebar
        agents={agents}
        selectedAgentId={selectedAgent?.agent_id}
        onSelectAgent={setSelectedAgent}
      />

      {/* Main Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 bg-[#0A0A0A] border-b border-white/5 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-white font-medium">Agent Workspace</h1>
            {selectedAgent && (
              <span className="text-[10px] font-mono uppercase text-[#F97316] bg-[#F97316]/10 px-2 py-1">
                {selectedAgent.agent_name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-neutral-500 text-sm">{user.name}</span>
            <button
              onClick={onLogout}
              className="text-[10px] font-mono uppercase text-neutral-400 hover:text-white px-4 py-2 border border-white/10 hover:border-white/30"
            >
              Sair
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-neutral-500 text-lg mb-2">Workspace do Agente</p>
            <p className="text-neutral-600 text-sm">
              Use o chat para solicitar conteúdo ao agente.
              {selectedAgent && ` Agente atual: ${selectedAgent.agent_name}`}
            </p>
          </div>
        </div>
      </div>

      {/* Central Panel */}
      <CentralPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        content={panelContent || undefined}
        agentName={selectedAgent?.agent_name}
        isLoading={isLoading}
        error={error || undefined}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AgentWorkspace.tsx
git commit -m "feat: add AgentWorkspace container component

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 11: Frontend - Integração ChatWidget com Rich Content

**Files:**
- Modify: `src/components/ChatWidget.tsx:65-95`

- [ ] **Step 1: Modificar handleSend para detectar rich content**

Modificar a função `handleSend` para verificar se há rich_content na resposta e passar para callback:

```typescript
// Adicionar props:
interface ChatWidgetProps {
  tenant: Tenant;
  onRichContent?: (content: RichContent, agentName: string) => void;
}

// No handleSend, após receber resposta:
const data = await res.json();
const responseText = data.text || data.response || 'Erro ao processar resposta';
setMessages(prev => [...prev, { role: 'model', text: responseText }]);

// Se houver rich_content, chamar callback
if (data.rich_content && onRichContent) {
  onRichContent(data.rich_content, selectedAgent?.name || 'Agente');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ChatWidget.tsx
git commit -m "feat: add onRichContent callback to ChatWidget

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 12: Frontend - Adicionar rotas em App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Adicionar rota /workspace/:tenantSlug**

Adicionar novo case antes do fallback:

```typescript
// Workspace route for agent users
if (path.startsWith('/workspace/')) {
  const workspaceSlug = parts[1];
  return <AgentWorkspacePage slug={workspaceSlug} onLogout={handleLogout} />;
}
```

Criar componente AgentWorkspacePage que usa useTenant e AgentWorkspace:

```typescript
function AgentWorkspacePage({ slug, onLogout }: { slug: string; onLogout: () => void }) {
  const { tenant, loading } = useTenant(slug);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Simulated login - in real app, use actual auth
  useEffect(() => {
    if (tenant) {
      // For demo, get first user of tenant
      fetch(`/api/tenants/${tenant.id}/users`)
        .then(r => r.json())
        .then(users => {
          if (users.length > 0) {
            setCurrentUser(users[0]);
          }
        });
    }
  }, [tenant]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!tenant || !currentUser) {
    return <div>Not found</div>;
  }

  return (
    <AgentWorkspace
      userId={currentUser.id}
      tenantId={tenant.id}
      onLogout={onLogout}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add /workspace route for AgentWorkspace

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Resumo das Tasks

| Task | Descrição | Status |
|------|-----------|--------|
| 1 | Database: users e user_agents | Pending |
| 2 | Backend: Types e Interfaces | Pending |
| 3 | Backend: Functions de Users | Pending |
| 4 | Backend: Rotas de Users | Pending |
| 5 | Backend: Endpoint /api/agent/chat | Pending |
| 6 | Frontend: RichContentRenderers | Pending |
| 7 | Frontend: CentralPanel | Pending |
| 8 | Frontend: AgentSidebar | Pending |
| 9 | Frontend: useAgentWorkspace hook | Pending |
| 10 | Frontend: AgentWorkspace | Pending |
| 11 | Frontend: ChatWidget integration | Pending |
| 12 | Frontend: Routes | Pending |
| 13 | Frontend: AgentChatPanel (lateral) | Pending |
| 14 | Frontend: Tests | Pending |

---

### Task 13: Frontend - AgentChatPanel (Painel Lateral de Chat)

**Files:**
- Create: `src/components/AgentChatPanel.tsx`

- [ ] **Step 1: Criar AgentChatPanel.tsx**

Painel lateral de chat alternativo ao ChatWidget, integrado com o workspace:

```typescript
import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { UserAgent } from '../types';
import CentralPanel from './CentralPanel';
import { RichContent } from '../types';

interface Props {
  userId: number;
  tenantId: number;
  agent: UserAgent;
  onClose: () => void;
  isOpen: boolean;
}

export default function AgentChatPanel({ userId, tenantId, agent, onClose, isOpen }: Props) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [panelContent, setPanelContent] = useState<RichContent | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (agent) {
      setMessages([{
        role: 'model',
        text: `Olá! Sou o ${agent.agent_name}. Como posso ajudar?`
      }]);
    }
  }, [agent]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          tenant_id: tenantId,
          user_id: userId,
          agent_id: agent.agent_id,
          history: messages.map(m => ({ role: m.role, text: m.text })),
          return_rich_content: true
        }),
      });

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'model', text: data.text }]);

      // If rich content, open central panel
      if (data.rich_content) {
        setPanelContent(data.rich_content);
        setIsPanelOpen(true);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "Erro ao processar resposta." }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed right-0 top-0 bottom-0 w-96 bg-[#0A0A0A] border-l border-white/10 z-50 flex flex-col">
        {/* Header */}
        <div className="p-4 flex justify-between items-center border-b border-white/5">
          <div>
            <h3 className="text-white font-medium">{agent.agent_name}</h3>
            <p className="text-neutral-500 text-xs uppercase">{agent.agent_type}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5">
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-[#F97316] text-black'
                  : 'bg-white/5 border border-white/10 text-neutral-300'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/5 p-3">
                <Loader2 className="w-4 h-4 animate-spin text-[#F97316]" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/5">
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="flex-1 px-4 py-2 input-dark text-sm"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-2 bg-[#F97316] text-black disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Central Panel */}
      <CentralPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        content={panelContent || undefined}
        agentName={agent.agent_name}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AgentChatPanel.tsx
git commit -m "feat: add AgentChatPanel lateral chat component

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 14: Frontend - Tests

**Files:**
- Create: `tests/workspace.test.tsx` (ou usar arquivo de testes existente)

**Nota:** Testes podem ser adicionados após implementação completa das tasks anteriores. Por enquanto, usar teste manual verificando:

1. Acessar `/workspace/:slug`
2. Verificar se sidebar mostra agentes
3. Enviar mensagem via chat
4. Verificar se painel central abre com conteúdo

- [ ] **Step 1: Adicionar testes básicos (após implementar tasks anteriores)**

```typescript
// tests/workspace.test.tsx
describe('AgentWorkspace', () => {
  it('should render workspace with sidebar', () => {
    // TODO: Add proper tests after implementation
  });

  it('should open central panel on rich content', () => {
    // TODO: Add proper tests after implementation
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/workspace.test.tsx
git commit -m "test: add workspace tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
