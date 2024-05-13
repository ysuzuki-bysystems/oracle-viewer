"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

export default function Layout({
  children
}: {
  children: React.ReactNode;
}) {
  const { connid } = useParams();

  return (
    <div className="size-full flex flex-col">
      <nav className="flex-none flex gap-4 px-4 py-2">
        <Link href="/conn">connections</Link>
        <span>&gt;</span>
        <span>{ connid }</span>
        <span>&gt;</span>
        <Link href={`/conn/${connid}`}>Query</Link>
        <span>|</span>
        <Link href={`/conn/${connid}/ddl`}>DDL</Link>
        <span>|</span>
        <Link href={`/conn/${connid}/def`}>DEF</Link>
      </nav>
      <main className="flex-1 max-h-[100%]">{children}</main>
    </div>
  );
}
