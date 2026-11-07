/// <reference types="node" />
/**
 * Substituto do `expo-sqlite` para testes em Node (Jest).
 *
 * Implementa a mesma API assíncrona usada pelo app (execAsync, runAsync, getFirstAsync,
 * getAllAsync, withTransactionAsync, closeAsync) sobre `node:sqlite` — o mesmo motor SQLite.
 * Assim os testes exercitam o SQL real: migrations, índices, chaves estrangeiras, CHECKs e transações.
 *
 * O arquivo do banco vem de `process.env.GYM_NOTES_TEST_DB` (definido por test/helpers/app.ts).
 */
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

type BindParams = SQLInputValue[] | SQLInputValue | undefined;

function toArray(params: BindParams): SQLInputValue[] {
  if (params === undefined) return [];
  return Array.isArray(params) ? params : [params];
}

/** Linhas do node:sqlite vêm com protótipo nulo; normalizamos para objetos comuns. */
function plain<T>(row: unknown): T {
  return { ...(row as object) } as T;
}

export async function openDatabaseAsync(_databaseName: string) {
  const database = new DatabaseSync(process.env.GYM_NOTES_TEST_DB ?? ':memory:');

  return {
    async execAsync(source: string): Promise<void> {
      database.exec(source);
    },
    async runAsync(source: string, params?: BindParams) {
      const result = database.prepare(source).run(...toArray(params));
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    async getFirstAsync<T>(source: string, params?: BindParams): Promise<T | null> {
      const row = database.prepare(source).get(...toArray(params));
      return row === undefined ? null : plain<T>(row);
    },
    async getAllAsync<T>(source: string, params?: BindParams): Promise<T[]> {
      return database
        .prepare(source)
        .all(...toArray(params))
        .map((row) => plain<T>(row));
    },
    async withTransactionAsync(task: () => Promise<void>): Promise<void> {
      database.exec('BEGIN');
      try {
        await task();
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
    async closeAsync(): Promise<void> {
      if (database.isOpen) database.close();
    },
  };
}
