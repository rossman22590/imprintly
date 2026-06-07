import axios from "axios";
import { API_BASE_URL } from "../utils/api-endpoints";

function getCookieValue(name) {
  if (typeof document === "undefined") return "";

  const prefix = `${name}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : "";
}

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 80000, // 80s
});

// Request interceptor - runs before a request is sent
axiosInstance.interceptors.request.use(
  (config) => {
    const jwt = localStorage.getItem("token");
    const method = (config.method || "get").toLowerCase();

    if (jwt) {
      config.headers.Authorization = `Bearer ${jwt}`;
    }

    if (!["get", "head", "options"].includes(method)) {
      const csrfToken = getCookieValue("imprintly_csrf");

      if (csrfToken) {
        config.headers["X-CSRF-Token"] = csrfToken;
      }
    }

    return config;
  },
  (err) => {
    console.error("Error in Axios request interceptor:", err);

    return Promise.reject(err);
  }
);

// Response interceptor - runs after a response is received
axiosInstance.interceptors.response.use(
  (response) => {
    const contentType = response.headers?.["content-type"] || "";

    if (
      contentType.includes("text/html") &&
      typeof response.data === "string"
    ) {
      const err = new Error(
        "The API request returned the frontend HTML. Set VITE_API_BASE_URL to the Render backend web service URL."
      );
      err.response = response;

      return Promise.reject(err);
    }

    // If the backend sent a token via cookie auth, cache it so subsequent
    // requests use Bearer auth (which bypasses cross-origin CSRF issues).
    const refreshedToken = response.headers?.["x-auth-token"];

    if (refreshedToken && typeof window !== "undefined") {
      localStorage.setItem("token", refreshedToken);
    }

    const url = response.config?.url || "";
    const method = (response.config?.method || "get").toLowerCase();
    const shouldRefreshCredits =
      method !== "get" &&
      (url.includes("/api/ai") || url.includes("/api/books"));

    if (shouldRefreshCredits && typeof window !== "undefined") {
      window.dispatchEvent(new Event("credits:refresh"));
    }

    return response;
  },
  (err) => {
    const isSuppressedAuthError =
      err.config?.suppressAuthErrorLog && err.response?.status === 401;

    if (!isSuppressedAuthError) {
      console.error("Error in Axios response interceptor:", err);
    }

    // Handle common errors centrally
    if (err.response) {
      if (err.response.status === 401 && typeof window !== "undefined") {
        // Token expired or invalid — clear stale credentials and send to login
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        window.dispatchEvent(new Event("auth:logout"));
      }

      if (err.response.status === 500) {
        console.error(
          "Internal Server Error! Please try again in a few minutes."
        );
      }

      if (err.response.status === 402 && typeof window !== "undefined") {
        window.dispatchEvent(new Event("credits:refresh"));
      }
    } else if (err.code === "ECONNABORTED") {
      console.error("Request timeout! Please try again later.");
    }

    return Promise.reject(err);
  }
);

export default axiosInstance;
