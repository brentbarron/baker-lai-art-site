#!/usr/bin/env python3
"""
sync_notion.py — Pull paintings from Notion and update gallery.js + images/

Usage:
  python sync_notion.py

Reads NOTION_TOKEN from .env, queries the Paintings database, downloads any
new images, and rewrites gallery.js. Only paintings with "Include on Website"
checked are included. Order follows the "ID" field (descending = newest first).
"""

import json
import os
import re
import sys
import urllib.request

# ── Config ───────────────────────────────────────────────────────────────────

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_FILE    = os.path.join(SCRIPT_DIR, ".env")
GALLERY_JS  = os.path.join(SCRIPT_DIR, "gallery.js")
IMAGES_DIR  = os.path.join(SCRIPT_DIR, "images")
DB_ID       = "338be8ba-3b31-80bc-959b-f9b427d84758"
NOTION_VER  = "2022-06-28"

# ── Helpers ──────────────────────────────────────────────────────────────────

def load_token():
    token = os.environ.get("NOTION_TOKEN")
    if token:
        return token
    if os.path.exists(ENV_FILE):
        with open(ENV_FILE) as f:
            for line in f:
                line = line.strip()
                if line.startswith("NOTION_TOKEN="):
                    return line.split("=", 1)[1].strip()
    print("ERROR: NOTION_TOKEN not found in .env or environment variable")
    sys.exit(1)


def notion_post(token, path, body):
    req = urllib.request.Request(
        f"https://api.notion.com/v1{path}",
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Notion-Version": NOTION_VER,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"Notion API error {e.code}: {body}")
        raise


def fetch_all_paintings(token):
    """Fetch all pages from the Paintings DB where Include on Website is checked."""
    results, cursor = [], None
    while True:
        body = {
            "filter": {"property": "Include on Website", "checkbox": {"equals": True}},
            "sorts": [{"property": "ID", "direction": "descending"}],
        }
        if cursor:
            body["start_cursor"] = cursor
        page = notion_post(token, f"/databases/{DB_ID}/query", body)
        results.extend(page["results"])
        if not page.get("has_more"):
            break
        cursor = page["next_cursor"]
    return results


def title_to_slug(title):
    slug = title.strip().lower()
    slug = re.sub(r"[‘’′'']", "", slug)  # drop all apostrophe variants
    slug = re.sub(r"[^a-z0-9]+", "-", slug)             # everything else -> dash
    return slug.strip("-")


def normalise_dimensions(raw):
    """'24" x 36"'  →  '24x36'"""
    if not raw:
        return None
    s = re.sub(r'["“”’‘\s]', "", raw)
    s = re.sub(r"[xX×]", "x", s)
    return s or None


def download_file(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp, open(dest, "wb") as f:
        f.write(resp.read())


def write_gallery_js(entries):
    header = (
        "// Add or remove entries here to update the gallery.\n"
        '// src: path to image file (e.g. "images/my-painting.jpg") or a URL\n'
        "// title: optional — auto-generated from filename if omitted\n"
        '// medium: optional — e.g. "Oil on Canvas"\n'
        '// dimensions: optional — e.g. "12 x 16 in"\n'
        '// year: optional — e.g. "2024"\n'
        "\n"
        "window.GALLERY_DATA = [\n"
    )

    FIELD_ORDER = ["src", "title", "medium", "dimensions", "year", "notes"]
    item_strs = []
    for entry in entries:
        lines = []
        for field in FIELD_ORDER:
            if field in entry:
                lines.append(f"    {json.dumps(field)}: {json.dumps(entry[field])}")
        item_strs.append("  {\n" + ",\n".join(lines) + "\n  }")

    with open(GALLERY_JS, "w", encoding="utf-8") as f:
        f.write(header)
        f.write(",\n".join(item_strs))
        f.write("\n];\n")


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    token = load_token()

    print("Fetching paintings from Notion...")
    paintings = fetch_all_paintings(token)
    print(f"  {len(paintings)} painting(s) marked 'Include on Website'\n")

    os.makedirs(IMAGES_DIR, exist_ok=True)
    entries = []
    skipped = 0

    for p in paintings:
        props = p["properties"]

        # Title
        title_items = props.get("Painting Name", {}).get("title", [])
        title = title_items[0]["plain_text"].strip() if title_items else ""
        if not title:
            print(f"  SKIP (no title): {p['id']}")
            skipped += 1
            continue

        slug     = title_to_slug(title)
        img_file = f"{slug}.jpg"
        img_path = os.path.join(IMAGES_DIR, img_file)

        # Image — download if missing
        files = props.get("Painting", {}).get("files", [])
        if files and files[0].get("type") == "file":
            file_url = files[0]["file"]["url"]
            if not os.path.exists(img_path):
                print(f"  + Downloading: {title}")
                try:
                    download_file(file_url, img_path)
                except Exception as e:
                    print(f"    ERROR: {e} - skipping")
                    skipped += 1
                    continue
            else:
                print(f"  ok {title}")
        elif os.path.exists(img_path):
            print(f"  ok {title} (local image, no Notion upload)")
        else:
            print(f"  SKIP (no image): {title}")
            skipped += 1
            continue

        # Metadata
        medium_obj = props.get("Medium", {}).get("select") or {}
        medium     = medium_obj.get("name") or None

        dim_items  = props.get("Dimensions", {}).get("rich_text", [])
        dimensions = normalise_dimensions(dim_items[0]["plain_text"] if dim_items else None)

        available  = props.get("Available for Sale", {}).get("checkbox", False)
        notes      = "available for purchase" if available else None

        entry = {"src": f"images/{img_file}", "title": title}
        if medium:     entry["medium"]     = medium
        if dimensions: entry["dimensions"] = dimensions
        entry["year"] = "2026"
        if notes:      entry["notes"]      = notes

        entries.append(entry)

    print(f"\nWriting gallery.js - {len(entries)} paintings, {skipped} skipped...")
    write_gallery_js(entries)
    print("Done!")


if __name__ == "__main__":
    main()
