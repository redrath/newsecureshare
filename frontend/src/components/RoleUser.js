
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

import '../styles/RoleUser.css';
import Navbar from '../components/Navbar';

const RoleUser = () => {
  const navigate = useNavigate();

  const { isAuthenticated, token, role } = useSelector(
    (state) => state.auth
  );

  // Protect the user dashboard
  useEffect(() => {
    if (!isAuthenticated || !token) {
      navigate('/login', { replace: true });
      return;
    }

    if (role && role !== 'user') {
      navigate('/home', { replace: true });
    }
  }, [isAuthenticated, token, role, navigate]);

  const handleUploadFile = () => {
    navigate('/fileupload');
  };

  const handleDownloadFile = () => {
    navigate('/filedownload');
  };

  const handleShareFile = () => {
    navigate('/fileshare');
  };

  const handleShowFile = () => {
    navigate('/SharedFile');
  };

  // Avoid rendering the dashboard while redirecting
  if (!isAuthenticated || !token || (role && role !== 'user')) {
    return null;
  }

  return (
    <div>
      <Navbar />

      <div className="role-user-container">
        <h1>User Options</h1>

        <div className="role-user-buttons">
          <button onClick={handleUploadFile}>
            Upload File
          </button>

          <button onClick={handleDownloadFile}>
            Download File
          </button>

          <button onClick={handleShareFile}>
            Share File
          </button>

          <button onClick={handleShowFile}>
            Shared Files
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleUser;
