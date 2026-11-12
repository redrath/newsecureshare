
import axios from 'axios';
import store from '../redux/store';
import { setToken, logout } from '../redux/authSlice';

const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  'https://newsecureshare.onrender.com';

export const fileapi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// REQUEST INTERCEPTOR
fileapi.interceptors.request.use(
  (config) => {
    config.headers = config.headers || {};

    const { token } = store.getState().auth;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// RESPONSE INTERCEPTOR
fileapi.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Prevent repeated refresh attempts
    if (
      error.response?.status === 401 &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      const { refreshToken } = store.getState().auth;

      if (!refreshToken) {
        store.dispatch(logout());
        return Promise.reject(error);
      }

      try {
        // Use the refresh endpoint, NOT the login endpoint
        const response = await fileapi.post(
          '/refresh-token/',
          { refresh: refreshToken }
        );

        store.dispatch(setToken(response.data));

        originalRequest.headers =
          originalRequest.headers || {};

        originalRequest.headers.Authorization =
          `Bearer ${response.data.access}`;

        return fileapi(originalRequest);

      } catch (refreshError) {
        store.dispatch(logout());
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// FETCH FILES
export const fetchFiles = async (email) => {
  const response = await fileapi.get(
    `/fileslist/${encodeURIComponent(email)}/`
  );

  return response.data.files;
};

// FETCH USERS
export async function getUsers(email) {
  const response = await fileapi.get(
    `/users/${encodeURIComponent(email)}/`
  );

  return response.data.users;
}

// UPLOAD FILE
export const uploadFile = async (formData) => {
  const response = await fileapi.post(
    '/upload-file/',
    formData
  );

  return response.data;
};

// DOWNLOAD FILE
export const decryptFile = async (fileName) => {
  const response = await fileapi.get(
    `/decrypt-file/${encodeURIComponent(fileName)}/`,
    { responseType: 'blob' }
  );

  return response.data;
};

// FETCH SHARED FILES
export const fetchSharedFileData = async (sender) => {
  const response = await fileapi.get(
    `/shared-files/${encodeURIComponent(sender)}/`
  );

  return response.data;
};
