"""Write the OpenAPI document. Prefers the real app (cco.main:app, T03); falls back to the contract stub."""
import json
import sys
from pathlib import Path

try:
    from cco.main import app  # type: ignore
    source = "cco.main"
except Exception:  # real app not built yet, or it needs services to import
    from cco.contracts.stub_app import app
    source = "cco.contracts.stub_app"

out = Path(sys.argv[1] if len(sys.argv) > 1 else "../contracts/openapi.json")
out.write_text(json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n")
print(f"openapi from {source} -> {out}")
