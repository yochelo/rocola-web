from http.server import BaseHTTPRequestHandler, HTTPServer
import urllib.parse, urllib.request, re, json

def search_google_videos(q):
    query = urllib.parse.quote_plus(q + " site:youtube.com")
    url = f"https://www.google.com/search?q={query}&tbm=vid"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    }

    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=10) as r:
        html = r.read().decode("utf-8", "ignore")

    # Extraer títulos y links
    pattern = re.compile(r'/watch\?v=([a-zA-Z0-9_-]{11}).*?>([^<]+)</h3>', re.DOTALL)
    matches = pattern.findall(html)

    results = []
    for vid, title in matches[:12]:
        results.append({
            "id": vid,
            "title": title.strip(),
            "link": f"https://www.youtube.com/watch?v={vid}",
            "thumbnail": f"https://img.youtube.com/vi/{vid}/0.jpg"
        })

    print(f"✅ {len(results)} resultados para '{q}'")
    return results


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path != "/search":
            self.send_response(404)
            self._cors()
            self.end_headers()
            return

        q = urllib.parse.parse_qs(parsed.query).get("q", [""])[0]
        try:
            res = search_google_videos(q)
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(res).encode("utf-8"))
        except Exception as e:
            self.send_response(502)
            self._cors()
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            print(f"❌ Error: {e}")


if __name__ == "__main__":
    print("🎧 Buscador Google Videos corriendo en http://localhost:5056/search?q=beatles")
    HTTPServer(("0.0.0.0", 5056), Handler).serve_forever()

