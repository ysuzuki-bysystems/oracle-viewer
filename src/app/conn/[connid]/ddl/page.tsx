
import { execute } from "@/db";
import type { ConnectionId } from "@/db";

import { View } from "./View";

export const dynamic = "force-dynamic";

type Props = {
  params: {
    connid: ConnectionId;
  };
}

const sql = "select OBJECT_TYPE, OWNER, OBJECT_NAME from ALL_OBJECTS where ORACLE_MAINTAINED='N' order by OBJECT_TYPE, OWNER, OBJECT_NAME";

export default async function Ddl({ params: { connid } }: Props) {
  const result = await execute(connid, sql, { nolimit: true });

  const objects: Record<string, [string, string][]> = {};
  for (const [ty, owner, name] of result.data.flatMap(d => d.rows)) {
    if (typeof ty !== "string" || typeof owner !== "string" || typeof name !== "string") {
      throw new Error();
    }

    (objects[ty] ??= []).push([owner, name]);
  }

  return <View connid={connid} objects={objects}/>;
}
