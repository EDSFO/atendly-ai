/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useTenant, useTenantData } from './hooks/useAtendly';
import AdminDashboard from './components/AdminDashboard';
import ChatWidget from './components/ChatWidget';
import SystemCatalogManager from './components/CatalogManager';
import { Loader2, Plus, X, Edit, Trash2, Check, FileText, Trash } from 'lucide-react';

// Material Symbols Icons
const MaterialIcon = ({ icon, filled = false, className = '' }: { icon: string; filled?: boolean; className?: string }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{ fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0" }}
  >
    {icon}
  </span>
);

const SmartToy = () => <MaterialIcon icon="smart_toy" className="w-5 h-5" />;
const Bolt = () => <MaterialIcon icon="bolt" className="w-4 h-4" />;
const Robot = () => <MaterialIcon icon="robot_2" className="w-5 h-5" />;
const Globe = () => <MaterialIcon icon="language" className="w-5 h-5" />;
const EditIcon = () => <MaterialIcon icon="edit" className="w-4 h-4" />;
const DeleteIcon = () => <MaterialIcon icon="delete" className="w-4 h-4" />;
const AddIcon = () => <MaterialIcon icon="add_circle" className="w-5 h-5" />;
const CheckIcon = () => <MaterialIcon icon="check_circle" className="w-5 h-5" />;
const CloseIcon = () => <MaterialIcon icon="cancel" className="w-5 h-5" />;

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [loggedInTenant, setLoggedInTenant] = useState<any>(null);

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (newPath: string) => {
    window.history.pushState({}, '', newPath);
    setPath(newPath);
  };

  const handleLogin = (tenant: any) => {
    setLoggedInTenant(tenant);
    navigate(`/${tenant.slug}`);
  };

  const handleLogout = () => {
    setLoggedInTenant(null);
    navigate('/');
  };

  if (path === '/') {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (path === '/new-company') {
    return <CreateCompany onNavigate={navigate} />;
  }

  // System Admin Catalog route - must check before slug parsing
  if (path === '/admin/catalog') {
    return <SystemCatalogManager onNavigate={navigate} />;
  }

  if (path === '/home' && loggedInTenant) {
    return <TenantApp tenant={loggedInTenant} onNavigate={navigate} onLogout={handleLogout} />;
  }

  const parts = path.split('/').filter(Boolean);
  const slug = parts[0];

  // Handle /admin routes for tenant
  if (slug === 'admin' && parts.length === 2) {
    // This would be /:slug/admin - handled by TenantApp
  }

  if (!slug) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <TenantApp slug={slug} onNavigate={navigate} onLogout={handleLogout} />;
}

function LoginPage({ onLogin }: { onLogin: (tenant: any) => void }) {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);

  useEffect(() => {
    fetch('/api/tenants')
      .then(res => res.json())
      .then(data => setTenants(data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = () => {
    if (selectedTenant) {
      onLogin(selectedTenant);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] relative overflow-hidden">
      {/* Grid Background */}
      <div className="fixed inset-0 grid-bg pointer-events-none z-0"></div>

      <div className="min-h-screen flex flex-col items-center justify-center p-4 relative z-10">
        <div className="max-w-md w-full space-y-12">
          {/* Logo */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="size-12 bg-[#F97316] flex items-center justify-center text-black">
                <SmartToy />
              </div>
            </div>
            <h1 className="text-white text-4xl font-bold tracking-tighter uppercase">Atendly AI</h1>
            <p className="text-[#F97316] text-[10px] font-mono uppercase tracking-[0.2em]">Intelligence</p>
          </div>

          {/* Login Card */}
          <div className="relative">
            {/* Beam effect on left */}
            <div className="beam-border-v h-full -left-6 top-0"></div>

            <div className="bg-[#0A0A0A] border border-white/10 p-8">
              <h2 className="text-white text-xs font-mono uppercase tracking-[0.2em] mb-6">
                Selecione sua empresa
              </h2>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-[#F97316]" />
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">Empresa</label>
                    <select
                      value={selectedTenant?.id || ''}
                      onChange={(e) => {
                        const tenant = tenants.find(t => t.id === parseInt(e.target.value));
                        setSelectedTenant(tenant);
                      }}
                      className="w-full p-4 input-dark text-sm bg-[#0A0A0A]"
                    >
                      <option value="" className="bg-[#0A0A0A]">Selecione uma empresa...</option>
                      {tenants.map(tenant => (
                        <option key={tenant.id} value={tenant.id} className="bg-[#0A0A0A]">
                          {tenant.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={handleLogin}
                    disabled={!selectedTenant}
                    className="w-full btn-beam py-4 px-6 text-white text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="btn-inner"></div>
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      <Bolt />
                      Entrar
                    </span>
                  </button>

                  <div className="text-center pt-2">
                    <button
                      onClick={() => window.location.href = '/new-company'}
                      className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 hover:text-[#F97316] transition-colors"
                    >
                      + Criar nova empresa
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateCompany({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [segment, setSegment] = useState('general');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, segment, theme_color: '#F97316' })
      });
      if (res.ok) {
        onNavigate(`/${slug}/admin`);
      } else {
        alert('Erro ao criar empresa. Verifique se o slug já existe.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] relative overflow-hidden">
      {/* Grid Background */}
      <div className="fixed inset-0 grid-bg pointer-events-none z-0"></div>

      <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-md">
          {/* Beam effect */}
          <div className="beam-border-v h-full -left-6 top-0"></div>

          <div className="bg-[#0A0A0A] border border-white/10 p-8">
            <h2 className="text-white text-2xl font-medium uppercase tracking-tight mb-2">
              Nova Empresa
            </h2>
            <p className="text-neutral-500 text-sm mb-8">Configure sua empresa no Atendly AI</p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">
                  Nome da Empresa
                </label>
                <input
                  required
                  className="w-full p-4 input-dark text-white text-sm"
                  value={name}
                  onChange={e => {
                    setName(e.target.value);
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
                  }}
                  placeholder="Nome da sua empresa"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">
                  URL (Slug)
                </label>
                <input
                  required
                  className="w-full p-4 input-dark text-white text-sm bg-[#050505]"
                  value={slug}
                  onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="sua-empresa"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">
                  Segmento
                </label>
                <select
                  className="w-full p-4 input-dark text-white text-sm bg-[#0A0A0A]"
                  value={segment}
                  onChange={e => setSegment(e.target.value)}
                >
                  <option value="general" className="bg-[#0A0A0A]">Geral</option>
                  <option value="beauty" className="bg-[#0A0A0A]">Beleza / Estética</option>
                  <option value="health" className="bg-[#0A0A0A]">Saúde</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-beam py-4 px-6 text-white text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
              >
                <div className="btn-inner"></div>
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <Bolt />
                  {loading ? 'Criando...' : 'Criar Empresa'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('/')}
                className="w-full text-center text-[10px] font-mono uppercase tracking-widest text-neutral-500 hover:text-white transition-colors py-2"
              >
                Cancelar
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function TenantApp({ slug, onNavigate, onLogout, loggedInTenant }: {
  slug?: string;
  onNavigate: (p: string) => void;
  onLogout?: () => void;
  tenant?: any;
  loggedInTenant?: any;
}) {
  const directTenant = loggedInTenant;
  const { tenant: fetchedTenant, loading } = useTenant(slug || directTenant?.slug);
  const tenant = directTenant || fetchedTenant;
  const { services, professionals, appointments, refreshAppointments } = useTenantData(tenant?.id);

  // Tenant Agents State
  const [tenantAgents, setTenantAgents] = useState<any[]>([]);
  const [tenantAgentsWithOrchestrator, setTenantAgentsWithOrchestrator] = useState<any[]>([]);
  const [catalogAgents, setCatalogAgents] = useState<any[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);
  const [editingPersonality, setEditingPersonality] = useState<any>(null);
  const [editingSubAgent, setEditingSubAgent] = useState<any>(null);
  const [personalityForm, setPersonalityForm] = useState({
    tone: 'professional',
    vocabulary: '',
    greeting: '',
    closing: '',
    rules: '',
    forbidden: ''
  });

  // RAG Documents state for tenant sub-agents
  const [selectedSubAgentForRAG, setSelectedSubAgentForRAG] = useState<any>(null);
  const [tenantSubAgentDocuments, setTenantSubAgentDocuments] = useState<any[]>([]);
  const [ragLoading, setRagLoading] = useState(false);
  const [ragModalOpen, setRagModalOpen] = useState(false);
  const [docForm, setDocForm] = useState({
    source_type: 'text',
    content: '',
    website_url: ''
  });

  // Fetch tenant agents and catalog
  useEffect(() => {
    if (tenant?.id) {
      fetch(`/api/tenants/${tenant.id}/agents`).then(r => r.json()).then(setTenantAgents);
      fetch(`/api/tenants/${tenant.id}/agents-with-orchestrator`).then(r => r.json()).then(setTenantAgentsWithOrchestrator);
    }
    fetch('/api/catalog/agents-with-subagents').then(r => r.json()).then(setCatalogAgents);
  }, [tenant?.id]);

  // Get agents not yet activated (only orchestrators)
  const availableAgents = catalogAgents.filter(
    cat => cat.is_orchestrator && !tenantAgents.some(ta => ta.agent_id === cat.id)
  );

  const activateAgent = async (agentId: number) => {
    try {
      const res = await fetch(`/api/tenants/${tenant.id}/agents/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId })
      });
      if (res.ok) {
        // Refresh both states
        const updatedAgents = await fetch(`/api/tenants/${tenant.id}/agents`).then(r => r.json());
        const updatedWithOrch = await fetch(`/api/tenants/${tenant.id}/agents-with-orchestrator`).then(r => r.json());
        setTenantAgents(updatedAgents);
        setTenantAgentsWithOrchestrator(updatedWithOrch);
        setShowCatalog(false);
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao ativar agente');
      }
    } catch (e) {
      console.error('Error activating agent:', e);
    }
  };

  const deactivateAgent = async (agentId: number) => {
    if (!confirm('Tem certeza que deseja desativar este agente e todos os sub-agentes?')) return;
    try {
      const res = await fetch(`/api/tenants/${tenant.id}/agents/${agentId}`, { method: 'DELETE' });
      if (res.ok) {
        // Refresh both states
        const updatedAgents = await fetch(`/api/tenants/${tenant.id}/agents`).then(r => r.json());
        const updatedWithOrch = await fetch(`/api/tenants/${tenant.id}/agents-with-orchestrator`).then(r => r.json());
        setTenantAgents(updatedAgents);
        setTenantAgentsWithOrchestrator(updatedWithOrch);
      }
    } catch (e) {
      console.error('Error deactivating agent:', e);
    }
  };

  const openPersonalityEditor = (tenantAgent: any, isSubAgent = false) => {
    const basePersonality = tenantAgent.base_personality || {};
    setPersonalityForm({
      tone: basePersonality.tone || 'professional',
      vocabulary: Array.isArray(basePersonality.vocabulary) ? basePersonality.vocabulary.join(', ') : (basePersonality.vocabulary || ''),
      greeting: basePersonality.greeting || '',
      closing: basePersonality.closing || '',
      rules: Array.isArray(basePersonality.rules) ? basePersonality.rules.join('\n') : (basePersonality.rules || ''),
      forbidden: Array.isArray(basePersonality.forbidden) ? basePersonality.forbidden.join(', ') : (basePersonality.forbidden || '')
    });
    if (isSubAgent) {
      setEditingSubAgent(tenantAgent);
      setEditingPersonality(null);
    } else {
      setEditingPersonality(tenantAgent);
      setEditingSubAgent(null);
    }
  };

  const savePersonality = async () => {
    if (!editingPersonality && !editingSubAgent) return;
    const personality = {
      tone: personalityForm.tone,
      vocabulary: personalityForm.vocabulary.split(',').map(v => v.trim()).filter(v => v),
      greeting: personalityForm.greeting,
      closing: personalityForm.closing,
      rules: personalityForm.rules.split('\n').filter(r => r.trim()),
      forbidden: personalityForm.forbidden.split(',').map(f => f.trim()).filter(f => f)
    };
    try {
      let res;
      if (editingSubAgent) {
        res = await fetch(`/api/tenant-sub-agents/${editingSubAgent.id}/personality`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ custom_personality: personality })
        });
      } else {
        res = await fetch(`/api/tenant-agents/${editingPersonality.id}/personality`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ custom_personality: personality })
        });
      }
      if (res.ok) {
        // Refresh state
        const updatedAgents = await fetch(`/api/tenants/${tenant.id}/agents`).then(r => r.json());
        const updatedWithOrch = await fetch(`/api/tenants/${tenant.id}/agents-with-orchestrator`).then(r => r.json());
        setTenantAgents(updatedAgents);
        setTenantAgentsWithOrchestrator(updatedWithOrch);
        setEditingPersonality(null);
        setEditingSubAgent(null);
      }
    } catch (e) {
      console.error('Error saving personality:', e);
    }
  };

  // RAG Document functions for tenant sub-agents
  const fetchTenantSubAgentDocuments = async (tenantAgentId: number) => {
    setRagLoading(true);
    try {
      const res = await fetch(`/api/tenant-sub-agents/${tenantAgentId}/documents`);
      const data = await res.json();
      setTenantSubAgentDocuments(data);
    } catch (e) {
      console.error('Error fetching tenant sub-agent documents:', e);
    } finally {
      setRagLoading(false);
    }
  };

  const openRAGModal = (subAgent: any) => {
    setSelectedSubAgentForRAG(subAgent);
    setDocForm({ source_type: 'text', content: '', website_url: '' });
    fetchTenantSubAgentDocuments(subAgent.id);
    setRagModalOpen(true);
  };

  const addTenantSubAgentDocument = async () => {
    if (!selectedSubAgentForRAG) return;
    try {
      const res = await fetch(`/api/tenant-sub-agents/${selectedSubAgentForRAG.id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docForm)
      });
      if (res.ok) {
        setDocForm({ source_type: 'text', content: '', website_url: '' });
        fetchTenantSubAgentDocuments(selectedSubAgentForRAG.id);
      }
    } catch (e) {
      console.error('Error adding tenant sub-agent document:', e);
    }
  };

  const deleteTenantSubAgentDocument = async (docId: number) => {
    if (!confirm('Tem certeza que deseja deletar este documento?')) return;
    if (!selectedSubAgentForRAG) return;
    try {
      const res = await fetch(`/api/tenant-sub-agents/${selectedSubAgentForRAG.id}/documents/${docId}?tenant_id=${tenant.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchTenantSubAgentDocuments(selectedSubAgentForRAG.id);
      }
    } catch (e) {
      console.error('Error deleting tenant sub-agent document:', e);
    }
  };

  if (loading && !tenant) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#F97316]" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center">
        <h2 className="text-white text-xl font-medium uppercase tracking-tight mb-4">Empresa não encontrada</h2>
        <button onClick={() => onNavigate('/')} className="text-[#F97316] hover:underline text-sm font-mono uppercase tracking-widest">
          Voltar ao início
        </button>
      </div>
    );
  }

  const isAdmin = window.location.pathname.includes('/admin');

  if (isAdmin) {
    return <AdminDashboard tenant={tenant} appointments={appointments} onLogout={onLogout} />;
  }

  const tenantSlug = slug || tenant?.slug;
  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Grid Background */}
      <div className="fixed inset-0 grid-bg pointer-events-none z-0"></div>

      {/* Header */}
      <header className="relative z-10 glass border-b border-white/5 px-6 py-4">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <h1 className="text-white text-base font-medium uppercase tracking-tight flex items-center gap-3">
            <div className="w-2 h-2 bg-[#F97316]"></div>
            {tenant.name}
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => onNavigate(`/${tenantSlug}/admin`)}
              className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 hover:text-white px-4 py-2 border border-white/10 hover:border-[#F97316]/50 transition-all"
            >
              Configurar Agentes
            </button>
            {onLogout && (
              <button
                onClick={onLogout}
                className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 hover:text-red-500 px-4 py-2 border border-white/10 hover:border-red-500/50 transition-all"
              >
                Sair
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Tenant Agents Section */}
      <div className="relative z-10 px-6 py-8 max-w-7xl mx-auto">
        {/* Personality Editor Modal */}
        {editingPersonality && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-[#0A0A0A] border border-white/10 p-8 max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-white text-lg font-medium uppercase tracking-tight">
                  Personalizar: {editingPersonality.name}
                </h3>
                <button onClick={() => setEditingPersonality(null)} className="text-neutral-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-6">
                <div>
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
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">Saudação</label>
                  <input
                    className="w-full p-4 input-dark text-white text-sm"
                    placeholder="Ex: Olá! Como posso ajudar?"
                    value={personalityForm.greeting}
                    onChange={e => setPersonalityForm({ ...personalityForm, greeting: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">Despedida</label>
                  <input
                    className="w-full p-4 input-dark text-white text-sm"
                    placeholder="Ex: Até logo!"
                    value={personalityForm.closing}
                    onChange={e => setPersonalityForm({ ...personalityForm, closing: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">Vocabulário (vírgula)</label>
                  <input
                    className="w-full p-4 input-dark text-white text-sm"
                    placeholder="Ex: marketing, SEO"
                    value={personalityForm.vocabulary}
                    onChange={e => setPersonalityForm({ ...personalityForm, vocabulary: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">Regras (linha)</label>
                  <textarea
                    className="w-full p-4 input-dark text-white text-sm h-24 resize-none"
                    placeholder="Uma regra por linha"
                    value={personalityForm.rules}
                    onChange={e => setPersonalityForm({ ...personalityForm, rules: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">Proibições (vírgula)</label>
                  <input
                    className="w-full p-4 input-dark text-white text-sm"
                    placeholder="Ex: spam, info pessoal"
                    value={personalityForm.forbidden}
                    onChange={e => setPersonalityForm({ ...personalityForm, forbidden: e.target.value })}
                  />
                </div>
                <button onClick={savePersonality} className="w-full btn-beam py-4 text-white text-[10px] font-bold uppercase tracking-widest">
                  <div className="btn-inner"></div>
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" />
                    Salvar Personalidade
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Catalog Modal */}
        {showCatalog && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-[#0A0A0A] border border-white/10 p-8 max-w-4xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-white text-lg font-medium uppercase tracking-tight">Catálogo de Agentes</h3>
                <button onClick={() => setShowCatalog(false)} className="text-neutral-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {availableAgents.length === 0 ? (
                <div className="text-center py-12">
                  <Robot className="w-12 h-12 mx-auto mb-4 text-neutral-700" />
                  <p className="text-neutral-500 text-sm">Todos os agentes já estão ativados</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availableAgents.map((agent: any) => (
                    <div key={agent.id} className="bg-black/40 border border-white/10 p-6">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[9px] font-mono text-[#F97316] uppercase tracking-widest">
                          {agent.agent_type}
                        </span>
                        {agent.is_orchestrator && (
                          <span className="text-[9px] font-mono bg-[#F97316] text-black px-2 py-0.5 uppercase">
                            Orquestrador
                          </span>
                        )}
                      </div>
                      <h4 className="text-white font-medium text-lg uppercase tracking-tight mt-2 mb-2">
                        {agent.name}
                      </h4>
                      <p className="text-neutral-500 text-xs mb-4 line-clamp-2">
                        {agent.description || 'Sem descrição'}
                      </p>
                      {agent.monthly_price > 0 ? (
                        <span className="text-green-500 text-[10px] font-mono uppercase">R$ {agent.monthly_price}/mês</span>
                      ) : (
                        <span className="text-green-500 text-[10px] font-mono uppercase">Gratuito</span>
                      )}
                      {agent.sub_agents && agent.sub_agents.length > 0 && (
                        <p className="text-neutral-500 text-[10px] mt-2">
                          + {agent.sub_agents.length} sub-agente(s) incluso(s)
                        </p>
                      )}
                      <button
                        onClick={() => activateAgent(agent.id)}
                        className="w-full mt-4 btn-beam py-3 text-white text-[10px] font-bold uppercase tracking-widest"
                      >
                        <div className="btn-inner"></div>
                        <span className="relative z-10 flex items-center justify-center gap-2">
                          <Plus className="w-4 h-4" />
                          Ativar
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Meus Agentes */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-white text-2xl font-medium uppercase tracking-tight">
              Meus Agentes <span className="text-neutral-700">de IA</span>
            </h2>
            <button
              onClick={() => setShowCatalog(true)}
              className="btn-beam px-6 py-3 text-white text-[10px] font-bold uppercase tracking-widest"
            >
              <div className="btn-inner"></div>
              <span className="relative z-10 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Adicionar Agente
              </span>
            </button>
          </div>

          {tenantAgentsWithOrchestrator.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-white/10">
              <Robot className="w-16 h-16 mx-auto mb-4 text-neutral-700" />
              <p className="text-neutral-500 text-sm font-mono uppercase tracking-widest mb-2">Nenhum agente ativado</p>
              <p className="text-neutral-600 text-xs mb-6">Ative agentes do catálogo para começar</p>
              <button
                onClick={() => setShowCatalog(true)}
                className="btn-beam px-8 py-3 text-white text-[10px] font-bold uppercase tracking-widest"
              >
                <div className="btn-inner"></div>
                <span className="relative z-10">Ver Catálogo</span>
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {tenantAgentsWithOrchestrator.map((orchestrator: any) => (
                <div key={orchestrator.id} className="bg-[#0A0A0A] border border-white/10 overflow-hidden">
                  {/* Orchestrator Header */}
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          {orchestrator.is_orchestrator && (
                            <span className="text-[9px] font-mono bg-[#F97316] text-black px-2 py-0.5 uppercase">
                              Orquestrador
                            </span>
                          )}
                          <span className="text-[9px] font-mono text-[#F97316] uppercase tracking-widest">
                            {orchestrator.agent_type || 'Atendimento'}
                          </span>
                        </div>
                        <h3 className="text-white font-medium text-xl uppercase tracking-tight">
                          {orchestrator.name}
                        </h3>
                        <p className="text-neutral-500 text-sm mt-1">
                          {orchestrator.description || 'Sem descrição'}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`text-[9px] font-mono uppercase ${orchestrator.is_active ? 'text-green-500' : 'text-red-500'}`}>
                          {orchestrator.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </div>

                    {/* Sub-agents */}
                    {orchestrator.sub_agents && orchestrator.sub_agents.length > 0 && (
                      <div className="mt-4 mb-4 pl-4 border-l-2 border-[#F97316]/30 space-y-2">
                        <p className="text-neutral-400 text-[10px] font-mono uppercase mb-3">Sub-agentes incluídos:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {orchestrator.sub_agents.map((subAgent: any) => (
                            <div key={subAgent.id} className="bg-black/40 border border-white/5 p-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="text-[9px] font-mono text-neutral-500 uppercase">{subAgent.agent_type}</span>
                                  <p className="text-white text-sm font-medium">{subAgent.name}</p>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => openRAGModal(subAgent)}
                                    className="text-neutral-500 hover:text-[#F97316]"
                                    title="Gerenciar RAG"
                                  >
                                    <FileText className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => openPersonalityEditor(subAgent, true)}
                                    className="text-neutral-500 hover:text-white"
                                  >
                                    <Edit className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => openPersonalityEditor(orchestrator)}
                        className="py-2 px-4 border border-white/10 text-neutral-400 hover:text-white hover:border-white/30 text-[10px] font-bold uppercase tracking-widest transition-all"
                      >
                        <div className="flex items-center gap-1">
                          <Edit className="w-3 h-3" />
                          Personalizar
                        </div>
                      </button>
                      <button
                        onClick={() => deactivateAgent(orchestrator.agent_id)}
                        className="py-2 px-3 border border-red-500/30 text-red-500 hover:bg-red-500/10 text-[10px] font-bold uppercase tracking-widest transition-all"
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

      {/* RAG Documents Modal for Tenant Sub-agents */}
      {ragModalOpen && selectedSubAgentForRAG && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-[#0A0A0A] border border-white/10 p-8 max-w-3xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-white text-lg font-medium uppercase tracking-tight">
                  RAG - {selectedSubAgentForRAG.name}
                </h3>
                <p className="text-neutral-500 text-xs mt-1">Adicione documentos para enriquecer as respostas do sub-agente</p>
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
                  onClick={addTenantSubAgentDocument}
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
              <h4 className="text-white text-sm font-mono uppercase tracking-widest mb-4">Seus Documentos ({tenantSubAgentDocuments.length})</h4>
              {ragLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#F97316]" />
                </div>
              ) : tenantSubAgentDocuments.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-white/10">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-neutral-700" />
                  <p className="text-neutral-500 text-xs">Nenhum documento adicionado</p>
                  <p className="text-neutral-600 text-[10px] mt-1">Adicione documentos para melhorar as respostas</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tenantSubAgentDocuments.map((doc) => (
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
                        onClick={() => deleteTenantSubAgentDocument(doc.id)}
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

      <ChatWidget tenant={tenant} />
    </div>
  );
}
