import { redirect } from "next/navigation";

import { allocate } from "@/db";

export async function GET(): Promise<never> {
  const id = await allocate();
  redirect(`/${id}`);
}
