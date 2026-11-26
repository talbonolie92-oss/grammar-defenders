import { firebaseConfig } from "./firebase-config.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signInAnonymously, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getDatabase, ref, set, update, get, onValue, push, remove, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const configured = Boolean(firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("PASTE_") && firebaseConfig.projectId && !firebaseConfig.projectId.startsWith("PASTE_") && firebaseConfig.databaseURL && !firebaseConfig.databaseURL.includes("PASTE_PROJECT_ID"));
let app = null, auth = null, db = null;
if (configured) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getDatabase(app);
}
const needFirebase = () => { if (!configured || !auth || !db) throw new Error("Firebase is not configured yet. Add the project settings in src/firebase-config.js."); };
export const firebaseReady = configured;
export const firebaseAuth = auth;
export const firebaseDb = db;
export const timestamp = () => serverTimestamp();
export const teacherSignIn = async (email, password) => { needFirebase(); return signInWithEmailAndPassword(auth, email, password); };
let studentSignInPromise = null;
export const studentSignIn = () => {
  needFirebase();
  // Serialize automatic resume and manual join so simultaneous calls cannot
  // race two anonymous sign-in operations and produce mismatched player IDs.
  if (studentSignInPromise) return studentSignInPromise;
  const pending = (async () => {
    if (typeof auth.authStateReady === "function") await auth.authStateReady();
    if (auth.currentUser?.isAnonymous) return auth.currentUser;
    // A teacher account in this browser must not become the student's player ID.
    if (auth.currentUser) await signOut(auth);
    return (await signInAnonymously(auth)).user;
  })();
  studentSignInPromise = pending;
  pending.then(
    () => { if (studentSignInPromise === pending) studentSignInPromise = null; },
    () => { if (studentSignInPromise === pending) studentSignInPromise = null; }
  );
  return pending;
};
export const teacherSignOut = async () => { needFirebase(); return signOut(auth); };
export const watchAuth = callback => { needFirebase(); return onAuthStateChanged(auth, callback); };
export const dbRef = path => { needFirebase(); return ref(db, path); };
export const dbGet = path => get(dbRef(path));
export const dbSet = (path, value) => set(dbRef(path), value);
export const dbUpdate = (path, value) => update(dbRef(path), value);
export const dbRemove = path => remove(dbRef(path));
export const dbTransaction = (path, updater) => runTransaction(dbRef(path), updater, { applyLocally: false });
export const dbPush = path => push(dbRef(path));
export const dbWatch = (path, callback, onError) => onValue(dbRef(path), callback, onError);
export const newKey = path => dbPush(path).key;
