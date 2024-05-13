"use server";

import type { ConnectionId, Result } from "@/db";
import { execute } from "@/db";

type GetState = {
  data?: Result["data"][number] | undefined;
}

async function getProcedure(connid: ConnectionId, form: FormData): Promise<GetState> {
  const objectid = form.get("object_id");
  const subprogramid = form.get("subprogram_id");
  if (typeof objectid !== "string" || typeof subprogramid !== "string") {
    throw new Error();
  }

  const sql = `SELECT POSITION, ARGUMENT_NAME, DATA_TYPE, DEFAULTED, IN_OUT, DATA_LENGTH, DATA_PRECISION, DATA_SCALE FROM ALL_ARGUMENTS where OBJECT_ID = :objectid and SUBPROGRAM_ID = :subprogramid order by POSITION`;
  const binds = {
    objectid,
    subprogramid,
  }
  const result = await execute(connid, sql, { binds });
  const [data] = result.data;
  if (typeof data === "undefined") {
    throw new Error();
  }

  return {
    data,
  }
}

export async function get(_state: GetState, form: FormData): Promise<GetState> {
  const ty = form.get("type");
  const connid = form.get("connid");
  if (typeof ty !== "string" || typeof connid !== "string") {
    throw new Error();
  }

  switch (ty) {
    case "PROCEDURE": return getProcedure(connid as ConnectionId, form);
    default: throw new Error("Unsupported");
  }
}
