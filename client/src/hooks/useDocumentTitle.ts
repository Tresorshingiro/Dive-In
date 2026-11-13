import { useEffect } from 'react';

export function useDocumentTitle(title: string, opts: { raw?: boolean } = {}) {
  useEffect(() => {
    document.title = opts.raw ? title : `${title} · DIVE-IN Fitness Hub`;
  }, [title, opts.raw]);
}
