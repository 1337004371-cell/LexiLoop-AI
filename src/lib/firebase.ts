import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth'; // 1. 导入 Google 提供者

const firebaseConfig = {
  apiKey: "AIzaSyC7Juu5jWx6nMVHX6Xp0C9Ct3048JzZCIE",
  authDomain: "gen-lang-client-0203578664.firebaseapp.com",
  projectId: "ai-studio-7d222616-f846-4337-b091-028d2c5c560a",
  storageBucket: "gen-lang-client-0203578664.firebasestorage.app",
  messagingSenderId: "100009268064",
  appId: "1:100009268064:web:3150ce2c373549e0fbc405"
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
