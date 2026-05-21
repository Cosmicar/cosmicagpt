export const firebaseConfig = {
  apiKey: "AIzaSyBgRCLYvSPLG4PIqPjHFGsPhu0EoxTLKCU",
  authDomain: "cosmica-clientes.firebaseapp.com",
  projectId: "cosmica-clientes",
  storageBucket: "cosmica-clientes.appspot.com",
  messagingSenderId: "875572379632",
  appId: "1:875572379632:web:db73498c6ffc9ec679a735"
};

export const APP_ROUTES = {
  login: "login.html",
  // After successful login, send operators to the SaaS (official platform).
  // Legacy /panel.html stays accessible at its URL for historical consultation.
  panel: "apps/cosmica-app/",
  saas:  "apps/cosmica-app/",
  legacy: "panel.html"
};

// Versión semántica del SaaS. Bump manual con cada release relevante.
//   MAJOR: cambios de modelo de datos o ruptura de API
//   MINOR: features nuevas (modelo contable, KPIs, módulos)
//   PATCH: bugfixes, ajustes UI
export const APP_VERSION = "1.1.0";
