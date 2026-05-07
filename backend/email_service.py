import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
FROM_EMAIL = os.getenv("FROM_EMAIL")
FRONTEND_URL = os.getenv("FRONTEND_URL")

def send_password_reset_email(to_email: str, reset_token: str, user_name: str = "User"):
    """
    Send password reset email with reset link.
    """
    if not all([SMTP_USER, SMTP_PASSWORD]):
        print("SMTP credentials not configured")
        return False
    
    # Create reset link - USE HASH ROUTER FORMAT (/#/path)
    reset_link = f"{FRONTEND_URL}/#/reset-password?token={reset_token}"
    
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
        msg["From"] = FROM_EMAIL
        msg["To"] = to_email
        
        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))
        
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(FROM_EMAIL, to_email, msg.as_string())
        
        print(f"Password reset email sent to {to_email}")
        return True
        
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False