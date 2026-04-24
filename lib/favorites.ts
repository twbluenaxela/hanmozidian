"use client";

import { useEffect, useState } from "react";
import {
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface FavoriteImage {
  id: number;
  imagePath: string;
  imageUrl: string;
  character: string;
  styleSlug: string;
  calligrapherName: string | null;
}

export interface Favorite extends FavoriteImage {
  savedAt: unknown;
}

function favoriteDoc(uid: string, imageId: number) {
  return doc(db, "users", uid, "favorites", String(imageId));
}

/** Writes an image to the user's favorites subcollection with a server timestamp. */
export async function addFavorite(uid: string, image: FavoriteImage) {
  await setDoc(favoriteDoc(uid, image.id), {
    imageId: image.id,
    imagePath: image.imagePath,
    imageUrl: image.imageUrl,
    character: image.character,
    styleSlug: image.styleSlug,
    calligrapherName: image.calligrapherName,
    savedAt: serverTimestamp(),
  });
}

/** Deletes a single favorite document. No-op if the document doesn't exist. */
export async function removeFavorite(uid: string, imageId: number) {
  await deleteDoc(favoriteDoc(uid, imageId));
}

/**
 * Live-synced list of the user's favorited images via Firestore onSnapshot.
 * Returns an empty array and cleans up the listener when uid is null (logged out).
 */
export function useFavorites(uid: string | null) {
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  useEffect(() => {
    if (!uid) {
      setFavorites([]);
      return;
    }
    const ref = collection(db, "users", uid, "favorites");
    const unsubscribe = onSnapshot(ref, (snap) => {
      setFavorites(
        snap.docs.map((d) => {
          const data = d.data();
          return { ...data, id: data.imageId } as Favorite;
        })
      );
    });
    return unsubscribe;
  }, [uid]);

  return favorites;
}
