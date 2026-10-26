"""Dev server for the phone prototype.

    python prototype-mobile/serve.py [port]

Serves this folder with caching off (stale copies look like real bugs), and maps
/site/ to the app's public/ folder, so the prototype can use the real song, intro
film, fly-through and journey photos without copying them. Listens on every
interface, so a phone on the same Wi-Fi can open it; don't leave it running on
public Wi-Fi.
"""
import functools
import http.server
import socketserver
import sys
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4322
ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT.parent / "public"


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        clean = path.split("?", 1)[0].split("#", 1)[0]
        if clean.startswith("/site/"):
            rel = Path(clean[len("/site/"):])
            target = (PUBLIC / rel).resolve()
            if PUBLIC.resolve() in target.parents:
                return str(target)
        return super().translate_path(path)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        super().end_headers()

    def send_header(self, keyword, value):
        if keyword.lower() == "last-modified":  # so conditional requests can't 304
            return
        super().send_header(keyword, value)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def lan_ips():
    import socket
    out = []
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if not ip.startswith("127.") and ip not in out:
                out.append(ip)
    except OSError:
        pass
    return out


if __name__ == "__main__":
    handler = functools.partial(Handler, directory=str(ROOT))
    with Server(("0.0.0.0", PORT), handler) as httpd:
        print(f"phone prototype on http://localhost:{PORT}/")
        for ip in lan_ips():
            print(f"  on this Wi-Fi:  http://{ip}:{PORT}/")
        httpd.serve_forever()
