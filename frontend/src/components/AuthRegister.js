
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import '../styles/AuthRegister.css';
import Navbar from '../components/Navbars';

// Local Django backend
const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  'https://newsecureshare.onrender.com';

const AuthRegister = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const email = location.state?.email;

  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  // Fetch QR code
  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;

    const fetchQrCode = async () => {
      if (!email) {
        setError('Email is missing. Please register again.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        const res = await fetch(
          `${API_BASE_URL}/get-qr/${encodeURIComponent(email)}/`
        );

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));

          throw new Error(
            errorData.detail || 'Failed to generate QR code.'
          );
        }

        const contentType = res.headers.get('content-type');

        if (!contentType?.includes('image/png')) {
          throw new Error('Backend did not return a QR image.');
        }

        const blob = await res.blob();

        if (cancelled) return;

        objectUrl = URL.createObjectURL(blob);
        setQrCodeUrl(objectUrl);

      } catch (err) {
        console.error('QR fetching error:', err);

        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchQrCode();

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [email]);

  // Validate OTP
  const handleRegister = async () => {
    const sanitizedOtp = DOMPurify.sanitize(otp.trim());

    if (!email) {
      alert('Email is missing. Please register again.');
      return;
    }

    if (!/^\d{6}$/.test(sanitizedOtp)) {
      alert('Please enter a valid 6-digit OTP.');
      return;
    }

    try {
      setVerifying(true);

      const res = await fetch(
        `${API_BASE_URL}/validate-otp/${encodeURIComponent(email)}/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            otp: sanitizedOtp,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.detail || 'Incorrect OTP. Please try again.'
        );
      }

      alert('MFA verification successful!');

      navigate('/home');

    } catch (err) {
      console.error('OTP validation error:', err);
      alert(err.message);

    } finally {
      setVerifying(false);
    }
  };

  return (
    <div>
      <Navbar />

      <div className="auth-register-container">

        <h3>Scan this QR Code with Google Authenticator</h3>

        {loading && <p>Loading QR Code...</p>}

        {error && <p className="error-message">{error}</p>}

        {qrCodeUrl && (
          <img
            src={qrCodeUrl}
            alt="Google Authenticator QR Code"
          />
        )}

        <input
          type="text"
          placeholder="Enter 6-digit OTP"
          maxLength={6}
          value={otp}
          onChange={(e) =>
            setOtp(e.target.value.replace(/\D/g, ''))
          }
        />

        <button
          onClick={handleRegister}
          disabled={loading || verifying || !qrCodeUrl}
        >
          {verifying
            ? 'Verifying...'
            : 'Complete Registration'}
        </button>

      </div>
    </div>
  );
};

export default AuthRegister;
