import { inspect } from "node:util";

import { execute, getDdl as dbGetDdl } from "@/db";
import type { ConnectionId } from "@/db";

import { View } from "./View";

export const dynamic = "force-dynamic";

type GetDdlState = {
  ddl?: string | undefined;
  error?: string | undefined;
}

export async function getDdl(_state: GetDdlState, form: FormData): Promise<GetDdlState> {
  "use server";

  const id = form.get("connid");
  const ty = form.get("type");
  const pkg = form.get("package");
  if (typeof id !== "string" || typeof ty !== "string" || typeof pkg !== "string") {
    return {
      error: "Unexpected!!",
    }
  }

  try {
    const ddl = await dbGetDdl(id as ConnectionId, ty, pkg);

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

type Props = {
  params: {
    connid: ConnectionId;
  };
}

const sql = "select OBJECT_TYPE, OBJECT_NAME from USER_OBJECTS order by OBJECT_TYPE, OBJECT_NAME";

export default async function Plsql({ params: { connid } }: Props) {
  const result = await execute(connid, sql);

  const objects: Record<string, string[]> = {};
  for (const [ty, name] of result.data.flatMap(d => d.rows)) {
    if (typeof ty !== "string" || typeof name !== "string") {
      throw new Error();
    }

    (objects[ty] ??= []).push(name);
  }

  return <View connid={connid} objects={objects} action={getDdl}/>;
}
