import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Tenant, RichContent } from '../types';

interface ChatWidgetProps {
  tenant: Tenant;
  onRichContent?: (content: RichContent, agentName: string) => void;
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

// Material Symbols Icons
const MaterialIcon = ({ icon, filled = false, className = '' }: { icon: string; filled?: boolean; className?: string }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{ fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0" }}
  >
    {icon}
  </span>
);

const Bot = () => <MaterialIcon icon="smart_toy" className="w-4 h-4" />;
const Bolt = () => <MaterialIcon icon="bolt" className="w-3 h-3" />;

export default function ChatWidget({ tenant, onRichContent }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: `Olá! Sou o assistente virtual da ${tenant.name}. Como posso ajudar?` }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch agents on mount
  useEffect(() => {
    fetch(`/api/tenants/${tenant.id}/agents`)
      .then(r => r.json())
      .then(data => {
        setAgents(data);
        if (data.length > 0) {
          const defaultId = tenant.default_agent_id;
          const validDefault = defaultId && data.some((a: any) => a.id === defaultId);
          setSelectedAgentId(validDefault ? defaultId : data[0].id);
        }
      })
      .catch(() => {});
  }, [tenant.id, tenant.default_agent_id]);

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const agentIdToUse = selectedAgentId || (agents.length > 0 ? agents[0].id : null);

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          tenant_id: tenant.id,
          agent_id: agentIdToUse,
          history: messages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text }))
        }),
      });

      const data = await res.json();
      const responseText = data.text || data.response || 'Erro ao processar resposta';
      setMessages(prev => [...prev, { role: 'model', text: responseText }]);

      // If rich content, call callback
      if (data.rich_content && onRichContent) {
        onRichContent(data.rich_content, selectedAgent?.name || 'Agente');
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "Desculpe, ocorreu um erro. Tente novamente." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const themeColor = tenant.theme_color || '#F97316';

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-20 right-4 w-80 md:w-96 bg-[#0A0A0A] border border-white/10 shadow-2xl z-50 flex flex-col"
            style={{ height: '500px' }}
          >
            {/* Header */}
            <div className="p-3 flex justify-between items-center gap-2 border-b border-white/5" style={{ backgroundColor: themeColor }}>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 bg-white/90 rounded-full animate-pulse flex-shrink-0" />
                {agents.length > 0 ? (
                  <div className="relative min-w-0">
                    <button
                      onClick={() => setShowAgentSelector(!showAgentSelector)}
                      className="flex items-center gap-1 hover:bg-white/10 rounded px-2 py-1 transition-colors"
                    >
                      <Bot />
                      <span className="text-xs font-mono uppercase tracking-wider text-black truncate">{selectedAgent?.name || 'Selecionar'}</span>
                      <ChevronDown className="w-3 h-3 text-black/70" />
                    </button>
                    {showAgentSelector && (
                      <div className="absolute top-full left-0 mt-1 w-48 bg-[#0A0A0A] border border-white/10 shadow-lg z-10">
                        {agents.map((agent: any) => (
                          <button
                            key={agent.id}
                            onClick={() => {
                              setSelectedAgentId(agent.id);
                              setShowAgentSelector(false);
                              setMessages([{ role: 'model', text: `Olá! Agora você está falando com o ${agent.name}. Como posso ajudar?` }]);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs font-mono uppercase tracking-wider text-neutral-400 hover:bg-white/5 hover:text-white transition-colors ${
                              agent.id === selectedAgentId ? 'text-white' : ''
                            }`}
                          >
                            {agent.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-xs font-mono uppercase tracking-wider text-black">Assistente IA</span>
                )}
              </div>
              <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 rounded-full p-1 transition-colors flex-shrink-0">
                <X className="w-5 h-5 text-black" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#050505]">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] p-3 text-xs ${
                      msg.role === 'user'
                        ? 'bg-[#F97316] text-black'
                        : 'bg-[#0A0A0A] border border-white/10 text-neutral-300'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-[#0A0A0A] border border-white/10 p-3">
                    <Loader2 className="w-4 h-4 animate-spin text-[#F97316]" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-[#0A0A0A] border-t border-white/5">
              <form
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 px-4 py-2 input-dark text-xs font-mono uppercase tracking-wider"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="p-2 border border-white/10 text-neutral-400 hover:text-[#F97316] hover:border-[#F97316]/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                  style={{ backgroundColor: input.trim() && !isLoading ? themeColor : 'transparent' }}
                >
                  <Send className="w-4 h-4" style={{ color: input.trim() && !isLoading ? 'black' : 'currentColor' }} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 p-4 shadow-lg z-50 flex items-center justify-center transition-all"
        style={{ backgroundColor: themeColor }}
      >
        {isOpen ? <X className="w-6 h-6 text-black" /> : <MessageCircle className="w-6 h-6 text-black" />}
      </motion.button>
    </>
  );
}
