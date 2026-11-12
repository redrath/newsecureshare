from django.urls import path
from .e2ee_views import MyE2EEKeysView, E2EEPublicKeyView, E2EEFileListCreateView, E2EEFileDetailView, E2EEShareFileView
from .views import (HomeView,RegisterView,GetUsersView,GetQRView,ValidateOTPView,LoginView,UploadFileView,DecryptFileView,
                    FileShareView,FileShareDataView,FileListView,ServeFileView,TokenManager,GetUserView)

urlpatterns = [
    path('e2ee/keys/me/', MyE2EEKeysView.as_view(), name='e2ee-my-keys'),
    path('e2ee/keys/<str:email>/', E2EEPublicKeyView.as_view(), name='e2ee-public-key'),
    path('e2ee/files/', E2EEFileListCreateView.as_view(), name='e2ee-files'),
    path('e2ee/files/<int:file_id>/', E2EEFileDetailView.as_view(), name='e2ee-file-detail'),
    path('e2ee/files/<int:file_id>/share/', E2EEShareFileView.as_view(), name='e2ee-file-share'),
    path('', HomeView(), name='home'),
    path('register/', RegisterView.as_view(), name='register'),
    path('users/<str:email>/', GetUsersView.as_view(), name='get_users'),
    path('users/', GetUserView.as_view(), name='get_users'),
    path('get-qr/<str:email>/', GetQRView.as_view(), name='get_qr'),
    path('validate-otp/<str:email>/', ValidateOTPView.as_view(), name='validate_otp'),
    path('login/', LoginView.as_view(), name='login'),
    path('upload-file/', UploadFileView.as_view(), name='upload_file'),
    path('decrypt-file/<str:filename>/', DecryptFileView.as_view(), name='decrypt-file'),
    path('file-share/', FileShareView.as_view(), name='file_share'),
    path('shared-files/<str:user>/', FileShareDataView.as_view(), name='get_users'),
    path('fileslist/<str:email>/', FileListView.as_view(), name='get_files'),
    path('serve-file/<str:filename>/', ServeFileView.as_view(), name='serve-files'),
    path('refresh-token/', TokenManager.as_view(), name='refresh_token'),
]