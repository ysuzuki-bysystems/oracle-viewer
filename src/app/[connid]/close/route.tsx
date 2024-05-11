import { close } from "@/db";
import type { ConnectionId } from "@/db";
import { NextResponse } from "next/server";

type Props = {
  params: {
    connid: ConnectionId;
  },
}

export async function POST(_: Request, { params: { connid } }: Props): Promise<NextResponse> {
  await close(connid);
  return new NextResponse(void 0, { status: 204 });
}
