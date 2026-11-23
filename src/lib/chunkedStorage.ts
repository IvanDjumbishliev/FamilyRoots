type Store = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

type Manifest = { slot: 0 | 1; count: number };
const chunkSize = 400;

export function createChunkedStorage(store: Store): Store {
  let queue: Promise<unknown> = Promise.resolve();

  function serial<T>(operation: () => Promise<T>) {
    const result = queue.then(operation);
    queue = result.catch(() => undefined);
    return result;
  }

  async function manifest(key: string): Promise<Manifest | null> {
    const current = await store.getItem(key);
    const match = current?.match(/^([01]):([1-9][0-9]{0,2})$/);
    if (!match) return null;
    return { slot: match[1] === '0' ? 0 : 1, count: Number(match[2]) };
  }

  function part(key: string, slot: number, index: number) {
    return `${key}.${slot}.${index}`;
  }

  async function clean(key: string, value: Manifest) {
    for (let index = 0; index < value.count; index++) {
      await store.removeItem(part(key, value.slot, index));
    }
  }

  return {
    getItem: (key) =>
      serial(async () => {
        const previous = await manifest(key);
        if (!previous) return null;
        let value = '';
        for (let index = 0; index < previous.count; index++) {
          const chunk = await store.getItem(part(key, previous.slot, index));
          if (chunk === null) return null;
          value += chunk;
        }
        return value;
      }),
    setItem: (key, value) =>
      serial(async () => {
        const previous = await manifest(key);
        const points = Array.from(value);
        const next: Manifest = {
          slot: previous?.slot === 0 ? 1 : 0,
          count: Math.max(1, Math.ceil(points.length / chunkSize)),
        };
        if (next.count > 999)
          throw new Error('Secure session data is too large.');
        try {
          for (let index = 0; index < next.count; index++) {
            await store.setItem(
              part(key, next.slot, index),
              points.slice(index * chunkSize, (index + 1) * chunkSize).join(''),
            );
          }
          await store.setItem(key, `${next.slot}:${next.count}`);
        } catch (error) {
          await clean(key, next).catch(() => undefined);
          throw error;
        }
        if (previous) await clean(key, previous).catch(() => undefined);
      }),
    removeItem: (key) =>
      serial(async () => {
        const previous = await manifest(key);
        await store.removeItem(key);
        if (previous) await clean(key, previous);
      }),
  };
}
