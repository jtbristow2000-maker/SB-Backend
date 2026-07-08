"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";

// Sticky save control for the Settings form. Hidden until something actually
// changes; then a floating pill appears with a Save button, shows a saving
// state while the server action runs, and flashes "Saved" before hiding again.
// Must be rendered INSIDE the <form> (useFormStatus reads the parent form).

function serialize(form: HTMLFormElement): string {
  const parts: string[] = [];
  for (const [k, v] of new FormData(form).entries()) {
    if (typeof v === "string") parts.push(`${k}=${v}`);
  }
  return parts.join("\n");
}

export function SettingsSaveBar({ formId }: { formId: string }) {
  const { pending } = useFormStatus();
  const [dirty, setDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const baseline = useRef<string | null>(null);
  const wasPending = useRef(false);

  // Track dirtiness from the form's own input/change events.
  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    baseline.current = serialize(form);
    const recompute = () => {
      if (baseline.current === null) return;
      setDirty(serialize(form) !== baseline.current);
    };
    form.addEventListener("input", recompute);
    form.addEventListener("change", recompute);
    return () => {
      form.removeEventListener("input", recompute);
      form.removeEventListener("change", recompute);
    };
  }, [formId]);

  // When a save finishes (pending true → false), reset the baseline + flash "Saved".
  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      return;
    }
    if (!wasPending.current) return;
    wasPending.current = false;
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (form) baseline.current = serialize(form);
    setDirty(false);
    setJustSaved(true);
    const t = setTimeout(() => setJustSaved(false), 2200);
    return () => clearTimeout(t);
  }, [pending, formId]);

  if (!dirty && !pending && !justSaved) return null;

  return (
    <div className="savebar" role="status">
      {justSaved && !dirty && !pending ? (
        <span className="savebar-saved"><Check size={15} strokeWidth={3} aria-hidden /> Saved</span>
      ) : (
        <>
          <span>Unsaved changes</span>
          <button type="submit" className="savebar-btn btn" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
        </>
      )}
    </div>
  );
}
