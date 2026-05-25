import { useState, useCallback } from 'react';
import { useAppStore } from '../../shared/store/appStore';

type SearchResult = { path: string; line: number; text: string };

export function SearchPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const currentProject = useAppStore((s) => s.currentProject);
  const openFile = useAppStore((s) => s.openFile);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || !currentProject) return;
    setSearching(true);
    try {
      const res = await fetch('http://localhost:18421/tool/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: 'search',
          params: { query: query.trim(), maxResults: 100 },
          projectDir: currentProject.path,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.content ?? []);
      }
    } catch { /* ignore */ }
    setSearching(false);
  }, [query, currentProject]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void handleSearch();
  }, [handleSearch]);

  const handleResultClick = useCallback(async (r: SearchResult) => {
    const content = await window.orisonDesktop?.readFile(r.path);
    if (content != null) {
      const name = r.path.split(/[/\\]/).pop() || r.path;
      openFile(r.path, name, content);
    }
  }, [openFile]);

  return (
    <div className="search-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="search-panel-header" style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
        <input
          type="text"
          className="search-panel-input"
          placeholder="搜索..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ width: '100%', padding: '4px 8px', boxSizing: 'border-box' }}
        />
      </div>
      <div className="search-panel-results" style={{ flex: 1, overflow: 'auto', fontSize: '12px' }}>
        {searching && <div style={{ padding: '8px', opacity: 0.6 }}>搜索中...</div>}
        {!searching && results.length === 0 && query && (
          <div style={{ padding: '8px', opacity: 0.6 }}>无结果</div>
        )}
        {results.map((r, i) => (
          <div
            key={`${r.path}:${r.line}:${i}`}
            className="search-result-item"
            style={{ padding: '4px 8px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle, transparent)' }}
            onClick={() => void handleResultClick(r)}
          >
            <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.path.split(/[/\\]/).pop()}
              <span style={{ opacity: 0.5, marginLeft: 4 }}>:{r.line}</span>
            </div>
            <div style={{ opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
