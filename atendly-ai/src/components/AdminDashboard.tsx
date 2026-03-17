import { useState, useEffect } from 'react';
import { Tenant, Appointment } from '../types';
import { Settings, Plus, Trash2, Loader2, X, Search, Edit } from 'lucide-react';

// Material Symbols Icons Components
const MaterialIcon = ({ icon, filled = false, className = '' }: { icon: string; filled?: boolean; className?: string }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{ fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0" }}
  >
    {icon}
  </span>
);

const SmartToy = () => <MaterialIcon icon="smart_toy" />;
const Home = () => <MaterialIcon icon="home" />;
const Robot = () => <MaterialIcon icon="robot_2" filled />;
const Shield = () => <MaterialIcon icon="shield_person" />;
const Group = () => <MaterialIcon icon="group" />;
const SettingsIcon = () => <MaterialIcon icon="settings" />;
const SearchIcon = () => <MaterialIcon icon="search" />;
const Notifications = () => <MaterialIcon icon="notifications" />;
const Help = () => <MaterialIcon icon="help" />;
const Bolt = () => <MaterialIcon icon="bolt" className="text-[#F97316]" />;
const Add = () => <MaterialIcon icon="add" className="text-4xl" />;
const EditIcon = () => <MaterialIcon icon="edit" />;
const DeleteIcon = () => <MaterialIcon icon="delete" />;
const Globe = () => <MaterialIcon icon="language" />;

interface AdminDashboardProps {
  tenant: Tenant;
  appointments: Appointment[];
  onLogout?: () => void;
}

export default function AdminDashboard({ tenant: initialTenant, appointments, onLogout }: AdminDashboardProps) {
  const [tenant, setTenant] = useState(initialTenant);
  const [activeTab, setActiveTab] = useState<'agents' | 'whatsapp' | 'settings'>('agents');

  // Agents state
  const [agents, setAgents] = useState<any[]>([]);
  const [agentTemplates, setAgentTemplates] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [agentDocuments, setAgentDocuments] = useState<any[]>([]);
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [newAgentForm, setNewAgentForm] = useState({
    template_key: 'atendimento',
    custom_name: '',
    custom_description: '',
    custom_prompt: ''
  });

  // Estado para edição de personalidade
  const [editingPersonality, setEditingPersonality] = useState(false);
  const [personalityForm, setPersonalityForm] = useState({
    tone: 'professional',
    vocabulary: '',
    greeting: '',
    closing: '',
    rules: '',
    forbidden: ''
  });

  // Estado para edição de configurações do agente
  const [editingAgentConfig, setEditingAgentConfig] = useState(false);
  const [agentConfigForm, setAgentConfigForm] = useState({
    name: '',
    description: '',
    system_prompt: '',
    services: '',
    professionals: '',
    business_info: ''
  });

  useEffect(() => {
    setTenant(initialTenant);
  }, [initialTenant]);

  // WhatsApp Config State
  const [whatsappConfig, setWhatsappConfig] = useState({
    instance_key: '',
    webhook_url: '',
    access_token: ''
  });
  const [isSavingWhatsapp, setIsSavingWhatsapp] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<string | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState(false);

  // Settings State
  const [aiContext, setAiContext] = useState(tenant.ai_context || '');
  const [defaultAgentId, setDefaultAgentId] = useState<number | null>(tenant.default_agent_id || null);
  const [isSaving, setIsSaving] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    fetch(`/api/tenants/${tenant.id}/agents`).then(r => r.json()).then(setAgents);

    fetch(`/api/whatsapp/status/${tenant.id}`).then(r => {
      if (r.ok) return r.json();
      return null;
    }).then(data => {
      if (data && data.status) {
        setWhatsappStatus(data.status);
      }
    }).catch(() => {});
  }, [tenant.id]);

  // Fetch agents and templates when agents tab is active
  useEffect(() => {
    if (activeTab === 'agents') {
      fetch(`/api/tenants/${tenant.id}/agents`).then(r => r.json()).then(setAgents);
      fetch('/api/agents/templates').then(r => r.json()).then(setAgentTemplates);
    }
  }, [activeTab, tenant.id]);

  // Fetch documents when an agent is selected
  useEffect(() => {
    if (selectedAgent) {
      fetch(`/api/agents/${selectedAgent.id}/documents`).then(r => r.json()).then(setAgentDocuments);
    }
  }, [selectedAgent]);

  const savePersonality = async (agentId: number) => {
    try {
      const personality = {
        tone: personalityForm.tone,
        vocabulary: personalityForm.vocabulary.split(',').map(v => v.trim()).filter(v => v),
        greeting: personalityForm.greeting,
        closing: personalityForm.closing,
        rules: personalityForm.rules.split('\n').filter(r => r.trim()),
        forbidden: personalityForm.forbidden.split(',').map(f => f.trim()).filter(f => f)
      };

      await fetch(`/api/agents/${agentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personality: JSON.stringify(personality) })
      });

      setEditingPersonality(false);
      fetch(`/api/tenants/${tenant.id}/agents`).then(r => r.json()).then(setAgents);
    } catch (error) {
      console.error('Error saving personality:', error);
    }
  };

  const saveAgentConfig = async (agentId: number) => {
    try {
      await fetch(`/api/agents/${agentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: agentConfigForm.name,
          description: agentConfigForm.description,
          system_prompt: agentConfigForm.system_prompt
        })
      });

      setEditingAgentConfig(false);
      fetch(`/api/tenants/${tenant.id}/agents`).then(r => r.json()).then(setAgents);
    } catch (error) {
      console.error('Error saving agent config:', error);
    }
  };

  const fetchQrCode = async () => {
    setIsLoadingQr(true);
    try {
      const res = await fetch(`/api/whatsapp/qrcode/${tenant.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.qrcode) {
          const qrData = data.qrcode.startsWith('data:image')
            ? data.qrcode
            : `data:image/png;base64,${data.qrcode}`;
          setQrCode(qrData);
        } else if (data.message) {
          alert(data.message);
        }
      } else {
        alert('Erro ao buscar QR Code. Verifique se a Instance Key está correta e salva.');
      }
    } catch (e) {
      alert('Erro de conexão ao buscar QR Code.');
    } finally {
      setIsLoadingQr(false);
    }
  };

  const handleScanWebsite = async () => {
    if (!websiteUrl) return;
    setIsScanning(true);
    try {
      const res = await fetch('/api/scan-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: websiteUrl })
      });
      if (res.ok) {
        const data = await res.json();
        setAiContext(prev => prev + (prev ? '\n\n' : '') + data.context);
        alert('Informações extraídas e adicionadas ao contexto!');
      } else {
        alert('Erro ao escanear site.');
      }
    } catch (e) {
      alert('Erro ao conectar com o servidor.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    await fetch(`/api/tenants/${tenant.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: tenant.name,
        theme_color: tenant.theme_color,
        ai_context: aiContext,
        default_agent_id: defaultAgentId
      })
    });
    setIsSaving(false);
    alert('Configurações salvas!');
  };

  // Navigation tabs
  const mainTabs = [
    { key: 'home', label: 'Início', icon: Home },
    { key: 'agents', label: 'Agentes', icon: Robot },
  ];

  const adminTabs = [
    { key: 'whatsapp', label: 'WhatsApp', icon: Globe },
    { key: 'settings', label: 'Configurações', icon: SettingsIcon },
  ];

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Grid Background */}
      <div className="fixed inset-0 grid-bg pointer-events-none z-0"></div>

      {/* Sidebar */}
      <aside className="w-72 flex-shrink-0 bg-black/40 backdrop-blur-xl h-full flex flex-col border-r border-white/10 z-20">
        <div className="p-6">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="size-10 bg-[#F97316] flex items-center justify-center text-black">
              <SmartToy />
            </div>
            <div className="flex flex-col">
              <h1 className="text-white text-base font-bold leading-none uppercase tracking-tighter">Atendly-AI</h1>
              <p className="text-[#F97316] text-[10px] font-mono uppercase tracking-[0.2em] mt-1">Intelligence</p>
            </div>
          </div>

          {/* Main Nav */}
          <nav className="flex flex-col gap-1">
            {mainTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => tab.key === 'agents' && setActiveTab('agents')}
                className={`flex items-center gap-3 px-4 py-3 transition-colors uppercase text-[10px] font-mono tracking-widest ${
                  activeTab === tab.key
                    ? 'bg-white/5 border-l-2 border-[#F97316] text-white'
                    : 'text-neutral-500 hover:text-white'
                }`}
              >
                <tab.icon className="text-sm" />
                <span>{tab.label}</span>
              </button>
            ))}

            {/* System Admin Section */}
            <div className="mt-8 mb-2 px-4">
              <p className="text-neutral-700 text-[9px] font-mono uppercase tracking-[0.3em]">System Admin</p>
            </div>

            {adminTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-3 px-4 py-3 transition-colors uppercase text-[10px] font-mono tracking-widest ${
                  activeTab === tab.key
                    ? 'bg-white/5 border-l-2 border-[#F97316] text-white'
                    : 'text-neutral-500 hover:text-white'
                }`}
              >
                <tab.icon className="text-sm" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* User Profile */}
        <div className="mt-auto p-6 border-t border-white/5 bg-black/20">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-neutral-900 border border-white/10 flex items-center justify-center text-neutral-500">
              <Group />
            </div>
            <div className="flex flex-col">
              <p className="text-[11px] font-bold text-white uppercase tracking-wider leading-none">Admin Profile</p>
              <p className="text-[10px] text-neutral-500 font-mono mt-1">{tenant.name}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-y-auto relative z-10">
        {/* Header */}
        <header className="flex items-center justify-between px-8 py-5 border-b border-white/5 sticky top-0 bg-black/60 backdrop-blur-md z-30">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 bg-[#F97316]"></div>
            <h2 className="text-white text-xs font-mono uppercase tracking-[0.2em]">
              Dashboard / {activeTab === 'agents' ? 'Agentes' : activeTab === 'whatsapp' ? 'WhatsApp' : 'Configurações'}
            </h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative group">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-[#F97316] transition-colors text-sm" />
              <input
                className="bg-white/5 border border-white/10 rounded-none py-2 pl-9 pr-4 text-[11px] font-mono text-white focus:ring-1 focus:ring-[#F97316] focus:border-[#F97316] w-64 placeholder:text-neutral-700"
                placeholder="PESQUISAR SISTEMA..."
                type="text"
              />
            </div>
            <div className="flex gap-2">
              <button className="size-9 flex items-center justify-center border border-white/10 text-neutral-400 hover:text-white hover:border-[#F97316] transition-colors">
                <Notifications className="text-[18px]" />
              </button>
              <button className="size-9 flex items-center justify-center border border-white/10 text-neutral-400 hover:text-white hover:border-[#F97316] transition-colors">
                <Help className="text-[18px]" />
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-8 lg:p-12 max-w-7xl mx-auto w-full">
          {/* Page Title */}
          <div className="mb-12 relative">
            <div className="beam-border-v h-20 -left-6 top-0"></div>
            <h1 className="text-white text-5xl lg:text-7xl font-medium uppercase tracking-tighter mb-4 leading-none">
              {activeTab === 'agents' ? 'Agentes' : activeTab === 'whatsapp' ? 'WhatsApp' : 'Configurações'} <span className="text-neutral-700">de IA</span>
            </h1>
            <p className="text-neutral-400 text-lg max-w-2xl leading-relaxed font-light">
              {activeTab === 'agents'
                ? 'Automatize processos complexos com inteligência artificial generativa de ponta em um ambiente modular.'
                : activeTab === 'whatsapp'
                ? 'Conecte o WhatsApp para receber e enviar mensagens automaticamente.'
                : 'Gerencie as configurações gerais do seu assistente virtual.'}
            </p>
          </div>

          {/* AGENTS TAB */}
          {activeTab === 'agents' && (
            <div className="space-y-8">
              {/* Filter Buttons */}
              <div className="flex flex-wrap gap-3 mb-12">
                <button className="px-6 py-2 bg-[#F97316] text-black text-[10px] font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(249,115,22,0.2)]">Todos</button>
                <button className="px-6 py-2 border border-white/10 text-neutral-500 hover:border-white/30 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all">Integrações</button>
                <button className="px-6 py-2 border border-white/10 text-neutral-500 hover:border-white/30 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all">Marketing</button>
                <button className="px-6 py-2 border border-white/10 text-neutral-500 hover:border-white/30 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all">Operação</button>
                <button className="px-6 py-2 border border-white/10 text-neutral-500 hover:border-white/30 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all">Vendas</button>
              </div>

              {/* Agent Templates Modal */}
              {isCreatingAgent && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                  <div className="bg-[#0A0A0A] border border-white/10 p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-white text-lg font-medium uppercase tracking-tight">Criar Novo Agente</h3>
                      <button onClick={() => setIsCreatingAgent(false)} className="text-neutral-500 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-6">
                      {/* Template Selection */}
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">Template</label>
                        <div className="grid grid-cols-2 gap-3">
                          {agentTemplates.map((template: any) => (
                            <button
                              key={template.key}
                              onClick={() => setNewAgentForm({ ...newAgentForm, template_key: template.key })}
                              className={`p-4 border text-left transition-all ${
                                newAgentForm.template_key === template.key
                                  ? 'border-[#F97316] bg-[#F97316]/5'
                                  : 'border-white/10 hover:border-white/30'
                              }`}
                            >
                              <div className="text-white font-medium text-sm uppercase tracking-tight">{template.name}</div>
                              <div className="text-neutral-500 text-xs mt-1">{template.description}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Agent Name */}
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">Nome do Agente</label>
                        <input
                          className="w-full p-4 input-dark text-white text-sm"
                          placeholder="Ex: Atendente João"
                          value={newAgentForm.custom_name}
                          onChange={e => setNewAgentForm({ ...newAgentForm, custom_name: e.target.value })}
                        />
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">Descrição</label>
                        <input
                          className="w-full p-4 input-dark text-white text-sm"
                          placeholder="Ex: Agente de atendimento para salão de beleza"
                          value={newAgentForm.custom_description}
                          onChange={e => setNewAgentForm({ ...newAgentForm, custom_description: e.target.value })}
                        />
                      </div>

                      {/* Services */}
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">Serviços Oferecidos</label>
                        <textarea
                          className="w-full p-4 input-dark text-white text-sm h-24 resize-none"
                          placeholder="Ex:&#10;Corte de cabelo - R$ 50 - 30min&#10;Barba - R$ 30 - 20min&#10;Coloração - R$ 120 - 90min"
                          value={newAgentForm.custom_prompt}
                          onChange={e => setNewAgentForm({ ...newAgentForm, custom_prompt: e.target.value })}
                        />
                      </div>

                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch('/api/agents/from-template', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                tenant_id: tenant.id,
                                template_key: newAgentForm.template_key,
                                custom_name: newAgentForm.custom_name || undefined,
                                custom_description: newAgentForm.custom_description || undefined,
                                custom_prompt: newAgentForm.custom_prompt || undefined
                              })
                            });
                            if (res.ok) {
                              const newAgent = await res.json();
                              setAgents([...agents, newAgent]);
                              setIsCreatingAgent(false);
                              setNewAgentForm({ template_key: 'atendimento', custom_name: '', custom_description: '', custom_prompt: '' });
                            }
                          } catch (e) {
                            alert('Erro ao criar agente');
                          }
                        }}
                        className="w-full btn-beam py-4 px-6 text-white text-[10px] font-bold uppercase tracking-widest"
                      >
                        <div className="btn-inner"></div>
                        <span className="relative z-10 flex items-center justify-center gap-2">
                          <Bolt />
                          Criar Agente
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Agents Grid */}
              {agents.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-white/10">
                  <Robot className="w-16 h-16 mx-auto mb-4 text-neutral-700" />
                  <p className="text-neutral-500 text-sm font-mono uppercase tracking-widest">Nenhum agente criado ainda</p>
                  <p className="text-neutral-600 text-xs mt-2">Crie seu primeiro agente de IA para começar</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {agents.map((agent: any) => (
                    <div
                      key={agent.id}
                      onClick={() => setSelectedAgent(agent)}
                      className="bg-[#0A0A0A] border border-white/10 floating-card overflow-hidden cursor-pointer group"
                    >
                      <div className="h-44 bg-cover bg-center grayscale-hover" style={{ backgroundColor: '#1a1a1a' }}></div>
                      <div className="p-6">
                        <span className="text-[9px] font-mono text-[#F97316] uppercase tracking-[0.2em] block mb-2">
                          {agent.agent_type || 'Atendimento'}
                        </span>
                        <h3 className="text-white font-medium text-lg uppercase tracking-tight mb-3">
                          {agent.name}
                        </h3>
                        <p className="text-neutral-500 text-sm leading-relaxed mb-6 h-12 overflow-hidden">
                          {agent.description || 'Agente de atendimento virtual'}
                        </p>
                        <button className="w-full btn-beam py-3 px-4 text-white text-[10px] font-bold uppercase tracking-widest group/btn shadow-[0_0_20px_-5px_rgba(249,115,22,0.3)]">
                          <div className="btn-inner"></div>
                          <span className="relative z-10 flex items-center justify-center gap-2">
                            <Bolt />
                            Ativar Agente
                          </span>
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Create New Card */}
                  <div
                    onClick={() => setIsCreatingAgent(true)}
                    className="bg-[#F97316]/5 border border-dashed border-[#F97316]/30 flex flex-col items-center justify-center p-8 hover:bg-[#F97316]/10 transition-all group cursor-pointer relative overflow-hidden"
                  >
                    <div className="beam-border-v h-full right-0 top-0"></div>
                    <div className="size-16 bg-[#F97316]/10 flex items-center justify-center text-[#F97316] mb-5 group-hover:scale-110 transition-transform border border-[#F97316]/20">
                      <Add />
                    </div>
                    <p className="text-white font-bold uppercase tracking-widest text-[11px]">Criar Novo Agente</p>
                    <p className="text-neutral-600 text-[10px] font-mono mt-2 uppercase tracking-wider">Modular Assembly</p>
                  </div>
                </div>
              )}

              {/* Agent Details Panel */}
              {selectedAgent && (
                <div className="border-t border-white/10 pt-8 mt-8">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-white text-xl font-medium uppercase tracking-tight">{selectedAgent.name}</h3>
                    <div className="flex gap-3">
                      <button
                        onClick={async () => {
                          const res = await fetch(`/api/agents/${selectedAgent.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ is_active: !selectedAgent.is_active })
                          });
                          if (res.ok) {
                            const updated = await res.json();
                            setAgents(agents.map((a: any) => a.id === updated.id ? updated : a));
                            setSelectedAgent(updated);
                          }
                        }}
                        className={`px-4 py-2 text-[10px] font-mono uppercase tracking-widest transition-all ${
                          selectedAgent.is_active
                            ? 'border border-red-500/50 text-red-500 hover:bg-red-500/10'
                            : 'border border-green-500/50 text-green-500 hover:bg-green-500/10'
                        }`}
                      >
                        {selectedAgent.is_active ? 'Desativar' : 'Ativar'}
                      </button>
                      <button
                        onClick={() => {
                          setAgentConfigForm({
                            name: selectedAgent.name || '',
                            description: selectedAgent.description || '',
                            system_prompt: selectedAgent.system_prompt || '',
                            services: '',
                            professionals: '',
                            business_info: ''
                          });
                          setEditingAgentConfig(true);
                        }}
                        className="px-4 py-2 border border-white/10 text-neutral-400 hover:text-white hover:border-white/30 text-[10px] font-mono uppercase tracking-widest transition-all"
                      >
                        <EditIcon className="w-3 h-3 inline mr-2" />
                        Configurar
                      </button>
                      <button
                        onClick={() => {
                          const existingPersonality = selectedAgent.personality ? JSON.parse(selectedAgent.personality) : null;
                          setPersonalityForm({
                            tone: existingPersonality?.tone || 'professional',
                            vocabulary: existingPersonality?.vocabulary?.join(', ') || '',
                            greeting: existingPersonality?.greeting || '',
                            closing: existingPersonality?.closing || '',
                            rules: existingPersonality?.rules?.join('\n') || '',
                            forbidden: existingPersonality?.forbidden?.join(', ') || ''
                          });
                          setEditingPersonality(true);
                        }}
                        className="px-4 py-2 border border-white/10 text-neutral-400 hover:text-white hover:border-white/30 text-[10px] font-mono uppercase tracking-widest transition-all"
                      >
                        Personalidade
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm('Tem certeza que deseja excluir este agente?')) {
                            await fetch(`/api/agents/${selectedAgent.id}`, { method: 'DELETE' });
                            setAgents(agents.filter((a: any) => a.id !== selectedAgent.id));
                            setSelectedAgent(null);
                          }
                        }}
                        className="px-4 py-2 border border-red-500/50 text-red-500 hover:bg-red-500/10 text-[10px] font-mono uppercase tracking-widest transition-all"
                      >
                        <DeleteIcon className="w-3 h-3 inline mr-2" />
                        Excluir
                      </button>
                    </div>
                  </div>

                  {/* Agent Config Editor */}
                  {editingAgentConfig && (
                    <div className="bg-[#0A0A0A] border border-white/10 p-6 space-y-4">
                      <h4 className="text-white text-sm font-mono uppercase tracking-widest mb-4">Configurar Agente</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">Nome</label>
                          <input
                            className="w-full p-3 input-dark text-sm"
                            value={agentConfigForm.name}
                            onChange={e => setAgentConfigForm({ ...agentConfigForm, name: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">Descrição</label>
                          <input
                            className="w-full p-3 input-dark text-sm"
                            value={agentConfigForm.description}
                            onChange={e => setAgentConfigForm({ ...agentConfigForm, description: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">System Prompt</label>
                          <textarea
                            className="w-full p-3 input-dark text-sm h-32 resize-none"
                            value={agentConfigForm.system_prompt}
                            onChange={e => setAgentConfigForm({ ...agentConfigForm, system_prompt: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="flex gap-3 mt-4">
                        <button
                          onClick={() => saveAgentConfig(selectedAgent.id)}
                          className="btn-beam px-6 py-3 text-white text-[10px] font-bold uppercase tracking-widest"
                        >
                          <div className="btn-inner"></div>
                          <span className="relative z-10 flex items-center gap-2">
                            <Bolt />
                            Salvar Configuração
                          </span>
                        </button>
                        <button
                          onClick={() => setEditingAgentConfig(false)}
                          className="px-6 py-3 border border-white/10 text-neutral-400 hover:text-white text-[10px] font-mono uppercase tracking-widest transition-all"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Personality Editor */}
                  {editingPersonality && (
                    <div className="bg-[#0A0A0A] border border-white/10 p-6 space-y-4 mt-4">
                      <h4 className="text-white text-sm font-mono uppercase tracking-widest mb-4">Configurar Personalidade</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">Tom de Voz</label>
                          <select
                            className="w-full p-3 input-dark text-sm"
                            value={personalityForm.tone}
                            onChange={e => setPersonalityForm({ ...personalityForm, tone: e.target.value })}
                          >
                            <option value="professional" className="bg-[#0A0A0A]">Profissional</option>
                            <option value="friendly" className="bg-[#0A0A0A]">Amigável</option>
                            <option value="casual" className="bg-[#0A0A0A]">Casual</option>
                            <option value="formal" className="bg-[#0A0A0A]">Formal</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">Vocabulário</label>
                          <input
                            className="w-full p-3 input-dark text-sm"
                            placeholder="palavra1, palavra2"
                            value={personalityForm.vocabulary}
                            onChange={e => setPersonalityForm({ ...personalityForm, vocabulary: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">Saudação</label>
                          <input
                            className="w-full p-3 input-dark text-sm"
                            placeholder="Olá! Como posso ajudar?"
                            value={personalityForm.greeting}
                            onChange={e => setPersonalityForm({ ...personalityForm, greeting: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">Despedida</label>
                          <input
                            className="w-full p-3 input-dark text-sm"
                            placeholder="Obrigado! Até mais!"
                            value={personalityForm.closing}
                            onChange={e => setPersonalityForm({ ...personalityForm, closing: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="flex gap-3 mt-4">
                        <button
                          onClick={() => savePersonality(selectedAgent.id)}
                          className="btn-beam px-6 py-3 text-white text-[10px] font-bold uppercase tracking-widest"
                        >
                          <div className="btn-inner"></div>
                          <span className="relative z-10 flex items-center gap-2">
                            <Bolt />
                            Salvar Personalidade
                          </span>
                        </button>
                        <button
                          onClick={() => setEditingPersonality(false)}
                          className="px-6 py-3 border border-white/10 text-neutral-400 hover:text-white text-[10px] font-mono uppercase tracking-widest transition-all"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* WHATSAPP TAB */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-6">
              <div className="bg-[#0A0A0A] border border-white/10 p-6">
                <h3 className="text-white text-sm font-mono uppercase tracking-widest mb-4">Configuração WhatsApp</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">Instance Key</label>
                    <input
                      className="w-full p-3 input-dark text-sm"
                      placeholder="Sua instance key"
                      value={whatsappConfig.instance_key}
                      onChange={e => setWhatsappConfig({ ...whatsappConfig, instance_key: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">Access Token</label>
                    <input
                      className="w-full p-3 input-dark text-sm"
                      placeholder="Seu access token"
                      value={whatsappConfig.access_token}
                      onChange={e => setWhatsappConfig({ ...whatsappConfig, access_token: e.target.value })}
                    />
                  </div>
                  <button
                    onClick={async () => {
                      setIsSavingWhatsapp(true);
                      await fetch('/api/whatsapp/config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          tenant_id: tenant.id,
                          instance_key: whatsappConfig.instance_key,
                          access_token: whatsappConfig.access_token,
                          webhook_url: `${window.location.origin}/api/whatsapp/webhook/${whatsappConfig.instance_key}`
                        })
                      });
                      setIsSavingWhatsapp(false);
                      alert('Configuração salva!');
                    }}
                    disabled={isSavingWhatsapp}
                    className="btn-beam px-6 py-3 text-white text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
                  >
                    <div className="btn-inner"></div>
                    <span className="relative z-10">{isSavingWhatsapp ? 'Salvando...' : 'Salvar Configuração'}</span>
                  </button>
                </div>
              </div>

              {/* QR Code Section */}
              <div className="bg-[#0A0A0A] border border-white/10 p-6">
                <h3 className="text-white text-sm font-mono uppercase tracking-widest mb-4">Conectar WhatsApp</h3>
                <div className="flex flex-col items-center">
                  <button
                    onClick={fetchQrCode}
                    disabled={isLoadingQr}
                    className="btn-beam px-6 py-3 text-white text-[10px] font-bold uppercase tracking-widest mb-4 disabled:opacity-50"
                  >
                    <div className="btn-inner"></div>
                    <span className="relative z-10 flex items-center gap-2">
                      <Bolt />
                      {isLoadingQr ? 'Carregando...' : 'Gerar QR Code'}
                    </span>
                  </button>
                  {qrCode && (
                    <div className="bg-white p-4">
                      <img src={qrCode} alt="QR Code" className="w-48 h-48" />
                    </div>
                  )}
                  {whatsappStatus && (
                    <p className="text-green-500 text-xs font-mono mt-4 uppercase tracking-widest">
                      Status: {whatsappStatus}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="bg-[#0A0A0A] border border-white/10 p-6">
                <h3 className="text-white text-sm font-mono uppercase tracking-widest mb-4">Configurações Gerais</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">Nome da Empresa</label>
                    <input
                      className="w-full p-3 input-dark text-sm"
                      value={tenant.name}
                      onChange={e => setTenant({ ...tenant, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">Cor do Tema</label>
                    <div className="flex gap-3">
                      <input
                        type="color"
                        className="w-12 h-12 border border-white/10 bg-transparent"
                        value={tenant.theme_color || '#F97316'}
                        onChange={e => setTenant({ ...tenant, theme_color: e.target.value })}
                      />
                      <input
                        className="flex-1 p-3 input-dark text-sm"
                        value={tenant.theme_color || '#F97316'}
                        onChange={e => setTenant({ ...tenant, theme_color: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">Agente Padrão</label>
                    <select
                      className="w-full p-3 input-dark text-sm"
                      value={defaultAgentId || ''}
                      onChange={e => setDefaultAgentId(e.target.value ? parseInt(e.target.value) : null)}
                    >
                      <option value="" className="bg-[#0A0A0A]">Selecione um agente...</option>
                      {agents.map(agent => (
                        <option key={agent.id} value={agent.id} className="bg-[#0A0A0A]">
                          {agent.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleSaveSettings}
                    disabled={isSaving}
                    className="btn-beam px-6 py-3 text-white text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
                  >
                    <div className="btn-inner"></div>
                    <span className="relative z-10">{isSaving ? 'Salvando...' : 'Salvar Configurações'}</span>
                  </button>
                </div>
              </div>

              {/* AI Context */}
              <div className="bg-[#0A0A0A] border border-white/10 p-6">
                <h3 className="text-white text-sm font-mono uppercase tracking-widest mb-4">Contexto da IA</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">Informações sobre a Empresa</label>
                    <textarea
                      className="w-full p-3 input-dark text-sm h-40 resize-none"
                      placeholder="Descreva sua empresa, serviços, políticas, etc."
                      value={aiContext}
                      onChange={e => setAiContext(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">Extrair de Site</label>
                    <div className="flex gap-3">
                      <input
                        className="flex-1 p-3 input-dark text-sm"
                        placeholder="https://seudominio.com.br"
                        value={websiteUrl}
                        onChange={e => setWebsiteUrl(e.target.value)}
                      />
                      <button
                        onClick={handleScanWebsite}
                        disabled={isScanning || !websiteUrl}
                        className="btn-beam px-6 py-3 text-white text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
                      >
                        <div className="btn-inner"></div>
                        <span className="relative z-10 flex items-center gap-2">
                          <Globe className="w-3 h-3" />
                          {isScanning ? 'Escaneando...' : 'Extrair'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
