import fs from 'fs';
import path from 'path';
import { BUILTIN_PRESETS } from '../src/shared/factoryPresets.ts';
import { resolveDust87Paths } from '../src/shared/pathResolver.ts';
import { validateDust87Preset } from '../src/shared/schemaValidator.ts';
import type { WorkflowCheckItem, WorkflowValidationReport } from '../src/shared/types.ts';

export function runAutomatedPluginValidation(rootDir = process.cwd(), quarantinedCount = 0, userPresetsCount = 0): WorkflowValidationReport {
  const checks: WorkflowCheckItem[] = [];

  // 1. Check GPL-3.0-only LICENSE
  const licensePath = path.join(rootDir, 'LICENSE');
  const licenseOk = fs.existsSync(licensePath) && fs.readFileSync(licensePath, 'utf-8').includes('GPL-3.0-only');
  checks.push({
    id: 'license-gpl3',
    label: 'GPL-3.0-only License Compliance',
    status: licenseOk ? 'pass' : 'fail',
    detail: licenseOk ? 'SPDX GPL-3.0-only verified in LICENSE' : 'Missing or invalid GPL-3.0-only LICENSE',
  });

  // 2. Check vst.json manifest
  const vstPath = path.join(rootDir, 'vst.json');
  let vstOk = false;
  let vstDetail = 'vst.json missing';
  if (fs.existsSync(vstPath)) {
    try {
      const vst = JSON.parse(fs.readFileSync(vstPath, 'utf-8'));
      vstOk = vst.schema === 'open-mpc.vst/v1' && vst.id === 'dust87' && vst.license === 'GPL-3.0-only';
      vstDetail = vstOk ? `UID ${vst.uid} · ${vst.targets.join(', ')}` : 'Invalid vst.json schema fields';
    } catch (err) {
      vstDetail = `JSON parse error: ${(err as Error).message}`;
    }
  }
  checks.push({
    id: 'open-mpc-vst-json',
    label: 'Open-MPC vst.json Manifest',
    status: vstOk ? 'pass' : 'fail',
    detail: vstDetail,
  });

  // 3. Check catalog/plugins/dust87.json
  const catalogPath = path.join(rootDir, 'catalog/plugins/dust87.json');
  let catOk = false;
  let catDetail = 'catalog/plugins/dust87.json missing';
  if (fs.existsSync(catalogPath)) {
    try {
      const cat = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
      catOk = cat.id === 'dust87' && cat.license === 'GPL-3.0-only' && cat.compatibility?.gen1 && cat.compatibility?.gen2;
      catDetail = catOk ? `Catalog ID "${cat.id}" · Gen1 + Gen2 + OS ${cat.compatibility.os_min}` : 'Invalid catalog entry';
    } catch (err) {
      catDetail = `JSON parse error: ${(err as Error).message}`;
    }
  }
  checks.push({
    id: 'open-mpc-catalog',
    label: 'Open-MPC Catalog Registry Entry',
    status: catOk ? 'pass' : 'fail',
    detail: catDetail,
  });

  // 4. Check .github/workflows/vst-release.yml
  const wfPath = path.join(rootDir, '.github/workflows/vst-release.yml');
  const wfOk = fs.existsSync(wfPath) && fs.readFileSync(wfPath, 'utf-8').includes('vst-release.yml');
  checks.push({
    id: 'ci-release-workflow',
    label: 'Open-MPC CI Release Workflow',
    status: wfOk ? 'pass' : 'fail',
    detail: wfOk ? '.github/workflows/vst-release.yml configured' : 'Missing vst-release.yml workflow',
  });

  // 5. Validate all 64 Factory + 16 Starter Presets against lumina.plugin/v1
  const factoryPresets = BUILTIN_PRESETS.filter((p) => p.bank_type === 'factory');
  const starterPresets = BUILTIN_PRESETS.filter((p) => p.bank_type === 'starter');
  let validFactory = 0;
  let validStarter = 0;

  for (const p of factoryPresets) {
    if (validateDust87Preset(p).valid) validFactory++;
  }
  for (const p of starterPresets) {
    if (validateDust87Preset(p).valid) validStarter++;
  }

  const presetsOk = validFactory === 64 && validStarter === 16;
  checks.push({
    id: 'preset-bank-integrity',
    label: 'Factory (64) & Starter (16) Preset Schema',
    status: presetsOk ? 'pass' : 'fail',
    detail: `Validated ${validFactory}/64 factory and ${validStarter}/16 starter presets against lumina.plugin/v1`,
  });

  // 6. Verify Quarantine Rejection of Corrupt JSON
  const corruptSample = { schema: 'broken.schema/v0', name: '', license: 'PROPRIETARY', engine: { bit: 7 } };
  const corruptRes = validateDust87Preset(corruptSample);
  const quarantineGuardOk = !corruptRes.valid && corruptRes.errors.length >= 3;
  checks.push({
    id: 'quarantine-guard',
    label: 'Schema Validator & Quarantine Guard',
    status: quarantineGuardOk ? 'pass' : 'fail',
    detail: quarantineGuardOk
      ? `Rejected malformed preset (${corruptRes.errors.length} schema violations caught)`
      : 'Validator failed to catch malformed test payload',
  });

  // 7. Verify Q4 Cross-Platform Directory Resolver
  const linuxPaths = resolveDust87Paths({ platform: 'linux', homeDir: '/home/mpc' });
  const macPaths = resolveDust87Paths({ platform: 'darwin', homeDir: '/Users/tyrone' });
  const winPaths = resolveDust87Paths({ platform: 'win32', homeDir: 'C:\\Users\\tyrone' });
  const resolverOk =
    linuxPaths.userPresetsDir.includes('Lumina.Aerospace/DUST87') &&
    macPaths.userPresetsDir.includes('Library/Application Support/Lumina.Aerospace/DUST87') &&
    winPaths.userPresetsDir.includes('Lumina.Aerospace\\DUST87');
  checks.push({
    id: 'q4-path-resolver',
    label: 'Q4 Cross-Platform Directory Resolver',
    status: resolverOk ? 'pass' : 'fail',
    detail: resolverOk
      ? 'Verified Linux/MPC, macOS Application Support, and Windows AppData targets'
      : 'Path resolution mismatch',
  });

  const passedChecks = checks.filter((c) => c.status === 'pass').length;

  return {
    pluginName: "DUST '87",
    version: 'v0.1.0',
    license: 'GPL-3.0-only',
    timestamp: new Date().toISOString(),
    passed: passedChecks === checks.length,
    summary: {
      totalChecks: checks.length,
      passedChecks,
      factoryPresetsVerified: validFactory,
      starterPresetsVerified: validStarter,
      userPresetsVerified: userPresetsCount,
      quarantinedFilesCount: quarantinedCount,
    },
    checks,
  };
}

// Execute when invoked directly via `npm run validate`
const isDirectRun = process.argv[1] && process.argv[1].endsWith('validate-plugin.ts');
if (isDirectRun) {
  const report = runAutomatedPluginValidation();
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) {
    process.exit(1);
  }
}
