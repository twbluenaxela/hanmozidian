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

export async function deleteSavedJizi(uid: string, id: string) {
  await deleteDoc(doc(db, "users", uid, "savedJizi", id));
}

export function useSavedJizi(uid: string | null) {
  const [saved, setSaved] = useState<SavedJizi[]>([]);

  useEffect(() => {
    if (!uid) {
      setSaved([]);
      return;
    }
    const r = query(savedJiziCol(uid), orderBy("savedAt", "desc"));
    const unsubscribe = onSnapshot(r, (snap) => {
      setSaved(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as SavedJizi))
      );
    });
    return unsubscribe;
  }, [uid]);

  return saved;
}
