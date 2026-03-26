import { useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Check, Image } from 'lucide-react';

interface CarouselItem {
  title?: string;
  image?: string;
  caption?: string;
  description?: string;
}

interface Props {
  content: { items: CarouselItem[] } | CarouselItem[];
  onAction?: (action: string, data: any) => void;
}

export default function CarouselRenderer({ content, onAction }: Props) {
  const items = Array.isArray(content) ? content : content.items;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copyingAll, setCopyingAll] = useState(false);

  const prev = () => setCurrentIndex((i) => (i === 0 ? items.length - 1 : i - 1));
  const next = () => setCurrentIndex((i) => (i === items.length - 1 ? 0 : i + 1));

  const copyItem = (item: CarouselItem) => {
    const text = [item.title, item.caption, item.description].filter(Boolean).join('\n\n');
    navigator.clipboard.writeText(text);
  };

  const copyAll = () => {
    setCopyingAll(true);
    const allText = items.map((item, idx) => {
      const text = [item.title, item.caption, item.description].filter(Boolean).join('\n\n');
      return `--- Opção ${idx + 1} ---\n${text}`;
    }).join('\n\n---\n\n');

    navigator.clipboard.writeText(allText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).finally(() => setCopyingAll(false));
  };

  const handleGenerateImages = () => {
    if (onAction) {
      onAction('generate_images', { items });
    }
  };

  if (!items || items.length === 0) {
    return <p className="text-neutral-500">Nenhum conteúdo disponível</p>;
  }

  const current = items[currentIndex];

  return (
    <div className="relative">
      {/* Action buttons */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <button
            onClick={copyAll}
            disabled={copyingAll}
            className="flex items-center gap-2 px-3 py-2 bg-[#F97316] text-black text-xs font-medium hover:bg-[#F97316]/90 transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copyingAll ? 'Copiando...' : copied ? 'Copiado!' : 'Copiar Tudo'}
          </button>
        </div>
        <button
          onClick={handleGenerateImages}
          className="flex items-center gap-2 px-3 py-2 border border-white/10 text-neutral-300 text-xs font-medium hover:border-white/30 transition-colors"
        >
          <Image className="w-4 h-4" />
          Gerar Imagens
        </button>
      </div>

      {/* Carousel content */}
      <div className="bg-[#0A0A0A] border border-white/10 p-4">
        {current.image && (
          <img src={current.image} alt={current.title || ''} className="w-full h-48 object-cover mb-3" />
        )}
        {current.title && (
          <h4 className="text-white font-medium text-lg mb-2">{current.title}</h4>
        )}
        {current.caption && (
          <p className="text-neutral-300 text-sm mb-2 whitespace-pre-wrap">{current.caption}</p>
        )}
        {current.description && (
          <p className="text-neutral-400 text-xs">{current.description}</p>
        )}

        {/* Copy single item button */}
        <button
          onClick={() => copyItem(current)}
          className="mt-3 flex items-center gap-2 text-xs text-neutral-500 hover:text-white transition-colors"
        >
          <Copy className="w-3 h-3" />
          Copiar este item
        </button>
      </div>

      {items.length > 1 && (
        <div className="flex justify-center items-center gap-4 mt-4">
          <button onClick={prev} className="p-2 border border-white/10 hover:border-white/30">
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>
          <span className="text-neutral-500 text-xs font-mono">
            {currentIndex + 1} / {items.length}
          </span>
          <button onClick={next} className="p-2 border border-white/10 hover:border-white/30">
            <ChevronRight className="w-4 h-4 text-white" />
          </button>
        </div>
      )}
    </div>
  );
}