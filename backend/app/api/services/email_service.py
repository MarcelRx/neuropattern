import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.api.core.config import settings

logger = logging.getLogger(__name__)


def send_password_reset_email(to_email: str, reset_token: str, user_name: str = "User"):
    """
    Send password reset email with reset link.
    """
    if not all([settings.SMTP_USER, settings.SMTP_PASSWORD]):
        logger.debug("SMTP credentials not configured")
        return False

    # Create reset link - USE HASH ROUTER FORMAT (/#/path)
    reset_link = f"{settings.FRONTEND_URL}/#/reset-password?token={reset_token}"

    subject = "Reset Your NeuroPattern Password"

    # HTML email body
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: #3d99f5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
            .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }}
            .button {{ display: inline-block; background: #3d99f5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
            .footer {{ text-align: center; color: #999; font-size: 12px; margin-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔐 Password Reset Request</h1>
            </div>
            <div class="content">
                <p>Hi {user_name},</p>
                <p>We received a request to reset your password for your NeuroPattern account.</p>
                <p>Click the button below to reset your password:</p>
                <center>
                    <a href="{reset_link}" class="button">Reset Password</a>
                </center>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #3d99f5;">{reset_link}</p>
                <p><strong>This link will expire in 30 minutes.</strong></p>
                <p>If you didn't request this, you can safely ignore this email.</p>
            </div>
            <div class="footer">
                <p>NeuroPattern LifeTracker</p>
                <p>This is an automated email, please do not reply.</p>
            </div>
        </div>
    </body>
    </html>
    """

    # Plain text fallback
    text_body = f"""
    Hi {user_name},

    We received a request to reset your password for your NeuroPattern account.

    Click this link to reset your password:
    {reset_link}

    This link will expire in 30 minutes.

    If you didn't request this, you can safely ignore this email.

    NeuroPattern LifeTracker
    """

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.FROM_EMAIL
        msg["To"] = to_email

        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.FROM_EMAIL, to_email, msg.as_string())

        logger.debug(f"Password reset email sent to {to_email}")
        return True

    except (smtplib.SMTPException, ConnectionError, OSError) as e:
        logger.debug(f"Failed to send email: {e}")
        return False


def send_welcome_email(to_email: str, user_name: str = "User"):
    """
    Send a welcome email to the user upon registration.
    """
    if not all([settings.SMTP_USER, settings.SMTP_PASSWORD]):
        logger.debug("SMTP credentials not configured")
        return False

    subject = "Welcome to NeuroPattern! 🧠"

    login_link = f"{settings.FRONTEND_URL}/#/auth"

    # HTML email body
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: #3d99f5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
            .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }}
            .button {{ display: inline-block; background: #3d99f5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
            .footer {{ text-align: center; color: #999; font-size: 12px; margin-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Welcome to NeuroPattern, {user_name}!</h1>
            </div>
            <div class="content">
                <p>We're thrilled to have you join our community focused on wellbeing and personal growth.</p>
                <p>NeuroPattern uses AI to help you track your patterns and improve your life quality through empathetic coaching and data-driven insights.</p>
                <p>Ready to get started? Sign in to your account to begin:</p>
                <center>
                    <a href="{login_link}" class="button">Sign In to Your Account</a>
                </center>
                <p>If you have any questions, feel free to reply to this email.</p>
            </div>
            <div class="footer">
                <p>NeuroPattern LifeTracker</p>
                <p>Empowering your personal growth.</p>
            </div>
        </div>
    </body>
    </html>
    """

    # Plain text fallback
    text_body = f"""
    Welcome to NeuroPattern, {user_name}!

    We're thrilled to have you join our community focused on wellbeing and personal growth.

    Ready to get started? Sign in to your account to begin:
    {login_link}

    NeuroPattern LifeTracker
    """

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.FROM_EMAIL
        msg["To"] = to_email

        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.FROM_EMAIL, to_email, msg.as_string())

        logger.debug(f"Welcome email sent to {to_email}")
        return True

    except (smtplib.SMTPException, ConnectionError, OSError) as e:
        logger.debug(f"Failed to send welcome email: {e}")
        return False


def send_verification_email(to_email: str, token: str, user_name: str = "User"):
    """
    Send email verification link to new users.
    """
    if not all([settings.SMTP_USER, settings.SMTP_PASSWORD]):
        logger.debug("SMTP credentials not configured")
        return False

    # The link points to the backend API endpoint which will verify the token
    # and then redirect the user to the frontend login page.
    verification_link = f"{settings.BACKEND_URL}/api/v1/auth/verify-email?token={token}"

    subject = "Verify Your NeuroPattern Account 🧠"

    # HTML email body
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: #3d99f5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
            .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }}
            .button {{ display: inline-block; background: #3d99f5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
            .footer {{ text-align: center; color: #999; font-size: 12px; margin-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Welcome to NeuroPattern!</h1>
            </div>
            <div class="content">
                <p>Hi {user_name},</p>
                <p>Thank you for joining NeuroPattern LifeTracker. To complete your registration and activate your account, please verify your email address.</p>
                <center>
                    <a href="{verification_link}" class="button">Verify Email Address</a>
                </center>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #3d99f5;">{verification_link}</p>
                <p><strong>This link will expire in 24 hours.</strong></p>
                <p>If you didn't create an account, you can safely ignore this email.</p>
            </div>
            <div class="footer">
                <p>NeuroPattern LifeTracker</p>
                <p>Empowering your personal growth through AI insights.</p>
            </div>
        </div>
    </body>
    </html>
    """

    # Plain text fallback
    text_body = f"""
    Hi {user_name},

    Welcome to NeuroPattern!

    To complete your registration, please verify your email address by clicking the link below:
    {verification_link}

    This link will expire in 24 hours.

    NeuroPattern LifeTracker
    """

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.FROM_EMAIL
        msg["To"] = to_email

        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.FROM_EMAIL, to_email, msg.as_string())

        return True
    except (smtplib.SMTPException, ConnectionError, OSError) as e:
        logger.debug(f"Failed to send verification email: {e}")
        return False
