import { redirect } from "next/navigation";

import { allocate } from "@/db";

export const dynamic = "force-dynamic";

export async function GET(): Promise<never> {
  const id = await allocate();
  redirect(`/conn/${id}`);
}
