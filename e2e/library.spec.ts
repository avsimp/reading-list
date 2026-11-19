import { test, expect, type Page } from '@playwright/test'
import { spawn, execFileSync } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function snapshot(page: Page, name: string) {
  if (process.env.CAPTURE_SCREENS) await page.screenshot({path: `docs/screens/${name}.png`, fullPage:true, animations:"disabled"})
}

test('клавиатура → SQLite → обновление страницы → CLI', async ({page, request}) => {
  const dir = await mkdtemp(join(tmpdir(), 'reading-ui-'))
  const db = join(dir,'books.sqlite3')
  const api = spawn('python3',['-m','web_api','--db',db,'--port','18765'])
  const closed = once(api,'close')
  try {
    await expect.poll(async () => {
      try { return (await request.get('http://127.0.0.1:18765/api/books')).status() } catch { return 0 }
    }).toBe(200)
    await page.goto('/')
    await expect(page.getByText('Пока нет книг')).toBeVisible()
    await snapshot(page,'empty')
    await page.keyboard.press('Tab')
    await expect(page.getByLabel(/Название/)).toBeFocused()
    await page.keyboard.insertText('Солярис')
    await page.keyboard.press('Tab')
    await page.keyboard.insertText('Станислав Лем')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button',{name:/Добавить книгу/})).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('listitem')).toContainText('Солярис')
    await expect(page.getByText('Книга добавлена.')).toBeVisible()
    await snapshot(page,'success')
    await page.reload()
    await expect(page.getByRole('listitem')).toContainText('Станислав Лем')
    expect(await (await request.get('/api/books')).json()).toEqual([
      { id:1, title:'Солярис', author:'Станислав Лем', is_read:false }
    ])
    expect(execFileSync('python3',['-m','reading_list','--db',db,'list'],{encoding:'utf8'})).toContain('Солярис — Станислав Лем')
    execFileSync('python3',['-m','reading_list','--db',db,'add','Пикник на обочине'])
    await page.reload()
    await expect(page.getByText('Пикник на обочине')).toBeVisible()
  } finally {
    api.kill()
    await closed
    await rm(dir,{recursive:true,force:true})
  }
})

test('мобильная форма сохраняет введённые данные при задержке и ошибке API', async ({page}) => {
  await page.setViewportSize({width:360,height:800})
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/books', async route => {
    if (route.request().method() === 'GET') return route.fulfill({json:[]})
    await gate
    await route.fulfill({status:503,json:{error:'Не удалось сохранить книгу.'}})
  })
  await page.goto('/')
  await page.getByLabel(/Название/).fill('Солярис')
  await page.getByLabel(/Автор/).fill('Станислав Лем')
  await page.getByRole('button',{name:/Добавить книгу/}).click()
  await expect(page.getByRole('button',{name:'Сохраняем…'})).toBeDisabled()
  await snapshot(page,'saving-mobile')
  release()
  await expect(page.getByRole('alert')).toContainText('Попробуйте ещё раз')
  await expect(page.getByLabel(/Автор/)).toHaveValue('Станислав Лем')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  await snapshot(page,'error-mobile')
})

test('прототип показывает состояния и результат своего ввода', async ({page}) => {
  await page.goto('/docs/prototype.html')
  await page.getByRole('combobox').selectOption({label:'Ошибка'})
  await expect(page.getByRole('status')).toContainText('Не удалось сохранить')
  await page.getByLabel(/Название/).fill('Дюна')
  await page.getByRole('button',{name:/Добавить книгу/}).click()
  await expect(page.getByRole('button',{name:'Сохраняем…'})).toBeDisabled()
  await expect(page.getByRole('listitem')).toContainText('Дюна')
})
