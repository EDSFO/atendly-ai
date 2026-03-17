import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Bot, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Tenant } from '../types';

interface ChatWidgetProps {
  tenant: Tenant;
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

export default function ChatWidget({ tenant }: ChatWidgetProps) {
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
          // Use tenant's default_agent_id if available, otherwise first agent
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
      // Se não há agente selecionado, usar o primeiro disponível
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
      // Support both text and response fields
      const responseText = data.text || data.response || 'Erro ao processar resposta';
      setMessages(prev => [...prev, { role: 'model', text: responseText }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "Desculpe, ocorreu um erro. Tente novamente." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-20 right-4 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-50 flex flex-col"
            style={{ height: '500px' }}
          >
            {/* Header */}
            <div className="p-3 flex justify-between items-center text-white gap-2" style={{ backgroundColor: tenant.theme_color }}>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
                {agents.length > 0 ? (
                  <div className="relative min-w-0">
                    <button
                      onClick={() => setShowAgentSelector(!showAgentSelector)}
                      className="flex items-center gap-1 hover:bg-white/20 rounded px-2 py-1 transition-colors"
                    >
                      <Bot className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm font-medium truncate">{selectedAgent?.name || 'Selecionar'}</span>
                      <ChevronDown className="w-3 h-3 flex-shrink-0" />
                    </button>
                    {showAgentSelector && (
                      <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border overflow-hidden z-10">
                        {agents.map((agent: any) => (
                          <button
                            key={agent.id}
                            onClick={() => {
                              setSelectedAgentId(agent.id);
                              setShowAgentSelector(false);
                              setMessages([{ role: 'model', text: `Olá! Agora você está falando com o ${agent.name}. Como posso ajudar?` }]);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-gray-100 ${
                              agent.id === selectedAgentId ? 'bg-gray-50' : ''
                            }`}
                          >
                            {agent.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="font-medium">Assistente IA</span>
                )}
              </div>
              <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 rounded-full p-1 transition-colors flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div 
                    className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                      msg.role === 'user' 
                        ? 'bg-gray-900 text-white rounded-tr-none' 
                        : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-tl-none shadow-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-white border-t border-gray-100">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 px-4 py-2 rounded-full border border-gray-200 focus:border-gray-400 focus:ring-0 outline-none text-sm bg-gray-50"
                />
                <button 
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="p-2 rounded-full bg-gray-900 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
                  style={{ backgroundColor: tenant.theme_color }}
                >
                  <Send className="w-4 h-4" />
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
        className="fixed bottom-4 right-4 p-4 rounded-full shadow-lg text-white z-50 flex items-center justify-center transition-colors"
        style={{ backgroundColor: tenant.theme_color }}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </motion.button>
    </>
  );
}
