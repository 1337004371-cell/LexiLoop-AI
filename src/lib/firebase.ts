import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth'; // 1. 导入 Google 提供者

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

// 导出数据库
export const db = getFirestore(app);

// 导出身份验证模块
export const auth = getAuth(app);

// 导出 Google 登录提供者 (修复当前报错的关键)
export const googleProvider = new GoogleAuthProvider(); 

// 可选：配置 Google 登录总是弹出账号选择框
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
