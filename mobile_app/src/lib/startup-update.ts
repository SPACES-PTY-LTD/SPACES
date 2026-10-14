type UpdateClient = {
  checkForUpdateAsync: () => Promise<{ isAvailable: boolean; isRollBackToEmbedded?: boolean }>;
  fetchUpdateAsync: () => Promise<{ isNew: boolean; isRollBackToEmbedded?: boolean }>;
  reloadAsync: () => Promise<void>;
};

/** Only reload while the launch gate still owns the screen. Late downloads wait for next launch. */
export function startStartupUpdate(client: UpdateClient, onReady: () => void, timeoutMs = 12_000) {
  let active = true;
  const finish = () => {
    if (!active) return;
    active = false;
    clearTimeout(timer);
    onReady();
  };
  const timer = setTimeout(finish, timeoutMs);
  void (async () => {
    try {
      const update = await client.checkForUpdateAsync();
      if (!active) return;
      if (!update.isAvailable && !update.isRollBackToEmbedded) return finish();
      const downloaded = await client.fetchUpdateAsync();
      if (!active) return;
      if (!downloaded.isNew && !downloaded.isRollBackToEmbedded) return finish();
      await client.reloadAsync();
      // Successful reload replaces this runtime. The timeout remains a fallback.
    } catch {
      finish(); // Offline checks, download failures and rejected reloads must not block the driver.
    }
  })();
  return {
    skip: finish,
    dispose: () => { active = false; clearTimeout(timer); },
  };
}
