import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signOut,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { fetchMe, loginWithBackend } from "../api/client";

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize and restore session
  useEffect(() => {
    const initAuth = async () => {
      // Check Firebase state
      if (auth) {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser) {
            try {
              const profile = await fetchMe();
              setUser(profile);
            } catch (err) {
              console.warn("Firebase session restore failed, signing out:", err);
              await signOut(auth);
              setUser(null);
            }
          } else {
            setUser(null);
          }
          setLoading(false);
        });

        return () => unsubscribe();
      } else {
        setUser(null);
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const loginWithGoogle = async (claimedRole) => {
    if (!auth || !googleProvider) {
      throw new Error("Firebase Authentication is not initialized. Please check configuration.");
    }
    const result = await signInWithPopup(auth, googleProvider);
    try {
      const idToken = await result.user.getIdToken(true);
      const userProfile = await loginWithBackend(claimedRole, idToken);
      setUser(userProfile);
      return userProfile;
    } catch (err) {
      await signOut(auth);
      setUser(null);
      throw err;
    }
  };

  const formatFirebasePassword = (pwd) => {
    if (!pwd) return "";
    return pwd.length < 6 ? pwd.padEnd(6, "0") : pwd;
  };

  const loginWithEmail = async (email, password, claimedRole) => {
    if (!auth) {
      throw new Error("Firebase Authentication is not initialized. Please check configuration.");
    }
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = formatFirebasePassword(password);

    let userCredential;
    try {
      userCredential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
    } catch (signInErr) {
      // If user does not exist in Firebase yet, auto-register them
      if (
        signInErr.code === "auth/user-not-found" ||
        signInErr.code === "auth/invalid-credential" ||
        signInErr.code === "auth/invalid-login-credentials"
      ) {
        try {
          userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
        } catch {
          throw signInErr;
        }
      } else {
        throw signInErr;
      }
    }

    try {
      const idToken = await userCredential.user.getIdToken(true);
      const userProfile = await loginWithBackend(claimedRole, idToken);
      setUser(userProfile);
      return userProfile;
    } catch (err) {
      await signOut(auth);
      setUser(null);
      throw err;
    }
  };

  const registerWithEmail = async (email, password, claimedRole) => {
    if (!auth) {
      throw new Error("Firebase Authentication is not initialized. Please check configuration.");
    }
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = formatFirebasePassword(password);
    const result = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
    try {
      const idToken = await result.user.getIdToken(true);
      const userProfile = await loginWithBackend(claimedRole, idToken);
      setUser(userProfile);
      return userProfile;
    } catch (err) {
      await signOut(auth);
      setUser(null);
      throw err;
    }
  };

  const logout = async () => {
    localStorage.removeItem("siteverify_token");
    if (auth) {
      try {
        await signOut(auth);
      } catch {
        // ignore
      }
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
