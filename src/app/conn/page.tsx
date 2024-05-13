
import { list } from "@/db";

import { action } from "./actions";

export const dynamic = "force-dynamic";

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
