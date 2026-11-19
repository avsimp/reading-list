from contextlib import redirect_stderr, redirect_stdout
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from reading_list import main


class ReadingListTests(unittest.TestCase):
    def setUp(self):
        directory = self.enterContext(TemporaryDirectory())
        self.db = Path(directory) / "books.sqlite3"

    def run_cli(self, *args):
        stdout = StringIO()
        stderr = StringIO()
        with redirect_stdout(stdout), redirect_stderr(stderr):
            code = main(["--db", str(self.db), *args])
        return code, stdout.getvalue(), stderr.getvalue()

    def test_empty_list(self):
        self.assertEqual(self.run_cli("list"), (0, "Список чтения пуст.\n", ""))

    def test_added_book_is_available_on_next_invocation(self):
        self.assertEqual(self.run_cli("add", "Солярис", "--author", "Лем")[0], 0)
        code, stdout, stderr = self.run_cli("list")
        self.assertEqual((code, stderr), (0, ""))
        self.assertEqual(stdout, "1. Солярис — Лем [к прочтению]\n")

    def test_list_unread_shows_only_unread_books(self):
        self.run_cli("add", "Солярис")
        self.run_cli("add", "Пикник на обочине")
        self.run_cli("read", "1")

        self.assertEqual(
            self.run_cli("list", "--unread"),
            (0, "2. Пикник на обочине [к прочтению]\n", ""),
        )

    def test_list_unread_reports_when_all_books_are_read(self):
        self.run_cli("add", "Солярис")
        self.run_cli("read", "1")

        self.assertEqual(
            self.run_cli("list", "--unread"), (0, "Нет непрочитанных книг.\n", "")
        )

    def test_read_updates_only_the_selected_book(self):
        self.run_cli("add", "Солярис")
        self.run_cli("add", "Пикник на обочине")
        self.assertEqual(self.run_cli("read", "2")[0], 0)
        code, stdout, stderr = self.run_cli("list")
        self.assertEqual((code, stderr), (0, ""))
        self.assertEqual(
            stdout,
            "1. Солярис [к прочтению]\n2. Пикник на обочине [прочитано]\n",
        )

    def test_read_reports_missing_book(self):
        code, stdout, stderr = self.run_cli("read", "99")
        self.assertEqual((code, stdout), (1, ""))
        self.assertEqual(stderr, "Книга #99 не найдена.\n")

    def test_add_rejects_blank_title(self):
        with self.assertRaises(SystemExit) as raised:
            self.run_cli("add", "  ")
        self.assertEqual(raised.exception.code, 2)
        self.assertFalse(self.db.exists())


if __name__ == "__main__":
    unittest.main()
