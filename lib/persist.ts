export function canPersistRecords(): boolean {
  return Boolean(process.env.POSTGRES_URL);
}

export function canPersistBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function canPersistAll(): boolean {
  return canPersistRecords() && canPersistBlob();
}
