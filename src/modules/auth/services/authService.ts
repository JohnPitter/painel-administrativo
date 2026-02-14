import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';

import { app } from '@core/config/firebase';

const auth = getAuth(app);

const login = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

const logout = () => signOut(auth);

const observeAuth = (callback: Parameters<typeof onAuthStateChanged>[1]) =>
  onAuthStateChanged(auth, callback);

const register = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password);

const applyDisplayName = (user: User, displayName: string) => updateProfile(user, { displayName });

export { auth, login, logout, observeAuth, register, applyDisplayName };
