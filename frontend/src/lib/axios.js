import axios from "axios";
import { API_BASE_URL } from "../utils/api-endpoints";

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

    if (jwt) {
      config.headers.Authorization = `Bearer ${jwt}`;
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

    const url = response.config?.url || "";
    const method = (response.config?.method || "get").toLowerCase();
    const shouldRefreshCredits =
      method !== "get" &&
      (url.includes("/api/ai") ||
        url.includes("/api/books") ||
        url.includes("/api/audiobook"));

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

    // Handle common erros centrally
    if (err.response) {
      if (err.response.status === 500) {
        console.error(
          "Internal Server Error! Please try again in a few minutes."
        );
      }

      if (err.response.status === 401 && typeof window !== "undefined") {
        const url = err.config?.url || "";
        const isAuthEndpoint =
          url.includes("/auth/login") || url.includes("/auth/register");
        const hasToken = localStorage.getItem("token");

        if (!isAuthEndpoint && hasToken) {
          // Remove the token immediately so concurrent 401s don't fire duplicate events
          localStorage.removeItem("token");
          window.dispatchEvent(new Event("auth:session-expired"));
        }
      }

      if (err.response.status === 402 && typeof window !== "undefined") {
        window.dispatchEvent(new Event("credits:refresh"));
        window.dispatchEvent(new CustomEvent("credits:insufficient", {
          detail: err.response.data || {}
        }));
      }
    } else if (err.code === "ECONNABORTED") {
      console.error("Request timeout! Please try again later.");
    }

    return Promise.reject(err);
  }
);

export default axiosInstance;
