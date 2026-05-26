import axios from "axios";
import { API_BASE_URL } from "../utils/api-endpoints";

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
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

    return response;
  },
  (err) => {
    console.error("Error in Axios response interceptor:", err);

    // Handle common erros centrally
    if (err.response) {
      if (err.response.status === 500) {
        console.error(
          "Internal Server Error! Please try again in a few minutes."
        );
      }
    } else if (err.code === "ECONNABORTED") {
      console.error("Request timeout! Please try again later.");
    }

    return Promise.reject(err);
  }
);

export default axiosInstance;
