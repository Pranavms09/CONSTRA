import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signOut,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { fetchMe, loginWithBackend, demoLoginApi } from "../api/client";

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("siteverify_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      return !localStorage.getItem("siteverify_user");
    } catch {
      return true;
    }
  });

  const saveUser = (profile) => {
    if (profile) {
      localStorage.setItem("siteverify_user", JSON.stringify(profile));
      if (profile.token) {
        localStorage.setItem("siteverify_token", profile.token);
      } else if (profile.role && !localStorage.getItem("siteverify_token")) {
        localStorage.setItem("siteverify_token", `demo-${profile.role}`);
      }
    } else {
      localStorage.removeItem("siteverify_user");
      localStorage.removeItem("siteverify_token");
    }
    setUser(profile);
  };

  // Initialize and restore session
  useEffect(() => {
    let isSubscribed = true;

    const initAuth = async () => {
      // Check Firebase state
      if (auth) {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (!isSubscribed) return;

          if (firebaseUser) {
            try {
              const idToken = await firebaseUser.getIdToken();
              localStorage.setItem("siteverify_token", idToken);
              const profile = await fetchMe();
              if (isSubscribed && profile) {
                saveUser(profile);
              }
            } catch (err) {
              console.warn("Firebase background session check warning:", err);
              // Do NOT call signOut(auth) - avoids destroying active login sessions
            }
          } else {
            const demoToken = localStorage.getItem("siteverify_token");
            if (demoToken) {
              try {
                const profile = await fetchMe();
                if (isSubscribed && profile) saveUser(profile);
              } catch (err) {
                if (err?.status === 401 || err?.status === 403) {
                  localStorage.removeItem("siteverify_token");
                  if (isSubscribed) saveUser(null);
                }
              }
            } else {
              const savedUserStr = localStorage.getItem("siteverify_user");
              if (savedUserStr) {
                try {
                  const parsed = JSON.parse(savedUserStr);
                  if (parsed?.role) {
                    const recoveredToken = parsed.token || `demo-${parsed.role}`;
                    localStorage.setItem("siteverify_token", recoveredToken);
                    try {
                      const profile = await fetchMe();
                      if (isSubscribed && profile) saveUser(profile);
                    } catch (err) {
                      if (err?.status === 401 || err?.status === 403) {
                        localStorage.removeItem("siteverify_token");
                        if (isSubscribed) saveUser(null);
                      }
                    }
                  }
                } catch {
                  if (isSubscribed) saveUser(null);
                }
              } else {
                if (isSubscribed) saveUser(null);
              }
            }
          }
          if (isSubscribed) setLoading(false);
        });

        return () => {
          isSubscribed = false;
          unsubscribe();
        };
      } else {
        const demoToken = localStorage.getItem("siteverify_token");
        if (demoToken) {
          try {
            const profile = await fetchMe();
            if (isSubscribed && profile) saveUser(profile);
          } catch (err) {
            if (err?.status === 401 || err?.status === 403) {
              localStorage.removeItem("siteverify_token");
              if (isSubscribed) saveUser(null);
            }
          }
        } else {
          const savedUserStr = localStorage.getItem("siteverify_user");
          if (savedUserStr) {
            try {
              const parsed = JSON.parse(savedUserStr);
              if (parsed?.role) {
                const recoveredToken = parsed.token || `demo-${parsed.role}`;
                localStorage.setItem("siteverify_token", recoveredToken);
                try {
                  const profile = await fetchMe();
                  if (isSubscribed && profile) saveUser(profile);
                } catch (err) {
                  if (err?.status === 401 || err?.status === 403) {
                    localStorage.removeItem("siteverify_token");
                    if (isSubscribed) saveUser(null);
                  }
                }
              }
            } catch {
              if (isSubscribed) saveUser(null);
            }
          } else {
            if (isSubscribed) saveUser(null);
          }
        }
        if (isSubscribed) setLoading(false);
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
      localStorage.setItem("siteverify_token", idToken);
      let userProfile;
      try {
        userProfile = await loginWithBackend(claimedRole, idToken, false, result.user.displayName);
      } catch (backendErr) {
        if (backendErr?.message?.includes("not registered") || backendErr?.status === 403) {
          userProfile = await loginWithBackend(claimedRole, idToken, true, result.user.displayName);
        } else {
          throw backendErr;
        }
      }
      saveUser(userProfile);
      return userProfile;
    } catch (err) {
      await signOut(auth);
      saveUser(null);
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
      localStorage.setItem("siteverify_token", idToken);
      let userProfile;
      try {
        userProfile = await loginWithBackend(claimedRole, idToken, false);
      } catch (backendErr) {
        if (backendErr?.message?.includes("not registered") || backendErr?.status === 403) {
          userProfile = await loginWithBackend(claimedRole, idToken, true);
        } else {
          throw backendErr;
        }
      }
      saveUser(userProfile);
      return userProfile;
    } catch (err) {
      await signOut(auth);
      saveUser(null);
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
      localStorage.setItem("siteverify_token", idToken);
      const userProfile = await loginWithBackend(claimedRole, idToken, true);
      saveUser(userProfile);
      return userProfile;
    } catch (err) {
      await signOut(auth);
      saveUser(null);
      throw err;
    }
  };

  const loginAsDemo = async (claimedRole) => {
    const userProfile = await demoLoginApi(claimedRole);
    saveUser(userProfile);
    return userProfile;
  };

  const logout = async () => {
    localStorage.removeItem("siteverify_token");
    localStorage.removeItem("siteverify_user");
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
        loginAsDemo,
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
