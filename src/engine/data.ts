import { useEffect, useState } from 'react';

const cache = new Map<string, Promise<unknown>>();

/** Fetch a JSON file from public/data once per session (null when missing). */
export function loadData<T>(name: string): Promise<T | null> {
  if (!cache.has(name)) {
    cache.set(
      name,
      fetch(`${import.meta.env.BASE_URL}data/${name}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    );
  }
  return cache.get(name) as Promise<T | null>;
}

/** React hook around loadData. */
export function useData<T>(name: string | null): T | null {
  const [state, setState] = useState<{ name: string | null; value: T | null }>({ name: null, value: null });
  useEffect(() => {
    let live = true;
    if (name) loadData<T>(name).then((value) => live && setState({ name, value }));
    return () => { live = false; };
  }, [name]);
  return state.name === name ? state.value : null;
}
