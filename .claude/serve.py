import functools
import http.server
import socketserver

DIRECTORY = "/Users/barbajohnz/Documents/GitHub/oh-cyprus"
PORT = 8000

Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=DIRECTORY)
with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    httpd.serve_forever()
