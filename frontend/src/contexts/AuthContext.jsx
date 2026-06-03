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
  // starting with isLoading as true since we need to check auth on mount!!
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  const authenticateUser = useCallback((userInfoOrToken, maybeUserInfo) => {
    const userInfo = maybeUserInfo || userInfoOrToken;

    clearStoredAuth();
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

    // consumers can pass this callback to handle navigation
    callback?.();
  }, []);

  const checkAuthStatus = useCallback(async () => {
    setIsLoading(true);

    try {
      const { data } = await axiosInstance.get(API_ENDPOINTS.PROFILE.GET, {
        suppressAuthErrorLog: true,
      });
      const userInfo = data?.user;

      if (userInfo) {
        clearStoredAuth();
        setIsAuthenticated(true);
        setUser(userInfo);
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      if (error?.response?.status !== 401) {
        console.error("Error checking auth status:", error);
      }
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
      return newUserInfo;
    });
  }, []);

  // check auth status on mount
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
