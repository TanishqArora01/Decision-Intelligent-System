"""
transaction-adapters/iso8583/adapter.py
ISO 8583 Transaction Adapter

Parses incoming ISO 8583 financial messages (used by payment networks:
Visa, Mastercard, domestic switches) and normalises them to the
canonical transaction schema.

ISO 8583 field mapping used here:
  F2   → PAN (card number) → customer_id (hashed)
  F3   → Processing code
  F4   → Transaction amount
  F5   → Settlement amount
  F7   → Transmission datetime
  F11  → System trace audit number (STAN) → txn_id component
  F12  → Local transaction time
  F13  → Local transaction date
  F18  → Merchant category code (MCC)
  F22  → POS entry mode → channel
  F32  → Acquiring institution code
  F37  → Retrieval reference number → txn_id
  F41  → Card acceptor terminal ID → device_id
  F42  → Card acceptor ID → merchant_id
  F43  → Card acceptor name/location → city/country
  F49  → Currency code
  F102 → Account ID 1 → customer_id fallback

Listens on a TCP socket for raw ISO 8583 frames (2-byte length prefix).
Real deployments use a dedicated HSM-connected gateway — this adapter
provides the software translation layer.
"""
from __future__ import annotations

import hashlib
import logging
import os
import socket
import struct
import threading
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("adapter.iso8583")

# Add parent to path for base_adapter import
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from base_adapter import BaseAdapter, CanonicalTransaction

# MCC → merchant category mapping (abbreviated)
MCC_MAP = {
    "5411": "grocery",       "5732": "electronics",
    "5812": "restaurants",   "5541": "fuel",
    "7995": "gambling",      "5094": "jewelry",
    "6011": "atm",           "4829": "money_transfer",
    "5999": "online_retail", "6012": "financial_services",
}

# ISO 8583 channel codes (POS entry mode)
CHANNEL_MAP = {
    "01": "CARD_SWIPE", "02": "CARD_SWIPE",
    "05": "CHIP",       "07": "CONTACTLESS",
    "10": "CREDENTIAL_ON_FILE",
    "81": "E_COMMERCE", "90": "MAGNETIC_STRIPE",
}

LISTEN_HOST = os.getenv("ISO8583_HOST", "0.0.0.0")
LISTEN_PORT = int(os.getenv("ISO8583_PORT", "9600"))
HASH_SALT   = os.getenv("ISO8583_HASH_SALT", "iso-adapter-salt")


def _hash_pan(pan: str) -> str:
    """Hash PAN to produce a stable customer_id. Never store raw PAN."""
    clean = pan.strip().replace(" ", "")
    return "card_" + hashlib.sha256((HASH_SALT + clean).encode()).hexdigest()[:16]


def _parse_iso_dict(raw_bytes: bytes) -> dict:
    """
    Minimal ISO 8583 parser.
    Real deployments use a certified ISO 8583 library (e.g. py8583, jPOS).
    This parser handles the most common field layout for demonstration.
    Returns a dict of field_number → value.
    """
    if len(raw_bytes) < 20:
        raise ValueError("Message too short")

    # MTI (4 bytes ASCII) + Bitmap (16 bytes hex) + data fields
    mti    = raw_bytes[:4].decode("ascii", errors="replace")
    bitmap = int(raw_bytes[4:20], 16)
    pos    = 20

    # Field lengths (simplified — real ISO 8583 uses TLV or fixed/LLVAR/LLLVAR)
    FIELD_LENGTHS = {
        2: ("LLVAR", None),   # PAN
        3: ("FIXED", 6),      # Processing code
        4: ("FIXED", 12),     # Amount
        5: ("FIXED", 12),     # Settlement amount
        7: ("FIXED", 10),     # Transmission datetime
        11: ("FIXED", 6),     # STAN
        12: ("FIXED", 6),     # Local time
        13: ("FIXED", 4),     # Local date
        18: ("FIXED", 4),     # MCC
        22: ("FIXED", 3),     # POS entry mode
        37: ("FIXED", 12),    # Retrieval reference
        41: ("FIXED", 8),     # Terminal ID
        42: ("FIXED", 15),    # Merchant ID
        43: ("LLVAR", None),  # Merchant name/location
        49: ("FIXED", 3),     # Currency code
        102: ("LLVAR", None), # Account ID
    }

    fields = {"mti": mti}
    data   = raw_bytes[20:].decode("ascii", errors="replace")
    offset = 0

    for field_num in range(1, 129):
        if not (bitmap >> (128 - field_num)) & 1:
            continue
        if field_num not in FIELD_LENGTHS:
            continue  # skip unknown fields
        ftype, flen = FIELD_LENGTHS[field_num]
        try:
            if ftype == "FIXED":
                fields[field_num] = data[offset:offset + flen].strip()
                offset += flen
            else:  # LLVAR
                ll = int(data[offset:offset + 2])
                offset += 2
                fields[field_num] = data[offset:offset + ll]
                offset += ll
        except Exception:
            break

    return fields


class ISO8583Adapter(BaseAdapter):
    """Adapts ISO 8583 payment messages to canonical transactions."""

    def __init__(self):
        super().__init__("iso8583")
        self._stop = threading.Event()

    def normalise(self, raw: dict) -> Optional[CanonicalTransaction]:
        """Convert parsed ISO 8583 field dict to CanonicalTransaction."""
        try:
            pan         = raw.get(2, "") or raw.get(102, "")
            amount_str  = raw.get(4, "0") or "0"
            currency    = raw.get(49, "840")
            rrn         = (raw.get(37, "") or "").strip()
            stan        = (raw.get(11, "") or "").strip()
            terminal_id = (raw.get(41, "") or "").strip()
            merchant_id = (raw.get(42, "") or "").strip()
            mcc         = (raw.get(18, "") or "").strip()
            entry_mode  = (raw.get(22, "") or "").strip()
            location    = (raw.get(43, "") or "").strip()
            txn_date    = (raw.get(7, "") or "").strip()

            if not pan:
                return None  # cannot process without card number

            # Construct txn_id from RRN + STAN (globally unique in ISO 8583)
            txn_id = f"iso_{rrn}_{stan}" if rrn else f"iso_{stan}_{terminal_id}"

            # Parse amount (ISO 8583 amounts are in cents, 12-digit zero-padded)
            try:
                amount = int(amount_str) / 100.0
            except ValueError:
                amount = 0.0

            # Currency code (ISO 4217 numeric → alpha)
            currency_alpha = {"840": "USD", "978": "EUR", "356": "INR",
                              "826": "GBP", "784": "AED"}.get(currency, currency)

            # Channel from POS entry mode
            channel = CHANNEL_MAP.get(entry_mode[:2], "CARD_NETWORK")

            # Location parsing (format: "MERCHANT NAME    CITY        COUNTRY")
            country_code = location[-2:].strip() if len(location) >= 2 else ""
            city         = location[38:51].strip() if len(location) >= 51 else ""

            # Timestamp
            try:
                if len(txn_date) >= 10:
                    txn_ts = datetime.strptime(txn_date, "%m%d%H%M%S").replace(
                        year=datetime.now().year, tzinfo=timezone.utc
                    ).isoformat()
                else:
                    txn_ts = datetime.now(timezone.utc).isoformat()
            except ValueError:
                txn_ts = datetime.now(timezone.utc).isoformat()

            return CanonicalTransaction(
                txn_id           = txn_id,
                customer_id      = _hash_pan(pan),
                amount           = amount,
                currency         = currency_alpha,
                channel          = channel,
                merchant_id      = merchant_id.strip(),
                merchant_category= MCC_MAP.get(mcc, "other"),
                device_id        = terminal_id,
                country_code     = country_code,
                city             = city,
                txn_ts           = txn_ts,
                adapter_source   = "iso8583",
            )
        except Exception as e:
            logger.warning("ISO 8583 normalise failed: %s", e)
            return None

    def handle_connection(self, conn: socket.socket, addr: tuple):
        """Handle a single TCP connection (one ISO 8583 session)."""
        logger.info("ISO 8583 connection from %s", addr)
        try:
            while not self._stop.is_set():
                # Read 2-byte message length prefix
                header = conn.recv(2)
                if len(header) < 2:
                    break
                msg_len = struct.unpack(">H", header)[0]
                data    = b""
                while len(data) < msg_len:
                    chunk = conn.recv(msg_len - len(data))
                    if not chunk:
                        break
                    data += chunk
                if len(data) < msg_len:
                    break

                try:
                    fields = _parse_iso_dict(data)
                    txn    = self.normalise(fields)
                    if txn:
                        ok = self.publish(txn)
                        # Send ISO 8583 response (0210 = financial response)
                        response = b"0210" + b"\x00" * 16 + b"000000"  # simplified
                        conn.send(struct.pack(">H", len(response)) + response)
                    else:
                        logger.debug("ISO 8583: skipped unparseable message")
                except Exception as e:
                    logger.error("ISO 8583 parse error: %s", e)
        finally:
            conn.close()
            logger.info("ISO 8583 connection closed: %s", addr)

    def run(self):
        """Start TCP listener for ISO 8583 connections."""
        server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server.bind((LISTEN_HOST, LISTEN_PORT))
        server.listen(10)
        server.settimeout(2.0)
        logger.info("ISO 8583 adapter listening on %s:%d", LISTEN_HOST, LISTEN_PORT)

        while not self._stop.is_set():
            try:
                conn, addr = server.accept()
                t = threading.Thread(target=self.handle_connection,
                                     args=(conn, addr), daemon=True)
                t.start()
            except socket.timeout:
                continue
            except Exception as e:
                if not self._stop.is_set():
                    logger.error("Accept error: %s", e)

        server.close()
        self.flush()


if __name__ == "__main__":
    import signal
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s | %(levelname)-8s | %(message)s")
    adapter = ISO8583Adapter()
    signal.signal(signal.SIGINT,  lambda s, f: adapter._stop.set())
    signal.signal(signal.SIGTERM, lambda s, f: adapter._stop.set())
    adapter.run()
