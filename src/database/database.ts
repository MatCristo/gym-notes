import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { runMigrations } from '@/database/migrations';

export const DATABASE_NAME = 'gym-notes.db';

let databasePromise: Promise<SQLiteDatabase> | null = null;

async function openAndInitialize(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(DATABASE_NAME);
  try {
    // PRAGMAs de conexão: precisam rodar fora de transações.
    await db.execAsync('PRAGMA journal_mode = WAL;');
    await db.execAsync('PRAGMA foreign_keys = ON;');

    const foreignKeys = await db.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');
    if (foreignKeys?.foreign_keys !== 1) {
      throw new Error('Não foi possível habilitar as chaves estrangeiras do SQLite.');
    }

    await runMigrations(db);
    return db;
  } catch (error) {
    // Não deixa a conexão aberta: a próxima tentativa abre uma nova do zero.
    // O arquivo do banco NUNCA é apagado aqui — os dados do usuário são preservados.
    await db.closeAsync().catch(() => undefined);
    throw error;
  }
}

/** Fila que garante uma transação por vez (a conexão é única; BEGIN aninhado falharia). */
let transactionQueue: Promise<unknown> = Promise.resolve();

/**
 * Executa `task` em uma transação: tudo é confirmado junto ou desfeito em caso de erro.
 * Usa `withTransactionAsync` (mesma conexão), para que as chaves estrangeiras continuem ativas.
 * Transações concorrentes (ex.: reordenações rápidas seguidas) são executadas em sequência.
 */
export function runInTransaction<T>(task: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const db = await getDatabase();
    let result: T | undefined;
    let hasResult = false;
    await db.withTransactionAsync(async () => {
      result = await task();
      hasResult = true;
    });
    if (!hasResult) throw new Error('Transação finalizada sem resultado.');
    return result as T;
  };
  const next = transactionQueue.then(run, run);
  // A fila segue mesmo se esta transação falhar; o erro vai para quem chamou.
  transactionQueue = next.catch(() => undefined);
  return next;
}

/**
 * Instância única do banco. A primeira chamada abre o arquivo, configura os PRAGMAs
 * e aplica as migrations pendentes; as seguintes reutilizam a mesma conexão.
 * Em caso de falha, a próxima chamada tenta novamente.
 */
export function getDatabase(): Promise<SQLiteDatabase> {
  if (databasePromise === null) {
    databasePromise = openAndInitialize().catch((error: unknown) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}
