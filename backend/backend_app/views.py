
import io

import pyotp
import qrcode

from django.shortcuts import get_object_or_404
from django.http import HttpResponse, FileResponse
from django.urls import reverse
from django.db import transaction
from django.contrib.auth.hashers import check_password, make_password

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework import status

from rest_framework_simplejwt.tokens import RefreshToken

from Crypto.Random import get_random_bytes
from Crypto.Cipher import AES

from .models import (
    User,
    EncryptedFile,
    FileSharingInfo,
    E2EEKeyProfile
)

from .utils import encrypt_file, decrypt_file


# ==================================================
# HOME VIEW
# ==================================================

class HomeView:

    def __call__(self, request):

        links = [
            ("Register", reverse("register")),
            ("Get Users", reverse("get_users", kwargs={"email": "test@example.com"})),
            ("Get QR", reverse("get_qr", kwargs={"email": "test@example.com"})),
            ("Validate OTP", reverse("validate_otp", kwargs={"email": "test@example.com"})),
            ("Login", reverse("login")),
            ("Upload File", reverse("upload_file")),
            ("Decrypt File", reverse("decrypt-file", kwargs={"filename": "example.txt"})),
            ("File Share", reverse("file_share")),
            ("Files List", reverse("get_files", kwargs={"email": "test@example.com"})),
            ("Serve File", reverse("serve-files", kwargs={"filename": "example.txt"}))
        ]

        html_content = "<h1>Available Links</h1><ul>"

        for name, url in links:
            html_content += f'<li><a href="{url}">{name}</a></li>'

        html_content += "</ul>"

        return HttpResponse(html_content)


# ==================================================
# TOKEN MANAGER
# ==================================================


from rest_framework_simplejwt.exceptions import TokenError

class TokenManager(APIView):
    permission_classes = [AllowAny]

    @staticmethod
    def generate_tokens(user):
        refresh = RefreshToken.for_user(user)

        return (
            str(refresh.access_token),
            str(refresh)
        )

    def post(self, request):
        refresh_token = request.data.get("refresh")

        if not refresh_token:
            return Response(
                {"detail": "Refresh token is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            refresh = RefreshToken(refresh_token)
            access_token = str(refresh.access_token)

            return Response(
                {"access": access_token},
                status=status.HTTP_200_OK
            )

        except TokenError:
            return Response(
                {"detail": "Invalid or expired refresh token"},
                status=status.HTTP_401_UNAUTHORIZED
            )



# ==================================================
# USER REGISTRATION
# ==================================================

class RegisterView(APIView):

    permission_classes = [AllowAny]

    def post(self, request):

        email = request.data.get("email", "").strip().lower()
        password = request.data.get("password")
        name = request.data.get("name", "").strip()
        access_level = request.data.get("access")

        public_key = request.data.get("public_key_pem")
        protected_private_key = request.data.get("protected_private_key")

        # Validate required fields

        if not all([
            email,
            password,
            name,
            access_level,
            public_key,
            protected_private_key
        ]):

            return Response(
                {"detail": "Missing registration or encryption fields"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not isinstance(public_key, str) or len(public_key) > 10000:

            return Response(
                {"detail": "Invalid public key"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not isinstance(protected_private_key, dict):

            return Response(
                {"detail": "Invalid protected private key"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if User.objects.filter(email=email).exists():

            return Response(
                {"detail": "Email already registered"},
                status=status.HTTP_400_BAD_REQUEST
            )

        hashed_password = make_password(password)

        # Generate TOTP secret only once

        secret = pyotp.random_base32()

        try:

            with transaction.atomic():

                user = User.objects.create(
                    email=email,
                    password=hashed_password,
                    name=name,
                    secret=secret,
                    access=access_level
                )

                # Store E2EE keys

                E2EEKeyProfile.objects.create(
                    user=user,
                    public_key_pem=public_key,
                    protected_private_key=protected_private_key
                )

                refresh = RefreshToken.for_user(user)

                return Response(
                    {
                        "access": str(refresh.access_token),
                        "refresh": str(refresh),
                        "role": user.access,
                        "detail": "User registered successfully"
                    },
                    status=status.HTTP_201_CREATED
                )

        except Exception as e:

            print("Registration error:", str(e))

            return Response(
                {"detail": "Registration failed"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ==================================================
# QR CODE GENERATION
# ==================================================

class GetQRView(APIView):

    permission_classes = [AllowAny]

    def get(self, request, email):

        sanitized_email = email.strip().lower()

        # Find registered user

        user = User.objects.filter(
            email=sanitized_email
        ).first()

        if not user:

            return Response(
                {
                    "detail": "User not found in database",
                    "requested_email": sanitized_email
                },
                status=status.HTTP_404_NOT_FOUND
            )

        if not user.secret:

            return Response(
                {"detail": "TOTP secret is missing"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:

            # Use the existing TOTP secret.
            # Never generate a new secret here.

            totp = pyotp.TOTP(user.secret)

            # Generate Google Authenticator URI

            otp_uri = totp.provisioning_uri(
                name=user.email,
                issuer_name="SecureShare"
            )

            # Generate QR image

            qr = qrcode.make(otp_uri)

            # Store PNG in memory

            buffer = io.BytesIO()

            qr.save(buffer, format="PNG")

            buffer.seek(0)

            # Return PNG response

            response = HttpResponse(
                buffer.getvalue(),
                content_type="image/png"
            )

            response["Content-Disposition"] = (
                'inline; filename="secureshare_qr.png"'
            )

            response["Cache-Control"] = "no-store"

            return response

        except Exception as e:

            print("QR generation error:", str(e))

            return Response(
                {"detail": "QR generation failed"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ==================================================
# OTP VALIDATION
# ==================================================

class ValidateOTPView(APIView):

    permission_classes = [AllowAny]

    def post(self, request, email):

        sanitized_email = email.strip().lower()

        otp = str(request.data.get("otp", "")).strip()

        # Validate OTP format

        if not otp.isdigit() or len(otp) != 6:

            return Response(
                {"detail": "Invalid OTP format"},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = User.objects.filter(
            email=sanitized_email
        ).first()

        if not user:

            return Response(
                {"detail": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        if not user.secret:

            return Response(
                {"detail": "TOTP secret is missing"},
                status=status.HTTP_400_BAD_REQUEST
            )

        totp = pyotp.TOTP(user.secret)

        # Allow a small clock difference

        if totp.verify(otp, valid_window=1):

            return Response(
                {
                    "message": "OTP is valid",
                    "role": user.access
                },
                status=status.HTTP_200_OK
            )

        return Response(
            {"detail": "Invalid OTP"},
            status=status.HTTP_400_BAD_REQUEST
        )


# ==================================================
# USER LOGIN
# ==================================================

class LoginView(APIView):

    permission_classes = [AllowAny]

    def post(self, request):

        email = request.data.get("email", "").strip().lower()
        password = request.data.get("password")

        if not email or not password:

            return Response(
                {"detail": "Email and password are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = User.objects.filter(email=email).first()

        if not user:

            return Response(
                {"detail": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not check_password(password, user.password):

            return Response(
                {"detail": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED
            )

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "role": user.access
            },
            status=status.HTTP_200_OK
        )


# ==================================================
# GET USERS BY EMAIL
# ==================================================

class GetUsersView(APIView):

    permission_classes = [AllowAny]

    def get(self, request, email):

        email = email.strip().lower()

        users = User.objects.exclude(
            email=email
        ).values(
            "email",
            "name",
            "access"
        )

        return Response(
            {"users": list(users)},
            status=status.HTTP_200_OK
        )


# ==================================================
# GET ALL USERS
# ==================================================

class GetUserView(APIView):

    permission_classes = [AllowAny]

    def get(self, request):

        users = User.objects.all().values(
            "email",
            "name",
            "access"
        )

        return Response(
            list(users),
            status=status.HTTP_200_OK
        )


# ==================================================
# FILE UPLOAD AND ENCRYPTION
# ==================================================

class UploadFileView(APIView):

    permission_classes = [AllowAny]

    def post(self, request):

        file = request.FILES.get("file")

        email = request.data.get("email", "").strip().lower()

        if not file:
            raise ValidationError("File is required")

        if not email:
            raise ValidationError("Email is required")

        user = User.objects.filter(email=email).first()

        if not user:
            raise ValidationError(f"'{email}' not found.")

        if EncryptedFile.objects.filter(
            filename=file.name,
            email=user
        ).exists():

            raise ValidationError(
                f"File '{file.name}' already exists."
            )

        # Generate AES-256 key and IV

        encryption_key = get_random_bytes(32)

        iv = get_random_bytes(AES.block_size)

        # Encrypt file

        encrypted_data = encrypt_file(
            file,
            encryption_key,
            iv
        )

        # Store encrypted file

        EncryptedFile.objects.create(
            email=user,
            filename=file.name,
            encrypted_file=encrypted_data,
            encryption_key=encryption_key,
            iv=iv
        )

        return Response(
            {"message": "File encrypted and uploaded successfully"},
            status=status.HTTP_201_CREATED
        )


# ==================================================
# FILE DECRYPTION
# ==================================================

class DecryptFileView(APIView):

    permission_classes = [AllowAny]

    def get(self, request, filename):

        try:

            encrypted_file = EncryptedFile.objects.get(
                filename=filename
            )

        except EncryptedFile.DoesNotExist:

            raise ValidationError(
                f"File '{filename}' not found."
            )

        encrypted_data = encrypted_file.encrypted_file

        encryption_key = encrypted_file.encryption_key

        iv = encrypted_file.iv

        decrypted_file = decrypt_file(
            encrypted_data,
            encryption_key,
            iv
        )

        response = HttpResponse(
            decrypted_file,
            content_type="application/octet-stream"
        )

        response["Content-Disposition"] = (
            f'attachment; filename="{filename}"'
        )

        return response


# ==================================================
# FILE SHARING
# ==================================================

class FileShareView(APIView):

    permission_classes = [AllowAny]

    def post(self, request):

        try:

            user_email = request.data.get("user")
            file_name = request.data.get("file")
            permission = request.data.get("permission")
            sender_email = request.data.get("sender")

            if not all([
                user_email,
                file_name,
                permission,
                sender_email
            ]):

                return Response(
                    {"error": "All fields are required."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:

                user = User.objects.get(
                    email=user_email.strip().lower()
                )

            except User.DoesNotExist:

                return Response(
                    {"error": "User does not exist."},
                    status=status.HTTP_404_NOT_FOUND
                )

            try:

                file = EncryptedFile.objects.get(
                    filename=file_name
                )

            except EncryptedFile.DoesNotExist:

                return Response(
                    {"error": "File does not exist."},
                    status=status.HTTP_404_NOT_FOUND
                )

            FileSharingInfo.objects.create(
                user=user,
                file=file,
                permission=permission,
                sender=sender_email
            )

            return Response(
                {"message": "File shared successfully."},
                status=status.HTTP_201_CREATED
            )

        except Exception as e:

            print("File sharing error:", str(e))

            return Response(
                {"error": "File sharing failed."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ==================================================
# GET SHARED FILES
# ==================================================

class FileShareDataView(APIView):

    permission_classes = [AllowAny]

    def get(self, request, user):

        try:

            user_obj = User.objects.get(
                email=user.strip().lower()
            )

        except User.DoesNotExist:

            return Response(
                {"error": "User not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        shared_data = FileSharingInfo.objects.filter(
            user=user_obj
        )

        data = [
            {
                "sender": item.sender,
                "file": item.file.filename,
                "permission": item.permission
            }
            for item in shared_data
        ]

        return Response(
            {"files": data},
            status=status.HTTP_200_OK
        )


# ==================================================
# FILE LIST
# ==================================================

class FileListView(APIView):

    permission_classes = [AllowAny]

    def get(self, request, email):

        try:

            user = User.objects.get(
                email=email.strip().lower()
            )

            files = EncryptedFile.objects.filter(
                email=user
            ).values("filename")

            return Response(
                {"files": list(files)},
                status=status.HTTP_200_OK
            )

        except User.DoesNotExist:

            return Response(
                {"files": []},
                status=status.HTTP_200_OK
            )


# ==================================================
# SERVE FILE
# ==================================================

class ServeFileView(APIView):

    permission_classes = [AllowAny]

    def get(self, request, filename):

        try:

            encrypted_file = EncryptedFile.objects.get(
                filename=filename
            )

        except EncryptedFile.DoesNotExist:

            raise ValidationError(
                f"File '{filename}' not found."
            )

        encrypted_data = encrypted_file.encrypted_file

        encryption_key = encrypted_file.encryption_key

        iv = encrypted_file.iv

        decrypted_data = decrypt_file(
            encrypted_data,
            encryption_key,
            iv
        )

        file_stream = io.BytesIO(decrypted_data)

        return FileResponse(
            file_stream,
            as_attachment=True,
            filename=filename,
            content_type="application/pdf"
        )
