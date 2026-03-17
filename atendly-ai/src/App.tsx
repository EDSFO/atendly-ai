/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from 'react';
import { useTenant, useTenantData } from './hooks/useAtendly';
import BookingFlow from './components/BookingFlow';
import AdminDashboard from './components/AdminDashboard';
import ChatWidget from './components/ChatWidget';
import { Loader2 } from 'lucide-react';

export default function App() {
  // Simple routing logic for MVP
  // / -> Login Page
  // /select-company -> Company Selector (for admin to add more)
  // /:slug -> Booking Page
  // /:slug/admin -> Admin Dashboard

  const [path, setPath] = useState(window.location.pathname);
  // Login state - empresa selecionada pelo usuário
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
    // Redirecionar para página da empresa ou admin
    navigate(`/${tenant.slug}/admin`);
  };

  const handleLogout = () => {
    setLoggedInTenant(null);
    navigate('/');
  };

  // Se não está logado, mostrar tela de login
  if (path === '/') {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (path === '/new-company') {
    return <CreateCompany onNavigate={navigate} />;
  }

  // Se está na página inicial após login, mostrar dashboard da empresa logada
  if (path === '/home' && loggedInTenant) {
    return <TenantApp tenant={loggedInTenant} isAdmin={true} onNavigate={navigate} onLogout={handleLogout} />;
  }

  const parts = path.split('/').filter(Boolean);
  const slug = parts[0];
  const isAdmin = parts[1] === 'admin';

  // Passar o tenant logado para o TenantApp
  return <TenantApp slug={slug} isAdmin={isAdmin} onNavigate={navigate} onLogout={handleLogout} loggedInTenant={loggedInTenant} />;
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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Atendly AI</h1>
          <p className="text-xl text-gray-600">Selecione sua empresa para continuar</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Empresa</label>
              <select
                value={selectedTenant?.id || ''}
                onChange={(e) => {
                  const tenant = tenants.find(t => t.id === parseInt(e.target.value));
                  setSelectedTenant(tenant);
                }}
                className="w-full p-3 border rounded-lg bg-gray-50"
              >
                <option value="">Selecione uma empresa...</option>
                {tenants.map(tenant => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleLogin}
              disabled={!selectedTenant}
              className="w-full bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Entrar
            </button>

            <div className="text-center">
              <button
                onClick={() => window.location.href = '/new-company'}
                className="text-sm text-gray-500 hover:text-gray-900"
              >
                Não encontrou? Criar nova empresa
              </button>
            </div>
          </div>
        )}
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
        body: JSON.stringify({ name, slug, segment, theme_color: '#000000' })
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Criar Nova Empresa</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Empresa</label>
            <input 
              required
              className="w-full p-2 border rounded-lg"
              value={name}
              onChange={e => {
                setName(e.target.value);
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL (Slug)</label>
            <input 
              required
              className="w-full p-2 border rounded-lg bg-gray-50"
              value={slug}
              onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Segmento</label>
            <select 
              className="w-full p-2 border rounded-lg"
              value={segment}
              onChange={e => setSegment(e.target.value)}
            >
              <option value="general">Geral</option>
              <option value="beauty">Beleza / Estética</option>
              <option value="health">Saúde</option>
            </select>
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? 'Criando...' : 'Criar Empresa'}
          </button>
          <button 
            type="button"
            onClick={() => onNavigate('/')}
            className="w-full text-gray-500 text-sm hover:text-gray-900"
          >
            Cancelar
          </button>
        </form>
      </div>
    </div>
  );
}

function TenantApp({ slug, isAdmin, onNavigate, onLogout, loggedInTenant }: {
  slug?: string;
  isAdmin: boolean;
  onNavigate: (p: string) => void;
  onLogout?: () => void;
  tenant?: any;
  loggedInTenant?: any;
}) {
  // Se recebeu tenant direto (da página /home), usar ele diretamente
  const directTenant = loggedInTenant;

  // Caso contrário, buscar pelo slug
  const { tenant: fetchedTenant, loading } = useTenant(slug || directTenant?.slug);

  const tenant = directTenant || fetchedTenant;
  const { services, professionals, appointments, refreshAppointments } = useTenantData(tenant?.id);

  // Loading state
  if (loading && !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Empresa não encontrada</h2>
        <button onClick={() => onNavigate('/')} className="text-blue-600 hover:underline">Voltar ao início</button>
      </div>
    );
  }

  if (isAdmin) {
    return <AdminDashboard tenant={tenant} appointments={appointments} onLogout={onLogout} />;
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <BookingFlow
        tenant={tenant}
        services={services}
        professionals={professionals}
        onSuccess={refreshAppointments}
      />
      <ChatWidget tenant={tenant} />
      <div className="text-center mt-8">
        <button onClick={() => onNavigate('/home')} className="text-sm text-gray-500 hover:text-gray-900">
          &larr; Voltar para dashboard
        </button>
      </div>
    </div>
  );
}
