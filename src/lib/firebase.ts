import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
console.log("API KEY CHECK:", "AIzaSyC7Juu5jWx6nMVHX6Xp0C9Ct3048JzZCIE");

const firebaseConfig = {
  apiKey: "AIzaSyC7Juu5jWx6nMVHX6Xp0C9Ct3048JzZCIE",
  authDomain: "gen-lang-client-0203578664.firebaseapp.com",
  projectId: "gen-lang-client-0203578664",
  storageBucket: "gen-lang-client-0203578664.firebasestorage.app",
  messagingSenderId: "100009268064",
  appId: "1:100009268064:web:3150ce2c373549e0fbc405",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { app, db, auth, googleProvider };
