# Test Credentials

## Admin Login
- Email: asrenterprisespatna@gmail.com
- Password: admin@asr123 (or test123)
- Mobile: 8877896889

## Staff Login
- Staff ID: ASR1024
- Password: test123

## Contact Info
- WhatsApp API: 8298389097
- Display Contact: 9296389097
- Support Email: support@asrenterprises.in

## OTP Testing
- Backend OTP API: POST /api/otp/send with body {"mobile": "8877896889"}
- Backend OTP Verify: POST /api/otp/verify with body {"mobile": "8877896889", "otp": "<received_otp>"}
- OTP stored in MongoDB collection: otp_store
- Max 5 attempts, 5-minute expiry
