import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

const book = { id: 1, title: 'Солярис', author: '', is_read: false }
const json = (data: unknown, status = 200) => Response.json(data, { status })
const setup = () => {
  const fetchMock = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, user: userEvent.setup() }
}
const name = () => screen.getByRole('textbox', {name: /Название/})
const submit = () => screen.getByRole('button', {name: /Добавить книгу/})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('показывает ожидание загрузки и предлагает повторить запрос после ошибки', async () => {
  const {fetchMock, user} = setup()
  fetchMock.mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json([]))
  render(<App/>)
  expect(screen.getByRole('status').textContent).toContain('Загружаем')
  await user.click(await screen.findByRole('button', {name:'Повторить'}))
  expect(await screen.findByText('Пока нет книг')).toBeTruthy()
})

it.each(['', '   '])('отклоняет название %j и возвращает фокус в поле', async value => {
  const {fetchMock, user} = setup()
  fetchMock.mockResolvedValueOnce(json([]))
  render(<App/>)
  await screen.findByText('Пока нет книг')
  if (value) await user.type(name(), value)
  await user.click(submit())
  expect(screen.getByText('Введите название книги.')).toBeTruthy()
  expect(document.activeElement).toBe(name())
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('сохраняет ввод после ошибки и добавляет книгу при повторной попытке', async () => {
  const {fetchMock, user} = setup()
  fetchMock.mockResolvedValueOnce(json([])).mockResolvedValueOnce(json({},503)).mockResolvedValueOnce(json(book,201))
  render(<App/>)
  await screen.findByText('Пока нет книг')
  await user.type(name(), 'Солярис')
  await user.click(submit())
  expect((await screen.findByRole('alert')).textContent).toContain('Не удалось сохранить')
  expect((name() as HTMLInputElement).value).toBe('Солярис')
  await user.click(submit())
  expect((await screen.findByRole('listitem')).textContent).toContain('Солярис')
  expect((name() as HTMLInputElement).value).toBe('')
})

it('отправляет один POST при двойном клике, Enter и повторном событии submit', async () => {
  const {fetchMock,user} = setup()
  let finish!: (value: Response) => void
  fetchMock.mockResolvedValueOnce(json([])).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  render(<App/>)
  await screen.findByText('Пока нет книг')
  await user.type(name(), ' Солярис ')
  await user.dblClick(submit())
  expect((screen.getByRole('button', {name:'Сохраняем…'}) as HTMLButtonElement).disabled).toBe(true)
  await user.click(name())
  await user.keyboard('{Enter}{Enter}')
  fireEvent.submit(screen.getByRole('form'))
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
  expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({title:'Солярис',author:''})
  finish(json(book,201))
  expect(await screen.findByText('Книга добавлена.')).toBeTruthy()
})
