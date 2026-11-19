import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Alert, Button, Card, CircularProgress, Stack, TextField, Typography } from '@mui/material'

type Book = { id: number, title: string, author: string, is_read: boolean }

function Spines() {
  return <span className="spines" aria-hidden="true"><i/><i/><i/><i/><i/></span>
}

export default function App() {
  const [books, setBooks] = useState<Book[]>([])
  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<'success' | 'error' | null>(null)
  const pending = useRef(false)
  const titleInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    async function loadBooks() {
      try {
        const response = await fetch('/api/books', { signal: controller.signal })
        if (!response.ok) throw new Error()
        const rows: Book[] = await response.json()
        if (!controller.signal.aborted) { setBooks(rows); setLoad('ready') }
      } catch {
        if (!controller.signal.aborted) setLoad('error')
      }
    }
    void loadBooks()
    return () => controller.abort()
  }, [attempt])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending.current || load !== 'ready') return
    setNotice(null)
    if (!title.trim()) {
      setInvalid(true)
      titleInput.current?.focus()
      return
    }
    pending.current = true
    setSaving(true)
    try {
      const response = await fetch('/api/books', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), author: author.trim() }),
      })
      if (!response.ok) throw new Error()
      const book: Book = await response.json()
      setBooks(previous => [...previous, book])
      setTitle('')
      setAuthor('')
      setNotice('success')
    } catch {
      setNotice('error')
    } finally {
      pending.current = false
      setSaving(false)
    }
  }

  return <div className="page">
    <header><Spines/><strong>Читальня</strong></header>
    <main>
      <Typography variant="h1">Список чтения</Typography>
      <div className="layout">
        <section className="collection" aria-labelledby="library-heading">
          <div className="section-heading"><Typography variant="h2" id="library-heading">Мои книги</Typography>
            {load === 'ready' && <span className="count" aria-label={`Количество книг: ${books.length}`}>{books.length}</span>}
          </div>
          {load === 'loading' && <p role="status">Загружаем библиотеку…</p>}
          {load === 'error' && <Alert severity="error" action={<Button onClick={() => { setLoad('loading'); setAttempt(n => n + 1) }}>Повторить</Button>}>Не удалось загрузить книги.</Alert>}
          {load === 'ready' && (books.length ? <ul>{books.map(book => <li key={book.id}>
            <div><strong>{book.title}</strong>{book.author && <span>{book.author}</span>}</div>
            <small>{book.is_read ? 'Прочитано' : 'К прочтению'}</small>
          </li>)}</ul> : <div className="empty"><Spines/><strong>Пока нет книг</strong><span>Добавьте первую книгу в список.</span></div>)}
        </section>
        <Card component="form" className="entry" elevation={0} onSubmit={submit} noValidate aria-labelledby="entry-heading">
          <Stack spacing={3}>
            <Typography variant="h2" id="entry-heading">Добавить книгу</Typography>
            <TextField label="Название" required value={title} inputRef={titleInput} error={invalid}
              helperText={invalid ? 'Введите название книги.' : undefined}
              onChange={e => { setTitle(e.target.value); setInvalid(false); setNotice(null) }}
              slotProps={{input: {readOnly: saving}}}/>
            <TextField label="Автор (необязательно)" value={author} onChange={e => { setAuthor(e.target.value); setNotice(null) }}
              slotProps={{input: {readOnly: saving}}}/>
            <Button type="submit" variant="contained" disableElevation size="large" disabled={saving || load !== 'ready'}
              startIcon={saving ? <CircularProgress size={17} color="inherit"/> : <span aria-hidden="true">＋</span>}>
              {saving ? 'Сохраняем…' : 'Добавить книгу'}
            </Button>
            {notice === 'success' && <Alert role="status" severity="success">Книга добавлена.</Alert>}
            {notice === 'error' && <Alert severity="error">Не удалось сохранить книгу. Попробуйте ещё раз.</Alert>}
          </Stack>
        </Card>
      </div>
    </main>
  </div>
}
