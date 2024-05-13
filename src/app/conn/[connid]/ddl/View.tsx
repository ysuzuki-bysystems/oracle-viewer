"use client";

import React, { SyntheticEvent, useCallback, useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";

import { basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { PLSQL, sql } from "@codemirror/lang-sql";

import { getDdl } from "./actions";

type EditorProps = {
  text: string | undefined;
}

function Editor({ text }: EditorProps) {
  const div = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<EditorState | null>(null);
  const [view, setView] = useState<EditorView | null>(null);

  useEffect(() => {
    setState(EditorState.create({
      doc: "",
      extensions: [
        basicSetup,
        sql({ dialect: PLSQL }),
        EditorView.theme({
          "&": {
            height: "100%",
            overflow: "auto",
            fontFamily: "var(--font-plex)",
          },
          ".cm-content, .cm-scroller, .cm-tooltip.cm-tooltip-autocomplete ul": {
            fontFamily: "var(--font-plex)",
          },
        }),
        EditorState.readOnly.of(true),
      ],
    }));
  }, []);

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
    setView(view);
    return () => view.destroy();
  }, [state]);

  useEffect(() => {
    if(view === null) {
      return;
    }

    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: text,
      },
    });
  }, [view, text]);

  return <div ref={div} className="size-full"></div>;
}

type Props = {
  connid: string;
  objects: Record<string, [string, string][]>;
}

export function View({ connid, objects }: Props) {
  const [ state, dispatch ] = useFormState(getDdl, {});

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
          {Object.entries(objects).map(([ty, values]) => (
            <details key={ty} className="cursor-pointer">
              <summary>{ty} ({values.length})</summary>
              <ul className="pl-4">
                {values.map(([s, p]) => (
                  <form key={`${s}.${p}`} action={dispatch}>
                    <input type="hidden" name="connid" value={connid} />
                    <input type="hidden" name="type" value={ty} />
                    <input type="hidden" name="owner" value={s} />
                    <input type="hidden" name="package" value={p} />
                    {state.type === ty && state.owner === s && state.pkg === p ?
                    <b>{s}.{p}</b> :
                    <a href="#" onClick={handleClick}>{s}.{p}</a>}
                  </form>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </nav>
      <div className="flex-1">
        <Editor text={state.error ?? state.ddl}/>
      </div>
    </div>
  );
}
