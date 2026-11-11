import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';

import {
  setEmail,
  setAuthentication,
  setToken
} from '../redux/authSlice';

import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import '../styles/Login.css';
import Navbar from '../components/Navbars';

const Login = () => {

  useEffect(() => {
    const hasRefreshed = sessionStorage.getItem('hasRefreshed');

    if (!hasRefreshed) {
      sessionStorage.setItem('hasRefreshed', 'true');
      window.location.reload();
    }
  }, []);

  const [email, setEmailInput] = useState('');
  const [password, setPassword] = useState('');

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {

      const response = await api.post('/login/', {
        email: email.trim(),
        password: password,
      });

      console.log('LOGIN SUCCESS:', response.data);

      const { access, refresh } = response.data;

      // Store tokens
      document.cookie = `access=${access}; Secure; SameSite=Strict;`;
      document.cookie = `refresh=${refresh}; Secure; SameSite=Strict;`;

      // Update Redux state
      dispatch(setEmail(email.trim()));
      dispatch(setAuthentication(true));
      dispatch(setToken({ access, refresh }));
      localStorage.setItem('token', access);
      localStorage.setItem('refreshToken', refresh);

      // Move to OTP verification
      navigate('/auth-login', {
        state: {
          email: email.trim()
        }
      });

    } catch (error) {

      console.error('LOGIN ERROR:', error);
      console.error('STATUS:', error.response?.status);
      console.error('BACKEND RESPONSE:', error.response?.data);

      const backendMessage =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.response?.data?.error;

      alert(
        backendMessage
          ? `Login failed: ${backendMessage}`
          : 'Login failed. Please check your email and password.'
      );
    }
  };

  return (
    <div>
      <Navbar />

      <div className="login-container">

        <div className="login-box">

          <h1>Login</h1>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="Email"
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />

          <button onClick={handleLogin}>
            Login
          </button>

          <p>
            New user?{' '}
            <button
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