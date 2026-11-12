
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchQR, validateOTP } from '../api/api';
import api from '../api/api';

// Safely retrieve values from localStorage
const getStoredValue = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

// Initial authentication state
const initialState = {
  email: getStoredValue('email'),
  role: getStoredValue('role'),

  // Restore authentication after page reload
  isAuthenticated: getStoredValue('isAuthenticated') === 'true',

  token: getStoredValue('token'),
  refreshToken: getStoredValue('refreshToken'),

  qrCodeUrl: null,
  loading: false,
  error: null,
};

// FETCH QR CODE
export const fetchQrCode = createAsyncThunk(
  'auth/fetchQrCode',
  async (email, { rejectWithValue }) => {
    try {
      return await fetchQR(email);
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.detail ||
        error.message ||
        'Failed to fetch QR code'
      );
    }
  }
);

// VALIDATE OTP
export const validateOtp = createAsyncThunk(
  'auth/validateOtp',
  async ({ email, otp }, { rejectWithValue }) => {
    try {
      return await validateOTP(email, otp);
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.detail ||
        'OTP validation failed'
      );
    }
  }
);

// LOGIN USER
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const response = await api.post('/login/', {
        email: email.trim().toLowerCase(),
        password,
      });

      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.detail ||
        'Login failed'
      );
    }
  }
);

// AUTH SLICE
const authSlice = createSlice({
  name: 'auth',
  initialState,

  reducers: {
    // SET EMAIL
    setEmail(state, action) {
      state.email = action.payload;

      if (action.payload) {
        localStorage.setItem('email', action.payload);
      } else {
        localStorage.removeItem('email');
      }
    },

    // SET ROLE
    setRole(state, action) {
      state.role = action.payload;

      if (action.payload) {
        localStorage.setItem('role', action.payload);
      } else {
        localStorage.removeItem('role');
      }
    },

    // SET AUTHENTICATION STATUS
    setAuthentication(state, action) {
      state.isAuthenticated = action.payload;

      localStorage.setItem(
        'isAuthenticated',
        String(action.payload)
      );
    },

    // SET ACCESS AND REFRESH TOKENS
    setToken(state, action) {
      const { access, refresh } = action.payload || {};

      if (access) {
        state.token = access;
        localStorage.setItem('token', access);
      }

      // Preserve the existing refresh token if the backend
      // returns only a new access token.
      if (refresh) {
        state.refreshToken = refresh;
        localStorage.setItem('refreshToken', refresh);
      }
    },

    // LOGOUT
    logout(state) {
      state.email = null;
      state.role = null;
      state.isAuthenticated = false;

      state.token = null;
      state.refreshToken = null;

      state.qrCodeUrl = null;
      state.loading = false;
      state.error = null;

      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('email');
      localStorage.removeItem('role');
      localStorage.removeItem('isAuthenticated');

      sessionStorage.removeItem('hasRefreshed');
    },

    // CLEAR ERROR
    clearError(state) {
      state.error = null;
    },
  },

  extraReducers: (builder) => {
    builder

      // LOGIN
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;

        state.token = action.payload.access || null;
        state.refreshToken = action.payload.refresh || null;

        if (action.payload.access) {
          localStorage.setItem(
            'token',
            action.payload.access
          );
        }

        if (action.payload.refresh) {
          localStorage.setItem(
            'refreshToken',
            action.payload.refresh
          );
        }

        // Login alone does not complete authentication.
        state.isAuthenticated = false;
        localStorage.setItem('isAuthenticated', 'false');
      })

      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // FETCH QR CODE
      .addCase(fetchQrCode.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(fetchQrCode.fulfilled, (state, action) => {
        state.qrCodeUrl = action.payload;
        state.loading = false;
      })

      .addCase(fetchQrCode.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // OTP VALIDATION
      .addCase(validateOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(validateOtp.fulfilled, (state, action) => {
        state.isAuthenticated = true;
        state.role = action.payload.role || null;

        state.loading = false;
        state.error = null;

        localStorage.setItem('isAuthenticated', 'true');

        if (state.role) {
          localStorage.setItem('role', state.role);
        }
      })

      .addCase(validateOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;

        // Failed OTP must never authenticate the user.
        state.isAuthenticated = false;
        localStorage.setItem('isAuthenticated', 'false');
      });
  },
});

// EXPORT ACTIONS
export const {
  setEmail,
  setRole,
  setAuthentication,
  setToken,
  logout,
  clearError,
} = authSlice.actions;

export default authSlice.reducer;
