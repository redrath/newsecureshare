
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { uploadFileAction } from '../redux/fileSlice';
import Navbar from '../components/Navbar';

const FileUpload = () => {
  const [file, setFile] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const dispatch = useDispatch();

  const email = useSelector((state) => state.auth.email);

  const {
    message,
    error,
    loading,
    files,
  } = useSelector((state) => state.file);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];

    if (!selectedFile) {
      setFile(null);
      return;
    }

    if (
      selectedFile.type !== 'application/pdf' &&
      !selectedFile.name.toLowerCase().endsWith('.pdf')
    ) {
      setErrorMsg('Only PDF files are allowed.');
      setFile(null);
      return;
    }

    setErrorMsg('');
    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      setErrorMsg('Please select a PDF file.');
      return;
    }

    if (!email) {
      setErrorMsg('User not authenticated. Please log in.');
      return;
    }

    setErrorMsg('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('email', email);

    try {
      await dispatch(uploadFileAction(formData));
      setFile(null);
    } catch (uploadError) {
      console.error('Upload failed:', uploadError);
    }
  };

  return (
    <div>
      <Navbar />

      <div className="file-upload-container">
        <h1>Secure PDF Upload</h1>

        <p>
          Uploading as: <strong>{email || 'Not logged in'}</strong>
        </p>

        <input
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          disabled={loading}
        />

        {file && (
          <p>
            Selected file: <strong>{file.name}</strong>
          </p>
        )}

        <button
          onClick={handleUpload}
          disabled={loading || !file}
        >
          {loading ? 'Uploading...' : 'Upload File'}
        </button>

        {message && (
          <p style={{ color: 'green' }}>
            ✓ {message}
          </p>
        )}

        {errorMsg && (
          <p style={{ color: 'red' }}>
            {errorMsg}
          </p>
        )}

        {error && (
          <p style={{ color: 'red' }}>
            Upload error: {error}
          </p>
        )}

        <h3>Uploaded Files</h3>

        {files?.length > 0 ? (
          <ul>
            {files.map((item, index) => (
              <li key={item.id || item.filename || index}>
                {item.filename}
              </li>
            ))}
          </ul>
        ) : (
          <p>No uploaded files found.</p>
        )}
      </div>
    </div>
  );
};

export default FileUpload;
