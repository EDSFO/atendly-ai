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