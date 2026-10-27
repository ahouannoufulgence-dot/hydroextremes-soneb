"use client";

import { useCallback, useSyncExternalStore } from "react";
import { TEST_DATASET, type StoredDataset } from "@/lib/dataset";

const KEY = "hydroextremes.datasets.v1";

interface State {
  datasets: StoredDataset[];
  activeId: string;
}

const EMPTY: State = { datasets: [], activeId: TEST_DATASET.id };
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedState: State = EMPTY;

function read(): State {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    /* stockage indisponible (navigation privée, etc.) : on reste en mémoire */
  }
  if (raw === cachedRaw) return cachedState;
  cachedRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as State) : EMPTY;
    cachedState = Array.isArray(parsed.datasets) ? parsed : EMPTY;
  } catch {
    cachedState = EMPTY;
  }
  return cachedState;
}

function write(next: State) {
  const raw = JSON.stringify(next);
  try {
    window.localStorage.setItem(KEY, raw);
  } catch {
    // Repli : mémoire seulement pour cette session.
  }
  cachedRaw = raw;
  cachedState = next;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useDatasets() {
  const state = useSyncExternalStore(subscribe, read, () => EMPTY);
  const all = [TEST_DATASET, ...state.datasets];
  const active = all.find((d) => d.id === state.activeId) ?? TEST_DATASET;

  const setActive = useCallback((id: string) => write({ ...read(), activeId: id }), []);
  const add = useCallback((ds: StoredDataset) => {
    const cur = read();
    // Un même nom de station + variable remplace l'import précédent.
    const rest = cur.datasets.filter((d) => !(d.name === ds.name && d.kind === ds.kind));
    write({ datasets: [...rest, ds], activeId: ds.id });
  }, []);
  const remove = useCallback((id: string) => {
    const cur = read();
    write({ datasets: cur.datasets.filter((d) => d.id !== id), activeId: cur.activeId === id ? TEST_DATASET.id : cur.activeId });
  }, []);

  return { datasets: all, active, setActive, add, remove };
}
