import { execute } from "@/db";
import type { ConnectionId } from "@/db";

import { View } from "./View";
import type { Procedure } from "./View";

export const dynamic = "force-dynamic";

type Props = {
  params: {
    connid: ConnectionId;
  };
}

const procQuery = `select p.OWNER
     , p.OBJECT_NAME
     , p.PROCEDURE_NAME
     , p.OBJECT_ID
     , p.SUBPROGRAM_ID
     , p.OVERLOAD
  from ALL_PROCEDURES p
  join ALL_OBJECTS o
    on p.OBJECT_ID = o.OBJECT_ID
   and o.ORACLE_MAINTAINED = 'N'
where p.PROCEDURE_NAME is not null`;

function assertsString(val: unknown): asserts val is string {
  if (typeof val !== "string") {
    throw new Error(`${val}`);
  }
}

function assertsNumber(val: unknown): asserts val is string {
  if (typeof val !== "number") {
    throw new Error(`${val}`);
  }
}

export default async function def({ params: { connid } }: Props) {
  const result = await execute(connid, procQuery, { nolimit: true });

  const procedures: Procedure[] = [];
  for (const [owner, pkg, name, objectId, subprogramId, overload] of result.data.flatMap(d => d.rows)) {
    assertsString(owner);
    assertsString(pkg);
    assertsString(name);
    assertsNumber(objectId);
    assertsNumber(subprogramId);
    if (overload !== null) {
      assertsString(overload);
    }

    procedures.push({
      owner,
      package: pkg,
      name,
      objectId,
      subprogramId,
    });
  }

  return <View connid={connid} procedures={procedures} />;
}
