import fs from 'fs';
import path from 'path';
import type { WorkflowCheckItem, WorkflowValidationReport } from '../src/shared/types.ts';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJson(filePath: string): { value: JsonRecord | null; error: string | null } {
  if (!fs.existsSync(filePath)) {
    return { value: null, error: `${path.relative(process.cwd(), filePath)} missing` };
  }

  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return isRecord(parsed)
      ? { value: parsed, error: null }
      : { value: null, error: 'JSON root must be an object' };
  } catch (error) {
    return { value: null, error: `JSON parse error: ${String(error)}` };
  }
}

function addCheck(checks: WorkflowCheckItem[], id: string, label: string, passed: boolean, detail: string): void {
  checks.push({ id, label, status: passed ? 'pass' : 'fail', detail });
}

export function runAutomatedPluginValidation(
  rootDir = process.cwd(),
  quarantinedCount = 0,
  userPresetsCount = 0,
): WorkflowValidationReport {
  const projectDir = path.join(rootDir, 'plugins', 'Dust87');
  const manifestResult = readJson(path.join(projectDir, 'plugin.json'));
  const manifest = manifestResult.value;
  const licenseExists = fs.existsSync(path.join(rootDir, 'LICENSE'));
  const licenseOk = licenseExists && manifest?.license === 'GPL-3.0-only';
  const checks: WorkflowCheckItem[] = [];

  addCheck(
    checks,
    'license-gpl3',
    'GPL-3.0-only License',
    licenseOk,
    licenseOk ? 'Repository license and SDK manifest agree on GPL-3.0-only' : 'LICENSE missing or manifest license mismatch',
  );

  const manifestOk =
    manifest?.name === "DUST '87" &&
    manifest.manufacturer === 'Lumina.Aerospace' &&
    manifest.version === '0.1.0' &&
    manifest.kind === 'instrument' &&
    manifest.uid === 'LMD8' &&
    manifest.license === 'GPL-3.0-only' &&
    manifest.numInputs === 0 &&
    manifest.numOutputs === 2;
  addCheck(
    checks,
    'mpc-sdk-manifest',
    'MPC SDK Plugin Manifest',
    manifestOk,
    manifestOk ? `UID ${String(manifest.uid)} · ${String(manifest.kind)} · v${String(manifest.version)}` : manifestResult.error ?? 'SDK manifest identity or I/O fields are invalid',
  );

  const sourcePath = path.join(projectDir, 'src', 'DUST87.cpp');
  const source = fs.existsSync(sourcePath) ? fs.readFileSync(sourcePath, 'utf-8') : '';
  const identityOk =
    source.includes("MPC_FOURCC('L', 'M', 'D', '8')") &&
    source.includes('MPC_PLUGIN_ENTRY(DUST87)');
  addCheck(
    checks,
    'native-uid',
    'Native Plugin UID',
    identityOk,
    identityOk ? 'C++ plugin entry and LMD8 UID match the SDK manifest' : 'Native source or matching SDK plugin entry is missing',
  );

  const catalogResult = readJson(path.join(rootDir, 'catalog', 'plugins', 'dust87.json'));
  const catalog = catalogResult.value;
  const catalogOk =
    catalog?.id === 'dust87' &&
    catalog.repo === 'Luminous-Works/mpc-vst-Dust-87' &&
    catalog.name === manifest?.name &&
    catalog.kind === manifest?.kind &&
    catalog.license === manifest?.license &&
    typeof catalog.summary === 'string' &&
    catalog.summary.length > 0 &&
    !Object.prototype.hasOwnProperty.call(catalog, 'version') &&
    !Object.prototype.hasOwnProperty.call(catalog, 'compatibility');
  addCheck(
    checks,
    'open-mpc-catalog',
    'Open-MPC Catalog Registry Entry',
    catalogOk,
    catalogOk ? 'Registry metadata matches the native SDK project' : catalogResult.error ?? 'Registry schema or SDK identity mismatch',
  );

  const uiResult = readJson(path.join(projectDir, 'ui.json'));
  const ui = uiResult.value;
  const expectedControls = new Set(['Master', 'Bit Depth', 'Sample Rate', 'Drive', 'Plate Mix', 'Plate Decay']);
  const drumLabels = [
    'Kick', 'Sub', 'Snare', 'Crack', 'Rim', 'Clap', 'CHat', 'OHat', 'LoTom',
    'MidTom', 'HiTom', 'Crash', 'Ride', 'CBell', 'Clave', 'Shaker', 'Metal', 'Zap',
  ];
  for (const label of drumLabels) {
    expectedControls.add(`${label} Tune`);
    expectedControls.add(`${label} Decay`);
    expectedControls.add(`${label} Level`);
  }
  const referencedControls = new Set<string>();
  const pages = Array.isArray(ui?.pages) ? ui.pages : [];
  let validPageLayout = pages.length === 6 && ui?.qlinkGroups === 'rows';
  for (const page of pages) {
    if (!isRecord(page) || !Array.isArray(page.controls) || page.controls.length > 16) {
      validPageLayout = false;
      continue;
    }
    for (const control of page.controls) {
      if (control === 'empty') {
        continue;
      }
      if (!isRecord(control) || typeof control.param !== 'string') {
        validPageLayout = false;
        continue;
      }
      referencedControls.add(control.param);
    }
  }
  const uiOk =
    uiResult.value !== null &&
    validPageLayout &&
    referencedControls.size === expectedControls.size &&
    [...expectedControls].every((control) => referencedControls.has(control));
  addCheck(
    checks,
    'mpc-touch-ui',
    'MPC Touch UI Parameters',
    uiOk,
    uiOk ? `Six pages cover all ${referencedControls.size} native controls` : uiResult.error ?? 'Touch UI pages or parameter references are invalid',
  );

  const programCount = (source.match(/addProgram\(\s*"/g) ?? []).length;
  addCheck(
    checks,
    'factory-programs',
    'Built-in Programs',
    programCount === 8,
    `Found ${programCount}/8 built-in program definitions in the native source`,
  );

  const workflowPath = path.join(rootDir, '.github', 'workflows', 'vst-release.yml');
  const workflow = fs.existsSync(workflowPath) ? fs.readFileSync(workflowPath, 'utf-8') : '';
  const reusableRef = workflow.match(
    /uses:\s*open-mpc\/mpc-vst-plugins\/\.github\/workflows\/vst-release\.yml@([0-9a-f]{40})/,
  )?.[1];
  const toolsRef = workflow.match(/tools_ref:\s*([0-9a-f]{40})/)?.[1];
  const workflowOk =
    reusableRef !== undefined &&
    reusableRef === toolsRef &&
    workflow.includes('sdk_project: plugins/Dust87') &&
    workflow.includes('tag: dust87-vst-v${{ inputs.version }}') &&
    workflow.includes('version: ${{ inputs.version }}') &&
    workflow.includes('dry_run: ${{ inputs.dry_run }}') &&
    /dry_run:\r?\n[ \t]+description:[^\r\n]*\r?\n[ \t]+type:\s*boolean\r?\n[ \t]+default:\s*true/.test(workflow) &&
    !/^[ \t]+push:/m.test(workflow);
  addCheck(
    checks,
    'sdk-release-workflow',
    'Pinned Open-MPC SDK Workflow',
    workflowOk,
    workflowOk ? `Reusable workflow and tools are pinned to ${reusableRef}` : 'SDK project, required inputs, immutable pin, or safe trigger configuration is invalid',
  );

  const passedChecks = checks.filter((check) => check.status === 'pass').length;
  const version = typeof manifest?.version === 'string' ? manifest.version : 'unknown';
  return {
    pluginName: typeof manifest?.name === 'string' ? manifest.name : "DUST '87",
    version,
    license: typeof manifest?.license === 'string' ? manifest.license : 'unknown',
    timestamp: new Date().toISOString(),
    passed: passedChecks === checks.length,
    summary: {
      totalChecks: checks.length,
      passedChecks,
      factoryPresetsVerified: programCount,
      starterPresetsVerified: 0,
      userPresetsVerified: userPresetsCount,
      quarantinedFilesCount: quarantinedCount,
    },
    checks,
  };
}

const isDirectRun = process.argv[1] && process.argv[1].endsWith('validate-plugin.ts');
if (isDirectRun) {
  const report = runAutomatedPluginValidation();
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) {
    process.exit(1);
  }
}
