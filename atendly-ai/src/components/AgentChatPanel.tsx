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