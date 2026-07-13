import type { DbAdapter } from './adapters/interface';

let _adapter: DbAdapter | null = null;

/**
 * Returns the configured DbAdapter, initialising it on first call.
 * Adapter type is controlled by the DB_ADAPTER environment variable:
 *   DB_ADAPTER=sqlite   (default) — uses the local SQLite file
 *   DB_ADAPTER=mongodb  — connects to MONGODB_URI (default: localhost:27017)
 */
export async function getAdapter(): Promise<DbAdapter> {
  if (_adapter) return _adapter;

  const type = (process.env.DB_ADAPTER ?? 'sqlite').toLowerCase();

  if (type === 'mongodb') {
    const { MongoAdapter } = await import('./adapters/mongodb');
    const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017';
    _adapter = await MongoAdapter.connect(uri);
    console.log('Connected to MongoDB');
  } else {
    const { SqliteAdapter } = await import('./adapters/sqlite');
    _adapter = new SqliteAdapter();
    console.log('Using SQLite adapter');
  }

  return _adapter;
}
