import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import { demoLoginApi, fetchMe } from "../api/client";

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize and restore session
  useEffect(() => {
    const initAuth = async () => {
      const demoToken = localStorage.getItem("siteverify_token");
      if (demoToken) {
        try {
          const profile = await fetchMe();
          setUser(profile);
          setLoading(false);
          return;
        } catch (err) {
          console.warn("Demo session restore failed, clearing token:", err);
          localStorage.removeItem("siteverify_token");
        }
      }

      // Check Firebase state if no active demo token
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
    };

    initAuth();
  }, []);

  const loginDemo = async (role) => {
    try {
      const loggedUser = await demoLoginApi(role);
      setUser(loggedUser);
      return loggedUser;
    } catch (err) {
      localStorage.removeItem("siteverify_token");
      setUser(null);
      throw err;
    }
  };

  const logout = async () => {
    localStorage.removeItem("siteverify_token");
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginDemo, logout }}>
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
