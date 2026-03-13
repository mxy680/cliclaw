"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";

interface MemoryEntry {
  id: string;
  fact: string;
  tags: string[];
  source: "user" | "agent" | "system";
  importance: 1 | 2 | 3;
  createdAt: string;
}

const SOURCE_COLORS: Record<string, string> = {
  user: "text-amber/80 border-amber/20",
  agent: "text-emerald-400/80 border-emerald-400/20",
  system: "text-muted-foreground border-border",
};

const IMPORTANCE_LABELS: Record<number, string> = {
  1: "LOW",
  2: "MED",
  3: "CRIT",
};

const IMPORTANCE_COLORS: Record<number, string> = {
  1: "text-muted-foreground",
  2: "text-amber-dim",
  3: "text-amber",
};

export function MemoryPanel({ agentName }: { agentName: string }) {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newFact, setNewFact] = useState("");
  const [newTags, setNewTags] = useState("");
  const [newImportance, setNewImportance] = useState<1 | 2 | 3>(2);
  const [adding, setAdding] = useState(false);

  const fetchMemories = useCallback(async (query?: string) => {
    setLoading(true);
    try {
      const url = query
        ? `/api/agent/${agentName}/memory?q=${encodeURIComponent(query)}`
        : `/api/agent/${agentName}/memory`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [agentName]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchMemories(search || undefined);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, fetchMemories]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!newFact.trim() || adding) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/agent/${agentName}/memory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fact: newFact.trim(),
          tags: newTags.trim() ? newTags.split(",").map((t) => t.trim()).filter(Boolean) : [],
          importance: newImportance,
          source: "user",
        }),
      });
      if (res.ok) {
        setNewFact("");
        setNewTags("");
        setNewImportance(2);
        setShowAdd(false);
        fetchMemories(search || undefined);
      }
    } catch {
      // ignore
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: string) {
    try {
      const res = await fetch(`/api/agent/${agentName}/memory`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== id));
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <svg className="size-3.5 text-amber/70" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 4.5v4M6 6.5h4" />
          </svg>
          <span className="font-mono text-[10px] text-amber tracking-wider uppercase">
            Memory
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            ({entries.length})
          </span>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="font-mono text-[10px] text-muted-foreground hover:text-amber tracking-wider uppercase transition-colors"
        >
          {showAdd ? "Cancel" : "+ Add"}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="p-3 border-b border-border space-y-2 animate-fade-in-up">
          <textarea
            value={newFact}
            onChange={(e) => setNewFact(e.target.value)}
            placeholder="Memory content..."
            rows={2}
            className="w-full bg-background border border-border rounded-sm px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber/50 resize-none"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              placeholder="Tags (comma-separated)"
              className="flex-1 bg-background border border-border rounded-sm px-2.5 py-1.5 font-mono text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber/50"
            />
            <select
              value={newImportance}
              onChange={(e) => setNewImportance(Number(e.target.value) as 1 | 2 | 3)}
              className="bg-background border border-border rounded-sm px-2 py-1.5 font-mono text-[11px] text-foreground focus:outline-none focus:border-amber/50"
            >
              <option value={1}>Low</option>
              <option value={2}>Normal</option>
              <option value={3}>Critical</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={!newFact.trim() || adding}
            className="w-full py-1.5 bg-amber/10 border border-amber/30 rounded-sm font-mono text-[10px] text-amber tracking-wider uppercase hover:bg-amber/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {adding ? "Saving..." : "Save Memory"}
          </button>
        </form>
      )}

      {/* Search */}
      <div className="px-3 py-2 border-b border-border">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search memories..."
          className="w-full bg-background border border-border rounded-sm px-2.5 py-1.5 font-mono text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber/50"
        />
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-1.5">
              <span className="thinking-dot" />
              <span className="thinking-dot" />
              <span className="thinking-dot" />
            </div>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8">
            <p className="font-mono text-[11px] text-muted-foreground">
              {search ? "No matches" : "No memories yet"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="group px-3 py-2.5 hover:bg-surface-raised/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-mono text-xs text-foreground leading-relaxed flex-1">
                    {entry.fact}
                  </p>
                  <button
                    onClick={() => handleRemove(entry.id)}
                    className="opacity-0 group-hover:opacity-100 font-mono text-[10px] text-muted-foreground hover:text-destructive transition-all shrink-0 mt-0.5"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`font-mono text-[9px] tracking-wider uppercase ${IMPORTANCE_COLORS[entry.importance]}`}>
                    {IMPORTANCE_LABELS[entry.importance]}
                  </span>
                  <span className={`font-mono text-[9px] tracking-wider uppercase px-1.5 py-0.5 border rounded-sm ${SOURCE_COLORS[entry.source]}`}>
                    {entry.source}
                  </span>
                  {entry.tags.map((tag) => (
                    <span
                      key={tag}
                      className="font-mono text-[9px] text-amber/50 tracking-wider"
                    >
                      #{tag}
                    </span>
                  ))}
                  <span className="font-mono text-[9px] text-muted-foreground/50 ml-auto">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
