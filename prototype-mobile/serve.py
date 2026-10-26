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

    # Safari on iPhone only plays <video> from servers that answer byte-range requests
    def send_head(self):
        rng = self.headers.get("Range")
        path = self.translate_path(self.path)
        if not rng or not rng.startswith("bytes=") or not Path(path).is_file():
            return super().send_head()
        size = Path(path).stat().st_size
        start_s, _, end_s = rng[len("bytes="):].split(",")[0].partition("-")
        try:
            if start_s:
                start = int(start_s)
                end = min(int(end_s), size - 1) if end_s else size - 1
            else:  # the last N bytes
                start, end = max(0, size - int(end_s)), size - 1
        except ValueError:
            return super().send_head()
        if start >= size or start > end:
            self.send_error(416, "Range not satisfiable")
            return None
        f = open(path, "rb")
        f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        self._range_left = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        left = getattr(self, "_range_left", None)
        try:
            if left is None:
                return super().copyfile(source, outputfile)
            while left > 0:
                chunk = source.read(min(64 * 1024, left))
                if not chunk:
                    break
                outputfile.write(chunk)
                left -= len(chunk)
        except (ConnectionResetError, BrokenPipeError):
            pass  # the browser stopped reading (it does this with video all the time)
        finally:
            self._range_left = None

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Accept-Ranges", "bytes")
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
