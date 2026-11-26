import { firebaseConfig } from "./firebase-config.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signInAnonymously, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getDatabase, ref, set, update, get, onValue, push, remove, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

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
export const studentSignIn = async () => {
  needFirebase();
  // Wait until Firebase restores the browser's persisted anonymous identity.
  // Otherwise a fast page refresh can create a new UID and lose the student's
  // existing player record and local checkpoint association.
  if (typeof auth.authStateReady === "function") await auth.authStateReady();
  return auth.currentUser || (await signInAnonymously(auth)).user;
};
export const teacherSignOut = async () => { needFirebase(); return signOut(auth); };
export const watchAuth = callback => { needFirebase(); return onAuthStateChanged(auth, callback); };
export const dbRef = path => { needFirebase(); return ref(db, path); };
export const dbGet = path => get(dbRef(path));
export const dbSet = (path, value) => set(dbRef(path), value);
export const dbUpdate = (path, value) => update(dbRef(path), value);
export const dbRemove = path => remove(dbRef(path));
export const dbPush = path => push(dbRef(path));
export const dbWatch = (path, callback, onError) => onValue(dbRef(path), callback, onError);
export const newKey = path => dbPush(path).key;
