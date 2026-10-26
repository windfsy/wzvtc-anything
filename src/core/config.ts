import { atomicWriteFile, ensureDataDirs, getPaths, readJsonFile } from './paths.js';
import { WzvtcError } from './errors.js';

export type WritePolicy = 'agent' | 'human';

export interface AppConfig {
  profile: string;
  write_policy: WritePolicy;
  deviceId?: string;
}

const DEFAULTS: AppConfig = {
  profile: 'default',
  write_policy: 'agent',
};

export function loadConfig(): AppConfig {
  ensureDataDirs();
  const stored = readJsonFile<Partial<AppConfig>>(getPaths().config, 'internal_error');
  const writePolicy = stored?.write_policy === 'human' ? 'human' : 'agent';
  return {
    ...DEFAULTS,
    ...stored,
    write_policy: writePolicy,
  };
}

export function saveConfig(config: AppConfig): void {
  ensureDataDirs();
  atomicWriteFile(getPaths().config, `${JSON.stringify(config, null, 2)}\n`);
}

export function setDeviceId(deviceId: string): void {
  const config = loadConfig();
  config.deviceId = deviceId;
  saveConfig(config);
}

export function getDeviceId(): string | undefined {
  return loadConfig().deviceId;
}

export function clearDeviceId(): void {
  const config = loadConfig();
  delete config.deviceId;
  saveConfig(config);
}

export function setWritePolicy(policy: WritePolicy): void {
  if (policy !== 'agent' && policy !== 'human') {
    throw new WzvtcError('invalid_input', 'write_policy 只能是 agent 或 human');
  }
  const config = loadConfig();
  config.write_policy = policy;
  saveConfig(config);
}
