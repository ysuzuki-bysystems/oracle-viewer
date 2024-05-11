import "disposablestack/auto";

import { getConnection } from "oracledb";
import type { Connection } from "oracledb";

import { env } from "@/env";

export type ConnectionId = string & { __ConnectionIdBranded: never };

// https://github.com/vercel/next.js/discussions/15054#discussioncomment-658138
class GlobalRef<T> {
  #sym: symbol;

  constructor(uniqueName: string, initialValue: () => T) {
    this.#sym = Symbol.for(uniqueName);

    if (typeof (globalThis as any)[this.#sym] === "undefined") {
      (globalThis as any)[this.#sym] = initialValue();
    }
  }

  get value(): T {
    return (globalThis as any)[this.#sym] as T;
  }
}

type State = {
  connections: Map<ConnectionId, Connection>;
}

const ref = new GlobalRef<State>("8d24c974-8d75-499b-b5d8-e028af97a034", () => ({ connections: new Map() }));

export async function allocate(): Promise<ConnectionId> {
  const { connections } = ref.value;
  if (connections.size >= 2) {
    throw new Error("Too many connections opened.");
  }

  const id = crypto.randomUUID() as unknown as ConnectionId;

  const conn = await getConnection({
    connectString: env.ORACLE_CONNECTION_STRING,
    user: env.ORACLE_USERNAME,
    password: env.ORACLE_PASSWORD,
  });
  connections.set(id, conn);
  return id;
}

export function list(): ConnectionId[] {
  const { connections } = ref.value;
  return Array.from(connections.keys());
}

export async function ping(id: ConnectionId): Promise<boolean> {
  const { connections } = ref.value;

  const conn = connections.get(id);
  if (typeof conn === "undefined") {
    return false;
  }

  await conn.ping();
  return true;
}

export type Result = {
  rowsAffected?: number | undefined;
  data: {
    metadata: {
      name: string;
    }[];
    rows: unknown[][];
  }[];
}

export async function execution(id: ConnectionId, statements: string): Promise<Result> {
  const { connections } = ref.value;

  const conn = connections.get(id);
  if (typeof conn === "undefined") {
    throw new Error(`No connection for ${id}`);
  }

  const { rowsAffected, resultSet, implicitResults } = await conn.execute(statements, {}, { resultSet: true, maxRows: 1 });

  const result: Result = {
    rowsAffected,
    data: [],
  }

  await using stack = new AsyncDisposableStack();

  for (const item of [resultSet, ...(implicitResults ?? []) ]) {
    if (typeof item === "undefined") {
      continue;
    }
    if (Array.isArray(item)) {
      continue;
    }

    stack.defer(() => item.close());

    const data: Result["data"][number] = {
      metadata: [],
      rows: [],
    };
    result.data.push(data);

    for (const metadata of item.metaData) {
      data.metadata.push({
        name: metadata.name,
      });
    }

    let row: unknown;
    while (data.rows.length < 1000 && typeof (row = await item.getRow()) !== "undefined") {
      if (!Array.isArray(row)) {
        throw new Error("Unexpected");
      }

      data.rows.push(row);
    }
  }

  return result;
}

export async function close(id: ConnectionId) {
  const { connections } = ref.value;

  const conn = connections.get(id);
  if (typeof conn === "undefined") {
    return;
  }

  connections.delete(id);
  await conn.close();
}
