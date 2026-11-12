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

// Request Interceptor to include Authorization headers
api.interceptors.request.use(
  (config) => {
    const publicEndpoints = [
      '/register/',
      '/login/',
      '/validate-otp/',
    ];

    const isPublicEndpoint = publicEndpoints.some(
      (endpoint) => config.url?.includes(endpoint)
    );

    if (isPublicEndpoint) {
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

// Response Interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const { refreshToken } = store.getState().auth;

    if (error.response?.status === 401 && !originalRequest._retry && refreshToken) {
      originalRequest._retry = true;
      try {
        const response = await api.post('/refresh-token/', { refresh: refreshToken });
        store.dispatch(setToken(response.data));
        originalRequest.headers['Authorization'] = `Bearer ${response.data.access}`;
        return api(originalRequest);
      } catch (refreshError) {
        store.dispatch(logout());
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
    const response = await api.post(`/validate-otp/${email}/`, { otp });
    return response.data;
};


export default api;