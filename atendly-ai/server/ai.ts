import { db } from './db';

// Deep Seek API Configuration
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEEPSEEK_MODEL = 'deepseek-chat';

if (!DEEPSEEK_API_KEY) {
  throw new Error('DEEPSEEK_API_KEY environment variable is required');
}

// Helper function to call Deep Seek API (OpenAI-compatible)
async function callDeepSeek(messages: any[], system?: string, tools?: any[]) {
  const url = `${DEEPSEEK_BASE_URL}/v1/chat/completions`;

  const payload: any = {
    model: DEEPSEEK_MODEL,
    messages: messages,
    max_tokens: 4096,
  };

  if (system) {
    payload.messages.unshift({ role: 'system', content: system });
  }

  if (tools && tools.length > 0) {
    payload.tools = tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema
      }
    }));
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Deep Seek API error: ${response.status} - ${error}`);
  }

  return await response.json();
}

// Tool definitions for Claude (MiniMax)
const tools = [
  {
    name: "getServices",
    description: "Get the list of services offered by the business, including prices and duration.",
    input_schema: {
      type: "object",
      properties: {
        tenant_id: { type: "integer", description: "The ID of the business/tenant." }
      },
      required: ["tenant_id"]
    }
  },
  {
    name: "getProfessionals",
    description: "Get the list of professionals working at the business.",
    input_schema: {
      type: "object",
      properties: {
        tenant_id: { type: "integer", description: "The ID of the business/tenant." }
      },
      required: ["tenant_id"]
    }
  },
  {
    name: "checkAvailability",
    description: "Check available appointment slots for a specific date.",
    input_schema: {
      type: "object",
      properties: {
        tenant_id: { type: "integer" },
        date: { type: "string", description: "Date in YYYY-MM-DD format." }
      },
      required: ["tenant_id", "date"]
    }
  },
  {
    name: "createAppointment",
    description: "Schedule a new appointment.",
    input_schema: {
      type: "object",
      properties: {
        tenant_id: { type: "integer" },
        service_name: { type: "string" },
        professional_name: { type: "string" },
        customer_name: { type: "string" },
        customer_phone: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM" }
      },
      required: ["tenant_id", "service_name", "professional_name", "customer_name", "customer_phone", "date", "time"]
    }
  }
];

// Helper functions for tools
async function getServices(tenant_id: number) {
  const result = await db.query('SELECT name, price, duration_minutes FROM services WHERE tenant_id = $1', [tenant_id]);
  return result.rows;
}

async function getProfessionals(tenant_id: number) {
  const result = await db.query('SELECT name, specialty FROM professionals WHERE tenant_id = $1', [tenant_id]);
  return result.rows;
}

async function checkAvailability(tenant_id: number, date: string) {
  const allSlots = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];

  const result = await db.query(`
    SELECT to_char(start_time, 'HH24:MI') as time
    FROM appointments
    WHERE tenant_id = $1 AND date(start_time) = $2
  `, [tenant_id, date]);

  const bookedTimes = new Set(result.rows.map((e: any) => e.time));
  return allSlots.filter(slot => !bookedTimes.has(slot));
}

async function createAppointment(args: any) {
  const { tenant_id, service_name, professional_name, customer_name, customer_phone, date, time } = args;

  const serviceRes = await db.query('SELECT id FROM services WHERE tenant_id = $1 AND name ILIKE $2', [tenant_id, `%${service_name}%`]);
  const professionalRes = await db.query('SELECT id FROM professionals WHERE tenant_id = $1 AND name ILIKE $2', [tenant_id, `%${professional_name}%`]);

  const service = serviceRes.rows[0];
  const professional = professionalRes.rows[0];

  if (!service || !professional) {
    return { error: "Service or Professional not found." };
  }

  const start_time = `${date} ${time}:00`;

  try {
    const result = await db.query(`
      INSERT INTO appointments (tenant_id, professional_id, service_id, customer_name, customer_phone, start_time)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [tenant_id, professional.id, service.id, customer_name, customer_phone, start_time]);
    return { success: true, id: result.rows[0].id, message: "Agendamento confirmado!" };
  } catch (e) {
    return { error: "Failed to create appointment." };
  }
}

// Tool execution handler
async function executeTool(toolName: string, args: any) {
  switch (toolName) {
    case 'getServices':
      return await getServices(args.tenant_id);
    case 'getProfessionals':
      return await getProfessionals(args.tenant_id);
    case 'checkAvailability':
      return await checkAvailability(args.tenant_id, args.date);
    case 'createAppointment':
      return await createAppointment(args);
    default:
      return { error: "Unknown tool" };
  }
}

// Helper function to build RAG context (hybrid - global + local + tenant documents)
async function buildRAGContext(agentId: number, tenantId?: number): Promise<string> {
  // 1. Buscar agente e seu parent (se existir)
  const agentRes = await db.query('SELECT * FROM agents WHERE id = $1', [agentId]);
  const agent = agentRes.rows[0];

  if (!agent) return '';

  let contextParts: string[] = [];

  // 2. Se tem parent_agent_id, buscar documentos globais do template
  // (documentos base copiados do catálogo para o tenant)
  if (agent.parent_agent_id) {
    const globalDocs = await db.query(
      `SELECT content FROM agent_documents WHERE agent_id = $1 AND is_global = true ORDER BY created_at DESC LIMIT 5`,
      [agent.parent_agent_id]
    );
    if (globalDocs.rows.length > 0) {
      contextParts.push('=== BASE DE CONHECIMENTO GLOBAL ===');
      contextParts.push(globalDocs.rows.map((d: any) => d.content).join('\\n\\n'));
    }
  }

  // 3. Buscar documentos específicos do tenant (adicionados após ativação)
  if (tenantId) {
    // Documentos específicos do tenant (is_global = false, tenant_id = tenantId)
    const tenantDocs = await db.query(
      `SELECT content FROM agent_documents
       WHERE agent_id = $1 AND tenant_id = $2 AND is_global = false
       ORDER BY created_at DESC LIMIT 5`,
      [agentId, tenantId]
    );
    if (tenantDocs.rows.length > 0) {
      contextParts.push('=== CONHECIMENTO DO TENANT ===');
      contextParts.push(tenantDocs.rows.map((d: any) => d.content).join('\\n\\n'));
    }
  } else {
    // Fallback: buscar documentos locais do agente (sem filtro de tenant)
    const localDocs = await db.query(
      `SELECT content FROM agent_documents WHERE agent_id = $1 AND is_global = false ORDER BY created_at DESC LIMIT 5`,
      [agentId]
    );
    if (localDocs.rows.length > 0) {
      contextParts.push('=== CONHECIMENTO ESPECÍFICO ===');
      contextParts.push(localDocs.rows.map((d: any) => d.content).join('\\n\\n'));
    }
  }

  return contextParts.join('\\n\\n');
}

// Helper function to apply personality to system prompt
function applyPersonality(systemPrompt: string, personality: any): string {
  if (!personality) return systemPrompt;

  // Parse personality if it's a string
  const parsed = typeof personality === 'string' ? JSON.parse(personality) : personality;

  const personalityInstructions = [];

  // Tom de voz
  if (parsed.tone) {
    personalityInstructions.push(`Tom de voz: ${parsed.tone}`);
  }

  // Vocabulário
  if (parsed.vocabulary && parsed.vocabulary.length > 0) {
    personalityInstructions.push(`Palavras-chave a usar: ${parsed.vocabulary.join(', ')}`);
  }

  // Saudação
  if (parsed.greeting) {
    personalityInstructions.push(`Saudação inicial: ${parsed.greeting}`);
  }

  // Despedida
  if (parsed.closing) {
    personalityInstructions.push(`Fechamento: ${parsed.closing}`);
  }

  // Regras
  if (parsed.rules && parsed.rules.length > 0) {
    personalityInstructions.push(`Regras a seguir:\n${parsed.rules.map((r: string) => `- ${r}`).join('\n')}`);
  }

  // Proibidos
  if (parsed.forbidden && parsed.forbidden.length > 0) {
    personalityInstructions.push(`Evitar:\n${parsed.forbidden.map((f: string) => `- ${f}`).join('\n')}`);
  }

  if (personalityInstructions.length > 0) {
    return systemPrompt + '\n\n=== PERSONALIDADE ===\n' + personalityInstructions.join('\n\n');
  }

  return systemPrompt;
}

// New function to scan website
export async function extractInfoFromUrl(url: string) {
  try {
    const res = await fetch(url);
    const html = await res.text();

    const cleanText = html
      .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
      .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 50000);

    const result = await callDeepSeek(
      [{
        role: 'user',
        content: `Analise o conteúdo deste site de uma empresa e extraia as informações relevantes para criar uma Base de Conhecimento (RAG) para um assistente de IA.

Foque em:
1. Nome da empresa e Segmento
2. Descrição sobre quem são (História, missão)
3. Lista de Serviços e Preços (se houver)
4. Horários de Funcionamento
5. Regras, Políticas e Informações de Contato

Formate a saída como um texto corrido e organizado, pronto para ser inserido no contexto da IA.

Conteúdo do site:
${cleanText}`
      }],
      "Você é um assistente de IA especializado em analisar websites de empresas."
    );

    return result.choices[0].message.content;
  } catch (error) {
    console.error("Error scanning website:", error);
    throw new Error("Failed to scan website");
  }
}

export async function handleChat(message: string, tenant_id: number, history: any[], agent_id?: number) {
  // Get Tenant Info for Context
  const tenantRes = await db.query('SELECT name, segment, ai_context FROM tenants WHERE id = $1', [tenant_id]);
  const tenant = tenantRes.rows[0];

  let systemInstruction = '';
  let useRAG = true;
  let personality: any = null;

  // If agent_id is provided, use that agent's configuration
  if (agent_id) {
    // Buscar agente onde:
    // 1. tenant_id = $2 (agente do tenant), OU
    // 2. is_global = true (agente global), OU
    // 3. está ativado via tenant_agents (agente do catálogo)
    const agentRes = await db.query(
      `SELECT a.*, ta.custom_personality 
       FROM agents a
       LEFT JOIN tenant_agents ta ON ta.agent_id = a.id AND ta.tenant_id = $2 AND ta.is_active = true
       WHERE a.id = $1 AND (
         a.tenant_id = $2 OR 
         a.is_global = true OR 
         ta.id IS NOT NULL
       )`,
      [agent_id, tenant_id]
    );
    const agent = agentRes.rows[0];

    if (agent) {
      // Se tem parent_agent_id, buscar system_prompt e personality do pai
      if (agent.parent_agent_id) {
        const parentRes = await db.query('SELECT system_prompt, personality FROM agents WHERE id = $1', [agent.parent_agent_id]);
        if (parentRes.rows.length > 0) {
          const parent = parentRes.rows[0];
          // Usar prompt do pai se o agente não tem prompt próprio
          if (!agent.system_prompt && parent.system_prompt) {
            systemInstruction = parent.system_prompt;
          }
          // Usar personality do pai se o agente não tem
          if (!agent.personality && parent.personality) {
            personality = parent.personality;
          }
        }
      }

      // Parse personality (string ou objeto)
      // Prioridade: custom_personality do tenant_agents > personality do agente > personality do pai
      if (agent.custom_personality) {
        // custom_personality do tenant (editado pelo tenant)
        personality = typeof agent.custom_personality === 'string' ? JSON.parse(agent.custom_personality) : agent.custom_personality;
      } else if (agent.personality) {
        personality = typeof agent.personality === 'string' ? JSON.parse(agent.personality) : agent.personality;
      }

      // Se ainda não temos system prompt, usar o do agente
      if (!systemInstruction && agent.system_prompt) {
        systemInstruction = agent.system_prompt;
      }

      // Se ainda não temos instructions, usar default
      if (!systemInstruction) {
        systemInstruction = `
Você é o assistente virtual da ${tenant.name} (${tenant.segment}).
Seu objetivo é ajudar clientes a tirar dúvidas sobre serviços, preços e realizar agendamentos.

Seja educado, prestativo e conciso.
Use as ferramentas disponíveis para buscar informações reais de serviços e agenda.
Para agendar, você precisa confirmar: Serviço, Profissional, Data, Hora, Nome do Cliente e Telefone.
Hoje é ${new Date().toLocaleDateString('pt-BR')}.
`;
        useRAG = false;
      } else {
        useRAG = agent.agent_type !== 'custom'; // Only use RAG for template agents
      }
    } else {
      // Fallback to default
      systemInstruction = `
Você é o assistente virtual da ${tenant.name} (${tenant.segment}).
Seu objetivo é ajudar clientes a tirar dúvidas sobre serviços, preços e realizar agendamentos.

Seja educado, prestativo e conciso.
Use as ferramentas disponíveis para buscar informações reais de serviços e agenda.
Para agendar, você precisa confirmar: Serviço, Profissional, Data, Hora, Nome do Cliente e Telefone.
Hoje é ${new Date().toLocaleDateString('pt-BR')}.
`;
      useRAG = false;
    }
  } else {
    // Default single-agent mode (legacy)
    systemInstruction = `
Você é o assistente virtual da ${tenant.name} (${tenant.segment}).
Seu objetivo é ajudar clientes a tirar dúvidas sobre serviços, preços e realizar agendamentos.

CONTEXTO ESPECÍFICO DO NEGÓCIO (RAG/Knowledge Base):
"${tenant.ai_context || 'Nenhuma informação adicional fornecida.'}"

Use essas informações para responder dúvidas específicas sobre regras, horários e políticas.

Seja educado, prestativo e conciso.
Use as ferramentas disponíveis para buscar informações reais de serviços e agenda.
Para agendar, você precisa confirmar: Serviço, Profissional, Data, Hora, Nome do Cliente e Telefone.
Hoje é ${new Date().toLocaleDateString('pt-BR')}.
`;
  }

  // Aplicar personalidade ao system prompt
  if (personality) {
    systemInstruction = applyPersonality(systemInstruction, personality);
  }

  // Add RAG context if enabled - usando função híbrida
  if (useRAG && agent_id) {
    const ragContext = await buildRAGContext(agent_id, tenant_id);
    if (ragContext) {
      systemInstruction += `\n\n${ragContext}`;
    }
  }

  const messages = history.map(h => ({
    role: h.role === 'model' ? 'assistant' : h.role,
    content: h.text
  }));

  messages.push({ role: 'user', content: message });

  try {
    const result = await callDeepSeek(messages, systemInstruction, tools);

    // Handle tool use
    const toolCall = result.choices[0].message.tool_calls?.[0];

    if (toolCall) {
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments);
      const toolResult = await executeTool(toolName, toolArgs);

      // Add tool result to messages
      const updatedMessages = [
        ...messages,
        { role: 'assistant', content: result.choices[0].message.content, tool_calls: result.choices[0].message.tool_calls },
        { role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(toolResult) }
      ];

      const finalResult = await callDeepSeek(updatedMessages, systemInstruction, tools);
      return finalResult.choices[0].message.content || 'Erro ao processar resposta';
    }

    return result.choices[0].message.content || 'Erro ao processar resposta';

  } catch (error) {
    console.error("AI Error:", error);
    return "Desculpe, estou com dificuldades técnicas no momento.";
  }
}

// Detect which agent type best matches the message (for automatic routing)
export async function detectAgentType(message: string, tenant_id: number): Promise<string> {
  const systemPrompt = `Analise a mensagem do cliente e determine qual tipo de agente é mais adequado para atender.

Tipos disponíveis:
- atendimento: Dúvidas gerais, informações sobre serviços, horários, políticas
- vendas: Interesse em comprar/agendar, orçamentos, negociação
- marketing: Campanhas, promoções, redes sociais, divulgação
- suporte: Problemas técnicos, reclamações, assistance

Responda apenas com o nome do tipo de agente (atendimento/vendas/marketing/suporte).`;

  try {
    const result = await callDeepSeek([{ role: 'user', content: message }], systemPrompt);

    const text = result.choices[0].message.content?.toLowerCase() || '';

    if (text.includes('vendas')) return 'vendas';
    if (text.includes('marketing')) return 'marketing';
    if (text.includes('suporte')) return 'suporte';
    return 'atendimento';
  } catch (error) {
    console.error("Error detecting agent type:", error);
    return 'atendimento'; // Default fallback
  }
}

// Multi-agent chat with automatic routing
export async function handleMultiAgentChat(
  message: string,
  tenant_id: number,
  history: any[],
  options: {
    agent_id?: number;         // Specific agent to use
    preferred_agent_type?: string; // Preferred type for auto-routing
    auto_route?: boolean;      // Enable automatic routing
  } = {}
) {
  const { agent_id, preferred_agent_type, auto_route = false } = options;

  // If specific agent provided, use it
  if (agent_id) {
    const response = await handleChat(message, tenant_id, history, agent_id);
    return { response, agent_id_used: agent_id, routed: false };
  }

  // If auto-routing is enabled and no specific agent
  if (auto_route) {
    // Detect best agent type for this message
    const detectedType = preferred_agent_type || await detectAgentType(message, tenant_id);

    // Find active agent of that type for this tenant via tenant_agents table
    // First check for orchestrator (parent) agents of the detected type
    const agentRes = await db.query(
      `SELECT ta.agent_id FROM tenant_agents ta
       JOIN agents a ON ta.agent_id = a.id
       WHERE ta.tenant_id = $1 AND a.agent_type = $2 AND ta.is_active = true
       AND (a.parent_agent_id IS NULL OR a.is_orchestrator = true)
       LIMIT 1`,
      [tenant_id, detectedType]
    );

    if (agentRes.rows.length > 0) {
      const detectedAgentId = agentRes.rows[0].agent_id;
      const response = await handleChat(message, tenant_id, history, detectedAgentId);
      return {
        response,
        agent_id_used: detectedAgentId,
        agent_type_detected: detectedType,
        routed: true
      };
    }

    // Fallback: try finding any active agent of that type (legacy support)
    const legacyAgentRes = await db.query(
      `SELECT id FROM agents WHERE tenant_id = $1 AND agent_type = $2 AND is_active = true LIMIT 1`,
      [tenant_id, detectedType]
    );

    if (legacyAgentRes.rows.length > 0) {
      const detectedAgentId = legacyAgentRes.rows[0].id;
      const response = await handleChat(message, tenant_id, history, detectedAgentId);
      return {
        response,
        agent_id_used: detectedAgentId,
        agent_type_detected: detectedType,
        routed: true
      };
    }
  }

  // Fallback to default chat
  const response = await handleChat(message, tenant_id, history);
  return { response, agent_id_used: null, routed: false };
}
