
import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import {
  setEmail,
  setAuthentication,
  setToken,
} from '../redux/authSlice';

import api from '../api/api';
import '../styles/Login.css';
import Navbar from '../components/Navbars';

const Login = () => {
  const [email, setEmailInput] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      alert('Please enter your email and password.');
      return;
    }

    try {
      setLoading(true);

      const response = await api.post('/login/', {
        email: normalizedEmail,
        password,
      });

      console.log('LOGIN SUCCESS:', response.data);

      const { access, refresh } = response.data;

      if (!access || !refresh) {
        throw new Error('The backend did not return both access and refresh tokens.');
      }

      // Store authentication details
      dispatch(setEmail(normalizedEmail));
      dispatch(setToken({ access, refresh }));

      // OTP verification must complete before marking the user authenticated
      dispatch(setAuthentication(false));

      // Navigate to OTP verification
      navigate('/auth-login', {
        replace: true,
        state: {
          email: normalizedEmail,
        },
      });

    } catch (error) {
      console.error('LOGIN ERROR:', error);
      console.error('STATUS:', error.response?.status);
      console.error('BACKEND RESPONSE:', error.response?.data);

      const backendMessage =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message;

      alert(`Login failed: ${backendMessage}`);

    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Navbar />

      <div className="login-container">
        <div className="login-box">

          <h1>Login</h1>

          <form onSubmit={handleLogin}>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmailInput(event.target.value)}
              placeholder="Email"
              autoComplete="email"
              required
            />

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              required
            />

            <button type="submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <p>
            New user?{' '}
            <button
              type="button"
              onClick={() =>
                navigate('/register', { replace: true })
              }
            >
              Register
            </button>
          </p>

        </div>
      </div>
    </div>
  );
};

export default Login;
