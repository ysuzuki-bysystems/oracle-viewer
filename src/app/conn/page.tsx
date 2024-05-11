import { redirect } from "next/navigation";

import { list, close } from "@/db";
import type { ConnectionId } from "@/db";

export async function action(form: FormData) {
  "use server";

  const id = form.get("id");
  if (typeof id !== "string") {
    throw new Error();
  }

  await close(id as ConnectionId);
  redirect("/conn");
}

export default function Conn() {
  const connections = list();
  return (
    <ul>
      {connections.map(c => (
        <li key={c}>
          <form action={action}>
            <a href={`./conn/${c}`}>{c}</a>
            <input type="hidden" name="id" value={c} />
            <button type="submit">🗑️</button>
          </form>
        </li>
      ))}
    </ul>
  );
}
