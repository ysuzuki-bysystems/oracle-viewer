"use server";

import { inspect } from "node:util";

import { getDdl as dbGetDdl } from "@/db";
import type { ConnectionId } from "@/db";

type GetDdlState = {
  ddl?: string | undefined;
  error?: string | undefined;
}

export async function getDdl(_state: GetDdlState, form: FormData): Promise<GetDdlState> {

  const id = form.get("connid");
  const ty = form.get("type");
  const owner = form.get("owner");
  const pkg = form.get("package");
  if (typeof id !== "string" || typeof ty !== "string" || typeof owner !== "string" || typeof pkg !== "string") {
    return {
      error: "Unexpected!!",
    }
  }

  try {
    const ddl = await dbGetDdl(id as ConnectionId, ty, owner, pkg);

    return {
      ddl,
    }
  } catch (e) {
    console.error((e as { suppressed?: unknown })["suppressed"] ?? e);
    return {
      error: inspect((e as { suppressed?: unknown })["suppressed"] ?? e),
    }
  }
}
