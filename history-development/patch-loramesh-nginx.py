#!/usr/bin/env python3
from pathlib import Path

conf = Path("/etc/nginx/sites-available/loramesh.conf")
snippet = Path("/tmp/loramesh-v2-split.snippet.conf").read_text()
text = conf.read_text()
start_marker = "  # --- mesh_v2 (lora2u.com/v2)"
end_marker = "  # Legacy v1 (PM2 lora2u :5001)"
start = text.find(start_marker)
if start == -1:
    raise SystemExit(f"start marker not found: {start_marker!r}")
end = text.find(end_marker, start)
if end == -1:
    raise SystemExit(f"end marker not found: {end_marker!r}")
header = "# NOTE: v1/v2 API split — /api→5001, /v2/api→5002 (2026-05-24)\n"
if "v1/v2 API split" not in text:
    text = header + text
    start = text.find(start_marker)
    end = text.find(end_marker, start)
conf.write_text(text[:start] + snippet + text[end:])
print("nginx patch OK")
