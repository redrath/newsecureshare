
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';

import { validateOtp } from '../redux/authSlice';

import '../styles/AuthLogin.css';
import Navbar from '../components/Navbars';

const AuthLogin = () => {
  const [otp, setOtp] = useState('');

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    email: storedEmail,
    error: authError,
    loading,
  } = useSelector((state) => state.auth);

  // Get email from navigation state or Redux
  const email = location.state?.email || storedEmail;

  const handleOtpValidation = async (event) => {
    event.preventDefault();

    const sanitizedOtp = otp.replace(/\D/g, '');

    if (!email) {
      alert('Email information is missing. Please log in again.');
      navigate('/login', { replace: true });
      return;
    }

    if (sanitizedOtp.length !== 6) {
      alert('Please enter a valid 6-digit OTP.');
      return;
    }

    try {
      const resultAction = await dispatch(
        validateOtp({
          email,
          otp: sanitizedOtp,
        })
      );

      if (validateOtp.fulfilled.match(resultAction)) {
        console.log('OTP validation successful:', resultAction.payload);

        const role = resultAction.payload.role;

        alert('Login successful!');

        switch (role) {
          case 'user':
            navigate('/roleuser', { replace: true });
            break;

          case 'guest':
            navigate('/roleguest', { replace: true });
            break;

          default:
            alert(`Unknown user role: ${role}`);
            break;
        }
      } else {
        console.error('OTP validation failed:', resultAction.payload);

        alert(resultAction.payload || 'Invalid OTP. Please try again.');
      }
    } catch (error) {
      console.error('OTP validation error:', error);
      alert('Unable to validate OTP. Please try again.');
    }
  };

  return (
    <div>
      <Navbar />

      <div className="auth-login-container">
        <h2>Multi-Factor Authentication</h2>

        <p>
          Enter the 6-digit verification code from your
          authenticator application.
        </p>

        {email && (
          <p className="otp-email">
            Verification for: {email}
          </p>
        )}

        {authError && (
          <p className="error-message">
            {authError}
          </p>
        )}

        <form onSubmit={handleOtpValidation}>
          <input
            type="text"
            value={otp}
            onChange={(event) => {
              setOtp(event.target.value.replace(/\D/g, '').slice(0, 6));
            }}
            placeholder="Enter OTP"
            maxLength={6}
            inputMode="numeric"
            autoComplete="one-time-code"
            required
          />

          <button
            type="submit"
            disabled={loading || !email}
          >
            {loading ? 'Verifying...' : 'Validate OTP'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => navigate('/login', { replace: true })}
          disabled={loading}
        >
          Back to Login
        </button>
      </div>
    </div>
  );
};

export default AuthLogin;
