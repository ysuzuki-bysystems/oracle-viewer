import { redirect } from "next/navigation";

import { ping, execution } from "@/db";
import type { ConnectionId } from "@/db";
import { View } from "./View";

const sql = `DECLARE
  c1 SYS_REFCURSOR;
BEGIN
  OPEN c1 FOR select table_name name from user_tables
    union
  select object_name || '.' || procedure_name from user_procedures where procedure_name is not null
    union
  select object_name from user_procedures where procedure_name is null;
  DBMS_SQL.RETURN_RESULT(c1);
END;
`;

type Props = {
  params: {
    connid: ConnectionId;
  };
}

export default async function Home({ params: { connid } }: Props) {
  const ok = await ping(connid);
  if (!ok) {
    redirect("/");
  }

  const objects: string[] = ["DUAL", "DBMS_SQL.RETURN_RESULT"];
  const result = await execution(connid, sql);
  for (const data of result.data) {
    for (const [val] of data.rows) {
      if (typeof val !== "string") {
        continue;
      }

      objects.push(val);
    }
  }

  return <View connid={connid as string} objectForCompletion={objects} />;
}
