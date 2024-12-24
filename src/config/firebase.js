import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDiY70Ni4eCoDFti-pZUKFdnLvK3Or3K5k",
  authDomain: "insights-b4135.firebaseapp.com",
  projectId: "insights-b4135",
  storageBucket: "insights-b4135.firebasestorage.app",
  messagingSenderId: "743769197754",
  appId: "1:743769197754:web:b97aed51cbb980c433c683",
  measurementId: "G-WWPCH3VC6J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const analytics = getAnalytics(app);

export default app;
