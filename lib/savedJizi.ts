"use client";

import { useEffect, useState } from "react";
import {
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
  serverTimestamp,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export const MAX_SAVED_JIZI = 10;

export interface SavedJiziData {
  text: string;
  style: string;
  calligraphers: number[];
  works: number[];
  orientation: "horizontal" | "vertical";
  gridSize: number;
  gap: number;
  paperId: string;
  composition: Record<string, unknown>;
  thumbnail?: string;
}

export interface SavedJizi extends SavedJiziData {
  id: string;
  savedAt: unknown;
}

function savedJiziCol(uid: string) {
  return collection(db, "users", uid, "savedJizi");
}

/**
 * Persists a jizi composition to Firestore. Enforces the MAX_SAVED_JIZI cap
 * and returns `{ error }` rather than throwing so callers can show UI feedback.
 */
export async function saveJizi(
  uid: string,
  data: SavedJiziData
): Promise<{ error?: string }> {
  const snap = await getDocs(savedJiziCol(uid));
  if (snap.size >= MAX_SAVED_JIZI) {
    return { error: `最多只能儲存 ${MAX_SAVED_JIZI} 個集字作品` };
  }
  const id = crypto.randomUUID();
  // JSON round-trip strips undefined values which Firestore rejects
  const sanitized = JSON.parse(JSON.stringify(data));
  await setDoc(doc(db, "users", uid, "savedJizi", id), {
    ...sanitized,
    savedAt: serverTimestamp(),
  });
  return {};
}

/** Deletes a saved jizi composition by its Firestore document id. */
export async function deleteSavedJizi(uid: string, id: string) {
  await deleteDoc(doc(db, "users", uid, "savedJizi", id));
}

/**
 * Live-synced list of the user's saved jizi compositions, ordered newest-first.
 * Returns an empty array and cleans up the listener when uid is null.
 */
export function useSavedJizi(uid: string | null) {
  const [saved, setSaved] = useState<SavedJizi[]>([]);

  useEffect(() => {
    if (!uid) {
      setSaved([]);
      return;
    }
    const q = query(savedJiziCol(uid), orderBy("savedAt", "desc"));
    const unsubscribe = onSnapshot(q, (snap) => {
      setSaved(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as SavedJizi))
      );
    });
    return unsubscribe;
  }, [uid]);

  return saved;
}
