
export const uploadFileAction = (formData) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  dispatch(setMessage(null));

  try {
    const response = await uploadFile(formData);

    console.log('UPLOAD RESPONSE:', response);

    dispatch(
      setMessage(
        response.message || 'File uploaded successfully!'
      )
    );

    // Refresh the file list after successful upload
    const email = formData.get('email');

    if (email) {
      const files = await fetchFiles(email);
      dispatch(setFiles(files));
    }

    return response;

  } catch (error) {
    console.error('UPLOAD ERROR:', error.response?.data || error);

    const errorMessage =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'File upload failed.';

    dispatch(setError(errorMessage));

    throw error;

  } finally {
    dispatch(setLoading(false));
  }
};
