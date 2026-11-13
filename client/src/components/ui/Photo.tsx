import { useState, type CSSProperties, type ReactNode } from 'react';

/**
 * Striped placeholder from the design, with the real photo faded in on top once it loads.
 * If the file is missing (or src is null) the placeholder and caption stay visible.
 */
export function Photo({
  src,
  alt,
  caption,
  className = '',
  style,
  imgClassName = '',
  children,
  eager = false,
}: {
  src?: string | null;
  alt: string;
  caption?: string;
  className?: string;
  style?: CSSProperties;
  imgClassName?: string;
  children?: ReactNode;
  eager?: boolean;
}) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>(src ? 'loading' : 'error');
  return (
    <div className={`ph ${state !== 'ok' ? 'ph-sweep' : ''} ${className}`} style={style}>
      {caption && state !== 'ok' ? <span className="ph-cap">{caption}</span> : null}
      {src && state !== 'error' ? (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setState('ok')}
          onError={() => setState('error')}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${state === 'ok' ? 'opacity-100' : 'opacity-0'} ${imgClassName}`}
        />
      ) : null}
      {children}
    </div>
  );
}
