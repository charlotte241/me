#!/usr/bin/env python3
"""Pull events + orders from Ticket Tailor and write docs/data.json for the dashboard.

Auth: TICKET_TAILOR_API_KEY env var (Ticket Tailor API key, Basic auth username, blank password).
Privacy: emails are replaced with anonymous hashes unless INCLUDE_EMAILS=true.
"""
import base64
import hashlib
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone

BASE = "https://api.tickettailor.com"
API_KEY = os.environ.get("TICKET_TAILOR_API_KEY", "")
INCLUDE_EMAILS = os.environ.get("INCLUDE_EMAILS", "false").lower() == "true"

if not API_KEY:
    sys.exit("TICKET_TAILOR_API_KEY is not set")

AUTH = base64.b64encode(f"{API_KEY}:".encode()).decode()


def get(path):
    req = urllib.request.Request(BASE + path, headers={
        "Authorization": f"Basic {AUTH}",
        "Accept": "application/json",
    })
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def fetch_all(path):
    out, url = [], f"{path}?limit=100"
    for _ in range(100):
        res = get(url)
        out.extend(res.get("data", []))
        nxt = (res.get("links") or {}).get("next")
        if not nxt:
            break
        url = nxt if nxt.startswith("/") else "/" + nxt
    return out


def key(email):
    email = (email or "").strip().lower()
    if not email:
        return None
    return hashlib.sha256(("pbw|" + email).encode()).hexdigest()[:16]


events = fetch_all("/v1/events")
orders = fetch_all("/v1/orders")

slim_events = [{
    "id": e["id"],
    "name": e.get("name"),
    "start_unix": (e.get("start") or {}).get("unix"),
} for e in events]

slim_orders = []
for o in orders:
    ev = (o.get("event_summary") or {})
    buyer = (o.get("buyer_details") or {})
    row = {
        "id": o["id"],
        "event_id": ev.get("event_id"),
        "created_at": o.get("created_at"),
        "total_paid": o.get("total_paid") or 0,
        "refund_amount": o.get("refund_amount") or 0,
        "status": o.get("status"),
        "referral_tag": o.get("referral_tag"),
        "buyer_name": buyer.get("name"),
        "buyer_key": key(buyer.get("email")),
        "tickets": [{
            "description": t.get("description"),
            "status": t.get("status"),
            "key": key(t.get("email") or buyer.get("email")),
        } for t in (o.get("issued_tickets") or [])],
    }
    if INCLUDE_EMAILS:
        row["buyer_email"] = buyer.get("email")
    slim_orders.append(row)

out = {
    "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    "include_emails": INCLUDE_EMAILS,
    "events": slim_events,
    "orders": slim_orders,
}

os.makedirs("docs", exist_ok=True)
with open("docs/data.json", "w") as f:
    json.dump(out, f, separators=(",", ":"))

print(f"Wrote docs/data.json: {len(slim_events)} events, {len(slim_orders)} orders, emails={'ON' if INCLUDE_EMAILS else 'OFF'}")
