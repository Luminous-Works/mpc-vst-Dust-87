import React, { useEffect, useState } from 'react';
import { CheckCircle2, Dices, FolderCog, Play, ShieldAlert, Trash2, Workflow, X, XCircle } from 'lucide-react';
import type { MidiDeviceInfo } from '../audio/midiManager.ts';
import type {
  Dust87Preset,
  MidiRoutingMode,
  PlatformPathsReport,
  QuarantineRecord,
  UserSettings,
  VelocityCurveMode,
  WorkflowValidationReport,
} from '../shared/types.ts';

interface SystemMenuModalProps {
  preset: Dust87Preset;
  settings: UserSettings;
  midiDevices: MidiDeviceInfo[];
  pathsReport: PlatformPathsReport | null;
  quarantineRecords: QuarantineRecord[];
  workflowReport: WorkflowValidationReport | null;
  onUpdateSettings: (patch: Partial<UserSettings>) => void;
  onUpdateRandomizerBounds: (pitch: [number, number], drive: [number, number]) => void;
  onRandomizeKit: () => void;
  onRandomizeSequence: () => void;
  onTestVelocityHit: (velocity: number) => void;
  onSimulateCorruptFile: () => Promise<void>;
  onDeleteQuarantine: (filename: string) => Promise<void>;
  onRunValidation: () => Promise<void>;
  onClose: () => void;
}

export const SystemMenuModal: React.FC<SystemMenuModalProps> = ({
  preset,
  settings,
  midiDevices,
  pathsReport,
  quarantineRecords,
  workflowReport,
  onUpdateSettings,
  onUpdateRandomizerBounds,
  onRandomizeKit,
  onRandomizeSequence,
  onTestVelocityHit,
  onSimulateCorruptFile,
  onDeleteQuarantine,
  onRunValidation,
  onClose,
}) => {
  const [tab, setTab] = useState<'midi' | 'randomizer' | 'storage' | 'workflow'>('midi');
  const [runningValidation, setRunningValidation] = useState(false);

  useEffect(() => {
    if (tab === 'workflow' && !workflowReport) {
      setRunningValidation(true);
      void onRunValidation().finally(() => setRunningValidation(false));
    }
  }, [tab, workflowReport, onRunValidation]);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-3xl h-[88vh] rounded-2xl chassis-surface border border-[#2C3342] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#242A35] bg-[#141821]">
          <div>
            <div className="text-[11px] font-mono-tabular text-[#F5A623] uppercase">
              Lumina.Aerospace · System &amp; Release Diagnostics
            </div>
            <h2 className="font-display text-lg font-bold text-[#F2F5FA]">DUST &apos;87 Configuration</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close System Menu"
            className="min-h-[48px] min-w-[48px] rounded-lg bg-[#1A1F29] border border-[#2B3240] flex items-center justify-center text-[#E6EAF2]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs (48px touch targets) */}
        <div className="px-4 py-2.5 border-b border-[#222733] bg-[#0E1117] flex items-center gap-2 overflow-x-auto">
          {(
            [
              { id: 'midi', label: 'MIDI & Touch' },
              { id: 'randomizer', label: 'Randomizer' },
              { id: 'storage', label: `Storage & Quarantine (${quarantineRecords.length})` },
              { id: 'workflow', label: 'Open-MPC Validation' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`min-h-[48px] px-4 rounded-lg border font-mono-tabular text-xs font-semibold whitespace-nowrap ${
                tab === t.id
                  ? 'bg-[#211A0E] border-[#F5A623] text-[#F5A623]'
                  : 'bg-[#141821] border-[#252B37] text-[#8C96A6]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {tab === 'midi' && (
            <>
              <div>
                <h3 className="text-xs font-mono-tabular text-[#F5A623] uppercase mb-2">
                  MIDI Channel Architecture
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(
                    [
                      {
                        mode: 'per_voice_channel' as MidiRoutingMode,
                        title: 'Per-Voice Channel (Voice n → Ch n)',
                        desc: 'Routes each voice on its own MIDI channel (Ch 1–12) for chromatic / multi-track MPC control.',
                      },
                      {
                        mode: 'combo_ch10' as MidiRoutingMode,
                        title: 'Combo Fallback (Ch 10 / Omni)',
                        desc: 'Maps MIDI Notes 36–83 on Channel 10 (or Omni) directly 1:1 across Banks A–D.',
                      },
                    ]
                  ).map((opt) => (
                    <button
                      key={opt.mode}
                      type="button"
                      onClick={() => onUpdateSettings({ midiRoutingMode: opt.mode })}
                      className={`min-h-[72px] p-3.5 rounded-xl border text-left transition-colors ${
                        settings.midiRoutingMode === opt.mode
                          ? 'bg-[#211A0E] border-[#F5A623]'
                          : 'bg-[#131720] border-[#252B37]'
                      }`}
                    >
                      <div className="font-mono-tabular text-xs font-bold text-[#F2F5FA] mb-1">
                        {opt.title}
                      </div>
                      <div className="text-xs text-[#8C96A6]">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-mono-tabular text-[#F5A623] uppercase mb-2">
                  Touch Velocity Curve &amp; Reactive Knob Test
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  {(
                    [
                      { id: 'touch_y', label: 'Touch Y-Axis' },
                      { id: 'fixed_127', label: 'Full Level 127' },
                      { id: 'soft_log', label: 'Soft Log' },
                      { id: 'hard_exp', label: 'Hard Exp' },
                    ] as Array<{ id: VelocityCurveMode; label: string }>
                  ).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onUpdateSettings({ velocityCurve: c.id })}
                      className={`min-h-[48px] rounded-lg border font-mono-tabular text-xs font-semibold ${
                        settings.velocityCurve === c.id
                          ? 'bg-[#211A0E] border-[#F5A623] text-[#F5A623]'
                          : 'bg-[#141821] border-[#252B37] text-[#B8C0CE]'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                <div className="p-3.5 rounded-xl bg-[#0D1016] border border-[#232936] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                    <span className="text-xs font-mono-tabular text-[#8C96A6] whitespace-nowrap">
                      Test Velocity: {settings.simulatedVelocity}
                    </span>
                    <input
                      type="range"
                      min={20}
                      max={127}
                      value={settings.simulatedVelocity}
                      onChange={(e) => onUpdateSettings({ simulatedVelocity: parseInt(e.target.value, 10) })}
                      className="flex-1 accent-[#F5A623]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => onTestVelocityHit(settings.simulatedVelocity)}
                    className="min-h-[48px] px-4 rounded-lg bg-[#211A0E] border border-[#F5A623] text-[#F5A623] font-mono-tabular text-xs font-semibold flex items-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    <span>FIRE VELOCITY PULSE</span>
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-mono-tabular text-[#F5A623] uppercase mb-2">
                  Detected WebMIDI Inputs ({midiDevices.length})
                </h3>
                <div className="rounded-xl bg-[#0D1016] border border-[#232936] p-3 text-xs font-mono-tabular text-[#8C96A6]">
                  {midiDevices.length === 0 ? (
                    <span>No external MIDI controller detected. Touch pads and QWERTY keys (1-4 / Q-R / A-F) are active.</span>
                  ) : (
                    <ul className="space-y-1.5">
                      {midiDevices.map((d) => (
                        <li key={d.id} className="text-[#E6EAF2]">
                          ● {d.name} ({d.manufacturer})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}

          {tab === 'randomizer' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#0D1016] border border-[#232936] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-mono-tabular text-[#F5A623] uppercase">
                    Bounded Kit &amp; Sequence Randomizer (lumina.plugin/v1)
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onRandomizeKit}
                      className="min-h-[48px] px-4 rounded-lg bg-[#F5A623] text-[#090B0F] font-mono-tabular text-xs font-bold flex items-center gap-2"
                    >
                      <Dices className="w-4 h-4" />
                      <span>RANDOMIZE KIT</span>
                    </button>
                    <button
                      type="button"
                      onClick={onRandomizeSequence}
                      className="min-h-[48px] px-4 rounded-lg bg-[#10202C] border border-[#38BDF8] text-[#38BDF8] font-mono-tabular text-xs font-bold flex items-center gap-2"
                    >
                      <Dices className="w-4 h-4" />
                      <span>RANDOMIZE SEQ</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-[#141821] border border-[#252B37] space-y-2">
                    <div className="text-xs font-mono-tabular text-[#E6EAF2]">
                      Pitch Range: [{preset.randomizer.pitch[0]} st, +{preset.randomizer.pitch[1]} st]
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-mono-tabular text-[#8C96A6]">MIN</span>
                      <input
                        type="range"
                        min={-24}
                        max={0}
                        value={preset.randomizer.pitch[0]}
                        onChange={(e) =>
                          onUpdateRandomizerBounds([parseInt(e.target.value, 10), preset.randomizer.pitch[1]], preset.randomizer.drive)
                        }
                        className="flex-1 accent-[#F5A623]"
                      />
                      <span className="text-[11px] font-mono-tabular text-[#8C96A6]">MAX</span>
                      <input
                        type="range"
                        min={0}
                        max={24}
                        value={preset.randomizer.pitch[1]}
                        onChange={(e) =>
                          onUpdateRandomizerBounds([preset.randomizer.pitch[0], parseInt(e.target.value, 10)], preset.randomizer.drive)
                        }
                        className="flex-1 accent-[#F5A623]"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#141821] border border-[#252B37] space-y-2">
                    <div className="text-xs font-mono-tabular text-[#E6EAF2]">
                      Drive Range: [{preset.randomizer.drive[0].toFixed(2)}, {preset.randomizer.drive[1].toFixed(2)}]
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-mono-tabular text-[#8C96A6]">MIN</span>
                      <input
                        type="range"
                        min={0}
                        max={0.5}
                        step={0.05}
                        value={preset.randomizer.drive[0]}
                        onChange={(e) =>
                          onUpdateRandomizerBounds(preset.randomizer.pitch, [parseFloat(e.target.value), preset.randomizer.drive[1]])
                        }
                        className="flex-1 accent-[#F5A623]"
                      />
                      <span className="text-[11px] font-mono-tabular text-[#8C96A6]">MAX</span>
                      <input
                        type="range"
                        min={0.2}
                        max={1}
                        step={0.05}
                        value={preset.randomizer.drive[1]}
                        onChange={(e) =>
                          onUpdateRandomizerBounds(preset.randomizer.pitch, [preset.randomizer.drive[0], parseFloat(e.target.value)])
                        }
                        className="flex-1 accent-[#F5A623]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'storage' && (
            <div className="space-y-4">
              {/* Q4 Cross-Platform Directory Resolver */}
              <div className="p-4 rounded-xl bg-[#0D1016] border border-[#232936] space-y-3">
                <div className="flex items-center gap-2 text-xs font-mono-tabular text-[#F5A623] uppercase">
                  <FolderCog className="w-4 h-4" />
                  <span>Q4 Cross-Platform Directory Resolver</span>
                </div>
                {pathsReport && (
                  <div className="space-y-2 text-xs font-mono-tabular">
                    <div className="p-2.5 rounded-lg bg-[#141821] border border-[#252B37]">
                      <div className="text-[#8C96A6]">Active Runtime User Bank ({pathsReport.activePlatform}):</div>
                      <div className="text-[#E6EAF2] break-all">{pathsReport.userPresetsDir}</div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="p-2.5 rounded-lg bg-[#141821] border border-[#252B37]">
                        <div className="text-[#F5A623] mb-1">Linux / MPC Standalone</div>
                        <div className="text-[11px] text-[#8C96A6] break-all">{pathsReport.matrix.linux_mpc.dataDir}</div>
                        <div className="text-[11px] text-[#7A8496] break-all mt-1">{pathsReport.matrix.linux_mpc.mpcExternalDir}</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#141821] border border-[#252B37]">
                        <div className="text-[#F5A623] mb-1">macOS (Darwin)</div>
                        <div className="text-[11px] text-[#8C96A6] break-all">{pathsReport.matrix.macos.presetsDir}</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#141821] border border-[#252B37]">
                        <div className="text-[#F5A623] mb-1">Windows (win32)</div>
                        <div className="text-[11px] text-[#8C96A6] break-all">{pathsReport.matrix.windows.roamingDir}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Quarantine Vault */}
              <div className="p-4 rounded-xl bg-[#0D1016] border border-[#232936] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-mono-tabular text-[#F5A623] uppercase">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Corrupt Preset Quarantine ({quarantineRecords.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={onSimulateCorruptFile}
                    className="min-h-[48px] px-3.5 rounded-lg bg-[#2A1416] border border-[#EF4444]/60 text-[#FCA5A5] font-mono-tabular text-xs font-semibold"
                  >
                    SIMULATE CORRUPT FILE SCAN
                  </button>
                </div>

                {quarantineRecords.length === 0 ? (
                  <div className="text-xs font-mono-tabular text-[#8C96A6] py-3">
                    Quarantine directory is clean. Any malformed or schema-invalid JSON loaded into the user bank is automatically isolated here.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {quarantineRecords.map((rec) => (
                      <div
                        key={rec.filename}
                        className="p-3 rounded-lg bg-[#181214] border border-[#EF4444]/40 flex items-start justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="text-xs font-mono-tabular font-bold text-[#FCA5A5] truncate">
                            {rec.filename}
                          </div>
                          <div className="text-[11px] font-mono-tabular text-[#8C96A6]">
                            Quarantined: {new Date(rec.quarantinedAt).toLocaleString()}
                          </div>
                          {rec.errors.map((err, i) => (
                            <div key={i} className="text-[11px] font-mono-tabular text-[#F87171]">
                              • {err}
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => onDeleteQuarantine(rec.filename)}
                          aria-label={`Purge ${rec.filename}`}
                          className="min-h-[44px] min-w-[44px] rounded-lg bg-[#241719] border border-[#EF4444]/40 flex items-center justify-center text-[#FCA5A5] shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'workflow' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-mono-tabular text-[#F5A623] uppercase">
                  <Workflow className="w-4 h-4" />
                  <span>Open-MPC Release Pipeline &amp; Automated Validation</span>
                </div>
                <button
                  type="button"
                  disabled={runningValidation}
                  onClick={() => {
                    setRunningValidation(true);
                    void onRunValidation().finally(() => setRunningValidation(false));
                  }}
                  className="min-h-[48px] px-4 rounded-lg bg-[#211A0E] border border-[#F5A623] text-[#F5A623] font-mono-tabular text-xs font-semibold"
                >
                  {runningValidation ? 'VALIDATING…' : 'RE-RUN VALIDATION SUITE'}
                </button>
              </div>

              {workflowReport && (
                <div className="space-y-3">
                  <div
                    className={`p-3.5 rounded-xl border flex items-center justify-between ${
                      workflowReport.passed
                        ? 'bg-[#102217] border-[#22C55E]/50 text-[#86EFAC]'
                        : 'bg-[#2A1416] border-[#EF4444]/50 text-[#FCA5A5]'
                    }`}
                  >
                    <div className="font-mono-tabular text-xs font-bold">
                      {workflowReport.passed ? 'ALL RELEASE CHECKS PASSED' : 'VALIDATION FAILED'} ·{' '}
                      {workflowReport.summary.passedChecks}/{workflowReport.summary.totalChecks} Checks
                    </div>
                    <div className="text-[11px] font-mono-tabular">
                      {workflowReport.license} · {workflowReport.version}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {workflowReport.checks.map((chk) => (
                      <div
                        key={chk.id}
                        className="p-3 rounded-xl bg-[#131720] border border-[#242A36] flex items-start gap-3"
                      >
                        {chk.status === 'pass' ? (
                          <CheckCircle2 className="w-5 h-5 text-[#22C55E] shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="text-xs font-mono-tabular font-bold text-[#F2F5FA]">
                            {chk.label}
                          </div>
                          <div className="text-xs font-mono-tabular text-[#8C96A6] mt-0.5">
                            {chk.detail}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
