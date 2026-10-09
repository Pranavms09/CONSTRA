import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { type UserProfile, loginWithBackend, fetchMe } from "../api/client";

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (claimedRole: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Restore backend session
          const profile = await fetchMe();
          setUser(profile);
        } catch (err) {
          console.warn("Session restore failed, signing out:", err);
          await signOut(auth);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (claimedRole: string): Promise<UserProfile> => {
    // 1. Popup Google Sign-In
    const result = await signInWithPopup(auth, googleProvider);
    // 2. Get ID token
    const idToken = await result.user.getIdToken();
    try {
      // 3. Backend verifies claimed_role and allowlist
      const backendUser = await loginWithBackend(claimedRole, idToken);
      setUser(backendUser);
      return backendUser;
    } catch (err) {
      // 4. On failure, immediately sign out of Firebase
      await signOut(auth);
      setUser(null);
      throw err;
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
