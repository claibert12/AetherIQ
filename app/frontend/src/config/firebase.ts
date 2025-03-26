import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
    apiKey: "AIzaSyA9Rt9WAlZPDtD5tIsbzgY_iW0xiu9qrOU",
    authDomain: "aetheriq-f6a9e.firebaseapp.com",
    projectId: "aetheriq-f6a9e",
    storageBucket: "aetheriq-f6a9e.firebasestorage.app",
    messagingSenderId: "490606027622",
    appId: "1:490606027622:web:bbd1d0ac99c13f2161dea7",
    measurementId: "G-FT1TRSLLV4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const analytics = getAnalytics(app);

export { app, analytics }; 