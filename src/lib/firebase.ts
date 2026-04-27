import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth'; // 1. 导入 Google 提供者

const firebaseConfig = {
  apiKey: "AIzaSyAr35y3_waA2r8VyrSvi-OPEbOe_vZgaxE",
  authDomain: "lexiloop-new.firebaseapp.com",
  projectId: "lexiloop-new",
  storageBucket: "lexiloop-new.firebasestorage.app",
  messagingSenderId: "474947903122",
  appId: "1:474947903122:web:e093ebaa5483d0da07104b"
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
