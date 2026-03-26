import { X, Loader2 } from 'lucide-react';
import { RichContent } from '../types';
import RichContentRenderer from './RichContentRenderer';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  content?: RichContent;
  agentName?: string;
  isLoading?: boolean;
  error?: string;
  onAction?: (action: string, data: any) => void;
  generatingImages?: boolean;
}

export default function CentralPanel({ isOpen, onClose, content, agentName, isLoading, error, onAction, generatingImages }: Props) {
  if (!isOpen) return null;

  const handleAction = (action: string, data: any) => {
    if (onAction) {
      onAction(action, data);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div className="relative flex-1 ml-auto w-2/3 max-w-4xl bg-[#0A0A0A] border-l border-white/10 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-white/5">
          <div>
            <span className="text-[10px] font-mono uppercase text-neutral-500 tracking-widest">
              {agentName || 'Agente'}
            </span>
            {generatingImages && (
              <span className="ml-3 text-[10px] font-mono text-[#F97316]">
                Gerando imagens...
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-[#F97316]" />
              <p className="text-neutral-500 text-sm">Processando...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <p className="text-red-500">{error}</p>
              <button
                onClick={() => handleAction('retry', null)}
                className="px-4 py-2 bg-white/10 text-white text-sm hover:bg-white/20"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {!isLoading && !error && content && (
            <RichContentRenderer content={content} onAction={handleAction} />
          )}

          {!isLoading && !error && !content && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <p className="text-neutral-500">Aguardando resposta do agente...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}