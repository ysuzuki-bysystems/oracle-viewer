"use client";

import React, { SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { PLSQL, sql } from "@codemirror/lang-sql";
import type { SQLConfig } from "@codemirror/lang-sql";
import { vim } from "@replit/codemirror-vim"
import * as cg from "cheetah-grid";
import { z } from "zod";
import * as idb from "idb-keyval";

import type { Result } from "@/db";
import { execute } from "./actions";

type EditorProps = {
  sqlOpts?: Omit<SQLConfig, "dialect"> | undefined;
  text2?: string | undefined;
  onChange?: ((text: string) => void) | undefined;
  onChangeSelection?: ((text: string | undefined) => void) | undefined;
  onCtrlEnter?: (() => void) | undefined;
}

function Editor({ text2: propText, onChange, onChangeSelection, onCtrlEnter, sqlOpts }: EditorProps) {
  const div = useRef<HTMLDivElement | null>(null);
  const [initialSqlOpts] = useState<EditorProps["sqlOpts"]>(sqlOpts);
  const [state, setState] = useState<EditorState | null>(null);
  const [view, setView] = useState<EditorView | null>(null);
  const [text, setText] = useState<string>(() => propText ?? "");
  const [selection, setSelection] = useState<string | undefined>();

  useEffect(() => {
    setState(EditorState.create({
      doc: "",
      extensions: [
        keymap.of([
          {
            key: "Ctrl-Enter",
            run(view) {
              view.dom.dispatchEvent(new CustomEvent("app-ctrl-enter"));
              return true;
            },
          },
        ]),
        vim(),
        basicSetup,
        sql({ dialect: PLSQL, ...initialSqlOpts }),
        EditorView.updateListener.of(update => {
          if (!update.docChanged) {
            return;
          }

          update.view.dom.dispatchEvent(new CustomEvent("app-change-text", {
            detail: {
              text: update.state.doc.toString(),
            },
          }));
          setText(update.state.doc.toString());
        }),
        EditorView.updateListener.of(update => {
          const selection = update.state.selection.main;
          if (selection.from === selection.to) {
            setSelection(void 0);
          } else {
            setSelection(update.state.sliceDoc(selection.from, selection.to));
          }
        }),
        EditorView.theme({
          "&": {
            height: "100%",
            fontFamily: "var(--font-plex)",
          },
          ".cm-content, .cm-scroller, .cm-tooltip.cm-tooltip-autocomplete ul": {
            fontFamily: "var(--font-plex)",
          },
        }),
      ],
    }));
  }, [initialSqlOpts]);

  useEffect(() => {
    if (state === null) {
      return;
    }

    if (div.current === null) {
      throw new Error();
    }

    const view = new EditorView({
      state,
      parent: div.current,
    });
    view.focus();
    setView(view);
    return () => view.destroy();
  }, [state]);

  useEffect(() => {
    if(view === null || typeof propText === "undefined") {
      return;
    }

    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: propText,
      },
    });
  }, [view, propText]);

  useEffect(() => {
    onChange?.(text);
  }, [onChange, text]);

  useEffect(() => {
    onChangeSelection?.(selection);
  }, [onChangeSelection, selection]);

  useEffect(() => {
    if (view === null || typeof onCtrlEnter === "undefined") {
      return;
    }

    const abort = new AbortController();
    view.dom.addEventListener("app-ctrl-enter", (event) => {
      if (!(event instanceof CustomEvent)) {
        return;
      }

      onCtrlEnter();
    }, { signal: abort.signal });
    return () => abort.abort();
  }, [onCtrlEnter, view]);

  return (
    <div ref={div} autoFocus className="h-full" />
  );
}

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

type TabViewProps = {
  children: React.ReactNode[];
}

function TabView({ children }: TabViewProps) {
  const [index, setIndex] = useState<number>(0);
  useEffect(() => {
    setIndex(0);
  }, [children.length]);
  const tabs = useMemo(() => Array.from({ length: children.length }).map((_, i) => i), [children]);

  if (children.length === 0) {
    return <></>;
  }
  if (children.length === 1) {
    return <>{children[0]}</>
  }

  return (
    <section className="flex flex-col h-full">
      <div className="flex-nome flex gap-4 mx-4">
        {tabs.map(i => i !== index && <a key={i} href="#" onClick={event => { event.preventDefault(); setIndex(i)}}>{i}</a> || <React.Fragment key={i}>{i}</React.Fragment>)}
      </div>
      <div className="flex-1">
        {children[index]}
      </div>
    </section>
    );
}

function buildCompletion(objects: string[] | undefined): Omit<SQLConfig, "dialect"> | undefined {
  if (typeof objects === "undefined") {
    return;
  }

  return {
    // tableではなく、schemaがテーブル部分の保管にまず利用される
    schema: objects.map(v => ({
      displayLabel: v,
      label: `${v} `,
      type: "type",
      boost: 99,
    })),
  }
}

const zStorageRecord = z.object({
  name: z.string(),
  createdAt: z.number(),
  data: z.string(),
});

const zStorage = z.object({
  records: zStorageRecord.array(),
});

type UseStorageResult = {
  items: z.infer<typeof zStorageRecord>[] | undefined;
  latest: z.infer<typeof zStorageRecord> | null | undefined;
  add: ((event: z.infer<typeof zStorageRecord>) => void) | undefined;
}

function useStorage(): UseStorageResult {
  const [state, setState] = useState<z.infer<typeof zStorage> | undefined>();
  const [items, setItems] = useState<z.infer<typeof zStorageRecord>[] | undefined>();
  const [latest, setLatest] = useState<z.infer<typeof zStorageRecord> | null | undefined>();
  const [add, setAdd] = useState<UseStorageResult["add"]>();

  useEffect(() => {
    const abort = new AbortController();
    (async () => {
      const result = await idb.get("storage");
      if (abort.signal.aborted) {
        return;
      }

      if (typeof result === "undefined") {
        setState({ records: [] });
        setLatest(null);
        return;
      }

      const parsed = zStorage.safeParse(result);
      if (!parsed.success) {
        setState({ records: [] });
        setLatest(null);
        return;
      }

      setState(parsed.data);
      setLatest(parsed.data.records.at(-1) ?? null);
    })();
    return () => abort.abort();
  }, []);

  useEffect(() => {
    if (typeof state === "undefined") {
      return;
    }

    setItems(state.records);
  }, [state]);

  useEffect(() => {
    if (typeof state === "undefined") {
      setAdd(void 0);
      return;
    }

    const abort = new AbortController();
    setAdd(() => (value: z.infer<typeof zStorageRecord>) => {
      (async () => {
        setState(void 0);

        if (state.records.some(r => r.data === value.data)) {
          setState(state);
          return;
        }

        const newData: z.infer<typeof zStorage> = {
          records: [...state.records, value],
        }
        while (newData.records.length > 100) {
          newData.records.shift();
        }
        await idb.set("storage", newData);
        setState(newData);
      })();
    });
    return () => abort.abort();
  }, [state]);

  return { items, latest, add };
}

type Props = {
  connid: string;
  objectForCompletion?: string[] | undefined;
}

export function View({ connid, objectForCompletion }: Props) {
  const {
    items,
    latest,
    add: addStorage,
  } = useStorage();

  const form = useRef<HTMLFormElement | null>(null);
  const [sql, setSql] = useState<string | undefined>();
  const [text2, setText2] = useState<string | undefined>();
  const [selection, setSelection] = useState<string | undefined>();
  const [ state, dispatch ] = useFormState(execute, {});
  const { pending } = useFormStatus();

  useEffect(() => {
    if (typeof latest === "undefined") {
      return;
    }

    setText2(latest?.data ?? "SELECT 1 FROM DUAL");
  }, [latest]);

  const sqlOpts = useMemo(() => buildCompletion(objectForCompletion), [objectForCompletion]);

  const handleSubmit = useCallback(() => {
    if (typeof sql === "undefined" || typeof addStorage === "undefined") {
      return;
    }

    const now = new Date();
    addStorage({
      name: now.toISOString(),
      createdAt: now.getTime(),
      data: sql,
    });
  }, [sql, addStorage]);

  const handleLoad = useCallback((event: SyntheticEvent<HTMLAnchorElement>) => {
    event.preventDefault();

    const data = event.currentTarget.dataset["data"];
    setText2(data ?? "");
  }, []);

  return (
    <main className="size-full flex flex-col gap-4">
      <nav className="flex-1 max-h-[50%] flex">
        <div className="flex-1">
          <Editor text2={text2} onChange={setSql} onChangeSelection={setSelection} onCtrlEnter={() => form.current?.requestSubmit()} sqlOpts={sqlOpts} />
        </div>
        <div className="flex-2 w-1/4 overflow-y-auto overflow-x-hidden">
          <ul className="mx-4 pb-4">
          {items && items.toReversed().map(r => (
            <li key={r.name}>
              <span className="relative group">
                <a href={`#${r.name}`} onClick={handleLoad} data-data={r.data}>{r.name}</a>
                <div className="absolute z-10 bg-white hidden group-hover:block transition pointer-events-none outline outline-1 p-2">
                  <pre>{r.data}</pre>
                </div>
              </span>
            </li>
          ))}
          </ul>
        </div>
        <form action={dispatch} ref={form} onSubmit={handleSubmit}>
          <input type="hidden" name="sql" value={selection ?? sql ?? ""} readOnly />
          <input type="hidden" name="connid" value={connid} />
        </form>
      </nav>
      <div className="flex-1 max-h-[50%]">
        {pending && <>...</> || <>
          {state.err && <pre className="font-mono">{state.err}</pre>}
          {typeof state.result?.rowsAffected === "number" && <output>rows affected: {state.result.rowsAffected}</output>}
          {state.result?.data && (
            <TabView>
              {state.result.data.map((data, i) => <ResultDataView key={i} result={data} />)}
            </TabView>
          )}
        </>}
      </div>
    </main>
  );
}
