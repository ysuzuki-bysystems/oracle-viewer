"use server";

import { inspect } from "node:util";

import { z } from "zod";

import type { ConnectionId, Result } from "@/db";
import { execution as executeDb } from "@/db";

type ExecuteState = {
  err?: string | undefined;
  result?: Result | undefined;
}

const zExecuteForm = z.object({
  sql: z.string(),
  connid: z.string().transform<ConnectionId>(v => v as ConnectionId),
});

export async function execute(_state: ExecuteState, form: FormData): Promise<ExecuteState> {
  const { sql, connid } = zExecuteForm.parse(Object.fromEntries(form.entries()));
  try {
    const result = await executeDb(connid, sql);
    return {
      result,
    }
  } catch (e) {
    console.error((e as { suppressed?: unknown })["suppressed"] ?? e);
    return {
      err: inspect((e as { suppressed?: unknown })["suppressed"] ?? e),
    }
  }
}

