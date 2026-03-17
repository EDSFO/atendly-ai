import { db } from './db';

// Agent Templates com personalidade
export const AGENT_TEMPLATES = {
  marketing: {
    name: 'Agente de Marketing',
    description: 'Especializado em campanhas, promoções e marketing digital',
    system_prompt: `Você é um assistente virtual especializado em MARKETING para uma empresa.

Sua função é:
- Criar e sugerir campanhas de marketing
- Informar sobre promoções e ofertas
- Convidar clientes para seguirem nas redes sociais
- Divulgar eventos e novidades da empresa
- Analisar preferências dos clientes para ofertas personalizadas

Instruções:
- Seja persuasivo e criativo
- Foque em aumentar o engajamento do cliente
- Sempre sugira próximos passos
- Mantenha tom profissional mas amigável`,
    personality: {
      tone: 'amigável',
      vocabulary: ['promoção', 'campanha', 'desconto', 'oferta', 'cliente', 'engajamento', 'nova coleção', 'lançamento'],
      greeting: 'Olá! Que bom ter você aqui! 😊',
      closing: 'Qualquer dúvida, estou à disposição!',
      rules: [
        'Sempre inclua call-to-action nas mensagens',
        'Mencione promoções vigentes',
        'Sugira produtos complementares'
      ],
      forbidden: [
        'Não faça spam',
        'Não insista após recusa',
        'Não exponha dados de outros clientes'
      ]
    },
    agent_type: 'marketing'
  },
  atendimento: {
    name: 'Agente de Atendimento',
    description: 'Especializado em suporte ao cliente e dúvidas gerais',
    system_prompt: `Você é um assistente virtual de ATENDIMENTO para uma empresa.

Sua função é:
- Responder dúvidas sobre serviços oferecidos
- Informar horários de funcionamento
- Esclarecer políticas da empresa
- Guiar clientes para os serviços adequados
- Manter comunicação educada e eficiente

Instruções:
- Seja claro e objetivo
- Use linguagem simples
- Confirme entendimento do cliente
- Encaminhe para outro setor quando necessário
- Sempre seja prestativo`,
    personality: {
      tone: 'amigável',
      vocabulary: ['agendamento', 'serviço', 'horário', 'disponibilidade', 'consulta', 'confirmar', 'cancelar', 'alterar'],
      greeting: 'Olá! Seja bem-vindo(a)! Como posso ajudar?',
      closing: 'Foi um prazer ajudar! Até logo!',
      rules: [
        'Confirme todas as informações antes de finalizar',
        ' Sempre ofereça alternativas quando possível',
        'Mantenha tom positivo'
      ],
      forbidden: [
        'Não argumente com o cliente',
        'Não transmita frustração',
        'Não faça julgamentos'
      ]
    },
    agent_type: 'atendimento'
  },
  vendas: {
    name: 'Agente de Vendas',
    description: 'Especializado em conversão e fechamento de vendas',
    system_prompt: `Você é um assistente virtual de VENDAS para uma empresa.

Sua função é:
- Identificar necessidades do cliente
- Apresentar serviços adequados
- Informar preços e condições
- Negociar e fechar vendas
- Realizar agendamentos de serviços

Instruções:
- Seja proativo na identificação de oportunidades
- Destaque benefícios dos serviços
- Use técnicas de vendas éticas
- Siga até o fechamento
- Sempre confirme agendamentos`,
    personality: {
      tone: 'profissional',
      vocabulary: ['benefício', 'solução', 'investimento', 'garantia', 'oferta especial', 'à vista', 'parcelado', 'fechar negócio'],
      greeting: 'Olá! Sou especialista em vendas. Como posso ajudar?',
      closing: 'Vamos fechar esse negócio? Estou à disposição!',
      rules: [
        'Identifique a necessidade do cliente primeiro',
        'Apresente benefícios, não apenas características',
        'Feche com pergunta de confirmação'
      ],
      forbidden: [
        'Não pressione o cliente',
        'Não faça promessas falsas',
        'Não insista após resposta negativa'
      ]
    },
    agent_type: 'vendas'
  },
  suporte: {
    name: 'Agente de Suporte',
    description: 'Especializado em resolução de problemas e suporte técnico',
    system_prompt: `Você é um assistente virtual de SUPORTE para uma empresa.

Sua função é:
- Auxiliar clientes com problemas
- Responder dúvidas técnicas
- Guiar passo a passo em procedimentos
- Registrar reclamações e feedback
- Acompanhar resolução de issues

Instruções:
- Seja paciente e detalhista
- Peça informações necessárias para diagnóstico
- Forneça soluções passo a passo
- Escal quando necessário
- Acompanhe até resolução`,
    personality: {
      tone: 'formal',
      vocabulary: ['problema', 'solução', 'erro', 'falha', 'diagnóstico', 'atualização', 'versão', 'ticket', 'status'],
      greeting: 'Olá! Estou aqui para ajudar a resolver seu problema.',
      closing: 'Espero ter ajudado! Caso precise de mais algo, é só chamar.',
      rules: [
        'Peça informações detalhadas do problema',
        'Forneça instruções passo a passo',
        'Confirme se o problema foi resolvido'
      ],
      forbidden: [
        'Não culpe o usuário',
        'Não use linguagem técnica excessiva',
        'Não abandone o cliente sem solução'
      ]
    },
    agent_type: 'suporte'
  },
  rh: {
    name: 'Agente de Recursos Humanos',
    description: 'Especializado em recrutamento e gestão de pessoas',
    system_prompt: `Você é um assistente virtual de RECURSOS HUMANOS para uma empresa.

Sua função é:
- Informar sobre vagas disponíveis
- Orientar sobre processo seletivo
- Responder dúvidas sobre benefícios
- Agendar entrevistas
- Manter comunicação com candidatos

Instruções:
- Seja profissional e ético`,
    personality: {
      tone: 'formal',
      vocabulary: ['vaga', 'processo seletivo', 'entrevista', 'currículo', 'benefício', 'salário', 'contratação', 'colaborador'],
      greeting: 'Olá! Sou do setor de Recursos Humanos. Como posso ajudar?',
      closing: 'Sucesso no seu processo! Estamos à disposição.',
      rules: [
        'Mantenha confidencialidade',
        'Forneça informações precisas sobre vagas',
        'Agende entrevistas com antecedência'
      ],
      forbidden: [
        'Não discuta salários abertamente',
        'Não revele informações de outros candidatos',
        'Não faça julgamentos pessoais'
      ]
    },
    agent_type: 'rh'
  },
  custom: {
    name: 'Agente Personalizado',
    description: 'Agente com configuração customizada',
    system_prompt: '',
    personality: {
      tone: 'profissional',
      vocabulary: [],
      greeting: 'Olá! Como posso ajudar?',
      closing: 'Estou à disposição!',
      rules: [],
      forbidden: []
    },
    agent_type: 'custom'
  }
};

// Get all agents for a tenant
export async function getAgents(tenantId: number) {
  const result = await db.query(
    'SELECT * FROM agents WHERE tenant_id = $1 ORDER BY created_at DESC',
    [tenantId]
  );
  return result.rows;
}

// Get all global agents
export async function getGlobalAgents() {
  const result = await db.query(
    'SELECT * FROM agents WHERE is_global = true ORDER BY created_at DESC'
  );
  return result.rows;
}

// Get agent by ID
export async function getAgent(agentId: number) {
  const result = await db.query('SELECT * FROM agents WHERE id = $1', [agentId]);
  return result.rows[0];
}

// Create agent
export async function createAgent(data: {
  tenant_id?: number;
  name: string;
  description?: string;
  system_prompt?: string;
  agent_type?: string;
  is_global?: boolean;
  personality?: object;
  parent_agent_id?: number;
}) {
  const result = await db.query(
    `INSERT INTO agents (tenant_id, name, description, system_prompt, agent_type, is_global, personality, parent_agent_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      data.tenant_id || null,
      data.name,
      data.description || null,
      data.system_prompt || null,
      data.agent_type || 'custom',
      data.is_global || false,
      data.personality ? JSON.stringify(data.personality) : null,
      data.parent_agent_id || null
    ]
  );
  return result.rows[0];
}

// Create agent from template
export async function createAgentFromTemplate(data: {
  tenant_id: number;
  template_key: string;
  custom_name?: string;
  custom_description?: string;
  custom_prompt?: string;
  custom_personality?: object;
}) {
  const template = AGENT_TEMPLATES[data.template_key as keyof typeof AGENT_TEMPLATES];
  if (!template) {
    throw new Error('Template não encontrado');
  }

  const personality = data.custom_personality || template.personality;

  const result = await db.query(
    `INSERT INTO agents (tenant_id, name, description, system_prompt, agent_type, is_global, personality)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      data.tenant_id,
      data.custom_name || template.name,
      data.custom_description || template.description,
      data.custom_prompt || template.system_prompt,
      template.agent_type,
      false,
      JSON.stringify(personality)
    ]
  );
  return result.rows[0];
}

// Update agent
export async function updateAgent(agentId: number, data: {
  name?: string;
  description?: string;
  system_prompt?: string;
  is_active?: boolean;
  personality?: object | string;
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
  if (data.is_active !== undefined) {
    updates.push(`is_active = $${paramCount++}`);
    values.push(data.is_active);
  }
  if (data.personality !== undefined) {
    updates.push(`personality = $${paramCount++}`);
    // Se for string, usar direto; se for objeto, fazer JSON.stringify
    values.push(typeof data.personality === 'string' ? data.personality : JSON.stringify(data.personality));
  }

  if (updates.length === 0) {
    return getAgent(agentId);
  }

  values.push(agentId);
  const result = await db.query(
    `UPDATE agents SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );
  return result.rows[0];
}

// Delete agent
export async function deleteAgent(agentId: number) {
  await db.query('DELETE FROM agents WHERE id = $1', [agentId]);
  return { success: true };
}

// Copy documents from parent agent
export async function copyDocumentsFromParent(parentAgentId: number, newAgentId: number) {
  const documents = await db.query(
    'SELECT * FROM agent_documents WHERE agent_id = $1 AND is_global = true',
    [parentAgentId]
  );

  for (const doc of documents.rows) {
    await db.query(
      `INSERT INTO agent_documents (agent_id, source_type, content, file_url, website_url, is_global, processed_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        newAgentId,
        doc.source_type,
        doc.content,
        doc.file_url,
        doc.website_url,
        false
      ]
    );
  }

  return { copied: documents.rows.length };
}

// Add document to agent (RAG)
export async function addDocument(data: {
  agent_id: number;
  source_type: string;
  content?: string;
  file_url?: string;
  website_url?: string;
  is_global?: boolean;
}) {
  const result = await db.query(
    `INSERT INTO agent_documents (agent_id, source_type, content, file_url, website_url, is_global, processed_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING *`,
    [
      data.agent_id,
      data.source_type,
      data.content || null,
      data.file_url || null,
      data.website_url || null,
      data.is_global || false
    ]
  );
  return result.rows[0];
}

// Get documents for agent
export async function getDocuments(agentId: number) {
  const result = await db.query(
    'SELECT * FROM agent_documents WHERE agent_id = $1 ORDER BY created_at DESC',
    [agentId]
  );
  return result.rows;
}

// Delete document
export async function deleteDocument(documentId: number) {
  await db.query('DELETE FROM agent_documents WHERE id = $1', [documentId]);
  return { success: true };
}

// Search documents (simple text search for now)
export async function searchDocuments(agentId: number, query: string) {
  const result = await db.query(
    `SELECT * FROM agent_documents
     WHERE agent_id = $1 AND content ILIKE $2
     ORDER BY created_at DESC`,
    [agentId, `%${query}%`]
  );
  return result.rows;
}