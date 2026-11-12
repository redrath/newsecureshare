
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import { validateOtp } from '../redux/authSlice';
import { fetchQR } from '../api/api';

import '../styles/AuthRegister.css';
import Navbar from '../components/Navbars';

const AuthRegister = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const storedEmail = useSelector((state) => state.auth.email);
  const authError = useSelector((state) => state.auth.error);
  const reduxLoading = useSelector((state) => state.auth.loading);

  const email = location.state?.email || storedEmail;

  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  // FETCH QR CODE
  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;

    const loadQRCode = async () => {
      if (!email) {
        setError('Email is missing. Please register again.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        const blob = await fetchQR(email);

        if (cancelled) return;

        if (!(blob instanceof Blob) || blob.size === 0) {
          throw new Error('Invalid QR code received from backend.');
        }

        objectUrl = URL.createObjectURL(blob);
        setQrCodeUrl(objectUrl);

      } catch (err) {
        console.error('QR fetching error:', err);

        if (!cancelled) {
          setError(
            err.response?.data?.detail ||
            err.message ||
            'Failed to load QR code.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadQRCode();

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [email]);

  // VALIDATE REGISTRATION OTP
  const handleRegister = async (event) => {
    event.preventDefault();

    const sanitizedOtp = otp.replace(/\D/g, '');

    if (!email) {
      alert('Email is missing. Please register again.');
      navigate('/register', { replace: true });
      return;
    }

    if (!/^\d{6}$/.test(sanitizedOtp)) {
      alert('Please enter a valid 6-digit OTP.');
      return;
    }

    try {
      setVerifying(true);
      setError('');

      const resultAction = await dispatch(
        validateOtp({
          email,
          otp: sanitizedOtp,
        })
      );

      if (validateOtp.fulfilled.match(resultAction)) {
        const role = resultAction.payload.role;

        console.log(
          'Registration MFA successful:',
          resultAction.payload
        );

        alert('Registration and MFA verification successful!');

        // Redirect according to registered role
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
        const message =
          resultAction.payload || 'Invalid OTP. Please try again.';

        setError(message);
        console.error('OTP validation failed:', message);
      }

    } catch (err) {
      console.error('OTP validation error:', err);

      setError(
        err.message || 'Unable to validate OTP. Please try again.'
      );

    } finally {
      setVerifying(false);
    }
  };

  return (
    <div>
      <Navbar />

      <div className="auth-register-container">

        <h3>Scan this QR Code with Google Authenticator</h3>

        {email && (
          <p>Registering account: {email}</p>
        )}

        {loading && (
          <p>Loading QR Code...</p>
        )}

        {(error || authError) && (
          <p className="error-message">
            {error || authError}
          </p>
        )}

        {qrCodeUrl && (
          <img
            src={qrCodeUrl}
            alt="Google Authenticator QR Code"
          />
        )}

        <form onSubmit={handleRegister}>

          <input
            type="text"
            placeholder="Enter 6-digit OTP"
            maxLength={6}
            inputMode="numeric"
            autoComplete="one-time-code"
            value={otp}
            onChange={(event) => {
              setOtp(
                event.target.value.replace(/\D/g, '').slice(0, 6)
              );
            }}
            required
          />

          <button
            type="submit"
            disabled={
              loading ||
              verifying ||
              reduxLoading ||
              !qrCodeUrl ||
              !email
            }
          >
            {verifying || reduxLoading
              ? 'Verifying...'
              : 'Complete Registration'}
          </button>

        </form>

        <button
          type="button"
          onClick={() => navigate('/login', { replace: true })}
          disabled={verifying || reduxLoading}
        >
          Back to Login
        </button>

      </div>
    </div>
  );
};

export default AuthRegister;
