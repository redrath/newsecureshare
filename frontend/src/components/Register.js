
import React, { useState } from "react";
import { useDispatch } from "react-redux";
import {
  setEmail,
  setToken,
  setAuthentication,
  setRole
} from "../redux/authSlice";

import { useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import { validateEmail, validatePassword } from "../utils";
import api from "../api/api";
import "../styles/Register.css";
import Navbar from "../components/Navbars";

// Convert binary data into Base64
const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return window.btoa(binary);
};

// Convert public key into PEM format
const convertToPEM = (buffer) => {
  const base64 = arrayBufferToBase64(buffer);
  const formatted = base64.match(/.{1,64}/g).join("\n");

  return `-----BEGIN PUBLIC KEY-----\n${formatted}\n-----END PUBLIC KEY-----`;
};

// Generate RSA keys and protect the private key
const generateE2EEKeys = async (password) => {

  // STEP 1: Generate RSA-2048 keypair
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256"
    },
    true,
    ["encrypt", "decrypt"]
  );

  // STEP 2: Export public key
  const publicKeyBuffer =
    await window.crypto.subtle.exportKey(
      "spki",
      keyPair.publicKey
    );

  const publicKeyPEM = convertToPEM(publicKeyBuffer);

  // STEP 3: Export private key
  const privateKeyBuffer =
    await window.crypto.subtle.exportKey(
      "pkcs8",
      keyPair.privateKey
    );

  // STEP 4: Generate random salt and IV
  const salt = window.crypto.getRandomValues(
    new Uint8Array(16)
  );

  const iv = window.crypto.getRandomValues(
    new Uint8Array(12)
  );

  // STEP 5: Import password as PBKDF2 material
  const passwordMaterial =
    await window.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );

  // STEP 6: Derive AES-256 key
  const derivedKey =
    await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 310000,
        hash: "SHA-256"
      },
      passwordMaterial,
      {
        name: "AES-GCM",
        length: 256
      },
      false,
      ["encrypt"]
    );

  // STEP 7: Encrypt private key using AES-256-GCM
  const encryptedPrivateKey =
    await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      derivedKey,
      privateKeyBuffer
    );

  // STEP 8: Package protected private key
  const protectedPrivateKey = {
    version: 1,
    format: "PKCS8",
    algorithm: "AES-256-GCM",
    kdf: "PBKDF2",
    hash: "SHA-256",
    iterations: 310000,
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(encryptedPrivateKey)
  };

  return {
    public_key_pem: publicKeyPEM,
    protected_private_key: protectedPrivateKey
  };
};

// REGISTER COMPONENT
const Register = () => {

  const [email, setEmailInput] = useState("");
  const [password, setPassword] = useState("");
  const [name, setNameInput] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [access, setAccessLevel] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const sanitizeInput = (input) =>
    DOMPurify.sanitize(input.trim());

  const handleRegister = async (event) => {
    event.preventDefault();

    const sanitizedEmail = sanitizeInput(email).toLowerCase();
    const sanitizedName = sanitizeInput(name);
    const sanitizedAccess = sanitizeInput(access);

    // VALIDATION
    if (!validateEmail(sanitizedEmail)) {
      alert("Invalid email format.");
      return;
    }

    if (!validatePassword(password)) {
      alert(
        "Password must contain at least 8 characters, 1 uppercase, 1 lowercase, 1 number, and 1 special character."
      );
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    if (!sanitizedName || !sanitizedAccess) {
      alert("Please enter your name and select a role.");
      return;
    }

    if (!window.isSecureContext || !window.crypto?.subtle) {
      alert("Secure browser cryptography is unavailable. Use HTTPS.");
      return;
    }

    setIsRegistering(true);

    try {

      // STEP 1: Generate E2EE keys in browser
      console.log("Generating RSA keypair...");

      const e2eeKeys = await generateE2EEKeys(password);

      console.log("RSA keypair generated.");
      console.log("Private key protected successfully.");

      // STEP 2: Send registration data to backend
      const response = await api.post("/register/", {
        email: sanitizedEmail,
        name: sanitizedName,
        password: password,
        access: sanitizedAccess,

        public_key_pem: e2eeKeys.public_key_pem,
        protected_private_key: e2eeKeys.protected_private_key
      });

      const {
        access: accessToken,
        refresh,
        role
      } = response.data;

      // Verify backend token response
      if (!accessToken || !refresh) {
        throw new Error("Registration response is missing authentication tokens.");
      }

      // STEP 3: Store user details and tokens
      dispatch(setEmail(sanitizedEmail));
      dispatch(setRole(role || sanitizedAccess));

      dispatch(setToken({
        access: accessToken,
        refresh: refresh
      }));

      // IMPORTANT: OTP must succeed before authentication
      dispatch(setAuthentication(false));

      // STEP 4: Navigate to registration OTP verification
      alert("Registration successful! Please complete MFA verification.");

      navigate("/auth-register", {
        replace: true,
        state: {
          email: sanitizedEmail
        }
      });

    } catch (error) {

      console.error("Registration error:", error);
      console.error("Backend response:", error.response?.data);

      alert(
        error.response?.data?.detail ||
        error.message ||
        "Registration or E2EE key generation failed."
      );

    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div>
      <Navbar />

      <div className="register-container">
        <div className="register-box">

          <h1>Register</h1>

          <form onSubmit={handleRegister}>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              required
            />

            <input
              type="text"
              value={name}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Name"
              autoComplete="name"
              required
            />

            <select
              value={access}
              onChange={(e) => setAccessLevel(e.target.value)}
              required
            >
              <option value="">Select Role</option>
              <option value="user">User</option>
              <option value="guest">Guest</option>
            </select>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="new-password"
              required
            />

            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm Password"
              autoComplete="new-password"
              required
            />

            <button
              type="submit"
              disabled={isRegistering}
            >
              {isRegistering
                ? "Generating Keys..."
                : "Register"}
            </button>

          </form>

          <p>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => navigate("/login")}
              disabled={isRegistering}
            >
              Login
            </button>
          </p>

        </div>
      </div>
    </div>
  );
};

export default Register;
