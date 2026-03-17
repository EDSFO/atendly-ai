import { useState, useEffect } from 'react';
import { Tenant, Appointment, Service, Professional } from '../types';
import { Calendar, Users, DollarSign, Clock, Settings, Plus, Trash2, Save, FileText, Globe, Loader2, Bot, X, Upload, Search, Edit, Check } from 'lucide-react';

interface AdminDashboardProps {
  tenant: Tenant;
  appointments: Appointment[];
  onLogout?: () => void;
}

export default function AdminDashboard({ tenant: initialTenant, appointments, onLogout }: AdminDashboardProps) {
  const [tenant, setTenant] = useState(initialTenant);
  const [activeTab, setActiveTab] = useState<'appointments' | 'services' | 'professionals' | 'settings' | 'whatsapp' | 'agents'>('appointments');

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

  useEffect(() => {
    setTenant(initialTenant);
  }, [initialTenant]);
  
  // Local state for lists
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  
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

  // Form states
  const [newService, setNewService] = useState({ name: '', price: '', duration: '' });
  const [newProfessional, setNewProfessional] = useState({ name: '', specialty: '' });
  const [aiContext, setAiContext] = useState(tenant.ai_context || '');
  const [defaultAgentId, setDefaultAgentId] = useState<number | null>(tenant.default_agent_id || null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Website Scan State
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    fetch(`/api/tenants/${tenant.id}/services`).then(r => r.json()).then(setServices);
    fetch(`/api/tenants/${tenant.id}/professionals`).then(r => r.json()).then(setProfessionals);
    fetch(`/api/tenants/${tenant.id}/agents`).then(r => r.json()).then(setAgents);

    // Check WhatsApp status on load if we have a config
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

  // Função para salvar personalidade do agente
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

  const fetchQrCode = async () => {
    setIsLoadingQr(true);
    try {
      const res = await fetch(`/api/whatsapp/qrcode/${tenant.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.qrcode) {
          // Ensure it has the data URI prefix
          const qrData = data.qrcode.startsWith('data:image') 
            ? data.qrcode 
            : `data:image/png;base64,${data.qrcode}`;
          setQrCode(qrData);
        } else if (data.message) {
          alert(data.message); // e.g., "Instance already connected"
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

  const handleAddService = async () => {
    if (!newService.name || !newService.price) return;
    const res = await fetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: tenant.id,
        name: newService.name,
        price: parseFloat(newService.price),
        duration_minutes: parseInt(newService.duration) || 30
      })
    });
    if (res.ok) {
      const data = await res.json(); // returns { id }
      // Refresh list
      fetch(`/api/tenants/${tenant.id}/services`).then(r => r.json()).then(setServices);
      setNewService({ name: '', price: '', duration: '' });
    }
  };

  const handleDeleteService = async (id: number) => {
    if (!confirm('Tem certeza?')) return;
    await fetch(`/api/services/${id}`, { method: 'DELETE' });
    setServices(s => s.filter(i => i.id !== id));
  };

  const handleAddProfessional = async () => {
    if (!newProfessional.name) return;
    const res = await fetch('/api/professionals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: tenant.id,
        name: newProfessional.name,
        specialty: newProfessional.specialty
      })
    });
    if (res.ok) {
      fetch(`/api/tenants/${tenant.id}/professionals`).then(r => r.json()).then(setProfessionals);
      setNewProfessional({ name: '', specialty: '' });
    }
  };

  const handleDeleteProfessional = async (id: number) => {
    if (!confirm('Tem certeza?')) return;
    await fetch(`/api/professionals/${id}`, { method: 'DELETE' });
    setProfessionals(p => p.filter(i => i.id !== id));
  };

  const stats = {
    totalAppointments: appointments.length,
    todayAppointments: appointments.filter(a => a.start_time.startsWith(new Date().toISOString().split('T')[0])).length,
    revenue: appointments.reduce((acc, curr) => acc + 45, 0), // Mock revenue calc
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tenant.theme_color }} />
            {tenant.name} <span className="text-gray-400 font-normal text-sm">| Painel do Gestor</span>
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">Olá, Gestor</span>
            {onLogout && (
              <button
                onClick={onLogout}
                className="text-sm text-red-600 hover:text-red-700 px-3 py-1 rounded border border-red-200 hover:bg-red-50"
              >
                Sair
              </button>
            )}
            <div className="w-8 h-8 bg-gray-200 rounded-full" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Agendamentos Hoje</p>
                <h3 className="text-2xl font-bold text-gray-900">{stats.todayAppointments}</h3>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-50 rounded-lg text-green-600">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Receita Estimada</p>
                <h3 className="text-2xl font-bold text-gray-900">R$ {stats.revenue.toFixed(2)}</h3>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-50 rounded-lg text-purple-600">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Clientes</p>
                <h3 className="text-2xl font-bold text-gray-900">{stats.totalAppointments}</h3>
              </div>
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-4 flex gap-6 overflow-x-auto">
            {['appointments', 'services', 'professionals', 'agents', 'settings', 'whatsapp'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`text-sm font-medium pb-1 border-b-2 transition-colors capitalize whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'appointments' ? 'Agenda' :
                 tab === 'services' ? 'Serviços' :
                 tab === 'professionals' ? 'Profissionais' :
                 tab === 'agents' ? 'Agentes IA' :
                 tab === 'whatsapp' ? 'WhatsApp' : 'Configurações & IA'}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === 'agents' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-semibold">Agentes de IA</h2>
                    <p className="text-sm text-gray-500">Gerencie seus assistentes virtuais especializados</p>
                  </div>
                  <button
                    onClick={() => setIsCreatingAgent(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                  >
                    <Plus className="w-4 h-4" />
                    Novo Agente
                  </button>
                </div>

                {/* Agent Templates Modal */}
                {isCreatingAgent && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Criar Novo Agente</h3>
                        <button onClick={() => setIsCreatingAgent(false)} className="text-gray-500 hover:text-gray-700">
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Template</label>
                          <div className="grid grid-cols-2 gap-2">
                            {agentTemplates.map((template: any) => (
                              <button
                                key={template.key}
                                onClick={() => setNewAgentForm({ ...newAgentForm, template_key: template.key })}
                                className={`p-3 border rounded-lg text-left transition-colors ${
                                  newAgentForm.template_key === template.key
                                    ? 'border-gray-900 bg-gray-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <div className="font-medium text-sm">{template.name}</div>
                                <div className="text-xs text-gray-500">{template.description}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nome Personalizado (opcional)</label>
                          <input
                            className="w-full p-2 border rounded-md"
                            placeholder="Deixe vazio para usar o nome do template"
                            value={newAgentForm.custom_name}
                            onChange={e => setNewAgentForm({ ...newAgentForm, custom_name: e.target.value })}
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
                                  custom_name: newAgentForm.custom_name || undefined
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
                          className="w-full py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                        >
                          Criar Agente
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Agents List */}
                {agents.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Bot className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Nenhum agente criado ainda</p>
                    <p className="text-sm">Crie seu primeiro agente de IA para começar</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {agents.map((agent: any) => (
                      <div
                        key={agent.id}
                        className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                          selectedAgent?.id === agent.id ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedAgent(agent)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <Bot className="w-5 h-5 text-gray-700" />
                            <span className="font-medium">{agent.name}</span>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            agent.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {agent.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mb-2">{agent.description}</p>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          {agent.agent_type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Agent Details */}
                {selectedAgent && (
                  <div className="border-t pt-6 mt-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-semibold">{selectedAgent.name}</h3>
                      <div className="flex gap-2">
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
                          className={`px-3 py-1 text-sm rounded ${selectedAgent.is_active ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
                        >
                          {selectedAgent.is_active ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm('Tem certeza que deseja excluir este agente?')) {
                              await fetch(`/api/agents/${selectedAgent.id}`, { method: 'DELETE' });
                              setAgents(agents.filter((a: any) => a.id !== selectedAgent.id));
                              setSelectedAgent(null);
                            }
                          }}
                          className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            // Carregar personalidade existente ou usar valores padrão
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
                          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center gap-1"
                        >
                          <Edit className="w-4 h-4" />
                          Personalidade
                        </button>
                      </div>
                    </div>

                    {/* Add Document */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <h4 className="font-medium mb-3">Adicionar Base de Conhecimento</h4>
                      <div className="space-y-2">
                        <input
                          className="w-full p-2 border rounded-md"
                          placeholder="Adicionar texto manualmente..."
                          id={`doc-text-${selectedAgent.id}`}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                              const content = (e.target as HTMLInputElement).value;
                              if (!content) return;
                              const res = await fetch(`/api/agents/${selectedAgent.id}/documents`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ source_type: 'manual', content })
                              });
                              if (res.ok) {
                                const doc = await res.json();
                                setAgentDocuments([...agentDocuments, doc]);
                                (e.target as HTMLInputElement).value = '';
                              }
                            }
                          }}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              const url = prompt('Digite a URL do site:');
                              if (!url) return;
                              const res = await fetch(`/api/agents/${selectedAgent.id}/documents/website`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ url })
                              });
                              if (res.ok) {
                                const doc = await res.json();
                                setAgentDocuments([...agentDocuments, doc]);
                                alert('Website escaneado com sucesso!');
                              } else {
                                alert('Erro ao escanear website');
                              }
                            }}
                            className="flex items-center gap-2 px-3 py-2 text-sm bg-white border rounded hover:bg-gray-50"
                          >
                            <Globe className="w-4 h-4" />
                            Escanear Website
                          </button>
                          <label className="flex items-center gap-2 px-3 py-2 text-sm bg-white border rounded hover:bg-gray-50 cursor-pointer">
                            <Upload className="w-4 h-4" />
                            Upload Arquivo
                            <input
                              type="file"
                              accept=".txt,.pdf,.docx"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;

                                const formData = new FormData();
                                formData.append('file', file);

                                try {
                                  const res = await fetch(`/api/agents/${selectedAgent.id}/documents/upload`, {
                                    method: 'POST',
                                    body: formData
                                  });
                                  if (res.ok) {
                                    const doc = await res.json();
                                    setAgentDocuments([...agentDocuments, doc]);
                                    alert('Arquivo上传ado com sucesso!');
                                  } else {
                                    alert('Erro ao fazer upload do arquivo');
                                  }
                                } catch (err) {
                                  alert('Erro ao fazer upload');
                                }
                                e.target.value = '';
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Documents List */}
                    <div>
                      <h4 className="font-medium mb-3">Documentos ({agentDocuments.length})</h4>
                      {agentDocuments.length === 0 ? (
                        <p className="text-sm text-gray-500">Nenhum documento adicionado</p>
                      ) : (
                        <div className="space-y-2">
                          {agentDocuments.map((doc: any) => (
                            <div key={doc.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                              <div>
                                <span className="text-sm font-medium">{doc.source_type}</span>
                                {doc.website_url && (
                                  <a href={doc.website_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 ml-2">
                                    {doc.website_url.substring(0, 30)}...
                                  </a>
                                )}
                              </div>
                              <button
                                onClick={async () => {
                                  await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' });
                                  setAgentDocuments(agentDocuments.filter((d: any) => d.id !== doc.id));
                                }}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'whatsapp' && (
              <div className="space-y-6 max-w-2xl">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <h3 className="text-green-800 font-medium flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    Integração MegaAPI
                  </h3>
                  <p className="text-sm text-green-700 mt-1">
                    Conecte seu número de WhatsApp para enviar e receber mensagens automaticamente.
                    Utilize as credenciais fornecidas pela MegaAPI.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Instance Key</label>
                    <input 
                      className="w-full p-2 border rounded-md"
                      value={whatsappConfig.instance_key}
                      onChange={e => setWhatsappConfig({...whatsappConfig, instance_key: e.target.value})}
                      placeholder="Ex: instance_key_..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL (Opcional)</label>
                    <input 
                      className="w-full p-2 border rounded-md"
                      value={whatsappConfig.webhook_url}
                      onChange={e => setWhatsappConfig({...whatsappConfig, webhook_url: e.target.value})}
                      placeholder="https://seu-dominio.com/api/whatsapp/webhook/..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Se deixado em branco, será configurado automaticamente para este servidor.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Access Token (Se necessário)</label>
                    <input 
                      className="w-full p-2 border rounded-md"
                      type="password"
                      value={whatsappConfig.access_token}
                      onChange={e => setWhatsappConfig({...whatsappConfig, access_token: e.target.value})}
                      placeholder="Token de acesso da API"
                    />
                  </div>

                  <button 
                    onClick={async () => {
                      setIsSavingWhatsapp(true);
                      try {
                        const res = await fetch('/api/whatsapp/config', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            tenant_id: tenant.id,
                            ...whatsappConfig,
                            webhook_url: whatsappConfig.webhook_url || `${window.location.origin}/api/whatsapp/webhook/${whatsappConfig.instance_key}`
                          })
                        });
                        
                        if (res.ok) {
                          alert('Configuração do WhatsApp salva com sucesso!');
                        } else {
                          alert('Erro ao salvar configuração.');
                        }
                      } catch (e) {
                        alert('Erro de conexão.');
                      } finally {
                        setIsSavingWhatsapp(false);
                      }
                    }}
                    disabled={isSavingWhatsapp}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSavingWhatsapp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSavingWhatsapp ? 'Salvando...' : 'Salvar Configuração'}
                  </button>
                </div>

                <div className="mt-8 pt-8 border-t border-gray-200">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Conexão do Dispositivo</h4>
                  
                  {whatsappStatus && (
                    <div className="mb-4">
                      <span className="text-sm text-gray-600">Status atual: </span>
                      <span className={`text-sm font-medium px-2 py-1 rounded-full ${whatsappStatus === 'CONNECTED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {whatsappStatus}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col items-start gap-4">
                    <button 
                      onClick={fetchQrCode}
                      disabled={isLoadingQr}
                      className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2 text-sm"
                    >
                      {isLoadingQr ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                      {isLoadingQr ? 'Gerando...' : 'Gerar QR Code'}
                    </button>

                    {qrCode && (
                      <div className="mt-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm inline-block">
                        <p className="text-sm text-gray-500 mb-4 text-center">Escaneie com seu WhatsApp</p>
                        <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64 object-contain" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'appointments' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                      <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Serviço</th>
                      <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Profissional</th>
                      <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Data/Hora</th>
                      <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {appointments.map(apt => (
                      <tr key={apt.id} className="group hover:bg-gray-50 transition-colors">
                        <td className="py-4">
                          <div className="font-medium text-gray-900">{apt.customer_name}</div>
                          <div className="text-xs text-gray-500">{apt.customer_phone}</div>
                        </td>
                        <td className="py-4 text-sm text-gray-600">{apt.service_name}</td>
                        <td className="py-4 text-sm text-gray-600">{apt.professional_name}</td>
                        <td className="py-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {apt.start_time}
                          </div>
                        </td>
                        <td className="py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {apt.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {appointments.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-500">
                          Nenhum agendamento encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'services' && (
              <div className="space-y-6">
                <div className="flex gap-4 items-end bg-gray-50 p-4 rounded-lg">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Nome do Serviço</label>
                    <input 
                      className="w-full p-2 border rounded-md text-sm"
                      value={newService.name}
                      onChange={e => setNewService({...newService, name: e.target.value})}
                      placeholder="Ex: Corte Masculino"
                    />
                  </div>
                  <div className="w-32">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Preço (R$)</label>
                    <input 
                      className="w-full p-2 border rounded-md text-sm"
                      type="number"
                      value={newService.price}
                      onChange={e => setNewService({...newService, price: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="w-32">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Duração (min)</label>
                    <input 
                      className="w-full p-2 border rounded-md text-sm"
                      type="number"
                      value={newService.duration}
                      onChange={e => setNewService({...newService, duration: e.target.value})}
                      placeholder="30"
                    />
                  </div>
                  <button 
                    onClick={handleAddService}
                    className="bg-gray-900 text-white p-2 rounded-md hover:bg-gray-800"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid gap-4">
                  {services.map(service => (
                    <div key={service.id} className="flex justify-between items-center p-4 border rounded-lg hover:bg-gray-50">
                      <div>
                        <h4 className="font-medium text-gray-900">{service.name}</h4>
                        <p className="text-sm text-gray-500">{service.duration_minutes} min • R$ {service.price.toFixed(2)}</p>
                      </div>
                      <button 
                        onClick={() => handleDeleteService(service.id)}
                        className="text-red-500 hover:bg-red-50 p-2 rounded-md"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'professionals' && (
              <div className="space-y-6">
                <div className="flex gap-4 items-end bg-gray-50 p-4 rounded-lg">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Nome do Profissional</label>
                    <input 
                      className="w-full p-2 border rounded-md text-sm"
                      value={newProfessional.name}
                      onChange={e => setNewProfessional({...newProfessional, name: e.target.value})}
                      placeholder="Ex: Ana Silva"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Especialidade</label>
                    <input 
                      className="w-full p-2 border rounded-md text-sm"
                      value={newProfessional.specialty}
                      onChange={e => setNewProfessional({...newProfessional, specialty: e.target.value})}
                      placeholder="Ex: Dermatologista"
                    />
                  </div>
                  <button 
                    onClick={handleAddProfessional}
                    className="bg-gray-900 text-white p-2 rounded-md hover:bg-gray-800"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid gap-4">
                  {professionals.map(prof => (
                    <div key={prof.id} className="flex justify-between items-center p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{prof.name}</h4>
                          <p className="text-sm text-gray-500">{prof.specialty}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteProfessional(prof.id)}
                        className="text-red-500 hover:bg-red-50 p-2 rounded-md"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Empresa</label>
                    <input 
                      className="w-full p-2 border rounded-md"
                      value={tenant.name}
                      onChange={e => setTenant({...tenant, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cor do Tema</label>
                    <div className="flex gap-2">
                      <input 
                        type="color"
                        className="h-10 w-10 rounded cursor-pointer border-0"
                        value={tenant.theme_color}
                        onChange={e => setTenant({...tenant, theme_color: e.target.value})}
                      />
                      <input 
                        className="flex-1 p-2 border rounded-md"
                        value={tenant.theme_color}
                        onChange={e => setTenant({...tenant, theme_color: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Agente Padrão para Clientes */}
                <div className="border-t border-gray-200 pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Bot className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-medium text-gray-900">Agente de IA para Clientes</h3>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    Escolha qual agente de IA will atender seus clientes na página de agendamento.
                  </p>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={defaultAgentId || ''}
                    onChange={e => setDefaultAgentId(e.target.value ? parseInt(e.target.value) : null)}
                  >
                    <option value="">Nenhum agente selecionado</option>
                    {agents.map((agent: any) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name} ({agent.agent_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Globe className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-medium text-gray-900">Importar do Site</h3>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <input 
                      className="flex-1 p-2 border rounded-md text-sm"
                      placeholder="https://suaempresa.com.br"
                      value={websiteUrl}
                      onChange={e => setWebsiteUrl(e.target.value)}
                    />
                    <button 
                      onClick={handleScanWebsite}
                      disabled={isScanning || !websiteUrl}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm"
                    >
                      {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                      {isScanning ? 'Escaneando...' : 'Escanear'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mb-6">
                    A IA irá ler o site e extrair informações relevantes automaticamente para preencher o contexto abaixo.
                  </p>

                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-medium text-gray-900">Base de Conhecimento da IA (RAG)</h3>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    Insira aqui informações detalhadas sobre seu negócio. O agente de IA usará este texto para responder dúvidas dos clientes.
                    Inclua: horários de funcionamento, regras de cancelamento, detalhes sobre serviços, estacionamento, formas de pagamento, etc.
                  </p>
                  <textarea 
                    className="w-full h-64 p-4 border rounded-xl text-sm leading-relaxed focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: Funcionamos de segunda a sexta das 9h às 18h. Aceitamos PIX e Cartão. Para cancelamentos, avise com 24h de antecedência..."
                    value={aiContext}
                    onChange={e => setAiContext(e.target.value)}
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <button 
                    onClick={handleSaveSettings}
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-gray-900 text-white px-6 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal de Edição de Personalidade */}
      {editingPersonality && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Editar Personalidade do Agente</h2>
              <button onClick={() => setEditingPersonality(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Tom da voz */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tom da Voz</label>
                <select
                  value={personalityForm.tone}
                  onChange={(e) => setPersonalityForm({ ...personalityForm, tone: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                >
                  <option value="formal">Formal</option>
                  <option value="informal">Informal</option>
                  <option value="amigavel">Amigável</option>
                  <option value="professional">Profissional</option>
                </select>
              </div>

              {/* Vocabulário */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vocabulário (separado por vírgula)</label>
                <input
                  type="text"
                  value={personalityForm.vocabulary}
                  onChange={(e) => setPersonalityForm({ ...personalityForm, vocabulary: e.target.value })}
                  placeholder="ex: agendamento, consulta, profissional"
                  className="w-full p-2 border rounded-lg"
                />
              </div>

              {/* Saudação */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Saudação Inicial</label>
                <textarea
                  value={personalityForm.greeting}
                  onChange={(e) => setPersonalityForm({ ...personalityForm, greeting: e.target.value })}
                  placeholder="Olá! Como posso ajudar você hoje?"
                  className="w-full p-2 border rounded-lg h-20"
                />
              </div>

              {/* Despedida */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Despedida</label>
                <textarea
                  value={personalityForm.closing}
                  onChange={(e) => setPersonalityForm({ ...personalityForm, closing: e.target.value })}
                  placeholder="Obrigado por entrar em contato! Até logo!"
                  className="w-full p-2 border rounded-lg h-20"
                />
              </div>

              {/* Regras */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Regras (uma por linha)</label>
                <textarea
                  value={personalityForm.rules}
                  onChange={(e) => setPersonalityForm({ ...personalityForm, rules: e.target.value })}
                  placeholder="Sempre cumprimente o cliente&#10;Nunca revele preços sem confirmar"
                  className="w-full p-2 border rounded-lg h-24"
                />
              </div>

              {/* Proibidos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Palavras/Temas Proibidos (separado por vírgula)</label>
                <input
                  type="text"
                  value={personalityForm.forbidden}
                  onChange={(e) => setPersonalityForm({ ...personalityForm, forbidden: e.target.value })}
                  placeholder="ex: política, religião, concurso"
                  className="w-full p-2 border rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingPersonality(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={() => selectedAgent && savePersonality(selectedAgent.id)}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Salvar Personalidade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
