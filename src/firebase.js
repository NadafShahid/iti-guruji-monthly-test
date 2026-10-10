import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, set } from "firebase/database";

// New current database configuration (iti-guruji-bea80)
const firebaseConfig = {
  apiKey: "AIzaSyC2SPlXggk9ydQ89bSfNtZ8sDlQHAOLeDs",
  authDomain: "iti-guruji-bea80.firebaseapp.com",
  databaseURL: "https://iti-guruji-bea80-default-rtdb.firebaseio.com",
  projectId: "iti-guruji-bea80",
  storageBucket: "iti-guruji-bea80.firebasestorage.app",
  messagingSenderId: "523619690234",
  appId: "1:523619690234:web:iti_guruji_web_app"
};

// Legacy fallback database configuration (egurujik)
const fallbackFirebaseConfig = {
  apiKey: "AIzaSyAa8PXpkHULJ0cduP4d8EObM1FCzoJSn84",
  authDomain: "egurujik.firebaseapp.com",
  databaseURL: "https://egurujik-default-rtdb.firebaseio.com",
  projectId: "egurujik",
  storageBucket: "egurujik.firebasestorage.app",
  messagingSenderId: "507847442792",
  appId: "1:507847442792:web:your_web_app_id_placeholder"
};

const app = initializeApp(firebaseConfig);
const fallbackApp = initializeApp(fallbackFirebaseConfig, "fallback");

export const db = getDatabase(app);
export const fallbackDb = getDatabase(fallbackApp);
export const allDbs = [db, fallbackDb];

/**
 * Fetches data across all connected Firebase databases.
 * Returns first existing snapshot, or the primary snapshot.
 */
export async function getFromAnyDb(path) {
  let primarySnap = null;
  for (const database of allDbs) {
    try {
      const snap = await get(ref(database, path));
      if (primarySnap === null) {
        primarySnap = snap;
      }
      if (snap.exists()) {
        return snap;
      }
    } catch (e) {
      console.warn("Error reading from db for path:", path, e);
    }
  }
  return primarySnap || { exists: () => false, val: () => null };
}

/**
 * Writes data across all connected Firebase databases so both apps stay in sync.
 */
export async function saveToAllDbs(path, data) {
  const promises = allDbs.map(async (database) => {
    try {
      await set(ref(database, path), data);
    } catch (e) {
      console.warn("Error saving to db for path:", path, e);
    }
  });
  return Promise.allSettled(promises);
}
