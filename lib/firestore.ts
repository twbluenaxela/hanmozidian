import { getFirestore } from "firebase/firestore";
import { app } from "@/lib/firebase";

// Firestore is split into its own module so that pages which only need auth
// (or no Firebase at all) don't pull the Firestore SDK into their bundle.
// Only favorites + savedJizi import this.
export const db = getFirestore(app);
