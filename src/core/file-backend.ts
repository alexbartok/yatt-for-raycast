import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import type { StorageBackend } from "./store";

const LOCK_STALE_MS = 5000;
const LOCK_WAIT_MS = 3000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Takes an exclusive lock next to the file: `O_EXCL` creation succeeds for one process at a time. A lock older
 * than LOCK_STALE_MS is treated as abandoned. Returns a release function.
 */
async function acquireLock(lock: string): Promise<() => void> {
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      closeSync(openSync(lock, "wx"));
      return () => {
        try {
          unlinkSync(lock);
        } catch {
          /* already gone */
        }
      };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      try {
        if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) unlinkSync(lock);
      } catch {
        /* vanished between checks */
      }
      if (Date.now() > deadline)
        throw new Error(`Another process is writing ${path.basename(lock.replace(/\.lock$/, ""))}.`);
      await sleep(50);
    }
  }
}

/**
 * A locations store in one JSON file. Writes go to a sibling temp file and are renamed into place, so a crash
 * never leaves a torn file; `update` reads and writes under a lock, so two commands on the same Mac cannot lose
 * each other's changes. Edits arriving from another Mac through a sync service are outside the lock: the sync
 * service decides which version wins.
 */
export function fileBackend(full: string): StorageBackend {
  const write = (text: string) => {
    mkdirSync(path.dirname(full), { recursive: true });
    const tmp = `${full}.${process.pid}.tmp`;
    writeFileSync(tmp, text, "utf8");
    renameSync(tmp, full);
  };
  const read = () => (existsSync(full) ? readFileSync(full, "utf8") : undefined);
  return {
    read: async () => read(),
    write: async (text) => write(text),
    update: async (fn) => {
      mkdirSync(path.dirname(full), { recursive: true });
      const release = await acquireLock(`${full}.lock`);
      try {
        write(fn(read()));
      } finally {
        release();
      }
    },
  };
}
