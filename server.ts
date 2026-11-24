import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { runAutomatedPluginValidation } from './scripts/validate-plugin.ts';
import { BUILTIN_PRESETS } from './src/shared/factoryPresets.ts';
import { resolveDust87Paths } from './src/shared/pathResolver.ts';
import { validateDust87Preset } from './src/shared/schemaValidator.ts';
import type { Dust87Preset, QuarantineRecord, UserSettings } from './src/shared/types.ts';

const PORT = 3000;
const WORKSPACE_ROOT = process.cwd();
const WORKSPACE_DATA_DIR = process.env.DUST87_DATA_DIR || path.join(WORKSPACE_ROOT, 'data', 'Lumina.Aerospace', 'DUST87');

function getResolvedPaths() {
  return resolveDust87Paths({
    platform: os.platform(),
    homeDir: os.homedir(),
    xdgDataHome: process.env.XDG_DATA_HOME,
    xdgConfigHome: process.env.XDG_CONFIG_HOME,
    appData: process.env.APPDATA,
    localAppData: process.env.LOCALAPPDATA,
    workspaceDataDir: WORKSPACE_DATA_DIR,
  });
}

function ensureStorageDirs() {
  const paths = getResolvedPaths();
  fs.mkdirSync(paths.userPresetsDir, { recursive: true });
  fs.mkdirSync(paths.quarantineDir, { recursive: true });
  fs.mkdirSync(paths.factoryCacheDir, { recursive: true });

  if (!fs.existsSync(paths.settingsFile)) {
    const defaultSettings: UserSettings = {
      activePresetId: BUILTIN_PRESETS[0].id || 'factory-01-dust-87-flagship',
      midiRoutingMode: 'per_voice_channel',
      velocityCurve: 'touch_y',
      qlinkCcMap: [74, 71, 75, 76],
      rollDivision: '1/16',
      simulatedVelocity: 112,
    };
    fs.writeFileSync(paths.settingsFile, JSON.stringify(defaultSettings, null, 2), 'utf-8');
  }

  return paths;
}

function quarantineFile(filePath: string, filename: string, errors: string[], rawContent: string): QuarantineRecord {
  const paths = ensureStorageDirs();
  const stamp = Date.now();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const targetName = `${stamp}_${safeName}`;
  const quarantinePath = path.join(paths.quarantineDir, targetName);

  if (fs.existsSync(filePath)) {
    fs.renameSync(filePath, quarantinePath);
  } else {
    fs.writeFileSync(quarantinePath, rawContent, 'utf-8');
  }

  const record: QuarantineRecord = {
    filename: targetName,
    quarantinedAt: new Date(stamp).toISOString(),
    originalPath: filePath,
    quarantinePath,
    errors,
    rawSnippet: rawContent.slice(0, 320),
  };

  fs.writeFileSync(`${quarantinePath}.meta.json`, JSON.stringify(record, null, 2), 'utf-8');
  return record;
}

function scanAndLoadUserPresets(): { userPresets: Dust87Preset[]; quarantined: QuarantineRecord[] } {
  const paths = ensureStorageDirs();
  const userPresets: Dust87Preset[] = [];
  const newlyQuarantined: QuarantineRecord[] = [];

  const entries = fs.readdirSync(paths.userPresetsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const fullPath = path.join(paths.userPresetsDir, entry.name);
    let rawContent = '';
    try {
      rawContent = fs.readFileSync(fullPath, 'utf-8');
      const parsed = JSON.parse(rawContent);
      const validation = validateDust87Preset(parsed);
      if (validation.valid && validation.preset) {
        userPresets.push({
          ...validation.preset,
          bank_type: 'user',
          category: validation.preset.category || 'User Bank',
        });
      } else {
        newlyQuarantined.push(quarantineFile(fullPath, entry.name, validation.errors, rawContent));
      }
    } catch (err) {
      newlyQuarantined.push(
        quarantineFile(fullPath, entry.name, [`JSON parse failure: ${(err as Error).message}`], rawContent)
      );
    }
  }

  return { userPresets, quarantined: newlyQuarantined };
}

function listQuarantinedRecords(): QuarantineRecord[] {
  const paths = ensureStorageDirs();
  const records: QuarantineRecord[] = [];
  const entries = fs.readdirSync(paths.quarantineDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.meta.json')) continue;
    try {
      const content = fs.readFileSync(path.join(paths.quarantineDir, entry.name), 'utf-8');
      records.push(JSON.parse(content) as QuarantineRecord);
    } catch {
      // Ignore broken metadata files
    }
  }

  return records.sort((a, b) => b.quarantinedAt.localeCompare(a.quarantinedAt));
}

async function startServer() {
  ensureStorageDirs();
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, plugin: "DUST '87", version: 'v0.1.0', license: 'GPL-3.0-only' });
  });

  app.get('/api/storage/paths', (_req, res) => {
    const paths = ensureStorageDirs();
    res.json(paths);
  });

  app.get('/api/presets', (_req, res) => {
    const { userPresets, quarantined } = scanAndLoadUserPresets();
    const allQuarantined = listQuarantinedRecords();
    res.json({
      factory: BUILTIN_PRESETS.filter((p) => p.bank_type === 'factory'),
      starter: BUILTIN_PRESETS.filter((p) => p.bank_type === 'starter'),
      user: userPresets,
      newlyQuarantined: quarantined,
      quarantineCount: allQuarantined.length,
    });
  });

  app.post('/api/presets/user', (req, res) => {
    const paths = ensureStorageDirs();
    const validation = validateDust87Preset(req.body);
    if (!validation.valid || !validation.preset) {
      res.status(400).json({ error: 'Preset failed lumina.plugin/v1 schema validation', errors: validation.errors });
      return;
    }

    const slug = validation.preset.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'user-kit';
    const id = validation.preset.id?.startsWith('user-') ? validation.preset.id : `user-${slug}-${Date.now().toString(36)}`;
    const savedPreset: Dust87Preset = {
      ...validation.preset,
      id,
      bank_type: 'user',
      category: 'User Bank',
    };

    const filePath = path.join(paths.userPresetsDir, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(savedPreset, null, 2), 'utf-8');
    res.json({ ok: true, preset: savedPreset, filePath });
  });

  app.post('/api/presets/import', (req, res) => {
    const paths = ensureStorageDirs();
    const { filename, rawJson } = req.body as { filename?: string; rawJson?: string };
    const safeFile = (filename || `import-${Date.now()}.json`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const tempPath = path.join(paths.userPresetsDir, safeFile.endsWith('.json') ? safeFile : `${safeFile}.json`);

    if (typeof rawJson !== 'string') {
      res.status(400).json({ error: 'rawJson string is required' });
      return;
    }

    fs.writeFileSync(tempPath, rawJson, 'utf-8');
    const importOutcome: { preset: Dust87Preset | null; newlyQuarantined: QuarantineRecord | null } = (() => {
      try {
        const parsed = JSON.parse(rawJson);
        const validation = validateDust87Preset(parsed);
        if (validation.valid && validation.preset) {
          const id = `user-${Date.now().toString(36)}`;
          const normalized: Dust87Preset = {
            ...validation.preset,
            id,
            bank_type: 'user',
            category: 'User Bank',
          };
          fs.unlinkSync(tempPath);
          fs.writeFileSync(path.join(paths.userPresetsDir, `${id}.json`), JSON.stringify(normalized, null, 2), 'utf-8');
          return { preset: normalized, newlyQuarantined: null };
        }
        const record = quarantineFile(tempPath, safeFile, validation.errors, rawJson);
        return { preset: null, newlyQuarantined: record };
      } catch (err) {
        const record = quarantineFile(tempPath, safeFile, [`JSON parse failure: ${(err as Error).message}`], rawJson);
        return { preset: null, newlyQuarantined: record };
      }
    })();

    if (importOutcome.newlyQuarantined) {
      res.status(422).json({
        ok: false,
        quarantined: true,
        record: importOutcome.newlyQuarantined,
      });
      return;
    }

    const { userPresets } = scanAndLoadUserPresets();
    res.json({ ok: true, quarantined: false, userPresets });
  });

  app.delete('/api/presets/user/:id', (req, res) => {
    const paths = ensureStorageDirs();
    const target = path.join(paths.userPresetsDir, `${req.params.id.replace(/[^a-zA-Z0-9._-]/g, '')}.json`);
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
      res.json({ ok: true });
      return;
    }
    res.status(404).json({ error: 'User preset not found' });
  });

  app.get('/api/quarantine', (_req, res) => {
    res.json({ records: listQuarantinedRecords() });
  });

  app.post('/api/quarantine/simulate-corrupt', (_req, res) => {
    const paths = ensureStorageDirs();
    const corruptFilename = `corrupt-kit-${Date.now().toString(36)}.json`;
    const corruptPath = path.join(paths.userPresetsDir, corruptFilename);
    const corruptPayload = JSON.stringify(
      {
        schema: 'legacy.unknown/v0',
        name: 'CORRUPT_DRUMS_87',
        version: 'bad-ver',
        license: 'PROPRIETARY',
        engine: { bit: 7, sr: [], filter: 'invalid-filter', drive: 4.5 },
        voices: [],
      },
      null,
      2
    );
    fs.writeFileSync(corruptPath, corruptPayload, 'utf-8');
    const scanResult = scanAndLoadUserPresets();
    res.json({
      ok: true,
      quarantined: scanResult.quarantined,
      records: listQuarantinedRecords(),
    });
  });

  app.delete('/api/quarantine/:filename', (req, res) => {
    const paths = ensureStorageDirs();
    const safeName = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const dataFile = path.join(paths.quarantineDir, safeName);
    const metaFile = `${dataFile}.meta.json`;
    if (fs.existsSync(dataFile)) fs.unlinkSync(dataFile);
    if (fs.existsSync(metaFile)) fs.unlinkSync(metaFile);
    res.json({ ok: true, records: listQuarantinedRecords() });
  });

  app.get('/api/settings', (_req, res) => {
    const paths = ensureStorageDirs();
    try {
      const content = fs.readFileSync(paths.settingsFile, 'utf-8');
      res.json(JSON.parse(content));
    } catch {
      res.status(500).json({ error: 'Failed to read settings.json' });
    }
  });

  app.put('/api/settings', (req, res) => {
    const paths = ensureStorageDirs();
    const nextSettings = req.body as UserSettings;
    fs.writeFileSync(paths.settingsFile, JSON.stringify(nextSettings, null, 2), 'utf-8');
    res.json({ ok: true, settings: nextSettings });
  });

  app.get('/api/workflow/validate', (_req, res) => {
    const { userPresets } = scanAndLoadUserPresets();
    const quarantined = listQuarantinedRecords();
    const report = runAutomatedPluginValidation(WORKSPACE_ROOT, quarantined.length, userPresets.length);
    res.json(report);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(WORKSPACE_ROOT, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DUST '87 server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
