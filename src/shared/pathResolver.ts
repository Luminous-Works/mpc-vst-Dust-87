import type { PlatformPathsReport } from './types.ts';

export interface ResolverEnv {
  platform: string;
  homeDir: string;
  xdgDataHome?: string;
  xdgConfigHome?: string;
  appData?: string;
  localAppData?: string;
  workspaceDataDir?: string;
}

const VENDOR_DIR = 'Lumina.Aerospace';
const PLUGIN_DIR = 'DUST87';

function joinPosix(...parts: string[]): string {
  return parts.join('/').replace(/\/+/g, '/');
}

function joinWin32(...parts: string[]): string {
  return parts.join('\\').replace(/\\+/g, '\\');
}

/**
 * Q4 Cross-Platform Directory Resolver for user settings, presets, and corrupt-file quarantine.
 * Supports Linux / Akai MPC Standalone OS, macOS, and Windows conventions cleanly.
 */
export function resolveDust87Paths(env: ResolverEnv): PlatformPathsReport {
  const home = env.homeDir || '/home/mpc';
  const xdgData = env.xdgDataHome || joinPosix(home, '.local/share');
  const xdgConfig = env.xdgConfigHome || joinPosix(home, '.config');
  const winRoaming = env.appData || joinWin32('C:\\Users\\User\\AppData\\Roaming');
  const winLocal = env.localAppData || joinWin32('C:\\Users\\User\\AppData\\Local');

  const matrix = {
    linux_mpc: {
      dataDir: joinPosix(xdgData, VENDOR_DIR, PLUGIN_DIR),
      mpcExternalDir: `/media/az01-internal/Synths/${VENDOR_DIR}/${PLUGIN_DIR}`,
      configDir: joinPosix(xdgConfig, VENDOR_DIR, PLUGIN_DIR),
    },
    macos: {
      appSupportDir: joinPosix(home, 'Library/Application Support', VENDOR_DIR, PLUGIN_DIR),
      presetsDir: joinPosix(home, 'Library/Application Support', VENDOR_DIR, PLUGIN_DIR, 'presets/user'),
      quarantineDir: joinPosix(home, 'Library/Application Support', VENDOR_DIR, PLUGIN_DIR, 'quarantine'),
    },
    windows: {
      roamingDir: joinWin32(winRoaming, VENDOR_DIR, PLUGIN_DIR),
      localCacheDir: joinWin32(winLocal, VENDOR_DIR, PLUGIN_DIR),
      quarantineDir: joinWin32(winLocal, VENDOR_DIR, PLUGIN_DIR, 'quarantine'),
    },
  };

  let activeRootDir: string;
  if (env.workspaceDataDir) {
    activeRootDir = env.workspaceDataDir;
  } else if (env.platform === 'darwin') {
    activeRootDir = matrix.macos.appSupportDir;
  } else if (env.platform === 'win32') {
    activeRootDir = matrix.windows.roamingDir;
  } else {
    activeRootDir = matrix.linux_mpc.dataDir;
  }

  const sep = env.platform === 'win32' && !env.workspaceDataDir ? '\\' : '/';
  const joinActive = sep === '\\' ? joinWin32 : joinPosix;

  return {
    activePlatform: env.platform,
    activeRootDir,
    settingsFile: joinActive(activeRootDir, 'settings.json'),
    userPresetsDir: joinActive(activeRootDir, 'presets', 'user'),
    quarantineDir: joinActive(activeRootDir, 'quarantine'),
    factoryCacheDir: joinActive(activeRootDir, 'presets', 'factory'),
    matrix,
  };
}
