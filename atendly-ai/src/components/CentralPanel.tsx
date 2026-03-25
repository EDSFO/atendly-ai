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
}

export default function CentralPanel({ isOpen, onClose, content, agentName, isLoading, error }: Props) {
  if (!isOpen) return null;

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
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-[#F97316]" />
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <p className="text-red-500">{error}</p>
            </div>
          )}

          {!isLoading && !error && content && (
            <RichContentRenderer content={content} />
          )}

          {!isLoading && !error && !content && (
            <div className="flex items-center justify-center h-full">
              <p className="text-neutral-500">Aguardando resposta do agente...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}