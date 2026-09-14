import os
import re
import ipaddress
import logging
import smtplib
import asyncio
from email.message import EmailMessage
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# Konfigurasi SMTP Mandiri
SMTP_HOST = os.environ.get("SMTP_HOST")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Binara LMS")
EMAIL_FROM_ADDRESS = os.environ.get("EMAIL_FROM_ADDRESS", SMTP_USER)
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")
APP_BASE_URL = (os.environ.get("APP_BASE_URL") or "").rstrip("/")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)

def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)

def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)

class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []

def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan(); scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")

def _send_smtp_sync(to: str, subject: str, html: str):
    if not SMTP_USER or not SMTP_PASSWORD or not SMTP_HOST:
        logger.error("Kredensial SMTP tidak lengkap. Pengiriman email dilewati.")
        return None

    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = f"{EMAIL_FROM_NAME} <{EMAIL_FROM_ADDRESS}>"
    msg['To'] = to
    if EMAIL_REPLY_TO:
        msg['Reply-To'] = EMAIL_REPLY_TO

    msg.set_content("Harap gunakan klien surel yang mendukung HTML.")
    msg.add_alternative(html, subtype='html')

    try:
        if SMTP_PORT == 465:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.send_message(msg)
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.send_message(msg)
        return "sent"
    except Exception as e:
        logger.error(f"Gagal mengirim email via SMTP: {e}")
        raise e

async def send_email(*, to: str, subject: str, html: str) -> str | None:
    _assert_safe_email(subject, html)
    try:
        result = await asyncio.to_thread(_send_smtp_sync, to, subject, html)
        return result
    except Exception:
        return None

async def notify_safe(to: str, subject: str, html: str) -> bool:
    try:
        await send_email(to=to, subject=subject, html=html)
        return True
    except Exception as e:
        logger.error(f"Email send error to {to}: {e}")
        return False

def _shell(inner: str) -> str:
    cta = (f'<p style="margin:24px 0"><a href="{APP_BASE_URL}/login" '
           f'style="background:#0E7490;color:#ffffff;text-decoration:none;padding:12px 22px;'
           f'border-radius:999px;font-weight:600">Buka Binara LMS</a></p>') if APP_BASE_URL else ""
    return (
        '<table role="presentation" width="100%" style="background:#F4F7FE;padding:24px">'
        '<tr><td align="center"><table role="presentation" width="560" '
        'style="background:#ffffff;border-radius:16px;border:1px solid #E2E8F0;'
        'font-family:Arial,Helvetica,sans-serif;color:#0A1128">'
        '<tr><td style="padding:28px 32px">'
        f'<p style="font-size:18px;font-weight:700;color:#0E7490;margin:0 0 16px">Binara LMS</p>'
        f'{inner}{cta}'
        '<p style="font-size:12px;color:#94A3B8;margin-top:24px">'
        'Email ini dikirim otomatis oleh Binara LMS sebagai notifikasi layanan. '
        'Kami tidak pernah meminta kata sandi atau data kartu melalui email.</p>'
        '</td></tr></table></td></tr></table>'
    )

async def notify_bid_accepted(to: str, tutor_name: str, slot_title: str, date: str, time_range: str):
    subject = f"Selamat! Bidding mengajar Anda diterima — {slot_title}"
    inner = (
        f'<p>Halo {escape(tutor_name)},</p>'
        f'<p>Kabar baik! Pengajuan bidding Anda untuk kelas '
        f'<strong>{escape(slot_title)}</strong> telah <strong>diterima</strong> oleh admin.</p>'
        f'<p>Jadwal: <strong>{escape(date)}</strong>, pukul {escape(time_range)}.</p>'
        f'<p>Kelas ini kini muncul di Kalender Mengajar dan Manajemen Kelas Anda.</p>'
    )
    return await notify_safe(to, subject, _shell(inner))

async def notify_new_tryout(recipients: list, tryout_title: str, subject_name: str):
    subject = f"Try Out baru tersedia: {tryout_title}"
    for r in recipients:
        inner = (
            f'<p>Halo {escape(r.get("name") or "Siswa")},</p>'
            f'<p>Sebuah Try Out baru telah dirilis dan siap Anda kerjakan:</p>'
            f'<p style="font-size:16px"><strong>{escape(tryout_title)}</strong> '
            f'<span style="color:#94A3B8">({escape(subject_name)})</span></p>'
            f'<p>Masuk ke portal siswa lalu buka menu CBT / Try Out untuk mulai mengerjakan.</p>'
        )
        await notify_safe(r["email"], subject, _shell(inner))

async def notify_new_material(recipients: list, class_title: str, item_label: str):
    subject = f"Pembaruan kelas: {class_title}"
    for r in recipients:
        inner = (
            f'<p>Halo {escape(r.get("name") or "Siswa")},</p>'
            f'<p>Ada pembaruan pada kelas <strong>{escape(class_title)}</strong>:</p>'
            f'<p style="font-size:16px"><strong>{escape(item_label)}</strong></p>'
            f'<p>Masuk ke portal siswa lalu buka menu Jadwal untuk melihat detailnya.</p>'
        )
        await notify_safe(r["email"], subject, _shell(inner))