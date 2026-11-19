"""A local reading list with a small command-line interface."""

import argparse
from contextlib import closing
from pathlib import Path
import sqlite3
import sys


def create_schema(db):
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            is_read INTEGER NOT NULL DEFAULT 0
        )
        """
    )


def insert_book(db, title, author):
    with db:
        cursor = db.execute(
            "INSERT INTO books (title, author) VALUES (?, ?)",
            (title, author.strip()),
        )
    return cursor.lastrowid


def add_book(db, args):
    book_id = insert_book(db, args.title, args.author)
    print(f"Добавлена книга #{book_id}: {args.title}")
    return 0


def select_books(db, unread=False):
    query = "SELECT id, title, author, is_read FROM books"
    if unread:
        query += " WHERE is_read = 0"
    return db.execute(query + " ORDER BY id").fetchall()


def list_books(db, args):
    books = select_books(db, args.unread)

    if not books:
        print("Нет непрочитанных книг." if args.unread else "Список чтения пуст.")
        return 0

    for book_id, title, author, is_read in books:
        label = f"{title} — {author}" if author else title
        status = "прочитано" if is_read else "к прочтению"
        print(f"{book_id}. {label} [{status}]")
    return 0


def mark_read(db, args):
    with db:
        cursor = db.execute(
            "UPDATE books SET is_read = 1 WHERE id = ?", (args.book_id,)
        )
    if cursor.rowcount == 0:
        print(f"Книга #{args.book_id} не найдена.", file=sys.stderr)
        return 1
    print(f"Книга #{args.book_id} отмечена как прочитанная.")
    return 0


def book_title(value):
    title = value.strip()
    if not title:
        raise argparse.ArgumentTypeError("укажите название книги")
    return title


def build_parser():
    parser = argparse.ArgumentParser(description="Ведите список книг для чтения.")
    parser.add_argument(
        "--db",
        type=Path,
        default=Path(".reading-list.sqlite3"),
        help="путь к файлу базы SQLite",
    )
    commands = parser.add_subparsers(dest="command", required=True)

    add = commands.add_parser("add", help="добавить книгу")
    add.add_argument("title", type=book_title, metavar="НАЗВАНИЕ")
    add.add_argument("--author", default="", help="имя автора")
    add.set_defaults(handler=add_book)

    listing = commands.add_parser("list", help="показать все книги")
    listing.add_argument(
        "--unread", action="store_true", help="показать только непрочитанные книги"
    )
    listing.set_defaults(handler=list_books)

    mark = commands.add_parser("read", help="отметить книгу как прочитанную")
    mark.add_argument("book_id", type=int, metavar="ID")
    mark.set_defaults(handler=mark_read)
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        with closing(sqlite3.connect(args.db)) as db:
            create_schema(db)
            return args.handler(db, args)
    except sqlite3.Error as error:
        print(f"Ошибка базы данных: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
