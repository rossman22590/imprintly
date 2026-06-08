import { createContext, useCallback, useContext, useState, useEffect } from "react";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";

const AuthContext = createContext(null);

const clearStoredAuth = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
};

export function AuthContextProvider({ children }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  const authenticateUser = useCallback((jwt, userInfo) => {
    localStorage.setItem("token", jwt);
    localStorage.setItem("user", JSON.stringify(userInfo));
    setIsAuthenticated(true);
    setUser(userInfo);
  }, []);

  const unauthenticateUser = useCallback((callback) => {
    clearStoredAuth();
    setIsAuthenticated(false);
    setUser(null);

    axiosInstance
      .post(API_ENDPOINTS.AUTH.LOGOUT)
      .catch((error) => {
        console.error("Error signing out:", error);
      });

    callback?.();
  }, []);

  const checkAuthStatus = useCallback(() => {
    setIsLoading(true);

    try {
      const jwt = localStorage.getItem("token");
      const stringifiedUser = localStorage.getItem("user");

      if (jwt && stringifiedUser) {
        const userInfo = JSON.parse(stringifiedUser);
        setIsAuthenticated(true);
        setUser(userInfo);
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
      clearStoredAuth();
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateUser = useCallback((updatedUserInfo) => {
    setUser((currentUser) => {
      const newUserInfo = { ...(currentUser || {}), ...updatedUserInfo };
      localStorage.setItem("user", JSON.stringify(newUserInfo));
      return newUserInfo;
    });
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        checkAuthStatus,
        authenticateUser,
        unauthenticateUser,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuthContext() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuthContext must be used within an AuthContextProvider"
    );
  }

  return context;
}
