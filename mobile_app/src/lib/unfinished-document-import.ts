type RecentImport = { import_id: string; filename: string; status: string };
type PendingImport = { id: string; filename: string };

/** Recent imports are newest first and scoped by the server to the driver. */
export function unfinishedDocumentImport(recent: RecentImport[], pending: PendingImport | null) {
  const known = pending ? recent.find(item => item.import_id === pending.id) : undefined;
  if (pending && !known) return { ...pending, needsStatusCheck: true };
  if (known?.status === 'analyzed') return { id: known.import_id, filename: known.filename, needsStatusCheck: false };
  const latest = recent.find(item => item.status === 'analyzed');
  return latest ? { id: latest.import_id, filename: latest.filename, needsStatusCheck: false } : null;
}
