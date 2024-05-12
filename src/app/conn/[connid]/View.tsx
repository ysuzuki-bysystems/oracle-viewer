"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { PLSQL, sql } from "@codemirror/lang-sql";
import type { SQLConfig } from "@codemirror/lang-sql";
import { vim } from "@replit/codemirror-vim"
import * as cg from "cheetah-grid";

import type { Result } from "@/db";
import { execute } from "./actions";

type EditorProps = {
  sqlOpts?: Omit<SQLConfig, "dialect"> | undefined;
  initialText?: string | undefined;
  onChange?: ((text: string) => void) | undefined;
  onChangeSelection?: ((text: string | undefined) => void) | undefined;
  onCtrlEnter?: (() => void) | undefined;
}

function Editor({ initialText, onChange, onChangeSelection, onCtrlEnter, sqlOpts }: EditorProps) {
  const div = useRef<HTMLDivElement | null>(null);
  const [initialSqlOpts] = useState<EditorProps["sqlOpts"]>(sqlOpts);
  const [_initialText] = useState<string>(() => initialText ?? "");
  const [state, setState] = useState<EditorState | null>(null);
  const [view, setView] = useState<EditorView | null>(null);
  const [text, setText] = useState<string>(() => initialText ?? "");
  const [selection, setSelection] = useState<string | undefined>();

  useEffect(() => {
    setState(EditorState.create({
      doc: _initialText,
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
  }, [_initialText, initialSqlOpts]);

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

function useLocalStorage(name: string, defaultValue: string): [string | undefined, (text: string) => void] {
  const [initialName] = useState(() => name);
  const [initialDefaultValue] = useState(() => defaultValue);

  const [state, setState] = useState<string | undefined>();
  useEffect(() => {
    const result = localStorage.getItem(initialName);
    setState(result ?? initialDefaultValue);
  }, [initialName, initialDefaultValue]);

  const setValue = useCallback((text: string) => {
    localStorage.setItem(initialName, text);
  }, [initialName]);

  return [state, setValue];
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

type Props = {
  connid: string;
  objectForCompletion?: string[] | undefined;
}

export function View({ connid, objectForCompletion }: Props) {
  const form = useRef<HTMLFormElement | null>(null);
  const [sql, setSql] = useState<string | undefined>();
  const [selection, setSelection] = useState<string | undefined>();
  const [ state, dispatch ] = useFormState(execute, {});
  const { pending } = useFormStatus();

  const [persistedSql, storeSql] = useLocalStorage("oracle-view-sql", "SELECT 1 FROM DUAL");
  useEffect(() => {
    if (typeof persistedSql === "undefined") {
      return;
    }

    setSql(persistedSql);
  }, [persistedSql]);

  const sqlOpts = useMemo(() => buildCompletion(objectForCompletion), [objectForCompletion]);

  const handleSubmit = useCallback(() => {
    if (typeof sql === "undefined") {
      return;
    }

    storeSql(sql);
  }, [sql, storeSql]);

  useEffect(() => {
    const abort = new AbortController();
    window.addEventListener("beforeunload", event => {
      event.preventDefault();
      event.returnValue = "";
    }, { signal: abort.signal });
    window.addEventListener("unload", () => {
      navigator.sendBeacon(`/conn/${connid}/close`);
    }, { signal: abort.signal });
    return () => abort.abort();
  }, []);

  return (
    <main className="size-full flex flex-col gap-4">
      <nav className="flex-1 max-h-[50%]">
        {sql && <Editor initialText={sql} onChange={setSql} onChangeSelection={setSelection} onCtrlEnter={() => form.current?.requestSubmit()} sqlOpts={sqlOpts} />}
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
