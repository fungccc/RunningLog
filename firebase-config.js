// firebase-config.js
// 請務必在 HTML 中引入 firebase-app-compat.js, firebase-auth-compat.js, firebase-firestore-compat.js

const firebaseConfig = {
  apiKey: "AIzaSyCw7o8V-QW5M9Px7lcx4hOCAxW7oNKLhak",
  authDomain: "runninglog-8da12.firebaseapp.com",
  projectId: "runninglog-8da12",
  storageBucket: "runninglog-8da12.firebasestorage.app",
  messagingSenderId: "600035565062",
  appId: "1:600035565062:web:5ae746eadd2b0c6d5c6d87"
};

// 初始化
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// 監聽登入狀態 (全域)
auth.onAuthStateChanged(user => {
    if (user) {
        console.log("User logged in:", user.uid);
        // 這裡可以做更新 lastLoginAt 的邏輯
    } else {
        console.log("User logged out");
    }
});
