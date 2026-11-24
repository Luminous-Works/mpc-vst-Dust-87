import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, Download, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import type { Dust87Preset, QuarantineRecord } from '../shared/types.ts';

interface PresetBrowserModalProps {
  activePreset: Dust87Preset;
  factoryPresets: Dust87Preset[];
  starterPresets: Dust87Preset[];
  userPresets: Dust87Preset[];
  onSelectPreset: (preset: Dust87Preset) => void;
  onSaveUserPreset: (name: string) => Promise<void>;
  onDeleteUserPreset: (id: string) => Promise<void>;
  onImportPresetJson: (filename: string, rawJson: string) => Promise<{ ok: boolean; record?: QuarantineRecord }>;
  onClose: () => void;
}

export const PresetBrowserModal: React.FC<PresetBrowserModalProps> = ({
  activePreset,
  factoryPresets,
  starterPresets,
  userPresets,
  onSelectPreset,
  onSaveUserPreset,
  onDeleteUserPreset,
  onImportPresetJson,
  onClose,
}) => {
  const [tab, setTab] = useState<'all' | 'factory' | 'starter' | 'user'>('all');
  const [query, setQuery] = useState('');
  const [saveName, setSaveName] = useState(`${activePreset.name} EDIT`);
  const [saving, setSaving] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{ type: 'ok' | 'quarantined'; message: string; errors?: string[] } | null>(null);

  const visiblePresets = useMemo(() => {
    const pool =
      tab === 'factory'
        ? factoryPresets
        : tab === 'starter'
        ? starterPresets
        : tab === 'user'
        ? userPresets
        : [...userPresets, ...factoryPresets, ...starterPresets];

    const q = query.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        `${p.engine.bit}-bit`.includes(q)
    );
  }, [tab, query, factoryPresets, starterPresets, userPresets]);

  const handleExportJson = () => {
    const payload = JSON.stringify(activePreset, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activePreset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.dust87.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const raw = await file.text();
    const res = await onImportPresetJson(file.name, raw);
    if (res.ok) {
      setImportFeedback({
        type: 'ok',
        message: `Validated against lumina.plugin/v1 and added "${file.name}" to User Bank.`,
      });
    } else {
      setImportFeedback({
        type: 'quarantined',
        message: `File "${file.name}" failed schema validation and was moved to Quarantine.`,
        errors: res.record?.errors || ['Invalid lumina.plugin/v1 payload'],
      });
    }
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-4xl h-[90vh] rounded-2xl chassis-surface border border-[#2C3342] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#242A35] bg-[#141821]">
          <div>
            <div className="text-[11px] font-mono-tabular text-[#F5A623] uppercase">
              Schema lumina.plugin/v1 · 64 Factory · 16 Starter · {userPresets.length} User
            </div>
            <h2 className="font-display text-lg font-bold text-[#F2F5FA]">Preset Library &amp; User Bank</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Preset Browser"
            className="min-h-[48px] min-w-[48px] rounded-lg bg-[#1A1F29] border border-[#2B3240] flex items-center justify-center text-[#E6EAF2]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Save / Import / Export Bar */}
        <div className="px-4 py-3 border-b border-[#222733] bg-[#0E1117] flex flex-wrap items-center gap-2.5">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="User preset name..."
            className="min-h-[48px] flex-1 min-w-[160px] px-3 rounded-lg bg-[#090B0F] border border-[#2B3240] focus:border-[#F5A623] focus:outline-none text-sm font-mono-tabular text-[#E6EAF2]"
          />
          <button
            type="button"
            disabled={saving || !saveName.trim()}
            onClick={async () => {
              setSaving(true);
              try {
                await onSaveUserPreset(saveName.trim());
              } finally {
                setSaving(false);
              }
            }}
            className="min-h-[48px] px-4 rounded-lg bg-[#F5A623] text-[#090B0F] font-mono-tabular text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>{saving ? 'SAVING…' : 'SAVE TO USER BANK'}</span>
          </button>

          <label className="min-h-[48px] px-3.5 rounded-lg bg-[#161A23] border border-[#2B3240] active:border-[#F5A623] text-xs font-mono-tabular text-[#E6EAF2] flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
            <Upload className="w-4 h-4 text-[#F5A623]" />
            <span>IMPORT JSON</span>
            <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
          </label>

          <button
            type="button"
            onClick={handleExportJson}
            className="min-h-[48px] px-3.5 rounded-lg bg-[#161A23] border border-[#2B3240] active:border-[#F5A623] text-xs font-mono-tabular text-[#E6EAF2] flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-4 h-4 text-[#F5A623]" />
            <span>EXPORT JSON</span>
          </button>
        </div>

        {importFeedback && (
          <div
            className={`mx-4 mt-3 p-3 rounded-xl border text-xs font-mono-tabular flex items-start gap-2.5 ${
              importFeedback.type === 'ok'
                ? 'bg-[#102217] border-[#22C55E]/50 text-[#86EFAC]'
                : 'bg-[#2A1416] border-[#EF4444]/60 text-[#FCA5A5]'
            }`}
          >
            {importFeedback.type === 'ok' ? (
              <Check className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="font-semibold">{importFeedback.message}</div>
              {importFeedback.errors?.map((err, i) => (
                <div key={i} className="text-[11px] opacity-90">
                  • {err}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter Tabs + Search */}
        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: 'all', label: `ALL (${factoryPresets.length + starterPresets.length + userPresets.length})` },
                { id: 'factory', label: `FACTORY (${factoryPresets.length})` },
                { id: 'starter', label: `STARTER (${starterPresets.length})` },
                { id: 'user', label: `USER (${userPresets.length})` },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`min-h-[48px] px-3.5 rounded-lg border font-mono-tabular text-xs font-semibold whitespace-nowrap ${
                  tab === t.id
                    ? 'bg-[#211A0E] border-[#F5A623] text-[#F5A623]'
                    : 'bg-[#141821] border-[#252B37] text-[#8C96A6]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-[#7A8496] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter kits or bit depth..."
              className="w-full min-h-[48px] pl-9 pr-3 rounded-lg bg-[#090B0F] border border-[#2B3240] focus:border-[#F5A623] focus:outline-none text-sm font-mono-tabular text-[#E6EAF2]"
            />
          </div>
        </div>

        {/* Preset Grid */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 content-start">
          {visiblePresets.map((p) => {
            const isActive = p.id === activePreset.id && p.name === activePreset.name;
            return (
              <div
                key={p.id || p.name}
                className={`rounded-xl border p-3 flex items-center justify-between gap-2 transition-colors ${
                  isActive
                    ? 'bg-[#211A0E] border-[#F5A623]'
                    : 'bg-[#131720] border-[#242A36]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectPreset(p);
                    onClose();
                  }}
                  className="flex-1 text-left min-h-[48px] flex flex-col justify-center min-w-0"
                >
                  <div className="font-display text-sm font-bold text-[#F2F5FA] truncate">
                    {p.name}
                  </div>
                  <div className="text-[11px] font-mono-tabular text-[#8C96A6] truncate">
                    {p.category || 'Factory'} · {p.engine.bit}-bit / {Math.round((p.engine.sr[0] ?? 26000) / 1000)}k
                  </div>
                </button>

                {p.bank_type === 'user' && p.id && (
                  <button
                    type="button"
                    onClick={() => onDeleteUserPreset(p.id!)}
                    aria-label={`Delete ${p.name}`}
                    className="min-h-[44px] min-w-[44px] rounded-lg bg-[#1A1F29] border border-[#2B3240] active:border-[#EF4444] flex items-center justify-center text-[#8C96A6] active:text-[#EF4444] shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
          {visiblePresets.length === 0 && (
            <div className="col-span-full py-12 text-center text-sm font-mono-tabular text-[#7A8496]">
              No presets match this filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
