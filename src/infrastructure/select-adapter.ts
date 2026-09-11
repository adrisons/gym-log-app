/**
 * FR-004: which real `StoragePort` adapter class the composition root
 * should instantiate, decided by feature detection alone — no
 * user-facing choice, no build-time branch. Extracted as a pure function
 * (rather than inlined in `src/presentation/main.tsx`) so it is
 * unit-testable without mounting the app (spec 003 tasks.md T028) —
 * importing `main.tsx` itself runs `mount()` as a side effect.
 */
export type AdapterKind = 'file-system' | 'indexed-db';

export function selectAdapterClass(hasFileSystemAccess: boolean): AdapterKind {
  return hasFileSystemAccess ? 'file-system' : 'indexed-db';
}
