/**
 * Placeholder root view for Phase 0 (spec 000 FR-020/FR-022). Draws only on
 * design tokens (app-shell.css, entirely var(--…) references) — no domain
 * import, no StoragePort import, no route beyond `/`. Real screens land in
 * Phases 1–3 (docs/agent-brief.md §3).
 */
import './app-shell.css';

export function AppShell() {
  return (
    <main className="app-shell">
      <h1>gym-log</h1>
      <p>Training diary — coming soon.</p>
    </main>
  );
}
