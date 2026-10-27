// Writes imported files into the origin-private file system (works in Safari, where createWritable is missing).
self.onmessage = async (e) => {
  const msg = e.data;
  try {
    const root = await navigator.storage.getDirectory();
    if (msg.type === 'import') {
      const files = msg.files;
      const total = files.reduce((a, f) => a + f.size, 0);
      let done = 0, lastPost = 0;
      for (const f of files) {
        const handle = await root.getFileHandle(f.name, { create: true });
        const access = await handle.createSyncAccessHandle();
        access.truncate(0);
        let at = 0;
        const reader = f.stream().getReader();
        for (;;) {
          const { done: end, value } = await reader.read();
          if (end) break;
          access.write(value, { at });
          at += value.byteLength;
          done += value.byteLength;
          const now = Date.now();
          if (now - lastPost > 200) { lastPost = now; postMessage({ type: 'progress', done, total, name: f.name }); }
        }
        access.flush();
        access.close();
      }
      postMessage({ type: 'done', count: files.length, total });
    } else if (msg.type === 'remove') {
      await root.removeEntry(msg.name);
      postMessage({ type: 'removed', name: msg.name });
    } else if (msg.type === 'clear') {
      const names = [];
      for await (const h of root.values()) names.push(h.name);
      for (const n of names) await root.removeEntry(n);
      postMessage({ type: 'cleared' });
    }
  } catch (err) {
    postMessage({ type: 'error', message: String(err && err.message || err) });
  }
};
