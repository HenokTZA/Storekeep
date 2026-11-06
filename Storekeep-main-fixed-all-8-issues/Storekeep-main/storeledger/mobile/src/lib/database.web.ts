function webKey(table: string, key: string) {
  return `storeledger.${table}.${key}`;
}

function readValue<T>(key: string): T | null {
  const value = globalThis.localStorage?.getItem(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    globalThis.localStorage?.removeItem(key);
    return null;
  }
}

export async function initializeDatabase() {
  // The responsive web client intentionally uses localStorage. SQLite remains
  // native-only, so web builds do not need experimental WASM/SharedArrayBuffer.
}

export async function cacheSet(key: string, value: unknown) {
  globalThis.localStorage?.setItem(webKey('cache', key), JSON.stringify(value));
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  return readValue<T>(webKey('cache', key));
}

export async function setLocalValue(key: string, value: unknown) {
  globalThis.localStorage?.setItem(webKey('local', key), JSON.stringify(value));
}

export async function getLocalValue<T>(key: string): Promise<T | null> {
  return readValue<T>(webKey('local', key));
}

export async function removeLocalValue(key: string) {
  globalThis.localStorage?.removeItem(webKey('local', key));
}

export async function clearLocalData() {
  const storage = globalThis.localStorage;
  if (!storage) return;
  const remove: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith('storeledger.cache.') || key?.startsWith('storeledger.local.')) remove.push(key);
  }
  remove.forEach(key => storage.removeItem(key));
}
