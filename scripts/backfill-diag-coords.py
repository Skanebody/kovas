#!/usr/bin/env python3
"""
KOVAS — Backfill des coordonnées manquantes des diagnostiqueurs.

Géocode (ville + code postal) via l'API officielle BAN (api-adresse.data.gouv.fr,
sans clé, open data) et met à jour geo_lat/geo_lng + latitude/longitude pour les
fiches qui n'ont pas encore de coordonnées — afin que la carte « zone
d'intervention » s'affiche pour TOUS les diagnostiqueurs.

Lecture des secrets depuis .env.local à la racine.
"""
import json
import os
import re
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = {}
for line in open(os.path.join(ROOT, ".env.local")):
    s = line.strip()
    if s and not s.startswith("#") and "=" in s:
        k, v = s.split("=", 1)
        ENV[k] = v.strip().strip('"').strip("'")

URL = ENV["NEXT_PUBLIC_SUPABASE_URL"]
SR = ENV["SUPABASE_SERVICE_ROLE_KEY"]
HDR = {"apikey": SR, "Authorization": f"Bearer {SR}", "Content-Type": "application/json"}


def sb_get(path):
    req = urllib.request.Request(f"{URL}/rest/v1/{path}", headers=HDR)
    return json.load(urllib.request.urlopen(req, timeout=30))


def sb_patch(diag_id, payload):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{URL}/rest/v1/diagnosticians?id=eq.{diag_id}",
        data=body, method="PATCH",
        headers={**HDR, "Prefer": "return=minimal"},
    )
    urllib.request.urlopen(req, timeout=30).read()


def geocode(city, postcode, address):
    """Retourne (lat, lng) via BAN, ou None."""
    q = (address or city or "").strip()
    if not q:
        return None
    params = {"q": q, "limit": "1"}
    if postcode and re.match(r"^\d{5}$", str(postcode)):
        params["postcode"] = str(postcode)
    elif city:
        params["type"] = "municipality"
    u = "https://api-adresse.data.gouv.fr/search/?" + urllib.parse.urlencode(params)
    try:
        req = urllib.request.Request(u, headers={"User-Agent": "KOVAS-annuaire/1.0"})
        data = json.load(urllib.request.urlopen(req, timeout=15))
        feats = data.get("features") or []
        if not feats:
            return None
        lng, lat = feats[0]["geometry"]["coordinates"]
        return (round(float(lat), 6), round(float(lng), 6))
    except Exception:
        return None


def main():
    # Pagination : récupère tous les diags sans geo_lat
    rows = []
    offset = 0
    while True:
        page = sb_get(
            "diagnosticians?select=id,city,postcode,address&geo_lat=is.null"
            f"&order=id&limit=1000&offset={offset}"
        )
        rows.extend(page)
        if len(page) < 1000:
            break
        offset += 1000
    print(f"{len(rows)} fiches sans coordonnées à géocoder.")

    ok = skip = fail = 0
    for i, r in enumerate(rows, 1):
        coords = geocode(r.get("city"), r.get("postcode"), r.get("address"))
        if not coords:
            skip += 1
            continue
        lat, lng = coords
        try:
            sb_patch(r["id"], {
                "geo_lat": lat, "geo_lng": lng,
                "latitude": lat, "longitude": lng,
            })
            ok += 1
        except Exception:
            fail += 1
        if i % 50 == 0:
            print(f"  {i}/{len(rows)} — maj:{ok} skip:{skip} fail:{fail}")
        time.sleep(0.05)  # poli (BAN ~50 req/s/IP)

    print(f"\n=== Terminé === mis à jour:{ok} · non géocodables:{skip} · erreurs:{fail}")


if __name__ == "__main__":
    main()
