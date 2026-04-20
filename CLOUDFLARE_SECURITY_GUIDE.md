# ASR Enterprises - Cloudflare Security Setup Guide (Free Tier)

## 1. SSL/TLS Settings (Most Important)

Go to: **SSL/TLS → Overview**

| Setting | Recommended Value |
|---------|------------------|
| SSL/TLS Mode | **Full (strict)** |
| Always Use HTTPS | **ON** |
| Automatic HTTPS Rewrites | **ON** |
| TLS 1.3 | **ON** |

---

## 2. Security Settings

Go to: **Security → Settings**

| Setting | Recommended Value |
|---------|------------------|
| Security Level | **Medium** (or High if under attack) |
| Challenge Passage | **30 minutes** |
| Browser Integrity Check | **ON** |

---

## 3. Firewall Rules (5 free rules)

Go to: **Security → WAF → Custom Rules**

### Rule 1: Block Bad Bots
```
(cf.client.bot) and not (cf.client.bot eq "verified_bot")
Action: Block
```

### Rule 2: Block SQL Injection Attempts
```
(http.request.uri.query contains "union" and http.request.uri.query contains "select") or 
(http.request.uri.query contains "drop" and http.request.uri.query contains "table")
Action: Block
```

### Rule 3: Block XSS Attempts
```
(http.request.uri contains "<script") or 
(http.request.uri contains "javascript:")
Action: Block
```

### Rule 4: Rate Limit Admin Pages
```
(http.request.uri.path contains "/admin" or http.request.uri.path contains "/api/admin")
Action: Managed Challenge
```

### Rule 5: Block Suspicious User Agents
```
(http.user_agent contains "curl") and not (ip.src in {your_server_ip})
Action: Managed Challenge
```

---

## 4. Bot Protection

Go to: **Security → Bots**

| Setting | Value |
|---------|-------|
| Bot Fight Mode | **ON** |
| JavaScript Detections | **ON** |

---

## 5. DDoS Protection (Automatic)

Go to: **Security → DDoS**

- L7 DDoS Protection: **Already enabled (Free)**
- Sensitivity: **Medium** (default)

---

## 6. Page Rules (3 free rules)

Go to: **Rules → Page Rules**

### Rule 1: Cache Static Assets
```
URL: www.asrenterprises.in/static/*
Setting: Cache Level = Cache Everything
Edge Cache TTL: 1 month
```

### Rule 2: Bypass Cache for Admin
```
URL: www.asrenterprises.in/admin/*
Setting: Cache Level = Bypass
Security Level: High
```

### Rule 3: Force HTTPS
```
URL: http://asrenterprises.in/*
Setting: Always Use HTTPS
```

---

## 7. Speed Optimizations (Free)

Go to: **Speed → Optimization**

| Setting | Value |
|---------|-------|
| Auto Minify (JavaScript, CSS, HTML) | **ON** |
| Brotli | **ON** |
| Early Hints | **ON** |
| Rocket Loader | **ON** (test first) |

---

## 8. Under Attack Mode (Emergency)

If you're being attacked:

1. Go to: **Overview**
2. Click: **Under Attack Mode** → **ON**
3. This adds a 5-second delay for all visitors (proves they're human)
4. Turn **OFF** when attack subsides

---

## 9. Monitoring

Go to: **Analytics → Security**

- Monitor blocked threats
- Check firewall events
- Review DDoS attacks

---

## Quick Security Checklist

- [x] SSL Full (Strict) mode enabled
- [x] Always Use HTTPS enabled
- [x] Bot Fight Mode enabled
- [x] Browser Integrity Check enabled
- [x] Firewall rules created
- [x] DDoS protection active (automatic)
- [x] Page rules for caching configured

---

## Your Backend Security (Already Implemented)

✅ Rate Limiting (5 requests/minute for auth, 10 for payments)
✅ IP Blocking (auto-blocks after 10 failed attempts)
✅ Security Headers (CSP, XSS, HSTS, etc.)
✅ Input Validation & Sanitization
✅ Request Size Limits (10MB normal, 50MB uploads)
✅ Suspicious Activity Logging
✅ Payment Signature Verification (HMAC)
✅ Admin Login Protection (OTP + lockout)

---

## Contact for Help

If you need assistance:
- Cloudflare Community: https://community.cloudflare.com/
- Cloudflare Support: https://support.cloudflare.com/
