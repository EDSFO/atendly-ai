# Design: Agent Workspace - Área Central para Conteúdo Rico

## Problema

Clientes que adquirem agentes no catálogo (ex: agente de marketing, vendas) precisam de uma área para visualizar o conteúdo rico gerado pelos agentes. O chat widget atual é restrito para mensagens de texto e não suporta tipos de conteúdo ricos como imagens, cards, carrosséis, código, etc.

## Arquitetura de Camadas

### três camadas de acesso

1. **Admin** (desenvolvedor/criador) → cria agentes base no catálogo com informações principais
2. **Manager** (dono da empresa) → cadastra funcionários, libera agentes, configura RAG e personalidade do negócio
3. **User** (funcionário) → usa os agentes liberados pelo Manager

### Modelo B2B

- Proprietário adquire agentes do catálogo
- Proprietário (Manager) libera agentes para funcionários
- Funcionários (User) usam agentes via Orquestrador
- Se 1 funcionário + múltiplos agentes → Orquestrador faz roteamento

## Solução: Painel Central Coexistente

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│                         HEADER                               │
│  Logo  │  Empresa: {nome}  │  Agente: Orquestrador  │ Sair │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐    ┌──────────────────────────────────┐ │
│  │  Agentes do     │    │                                  │ │
│  │  Funcionário    │    │     ÁREA CENTRAL                 │ │
│  │                 │    │     (Conteúdo Gerado)             │ │
│  │  □ Marketing    │    │                                  │ │
│  │  □ Vendas      │    │  - Textos                         │ │
│  │  □ Suporte     │    │  - Imagens                        │ │
│  │                 │    │  - Links                          │ │
│  │                 │    │  - Cards                           │ │
│  │                 │    │  - etc                            │ │
│  └─────────────────┘    │                                  │ │
│                          │                                  │ │
│                          └──────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  CHAT WIDGET ( Canto inferior )                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Fluxo de Interação

1. User digita no chat: "gere um criativo para campanha de marketing"
2. Chat widget envia para API com flag `return_rich_content: true`
3. Backend processa via agente apropiado (usando sub-agentes e RAG)
4. Backend retorna resposta com conteúdo rico
5. Frontend abre painel central com conteúdo
6. Chat widget mantém histórico conversacional

## Estrutura de Dados

### API de Chat Atualizada

```typescript
// Request
POST /api/chat
{
  "message": "gere um criativo...",
  "tenant_id": 1,
  "user_id": 1,           // ID do funcionário
  "agent_id": 1,          // orquestrador
  "history": [],
  "return_rich_content": true
}

// Response
{
  "text": "Aqui está o criativo...",
  "rich_content": {
    "type": "carousel",
    "content": {
      "items": [
        { "title": "Post 1", "image": "url", "caption": "legenda" },
        { "title": "Post 2", "image": "url", "caption": "legenda" }
      ]
    }
  },
  "panel_to_open": "marketing",
  "agent_used": { "id": 3, "name": "Marketing Agent" }
}
```

### Tipos de Conteúdo Rico

| Tipo | Descrição | Estrutura |
|------|-----------|-----------|
| `text` | Texto simples ou markdown | `{ "content": "..." }` |
| `image` | Imagem com fonte | `{ "url": "...", "caption": "..." }` |
| `card` | Card com título e ações | `{ "title": "...", "description": "...", "actions": [...] }` |
| `carousel` | Slider de cards | `{ "items": [...] }` |
| `link` | Link com preview | `{ "url": "...", "title": "...", "description": "..." }` |
| `code` | Código com syntax highlighting | `{ "language": "...", "code": "..." }` |
| `composite` | Múltiplos elementos | `{ "elements": [...] }` |

### Interface do AgentResponse

```typescript
interface AgentResponse {
  type: 'text' | 'image' | 'card' | 'carousel' | 'link' | 'code' | 'composite';
  content: any;
  panel?: 'marketing' | 'sales' | 'support' | 'default';
}
```

## Componentes Frontend

### Arquitetura de Componentes

```
src/components/
├── AgentWorkspace.tsx      # Container principal da área User
├── CentralPanel.tsx        # Painel central para conteúdo rico
├── AgentSidebar.tsx        # Lista de agentes disponíveis
├── RichContentRenderer.tsx # Renderiza tipos diferentes de conteúdo
│   ├── TextRenderer.tsx
│   ├── ImageRenderer.tsx
│   ├── CardRenderer.tsx
│   ├── CarouselRenderer.tsx
│   ├── LinkRenderer.tsx
│   ├── CodeRenderer.tsx
│   └── CompositeRenderer.tsx
├── ChatWidget.tsx          # Mantém chat widget existente (não modifica)
└── AgentChatPanel.tsx     # Painel de chat alternativo (lateral)
```

### Estados do Painel Central

| Estado | Descrição |
|--------|-----------|
| `hidden` | Painel não visível |
| `expanded` | Aberto com conteúdo |
| `loading` | Carregando resposta do agente |
| `error` | Erro na comunicação |

## Backend: Processamento de Agentes

### Multi-Agent Chat com Rich Content

```typescript
// server/ai.ts - nova estrutura

interface RichContentOptions {
  return_rich_content: boolean;
  preferred_panel?: string;
}

export async function handleAgentChat(
  message: string,
  tenant_id: number,
  user_id: number,
  agent_id: number,
  history: any[],
  options: RichContentOptions = {}
): Promise<AgentResponse> {
  // 1. Identificar sub-agente apropiado via Orquestrador
  // 2. Construir contexto com RAG do tenant
  // 3. Gerar resposta usando DeepSeek
  // 4. Formatar como rich_content baseado no tipo de agente
  // 5. Retornar resposta com metadados do painel
}
```

### Detecção de Tipo de Conteúdo

Cada tipo de agente gera conteúdo diferente:

| Tipo de Agente | Conteúdo Típico |
|----------------|-----------------|
| `marketing` | Posts, banners, campanhas, copy |
| `sales` | Propostas,报价, comparisons |
| `support` | Tutoriais, FAQs, troubleshooting |
| `rh` | Descrições de vagas, políticas |
| `atendimento` | Informações, agendamentos |

## API Endpoints

### Chat com Rich Content

```
POST /api/agent/chat
GET  /api/agents/available/:userId
GET  /api/user/agents
```

### Response Example

```json
{
  "text": "Aqui está sua campanha de marketing!",
  "rich_content": {
    "type": "carousel",
    "content": {
      "items": [
        {
          "title": "Post Instagram",
          "image": "https://...",
          "caption": "Texto do post",
          "actions": [
            { "label": "Copiar texto", "type": "copy" }
          ]
        }
      ]
    }
  },
  "panel_to_open": "marketing",
  "agent_used": {
    "id": 5,
    "name": "Marketing Agent",
    "sub_agent_id": 8,
    "sub_agent_name": "Social Media"
  }
}
```

## Novos Campos no Banco

### Tabela `users` (funcionários)

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tabela `user_agents` (agentes liberados por usuário)

```sql
CREATE TABLE user_agents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  tenant_agent_id INTEGER NOT NULL REFERENCES tenant_agents(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, tenant_agent_id)
);
```

## Autenticação

- Manager faz login → acessa painel admin
- User faz login → acessa AgentWorkspace
- Auth via JWT tokens
- Sessions armazenadas no banco

## Status

- [x] Design aprovado
- [ ] Implementation plan
- [ ] Implementação
- [ ] Testes
