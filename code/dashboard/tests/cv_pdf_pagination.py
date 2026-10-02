"""Render the real print route with Chromium, then inspect every A4 PDF.

Run after ``npm run build`` from the dashboard directory:
    python tests/cv_pdf_pagination.py
"""

import json
import shutil
import subprocess
import tempfile
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

import fitz


ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "dist" / "dashboard" / "browser"
OUTPUT = ROOT / "tests" / "output"
FIXTURE = json.loads((ROOT / "tests" / "fixtures" / "two-page-cv.json").read_text(encoding="utf-8"))
TEMPLATES = ("modern", "classic", "onyx")
MARKERS = (
    "Camille Test",
    "EXPERIENCEFINALE",
    "PROJETFINAL",
    "Esprit de cooperation",
    "Cyclisme",
    "Universite Regionale",
    "Professionnel",
)


def chrome_executable() -> str:
    candidates = (
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
    )
    for candidate in candidates:
        if Path(candidate).is_file():
            return candidate
    found = shutil.which("google-chrome") or shutil.which("chromium")
    if not found:
        raise RuntimeError("Chromium ou Chrome introuvable")
    return found


class FixtureServer(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SITE), **kwargs)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/api/v1/cvs/fixture/print-data":
            body = json.dumps({"contentJson": json.dumps(FIXTURE), "template": "modern"}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path.startswith("/print/cv/"):
            self.path = "/index.html"
        super().do_GET()

    def log_message(self, format, *args):
        pass


def main() -> None:
    if not (SITE / "index.html").is_file():
        raise RuntimeError("Build Angular absent : lancer npm run build")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", 0), FixtureServer)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        for template in TEMPLATES:
            pdf_path = OUTPUT / f"cv-two-page-{template}.pdf"
            pdf_path.unlink(missing_ok=True)
            with tempfile.TemporaryDirectory(prefix="chrome-cv-", dir=OUTPUT) as profile:
                command = [
                    chrome_executable(),
                    "--headless=new",
                    "--disable-gpu",
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--no-pdf-header-footer",
                    "--run-all-compositor-stages-before-draw",
                    "--virtual-time-budget=4000",
                    f"--user-data-dir={profile}",
                    f"--print-to-pdf={pdf_path}",
                    f"http://127.0.0.1:{server.server_port}/print/cv/fixture?template={template}&token=test",
                ]
                result = subprocess.run(command, capture_output=True, text=True, timeout=30)
                if result.returncode != 0 or not pdf_path.is_file():
                    raise RuntimeError(f"Echec Chromium {template}: {result.stderr[-1000:]}")

            with fitz.open(pdf_path) as pdf:
                if len(pdf) != 2:
                    raise AssertionError(f"{template}: {len(pdf)} pages au lieu de 2")
                texts = [page.get_text() for page in pdf]
                combined = " ".join(" ".join(text.split()) for text in texts).casefold()
                for marker in MARKERS:
                    if marker.casefold() not in combined:
                        raise AssertionError(f"{template}: contenu manquant : {marker}")
                if "Cyclisme" not in texts[1]:
                    raise AssertionError(f"{template}: la deuxieme page ne contient pas la fin du CV")
                for number, (page, page_text) in enumerate(zip(pdf, texts), 1):
                    if len(page_text.strip()) < 60:
                        raise AssertionError(f"{template}: page {number} vide")
                    if not (590 <= page.rect.width <= 600 and 837 <= page.rect.height <= 847):
                        raise AssertionError(f"{template}: page {number} hors A4")
                print(f"{template}: {len(pdf)} pages A4, tous les marqueurs presents -> {pdf_path}")
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
