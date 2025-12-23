// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 請替換成你的 Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyCw7o8V-QW5M9Px7lcx4hOCAxW7oNKLhak",
  authDomain: "runninglog-8da12.firebaseapp.com",
  projectId: "runninglog-8da12",
  storageBucket: "runninglog-8da12.firebasestorage.app",
  messagingSenderId: "600035565062",
  appId: "1:600035565062:web:5ae746eadd2b0c6d5c6d87"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, writeBatch };
