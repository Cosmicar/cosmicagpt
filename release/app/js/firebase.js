import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export function createSecondaryFirebaseApp() {
  const secondaryApp = initializeApp(firebaseConfig, `cosmica-secondary-${Date.now()}`);
  return {
    app: secondaryApp,
    auth: getAuth(secondaryApp),
    destroy: () => deleteApp(secondaryApp)
  };
}
