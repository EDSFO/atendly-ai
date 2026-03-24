import { useState, useEffect } from 'react';
import { Loader2, Plus, X, Edit, Trash2, Settings, ChevronDown, ChevronRight, FileText, Upload, Globe, Trash } from 'lucide-react';

// Material Symbols Icons
const MaterialIcon = ({ icon, filled = false, className = '' }: { icon: string; filled?: boolean; className?: string }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{ fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0" }}
  >
    {icon}
  </span>
);

const SmartToy = () => <MaterialIcon icon="smart_toy" />;
const RobotIcon = () => <MaterialIcon icon="robot_2" filled />;
const Bolt = () => <MaterialIcon icon="bolt" className="text-[#F97316]" />;
const GroupIcon = () => <MaterialIcon icon="group" />;

interface SubAgent {
  id?: number;
  name: string;
  description: string;
  system_prompt: string;
  agent_type: string;
  personality?: any;
  agent_order?: number;
}

interface CatalogAgent {
  id: number;
  name: string;
  description: string;
  system_prompt: string;
  agent_type: string;
  personality: any;
  monthly_price: number;
  is_orchestrator: boolean;
  parent_agent_id: number | null;
  sub_agents?: SubAgent[];
}

interface SystemCatalogManagerProps {
  onNavigate: (path: string) => void;
}

export default function SystemCatalogManager({ onNavigate }: SystemCatalogManagerProps) {
  const [catalogAgents, setCatalogAgents] = useState<CatalogAgent[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingAgent, setEditingAgent] = useState<CatalogAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedAgents, setExpandedAgents] = useState<Set<number>>(new Set());

  const [catalogForm, setCatalogForm] = useState({
    name: '',
    description: '',
    system_prompt: '',
    agent_type: 'atendimento',
    monthly_price: 0,
    is_orchestrator: true
  });

  const [subAgents, setSubAgents] = useState<SubAgent[]>([]);
  const [newSubAgent, setNewSubAgent] = useState<SubAgent>({
    name: '',
    description: '',
    system_prompt: '',
    agent_type: 'atendimento'
  });

  const [personalityForm, setPersonalityForm] = useState({
    tone: 'professional',
    vocabulary: '',
    greeting: '',
    closing: '',
    rules: '',
    forbidden: ''
  });

  // RAG Documents state
  const [selectedSubAgentForRAG, setSelectedSubAgentForRAG] = useState<SubAgent | null>(null);
  const [subAgentDocuments, setSubAgentDocuments] = useState<any[]>([]);
  const [ragLoading, setRagLoading] = useState(false);
  const [ragModalOpen, setRagModalOpen] = useState(false);
  const [docForm, setDocForm] = useState({
    source_type: 'text',
    content: '',
    website_url: ''
  });

  useEffect(() => {
    fetchCatalogAgents();
  }, []);

  const fetchCatalogAgents = async () => {
    try {
      const res = await fetch('/api/catalog/agents-with-subagents');
      const data = await res.json();
      setCatalogAgents(data);
    } catch (e) {
      console.error('Error fetching catalog agents:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (agentId: number) => {
    const newExpanded = new Set(expandedAgents);
    if (newExpanded.has(agentId)) {
      newExpanded.delete(agentId);
    } else {
      newExpanded.add(agentId);
    }
    setExpandedAgents(newExpanded);
  };

  const createAgent = async () => {
    const personality = {
      tone: personalityForm.tone,
      vocabulary: personalityForm.vocabulary.split(',').map(v => v.trim()).filter(v => v),
      greeting: personalityForm.greeting,
      closing: personalityForm.closing,
      rules: personalityForm.rules.split('\n').filter(r => r.trim()),
      forbidden: personalityForm.forbidden.split(',').map(f => f.trim()).filter(f => f)
    };

    try {
      const res = await fetch('/api/catalog/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...catalogForm,
          personality,
          sub_agents: catalogForm.is_orchestrator ? subAgents.map((sa, idx) => ({
            ...sa,
            agent_order: idx
          })) : []
        })
      });
      if (res.ok) {
        await fetchCatalogAgents();
        resetForm();
        setIsCreating(false);
      }
    } catch (e) {
      console.error('Error creating agent:', e);
    }
  };

  const updateAgent = async () => {
    if (!editingAgent) return;
    const personality = {
      tone: personalityForm.tone,
      vocabulary: personalityForm.vocabulary.split(',').map(v => v.trim()).filter(v => v),
      greeting: personalityForm.greeting,
      closing: personalityForm.closing,
      rules: personalityForm.rules.split('\n').filter(r => r.trim()),
      forbidden: personalityForm.forbidden.split(',').map(f => f.trim()).filter(f => f)
    };

    try {
      const res = await fetch(`/api/catalog/agents/${editingAgent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...catalogForm,
          personality
        })
      });
      if (res.ok) {
        await fetchCatalogAgents();
        resetForm();
        setEditingAgent(null);
      }
    } catch (e) {
      console.error('Error updating agent:', e);
    }
  };

  const deleteAgent = async (agentId: number) => {
    if (!confirm('Tem certeza que deseja deletar este agente e todos os seus sub-agentes?')) return;
    try {
      const res = await fetch(`/api/catalog/agents/${agentId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchCatalogAgents();
      }
    } catch (e) {
      console.error('Error deleting agent:', e);
    }
  };

  const addSubAgent = async (orchestratorId: number) => {
    try {
      const res = await fetch(`/api/catalog/agents/${orchestratorId}/sub-agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSubAgent)
      });
      if (res.ok) {
        await fetchCatalogAgents();
        setNewSubAgent({ name: '', description: '', system_prompt: '', agent_type: 'atendimento' });
      }
    } catch (e) {
      console.error('Error adding sub-agent:', e);
    }
  };

  const deleteSubAgent = async (subAgentId: number) => {
    if (!confirm('Tem certeza que deseja deletar este sub-agente?')) return;
    try {
      const res = await fetch(`/api/catalog/sub-agents/${subAgentId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchCatalogAgents();
      }
    } catch (e) {
      console.error('Error deleting sub-agent:', e);
    }
  };

  // RAG Document functions
  const fetchSubAgentDocuments = async (subAgentId: number) => {
    setRagLoading(true);
    try {
      const res = await fetch(`/api/catalog/sub-agents/${subAgentId}/documents`);
      const data = await res.json();
      setSubAgentDocuments(data);
    } catch (e) {
      console.error('Error fetching sub-agent documents:', e);
    } finally {
      setRagLoading(false);
    }
  };

  const openRAGModal = (subAgent: SubAgent) => {
    setSelectedSubAgentForRAG(subAgent);
    setDocForm({ source_type: 'text', content: '', website_url: '' });
    if (subAgent.id) {
      fetchSubAgentDocuments(subAgent.id);
    }
    setRagModalOpen(true);
  };

  const addSubAgentDocument = async () => {
    if (!selectedSubAgentForRAG?.id) return;
    try {
      const res = await fetch(`/api/catalog/sub-agents/${selectedSubAgentForRAG.id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docForm)
      });
      if (res.ok) {
        setDocForm({ source_type: 'text', content: '', website_url: '' });
        if (selectedSubAgentForRAG.id) {
          fetchSubAgentDocuments(selectedSubAgentForRAG.id);
        }
      }
    } catch (e) {
      console.error('Error adding sub-agent document:', e);
    }
  };

  const deleteSubAgentDocument = async (docId: number) => {
    if (!confirm('Tem certeza que deseja deletar este documento?')) return;
    if (!selectedSubAgentForRAG?.id) return;
    try {
      const res = await fetch(`/api/catalog/sub-agents/${selectedSubAgentForRAG.id}/documents/${docId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (selectedSubAgentForRAG.id) {
          fetchSubAgentDocuments(selectedSubAgentForRAG.id);
        }
      }
    } catch (e) {
      console.error('Error deleting sub-agent document:', e);
    }
  };

  const openEdit = (agent: CatalogAgent) => {
    const personality = agent.personality || {};
    setCatalogForm({
      name: agent.name || '',
      description: agent.description || '',
      system_prompt: agent.system_prompt || '',
      agent_type: agent.agent_type || 'atendimento',
      monthly_price: agent.monthly_price || 0,
      is_orchestrator: agent.is_orchestrator || false
    });
    setPersonalityForm({
      tone: personality.tone || 'professional',
      vocabulary: Array.isArray(personality.vocabulary) ? personality.vocabulary.join(', ') : (personality.vocabulary || ''),
      greeting: personality.greeting || '',
      closing: personality.closing || '',
      rules: Array.isArray(personality.rules) ? personality.rules.join('\n') : (personality.rules || ''),
      forbidden: Array.isArray(personality.forbidden) ? personality.forbidden.join(', ') : (personality.forbidden || '')
    });
    setSubAgents(agent.sub_agents || []);
    setEditingAgent(agent);
  };

  const resetForm = () => {
    setCatalogForm({
      name: '',
      description: '',
      system_prompt: '',
      agent_type: 'atendimento',
      monthly_price: 0,
      is_orchestrator: true
    });
    setPersonalityForm({
      tone: 'professional',
      vocabulary: '',
      greeting: '',
      closing: '',
      rules: '',
      forbidden: ''
    });
    setSubAgents([]);
    setNewSubAgent({ name: '', description: '', system_prompt: '', agent_type: 'atendimento' });
  };

  const closeModal = () => {
    setIsCreating(false);
    setEditingAgent(null);
    resetForm();
  };

  const addSubAgentToList = () => {
    if (newSubAgent.name && newSubAgent.system_prompt) {
      setSubAgents([...subAgents, { ...newSubAgent }]);
      setNewSubAgent({ name: '', description: '', system_prompt: '', agent_type: 'atendimento' });
    }
  };

  const removeSubAgentFromList = (index: number) => {
    setSubAgents(subAgents.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-[#050505] relative overflow-hidden">
      <div className="fixed inset-0 grid-bg pointer-events-none z-0"></div>

      {/* Header */}
      <header className="relative z-10 glass border-b border-white/5 px-6 py-4">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#F97316] flex items-center justify-center">
              <SmartToy />
            </div>
            <h1 className="text-white text-lg font-medium uppercase tracking-tight">
              Atendly AI <span className="text-neutral-500">/ Catálogo de Agentes</span>
            </h1>
          </div>
          <button
            onClick={() => onNavigate('/')}
            className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 hover:text-white px-4 py-2 border border-white/10 hover:border-white/30 transition-all"
          >
            Voltar
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="relative z-10 px-6 py-8 max-w-7xl mx-auto">
        {/* Page Title */}
        <div className="mb-12">
          <h2 className="text-white text-4xl font-medium uppercase tracking-tight mb-2">
            Catálogo <span className="text-neutral-700">de Agentes</span>
          </h2>
          <p className="text-neutral-400 text-lg">
            Gerencie os agentes base disponíveis para todas as empresas.
          </p>
        </div>

        {/* Create Button */}
        <div className="flex justify-end mb-8">
          <button
            onClick={() => { resetForm(); setIsCreating(true); }}
            className="btn-beam px-6 py-3 text-white text-[10px] font-bold uppercase tracking-widest"
          >
            <div className="btn-inner"></div>
            <span className="relative z-10 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Criar Novo Agente
            </span>
          </button>
        </div>

        {/* Agents List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#F97316]" />
          </div>
        ) : catalogAgents.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-white/10">
            <RobotIcon className="w-16 h-16 mx-auto mb-4 text-neutral-700" />
            <p className="text-neutral-500 text-sm font-mono uppercase tracking-widest">Nenhum agente no catálogo</p>
            <p className="text-neutral-600 text-xs mt-2">Crie agentes para disponibilizar às empresas</p>
          </div>
        ) : (
          <div className="space-y-4">
            {catalogAgents.map((agent) => (
              <div key={agent.id} className="bg-[#0A0A0A] border border-white/10 overflow-hidden">
                {/* Orchestrator Row */}
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    {/* Expand/Collapse Button */}
                    {agent.is_orchestrator && (agent.sub_agents?.length ?? 0) > 0 && (
                      <button
                        onClick={() => toggleExpanded(agent.id)}
                        className="mt-1 text-neutral-500 hover:text-white"
                      >
                        {expandedAgents.has(agent.id) ? (
                          <ChevronDown className="w-5 h-5" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </button>
                    )}

                    {/* Agent Info */}
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {agent.is_orchestrator && (
                              <span className="text-[9px] font-mono bg-[#F97316] text-black px-2 py-0.5 uppercase">
                                Orquestrador
                              </span>
                            )}
                            <span className="text-[9px] font-mono text-[#F97316] uppercase tracking-widest">
                              {agent.agent_type}
                            </span>
                          </div>
                          <h3 className="text-white font-medium text-xl uppercase tracking-tight">
                            {agent.name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-4">
                          {Number(agent.monthly_price) > 0 ? (
                            <span className="text-green-500 text-[10px] font-mono uppercase">
                              R$ {Number(agent.monthly_price).toFixed(2)}/mês
                            </span>
                          ) : (
                            <span className="text-green-500 text-[10px] font-mono uppercase">Gratuito</span>
                          )}
                        </div>
                      </div>
                      <p className="text-neutral-500 text-sm mb-3">
                        {agent.description || 'Sem descrição'}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(agent)}
                          className="py-2 px-4 border border-white/10 text-neutral-400 hover:text-white hover:border-white/30 text-[10px] font-bold uppercase tracking-widest transition-all"
                        >
                          <div className="flex items-center gap-1">
                            <Edit className="w-3 h-3" />
                            Editar
                          </div>
                        </button>
                        <button
                          onClick={() => deleteAgent(agent.id)}
                          className="py-2 px-3 border border-red-500/30 text-red-500 hover:bg-red-500/10 text-[10px] font-bold uppercase tracking-widest transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Sub-agents List (when expanded) */}
                  {agent.is_orchestrator && expandedAgents.has(agent.id) && agent.sub_agents && agent.sub_agents.length > 0 && (
                    <div className="mt-6 ml-8 pl-6 border-l-2 border-[#F97316]/30 space-y-3">
                      <div className="flex items-center gap-2 mb-3">
                        <GroupIcon />
                        <span className="text-neutral-400 text-xs font-mono uppercase">Sub-agentes</span>
                        <span className="text-neutral-600 text-xs">({agent.sub_agents.length})</span>
                      </div>
                      {agent.sub_agents.map((sub, idx) => (
                        <div key={sub.id || idx} className="bg-black/40 border border-white/5 p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[9px] font-mono text-neutral-500 uppercase">{sub.agent_type}</span>
                              <h4 className="text-white font-medium">{sub.name}</h4>
                              <p className="text-neutral-500 text-xs mt-1">{sub.description || 'Sem descrição'}</p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => openRAGModal(sub)}
                                className="py-1 px-2 border border-[#F97316]/30 text-[#F97316] hover:bg-[#F97316]/10 text-[10px] font-bold uppercase transition-all"
                                title="Gerenciar RAG"
                              >
                                <FileText className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => sub.id && deleteSubAgent(sub.id)}
                                className="py-1 px-2 border border-red-500/30 text-red-500 hover:bg-red-500/10 text-[10px] font-bold uppercase transition-all"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(isCreating || editingAgent) && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-[#0A0A0A] border border-white/10 p-8 max-w-3xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-white text-lg font-medium uppercase tracking-tight">
                {editingAgent ? 'Editar Agente' : 'Criar Novo Agente'}
              </h3>
              <button onClick={closeModal} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Is Orchestrator */}
              {!editingAgent && (
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_orchestrator"
                    checked={catalogForm.is_orchestrator}
                    onChange={(e) => setCatalogForm({ ...catalogForm, is_orchestrator: e.target.checked })}
                    className="w-5 h-5"
                  />
                  <label htmlFor="is_orchestrator" className="text-white text-sm">
                    Este é um agente <strong>Orquestrador</strong> (irá coordenar sub-agentes)
                  </label>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">Nome</label>
                <input
                  className="w-full p-4 input-dark text-white text-sm"
                  placeholder="Ex: Agente de Marketing"
                  value={catalogForm.name}
                  onChange={e => setCatalogForm({ ...catalogForm, name: e.target.value })}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">Descrição</label>
                <input
                  className="w-full p-4 input-dark text-white text-sm"
                  placeholder="Ex: Agente especializado em marketing digital"
                  value={catalogForm.description}
                  onChange={e => setCatalogForm({ ...catalogForm, description: e.target.value })}
                />
              </div>

              {/* Agent Type */}
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">Tipo</label>
                <select
                  className="w-full p-4 input-dark text-white text-sm"
                  value={catalogForm.agent_type}
                  onChange={e => setCatalogForm({ ...catalogForm, agent_type: e.target.value })}
                >
                  <option value="atendimento">Atendimento</option>
                  <option value="marketing">Marketing</option>
                  <option value="vendas">Vendas</option>
                  <option value="operacao">Operação</option>
                  <option value="suporte">Suporte</option>
                </select>
              </div>

              {/* Price */}
              {!editingAgent && (
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">Preço Mensal (R$)</label>
                  <input
                    type="number"
                    className="w-full p-4 input-dark text-white text-sm"
                    placeholder="0 para gratuito"
                    value={catalogForm.monthly_price}
                    onChange={e => setCatalogForm({ ...catalogForm, monthly_price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              )}

              {/* System Prompt */}
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">System Prompt</label>
                <textarea
                  className="w-full p-4 input-dark text-white text-sm h-32 resize-none"
                  placeholder="Você é um assistente de IA especializado em..."
                  value={catalogForm.system_prompt}
                  onChange={e => setCatalogForm({ ...catalogForm, system_prompt: e.target.value })}
                />
              </div>

              {/* Sub-agents Section (only for new orchestrator) */}
              {!editingAgent && catalogForm.is_orchestrator && (
                <div className="border-t border-white/10 pt-6">
                  <h4 className="text-white text-sm font-mono uppercase tracking-widest mb-4">Sub-agentes</h4>

                  {/* Existing sub-agents */}
                  {subAgents.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {subAgents.map((sub, idx) => (
                        <div key={idx} className="bg-black/40 border border-white/5 p-4 flex items-start gap-3">
                          <div className="flex-1">
                            <span className="text-[9px] font-mono text-neutral-500 uppercase">{sub.agent_type}</span>
                            <p className="text-white font-medium">{sub.name}</p>
                          </div>
                          <button
                            onClick={() => removeSubAgentFromList(idx)}
                            className="text-red-500 hover:text-red-400"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add new sub-agent */}
                  <div className="bg-black/40 border border-white/5 p-4 space-y-3">
                    <p className="text-neutral-400 text-xs uppercase">Adicionar Sub-agente</p>
                    <input
                      className="w-full p-3 input-dark text-white text-sm"
                      placeholder="Nome do sub-agente"
                      value={newSubAgent.name}
                      onChange={e => setNewSubAgent({ ...newSubAgent, name: e.target.value })}
                    />
                    <input
                      className="w-full p-3 input-dark text-white text-sm"
                      placeholder="Descrição"
                      value={newSubAgent.description}
                      onChange={e => setNewSubAgent({ ...newSubAgent, description: e.target.value })}
                    />
                    <select
                      className="w-full p-3 input-dark text-white text-sm"
                      value={newSubAgent.agent_type}
                      onChange={e => setNewSubAgent({ ...newSubAgent, agent_type: e.target.value })}
                    >
                      <option value="atendimento">Atendimento</option>
                      <option value="marketing">Marketing</option>
                      <option value="vendas">Vendas</option>
                      <option value="operacao">Operação</option>
                      <option value="suporte">Suporte</option>
                    </select>
                    <textarea
                      className="w-full p-3 input-dark text-white text-sm h-20 resize-none"
                      placeholder="System prompt"
                      value={newSubAgent.system_prompt}
                      onChange={e => setNewSubAgent({ ...newSubAgent, system_prompt: e.target.value })}
                    />
                    <button
                      onClick={addSubAgentToList}
                      disabled={!newSubAgent.name || !newSubAgent.system_prompt}
                      className="w-full py-2 border border-[#F97316]/50 text-[#F97316] hover:bg-[#F97316]/10 text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <Plus className="w-3 h-3" />
                        Adicionar à lista
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Personality */}
              <div className="border-t border-white/10 pt-6">
                <h4 className="text-white text-sm font-mono uppercase tracking-widest mb-4">Personalidade Base</h4>

                <div className="mb-4">
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">Tom</label>
                  <select
                    className="w-full p-4 input-dark text-white text-sm"
                    value={personalityForm.tone}
                    onChange={e => setPersonalityForm({ ...personalityForm, tone: e.target.value })}
                  >
                    <option value="friendly">Amigável</option>
                    <option value="professional">Profissional</option>
                    <option value="formal">Formal</option>
                    <option value="casual">Casual</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">Saudação</label>
                  <input
                    className="w-full p-4 input-dark text-white text-sm"
                    placeholder="Ex: Olá! Como posso ajudar?"
                    value={personalityForm.greeting}
                    onChange={e => setPersonalityForm({ ...personalityForm, greeting: e.target.value })}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">Despedida</label>
                  <input
                    className="w-full p-4 input-dark text-white text-sm"
                    placeholder="Ex: Até logo!"
                    value={personalityForm.closing}
                    onChange={e => setPersonalityForm({ ...personalityForm, closing: e.target.value })}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">Vocabulário (vírgula)</label>
                  <input
                    className="w-full p-4 input-dark text-white text-sm"
                    placeholder="Ex: marketing, SEO, redes sociais"
                    value={personalityForm.vocabulary}
                    onChange={e => setPersonalityForm({ ...personalityForm, vocabulary: e.target.value })}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">Regras (linha)</label>
                  <textarea
                    className="w-full p-4 input-dark text-white text-sm h-24 resize-none"
                    placeholder="Uma regra por linha"
                    value={personalityForm.rules}
                    onChange={e => setPersonalityForm({ ...personalityForm, rules: e.target.value })}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">Proibições (vírgula)</label>
                  <input
                    className="w-full p-4 input-dark text-white text-sm"
                    placeholder="Ex: spam, informações pessoais"
                    value={personalityForm.forbidden}
                    onChange={e => setPersonalityForm({ ...personalityForm, forbidden: e.target.value })}
                  />
                </div>
              </div>

              <button
                onClick={editingAgent ? updateAgent : createAgent}
                className="w-full btn-beam py-4 px-6 text-white text-[10px] font-bold uppercase tracking-widest"
              >
                <div className="btn-inner"></div>
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <Bolt />
                  {editingAgent ? 'Salvar Alterações' : 'Criar Agente'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RAG Documents Modal for Sub-agents */}
      {ragModalOpen && selectedSubAgentForRAG && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-[#0A0A0A] border border-white/10 p-8 max-w-3xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-white text-lg font-medium uppercase tracking-tight">
                  RAG - {selectedSubAgentForRAG.name}
                </h3>
                <p className="text-neutral-500 text-xs mt-1">Gerencie os documentos base do sub-agente</p>
              </div>
              <button onClick={() => setRagModalOpen(false)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Add Document Form */}
            <div className="bg-black/40 border border-white/5 p-4 mb-6">
              <h4 className="text-white text-sm font-mono uppercase tracking-widest mb-4">Adicionar Documento</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">Tipo</label>
                  <select
                    className="w-full p-3 input-dark text-white text-sm"
                    value={docForm.source_type}
                    onChange={e => setDocForm({ ...docForm, source_type: e.target.value })}
                  >
                    <option value="text">Texto</option>
                    <option value="website">Website</option>
                  </select>
                </div>
                {docForm.source_type === 'text' ? (
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">Conteúdo</label>
                    <textarea
                      className="w-full p-3 input-dark text-white text-sm h-24 resize-none"
                      placeholder="Cole o conteúdo do documento aqui..."
                      value={docForm.content}
                      onChange={e => setDocForm({ ...docForm, content: e.target.value })}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">URL do Website</label>
                    <input
                      className="w-full p-3 input-dark text-white text-sm"
                      placeholder="https://exemplo.com"
                      value={docForm.website_url}
                      onChange={e => setDocForm({ ...docForm, website_url: e.target.value })}
                    />
                  </div>
                )}
                <button
                  onClick={addSubAgentDocument}
                  disabled={docForm.source_type === 'text' ? !docForm.content : !docForm.website_url}
                  className="w-full py-2 border border-[#F97316]/50 text-[#F97316] hover:bg-[#F97316]/10 text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50"
                >
                  <div className="flex items-center justify-center gap-1">
                    <Plus className="w-3 h-3" />
                    Adicionar Documento
                  </div>
                </button>
              </div>
            </div>

            {/* Documents List */}
            <div>
              <h4 className="text-white text-sm font-mono uppercase tracking-widest mb-4">Documentos ({subAgentDocuments.length})</h4>
              {ragLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#F97316]" />
                </div>
              ) : subAgentDocuments.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-white/10">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-neutral-700" />
                  <p className="text-neutral-500 text-xs">Nenhum documento adicionado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {subAgentDocuments.map((doc) => (
                    <div key={doc.id} className="bg-black/40 border border-white/5 p-3 flex items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {doc.source_type === 'website' ? (
                            <Globe className="w-3 h-3 text-[#F97316]" />
                          ) : (
                            <FileText className="w-3 h-3 text-[#F97316]" />
                          )}
                          <span className="text-[9px] font-mono text-neutral-500 uppercase">{doc.source_type}</span>
                        </div>
                        <p className="text-white text-xs line-clamp-2">
                          {doc.content || doc.website_url || 'Sem conteúdo'}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteSubAgentDocument(doc.id)}
                        className="py-1 px-2 border border-red-500/30 text-red-500 hover:bg-red-500/10 text-[10px] font-bold uppercase transition-all"
                      >
                        <Trash className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
