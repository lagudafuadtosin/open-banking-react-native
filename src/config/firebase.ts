import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { FIREBASE_WEB_API_KEY } from '@env';

const firebaseConfig = {
  apiKey: FIREBASE_WEB_API_KEY,
  authDomain: "truelayerbankingapp.firebaseapp.com",
  projectId: "truelayerbankingapp",
  storageBucket: "truelayerbankingapp.appspot.com",
  messagingSenderId: "1062288385091",
  appId: "1:1062288385091:android:0c2e9492b1dcceaacfa0f6",
  measurementId: "G-TS1RJK3S67"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export { firebase, auth, firestore };