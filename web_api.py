"""Local JSON API for the Reading List UI."""
import argparse
from contextlib import closing
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import sqlite3

from reading_list import create_schema, insert_book, select_books


def book_json(book_id, title, author, is_read):
    return dict(id=book_id, title=title, author=author, is_read=bool(is_read))


class BooksAPI(BaseHTTPRequestHandler):
    def respond(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path != "/api/books":
            return self.respond(404, {"error": "Адрес не найден."})
        try:
            with closing(sqlite3.connect(self.server.db_path)) as db:
                books = [book_json(*row) for row in select_books(db)]
            self.respond(200, books)
        except sqlite3.Error:
            self.respond(503, {"error": "Библиотека временно недоступна."})

    def do_POST(self):
        if self.path != "/api/books":
            return self.respond(404, {"error": "Адрес не найден."})
        if self.headers.get_content_type() != "application/json":
            return self.respond(415, {"error": "Ожидается JSON."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 1048576:
                raise ValueError
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError
            title, author = data.get("title"), data.get("author", "")
            if not isinstance(title, str) or not title.strip() or not isinstance(author, str):
                raise ValueError
        except (ValueError, UnicodeError):
            return self.respond(400, {"error": "Проверьте название и имя автора."})
        title, author = title.strip(), author.strip()
        try:
            with closing(sqlite3.connect(self.server.db_path)) as db:
                book_id = insert_book(db, title, author)
            self.respond(201, book_json(book_id, title, author, False))
        except sqlite3.Error:
            self.respond(503, {"error": "Не удалось сохранить книгу."})


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default=".reading-list.sqlite3")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    with closing(sqlite3.connect(args.db)) as connection:
        create_schema(connection)
    with ThreadingHTTPServer(("127.0.0.1", args.port), BooksAPI) as server:
        server.db_path = args.db
        server.serve_forever()
