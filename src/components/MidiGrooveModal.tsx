import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Disc3,
  FileMusic,
  FolderOpen,
  Play,
  Search,
  Shuffle,
  Square,
  Upload,
  X,
} from 'lucide-react';
import { BUILTIN_GROOVES, type NamedGroovePreset } from '../shared/grooveLibrary.ts';
import { isValidMidiFilename, parseMidiBufferToGroove } from '../shared/midiFileParser.ts';
import type { SequencerPattern } from '../shared/types.ts';

export interface IndexedMidiEntry {
  id: string;
  name: string;
  relativePath: string;
  file: File;
}

interface MidiGrooveModalProps {
  currentBpm: number;
  isPlaying: boolean;
  activeGrooveName?: string;
  onApplyGroove: (pattern: SequencerPattern, label: string, startPlayback: boolean) => void;
  onTogglePlay: () => void;
  onClose: () => void;
}

const MAX_RENDERED_MIDI_ROWS = 150;

export const MidiGrooveModal: React.FC<MidiGrooveModalProps> = ({
  currentBpm,
  isPlaying,
  activeGrooveName,
  onApplyGroove,
  onTogglePlay,
  onClose,
}) => {
  const [tab, setTab] = useState<'builtin' | 'midi'>('builtin');
  const [genreFilter, setGenreFilter] = useState<string>('ALL');
  const [builtinQuery, setBuiltinQuery] = useState('');

  // Local .mid archive / file state
  const [midiEntries, setMidiEntries] = useState<IndexedMidiEntry[]>([]);
  const [ignoredJunkCount, setIgnoredJunkCount] = useState(0);
  const [midiQuery, setMidiQuery] = useState('');
  const [loadedLabel, setLoadedLabel] = useState<string>(activeGrooveName || '');
  const [midiStatus, setMidiStatus] = useState<{
    type: 'ok' | 'error';
    message: string;
  } | null>(null);

  const genres = useMemo(() => {
    const set = new Set<string>();
    BUILTIN_GROOVES.forEach((g) => set.add(g.genre));
    return ['ALL', ...Array.from(set)];
  }, []);

  const filteredBuiltin = useMemo(() => {
    const q = builtinQuery.trim().toLowerCase();
    return BUILTIN_GROOVES.filter((g) => {
      if (genreFilter !== 'ALL' && g.genre !== genreFilter) return false;
      if (!q) return true;
      return (
        g.name.toLowerCase().includes(q) ||
        g.genre.toLowerCase().includes(q) ||
        `${g.bpm}`.includes(q)
      );
    });
  }, [genreFilter, builtinQuery]);

  const filteredMidi = useMemo(() => {
    const q = midiQuery.trim().toLowerCase();
    if (!q) return midiEntries;
    const terms = q.split(/\s+/).filter(Boolean);
    return midiEntries.filter((entry) => {
      const hay = entry.relativePath.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [midiEntries, midiQuery]);

  const visibleMidiRows = useMemo(
    () => filteredMidi.slice(0, MAX_RENDERED_MIDI_ROWS),
    [filteredMidi]
  );

  const handleSelectBuiltin = (groove: NamedGroovePreset) => {
    setLoadedLabel(groove.name);
    setMidiStatus({
      type: 'ok',
      message: `Loaded "${groove.name}" (${groove.genre} · ${groove.bpm} BPM · ${Math.round(groove.swing * 100)}% swing).`,
    });
    onApplyGroove(
      {
        ...groove.pattern,
        enabled: true,
        steps: JSON.parse(JSON.stringify(groove.pattern.steps)) as Record<number, number[]>,
      },
      groove.name,
      true
    );
  };

  const handleIndexFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const valid: IndexedMidiEntry[] = [];
    let skipped = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      if (!isValidMidiFilename(rel)) {
        if (/\.midi?$/i.test(file.name) || rel.includes('__MACOSX') || file.name.startsWith('._')) {
          skipped++;
        }
        continue;
      }
      valid.push({
        id: `${i}-${rel}`,
        name: file.name.replace(/\.midi?$/i, ''),
        relativePath: rel,
        file,
      });
    }

    setMidiEntries(valid);
    setIgnoredJunkCount(skipped);
    setTab('midi');

    if (valid.length === 0) {
      setMidiStatus({
        type: 'error',
        message:
          skipped > 0
            ? `Skipped ${skipped} macOS __MACOSX / ._ resource metadata files; no valid .mid tracks found in selection.`
            : 'No valid .mid / .midi files found in selection.',
      });
      return;
    }

    // Automatically parse & audition the first valid MIDI groove immediately
    try {
      const first = valid[0];
      const buf = await first.file.arrayBuffer();
      const parsed = parseMidiBufferToGroove(buf, first.relativePath);
      setLoadedLabel(parsed.name);
      setMidiStatus({
        type: 'ok',
        message: `Indexed ${valid.length.toLocaleString()} .mid files${
          skipped > 0 ? ` (skipped ${skipped.toLocaleString()} __MACOSX/._ files)` : ''
        }. Loaded "${parsed.name}" (${parsed.noteCount} hits · ${parsed.bars} bar${
          parsed.bars > 1 ? 's' : ''
        } · ${parsed.bpm} BPM).`,
      });
      onApplyGroove(parsed.pattern, parsed.name, true);
    } catch (err) {
      setMidiStatus({
        type: 'error',
        message: `Indexed ${valid.length.toLocaleString()} files, but failed to parse first track: ${(err as Error).message}`,
      });
    }
  };

  const handleLoadMidiEntry = async (entry: IndexedMidiEntry) => {
    try {
      const buf = await entry.file.arrayBuffer();
      const parsed = parseMidiBufferToGroove(buf, entry.relativePath);
      setLoadedLabel(parsed.name);
      setMidiStatus({
        type: 'ok',
        message: `Loaded "${parsed.name}" (${parsed.noteCount} hits · ${parsed.bars} bar${
          parsed.bars > 1 ? 's' : ''
        } · ${parsed.bpm} BPM).`,
      });
      onApplyGroove(parsed.pattern, parsed.name, true);
    } catch (err) {
      setMidiStatus({
        type: 'error',
        message: `Could not parse "${entry.name}": ${(err as Error).message}`,
      });
    }
  };

  const handleShuffleMidi = () => {
    const pool = filteredMidi.length > 0 ? filteredMidi : midiEntries;
    if (pool.length === 0) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    void handleLoadMidiEntry(pick);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-4xl h-[90vh] rounded-2xl chassis-surface border border-[#2C3342] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#242A35] bg-[#141821]">
          <div className="min-w-0">
            <div className="text-[11px] font-mono-tabular text-[#FFB938] uppercase truncate">
              80 Distinct Grooves + Standard MIDI (.mid) Folder Importer · {currentBpm} BPM
            </div>
            <h2 className="font-display text-lg font-bold text-[#F2F5FA] truncate">
              Groove Browser &amp; MIDI Archive Loader
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onTogglePlay}
              className={`min-h-[48px] px-3.5 rounded-lg border font-mono-tabular text-xs font-bold flex items-center gap-1.5 ${
                isPlaying
                  ? 'bg-[#22C55E] border-[#4ADE80] text-[#07110B]'
                  : 'bg-[#1A1F29] border-[#2B3240] text-[#E6EAF2]'
              }`}
            >
              {isPlaying ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>{isPlaying ? 'STOP' : 'PLAY'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Groove Browser"
              className="min-h-[48px] min-w-[48px] rounded-lg bg-[#1A1F29] border border-[#2B3240] flex items-center justify-center text-[#E6EAF2]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mode Tabs */}
        <div className="px-4 py-3 border-b border-[#222733] bg-[#0E1117] flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('builtin')}
              className={`min-h-[48px] px-4 rounded-lg border font-mono-tabular text-xs font-semibold flex items-center gap-2 ${
                tab === 'builtin'
                  ? 'bg-[#211A0E] border-[#F5A623] text-[#F5A623]'
                  : 'bg-[#141821] border-[#252B37] text-[#8C96A6]'
              }`}
            >
              <Disc3 className="w-4 h-4" />
              <span>80 BUILT-IN GROOVES</span>
            </button>

            <button
              type="button"
              onClick={() => setTab('midi')}
              className={`min-h-[48px] px-4 rounded-lg border font-mono-tabular text-xs font-semibold flex items-center gap-2 ${
                tab === 'midi'
                  ? 'bg-[#10202C] border-[#38BDF8] text-[#38BDF8]'
                  : 'bg-[#141821] border-[#252B37] text-[#8C96A6]'
              }`}
            >
              <FileMusic className="w-4 h-4" />
              <span>
                LOCAL .MID ARCHIVE {midiEntries.length > 0 ? `(${midiEntries.length.toLocaleString()})` : ''}
              </span>
            </button>
          </div>

          {loadedLabel && (
            <div className="px-3 py-1.5 rounded-lg lcd-screen border border-[#334155] text-xs font-mono-tabular text-[#FFB938] truncate max-w-full sm:max-w-[260px]">
              ACTIVE: {loadedLabel}
            </div>
          )}
        </div>

        {midiStatus && (
          <div
            className={`mx-4 mt-3 p-3 rounded-xl border text-xs font-mono-tabular flex items-start gap-2.5 ${
              midiStatus.type === 'ok'
                ? 'bg-[#0E1F18] border-[#22C55E]/50 text-[#86EFAC]'
                : 'bg-[#2A1416] border-[#EF4444]/60 text-[#FCA5A5]'
            }`}
          >
            {midiStatus.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{midiStatus.message}</span>
          </div>
        )}

        {tab === 'builtin' ? (
          <>
            {/* Genre & Search Controls */}
            <div className="px-4 py-3 flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                  {genres.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGenreFilter(g)}
                      className={`min-h-[44px] px-3 rounded-lg border font-mono-tabular text-xs font-semibold whitespace-nowrap ${
                        genreFilter === g
                          ? 'bg-[#211A0E] border-[#F5A623] text-[#F5A623]'
                          : 'bg-[#141821] border-[#252B37] text-[#8C96A6]'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>

                <div className="relative flex-1 min-w-[200px] max-w-xs">
                  <Search className="w-4 h-4 text-[#7A8496] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={builtinQuery}
                    onChange={(e) => setBuiltinQuery(e.target.value)}
                    placeholder="Search groove, genre, BPM..."
                    className="w-full min-h-[48px] pl-9 pr-3 rounded-lg bg-[#090B0F] border border-[#2B3240] focus:border-[#F5A623] focus:outline-none text-sm font-mono-tabular text-[#E6EAF2]"
                  />
                </div>
              </div>
            </div>

            {/* 80 Built-in Grooves Grid */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 content-start">
              {filteredBuiltin.map((g) => {
                const isSelected = loadedLabel === g.name;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleSelectBuiltin(g)}
                    className={`min-h-[60px] rounded-xl border p-3 text-left transition-colors flex flex-col justify-center ${
                      isSelected
                        ? 'bg-[#211A0E] border-[#F5A623]'
                        : 'bg-[#131720] border-[#242A36] active:border-[#F5A623]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-sm font-bold text-[#F2F5FA] truncate">
                        {g.name}
                      </span>
                      <span className="text-[11px] font-mono-tabular text-[#FFB938] shrink-0">
                        {g.bpm} BPM
                      </span>
                    </div>
                    <div className="text-[11px] font-mono-tabular text-[#8C96A6] mt-0.5 truncate">
                      {g.genre} · Swing {Math.round(g.swing * 100)}% · 64 Steps
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* Local .MID File / Folder Archive Controls */}
            <div className="px-4 py-3 flex flex-wrap items-center gap-2.5">
              <label className="min-h-[48px] px-4 rounded-lg bg-[#38BDF8] text-[#06131D] font-mono-tabular text-xs font-bold flex items-center gap-2 cursor-pointer whitespace-nowrap">
                <FolderOpen className="w-4 h-4" />
                <span>SCAN MIDI FOLDER</span>
                <input
                  type="file"
                  multiple
                  {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
                  onChange={(e) => {
                    void handleIndexFiles(e.target.files);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </label>

              <label className="min-h-[48px] px-4 rounded-lg bg-[#161A23] border border-[#2B3240] active:border-[#38BDF8] font-mono-tabular text-xs font-semibold text-[#E6EAF2] flex items-center gap-2 cursor-pointer whitespace-nowrap">
                <Upload className="w-4 h-4 text-[#38BDF8]" />
                <span>LOAD .MID FILES</span>
                <input
                  type="file"
                  accept=".mid,.midi"
                  multiple
                  onChange={(e) => {
                    void handleIndexFiles(e.target.files);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </label>

              {midiEntries.length > 0 && (
                <button
                  type="button"
                  onClick={handleShuffleMidi}
                  className="min-h-[48px] px-4 rounded-lg bg-[#211A0E] border border-[#F5A623] text-[#F5A623] font-mono-tabular text-xs font-bold flex items-center gap-2 whitespace-nowrap"
                >
                  <Shuffle className="w-4 h-4" />
                  <span>RANDOM .MID</span>
                </button>
              )}

              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-[#7A8496] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={midiQuery}
                  onChange={(e) => setMidiQuery(e.target.value)}
                  placeholder="Filter by kit, genre, tempo, folder (e.g. Jazz 134BPM Triplets)..."
                  className="w-full min-h-[48px] pl-9 pr-3 rounded-lg bg-[#090B0F] border border-[#2B3240] focus:border-[#38BDF8] focus:outline-none text-sm font-mono-tabular text-[#E6EAF2]"
                />
              </div>
            </div>

            {/* Archive Index List */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
              {midiEntries.length === 0 ? (
                <div className="h-full min-h-[220px] rounded-xl border border-dashed border-[#2C3342] bg-[#0B0E14] p-6 flex flex-col items-center justify-center text-center gap-2">
                  <FolderOpen className="w-8 h-8 text-[#38BDF8]" />
                  <div className="font-display text-base font-bold text-[#F2F5FA]">
                    Point DUST &apos;87 at Your Local Drum MIDI Folder
                  </div>
                  <p className="text-xs font-mono-tabular text-[#8C96A6] max-w-lg leading-relaxed">
                    Tap <span className="text-[#38BDF8]">SCAN MIDI FOLDER</span> to index your entire local drum MIDI library (even 80,000+ files), or tap <span className="text-[#E6EAF2]">LOAD .MID FILES</span> for individual grooves. macOS <span className="text-[#FFB938]">__MACOSX</span> and <span className="text-[#FFB938]">._*</span> resource-fork metadata files are automatically skipped.
                  </p>
                </div>
              ) : (
                <>
                  <div className="text-[11px] font-mono-tabular text-[#8C96A6] flex flex-wrap items-center justify-between gap-2 px-1">
                    <span>
                      Showing {visibleMidiRows.length.toLocaleString()} of {filteredMidi.length.toLocaleString()} matching .mid tracks
                      {ignoredJunkCount > 0 ? ` · Skipped ${ignoredJunkCount.toLocaleString()} __MACOSX/._ files` : ''}
                    </span>
                    {filteredMidi.length > MAX_RENDERED_MIDI_ROWS && (
                      <span className="text-[#FFB938]">Refine search or tap RANDOM .MID to explore all {filteredMidi.length.toLocaleString()}</span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {visibleMidiRows.map((entry) => {
                      const folderPart = entry.relativePath.includes('/')
                        ? entry.relativePath.slice(0, entry.relativePath.lastIndexOf('/'))
                        : 'Local File';
                      const isSelected = loadedLabel === entry.name;
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => void handleLoadMidiEntry(entry)}
                          className={`min-h-[56px] rounded-xl border px-3.5 py-2.5 text-left transition-colors flex flex-col justify-center ${
                            isSelected
                              ? 'bg-[#10202C] border-[#38BDF8]'
                              : 'bg-[#131720] border-[#242A36] active:border-[#38BDF8]'
                          }`}
                        >
                          <div className="font-display text-sm font-bold text-[#F2F5FA] truncate">
                            {entry.name}
                          </div>
                          <div className="text-[11px] font-mono-tabular text-[#8C96A6] truncate">
                            {folderPart}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
