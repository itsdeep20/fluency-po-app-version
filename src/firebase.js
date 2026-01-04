// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAmNWTJqi_kC799CLCOHyRI7BfsEyZeE5I",
    authDomain: "project-fluency-ai-pro-d3189.firebaseapp.com",
    projectId: "project-fluency-ai-pro-d3189",
    storageBucket: "project-fluency-ai-pro-d3189.firebasestorage.app",
    messagingSenderId: "1012349805984",
    appId: "1:1012349805984:web:c60325a31575b6df72b0c5",
    measurementId: "G-X5MR5J96Z6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);
const analytics = getAnalytics(app);

export { auth, db, functions, analytics };
