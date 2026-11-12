
import axios from 'axios';
import store from '../redux/store';
import { setToken, logout } from '../redux/authSlice';

const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  'https://newsecureshare.onrender.com';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Endpoints that do not require an existing access token
const publicEndpoints = [
  '/register/',
  '/login/',
  '/validate-otp/',
  '/refresh-token/',
  '/get-qr/',
];

const isPublicEndpoint = (url = '') =>
  publicEndpoints.some((endpoint) => url.includes(endpoint));

// Attach access token to protected requests
api.interceptors.request.use(
  (config) => {
    config.headers = config.headers || {};

    if (isPublicEndpoint(config.url)) {
      delete config.headers.Authorization;
    } else {
      const token = store.getState().auth.token;

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Refresh expired access tokens for protected requests
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Do not refresh public endpoint requests
    if (isPublicEndpoint(originalRequest.url)) {
      return Promise.reject(error);
    }

    if (
      error.response?.status === 401 &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      const refreshToken = store.getState().auth.refreshToken;

      if (!refreshToken) {
        store.dispatch(logout());
        return Promise.reject(error);
      }

      try {
        const refreshResponse = await api.post(
          '/refresh-token/',
          { refresh: refreshToken }
        );

        store.dispatch(setToken(refreshResponse.data));

        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization =
          `Bearer ${refreshResponse.data.access}`;

        return api(originalRequest);
      } catch (refreshError) {
        store.dispatch(logout());
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Fetch QR code
export const fetchQR = async (email) => {
  const response = await api.get(
    `/get-qr/${encodeURIComponent(email)}/`,
    { responseType: 'blob' }
  );

  return response.data;
};

// Validate OTP
export const validateOTP = async (email, otp) => {
  const response = await api.post(
    `/validate-otp/${encodeURIComponent(email)}/`,
    { otp }
  );

  return response.data;
};

export default api;
