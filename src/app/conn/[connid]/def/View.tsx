"use client";

import { SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useFormState } from "react-dom";
import * as cg from "cheetah-grid";

import type { Result } from "@/db";
import { get } from "./actions";

function ResultDataView({ result: { metadata, rows } }: { result: Required<Result>["data"][number] }) {
  const div = useRef<HTMLDivElement | null>(null);
  const [grid, setGrid] = useState<cg.ListGrid<unknown[]> | null>(null);

  useEffect(() => {
    if (div.current === null) {
      throw new Error();
    }

    const grid = new cg.ListGrid<unknown[]>({
      parentElement: div.current,
    });
    setGrid(grid);
    return () => grid.dispose();
  }, []);

  useEffect(() => {
    if (grid === null) {
      return;
    }

    grid.header = metadata.map((v, i) => ({
      caption: v.name,
      field: (data) => data[i],
      sort: true,
      width: "16em",
    }));
    grid.invalidate();
  }, [grid, metadata]);

  useEffect(() => {
    if (grid === null) {
      return;
    }

    grid.dataSource = new cg.data.DataSource({
      get: (i) => rows[i],
      length: rows.length,
      source: rows,
    });
  }, [grid, rows]);

  return <div ref={div} className="h-full"></div>;
}

export type Procedure = {
  owner: string;
  package: string;
  name: string;
  overload?: string | undefined;
  objectId: number;
  subprogramId: number;
}

type Props = {
  connid: string;
  procedures: Procedure[];
}

function indexByOwnerPackage(procs: Procedure[]): Record<string, Procedure[]> {
  const result: ReturnType<typeof indexByOwnerPackage> = {};

  for (const proc of procs) {
    const name = `${proc.owner}.${proc.package}`;
    (result[name] ??= []).push(proc);
  }

  return result;
}

export function View({ connid, procedures }: Props) {
  const [state, dispatch] = useFormState(get, {});
  const indexedProc = useMemo(() => indexByOwnerPackage(procedures), [procedures]);

  const handleClick = useCallback((event: SyntheticEvent<HTMLAnchorElement>) => {
    event.preventDefault();

    const form = event.currentTarget.closest("form");
    if (!(form instanceof HTMLFormElement)) {
      throw new Error("Unexpected");
    }

    form.requestSubmit();
  }, []);

  return (
    <div className="size-full flex">
      <nav className="flex-none p-4 overflow-auto">
        <div className="size-full">
          <h1>PROCEDURES</h1>
          {Object.entries(indexedProc).map(([name, values]) => (
            <details key={name} className="cursor-pointer">
              <summary>{name} ({values.length})</summary>
              <ul className="pl-4">
                {values.map((proc) => (
                  <form key={proc.subprogramId} action={dispatch}>
                    <input type="hidden" name="type" value="PROCEDURE" />
                    <input type="hidden" name="connid" value={connid} />
                    <input type="hidden" name="object_id" value={proc.objectId} />
                    <input type="hidden" name="subprogram_id" value={proc.subprogramId} />
                    {proc.objectId === state.objectId && proc.subprogramId === state.subprogramId ?
                    <b>{proc.name}{proc.overload && <> (${proc.overload})</>}</b> :
                    <a href="#" onClick={handleClick}>{proc.name}{proc.overload && <> (${proc.overload})</>}</a>}
                  </form>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </nav>
      <div className="flex-1">
        {state.data && <ResultDataView result={state.data} />}
      </div>
    </div>

  );
}
