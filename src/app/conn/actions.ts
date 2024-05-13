import { redirect } from "next/navigation";

import { close } from "@/db";
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
