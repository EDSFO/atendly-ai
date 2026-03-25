interface ImageContent {
  url: string;
  caption?: string;
}

interface Props {
  content: ImageContent | string;
}

export default function ImageRenderer({ content }: Props) {
  const url = typeof content === 'string' ? content : content.url;
  const caption = typeof content === 'string' ? undefined : (content as ImageContent).caption;

  return (
    <div>
      <img src={url} alt={caption || ''} className="max-w-full" />
      {caption && <p className="text-neutral-500 text-xs mt-2">{caption}</p>}
    </div>
  );
}