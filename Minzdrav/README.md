# ЕМИАС — Минздрав (CustomCogs)

Порт системы **ЕМИАС** в кастом-коги бота «Управление Департаментами» (ER:LC Россия). Чистая БД, минимум команд, современный визуал на Containers V2.

## Принципы

- **Чистая БД** — никаких фейков. `Minzdrav/data/emias.db` создаётся пустой. Данные только реальные (создаются игроками/врачами). `/штаб` → Очистка.
- **Минимум команд** — вместо 18 слэш-команд — 3 панели с кнопками. Вся логика через компоненты.
- **Containers V2** — вместо EmbedBuilder — `ContainerBuilder` с `accent_color`, секции, сепараторы, минимум эмодзи, аккуратная типографика.

## Команды (3)

| Команда | Описание | Доступ |
|---|---|---|
| `/емис` | Главная панель ЕМИАС — кнопки: Записаться · Мои талоны · Привязать · (для сотрудников) Очередь · Карта · Статус · Прием · Рецепт | Все |
| `/штаб` | Штаб персонала — кнопки: Добавить · Список · Статистика · Очистка · Блок · Разблок | Главврач (первый — админ сервера) |
| `/помощь` | Помощь — контейнер с гидом | Все |

Все действия — **кнопками** внутри панелей:
- **Записаться** → модалка (врач, дата, время) → `bookAppointment`
- **Мои талоны** → контейнер со списком
- **Привязать** → модалка (код 6 симв.) → `linkPatientByCode`
- **Очередь** → контейнер очереди на сегодня (сотрудникам)
- **Карта** → модалка (ID) → контейнер карты (медданные только врачам)
- **Статус** → селект (Свободен/На приёме/Офф)
- **Прием / Рецепт** → модалки ЭМК/рецептов (врачи)
- **Добавить** → модалка (Discord ID, ФИО, роль, специальность) — только главврач
- **Список / Статистика / Очистка / Блок / Разблок** — через штаб

## Визуал

`Minzdrav/utils/embeds.js` — все контейнеры:
```js
new ContainerBuilder().setAccentColor(0x0063B0)
  .addSectionComponents(headerSection(...).setThumbnailAccessory(...))
  .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(...))
  // + ActionRow с кнопками
```
- Акцент `#0063B0`, иконка `ICON_URL`, `TextDisplay` с markdown, `Section` с thumbnail, `Separator` с divider, `-#` дисклеймер.
- Нет лишних эмодзи — только текст и системные разделители.
- Флаг `MessageFlags.IsComponentsV2` (32768) при отправке.

`Minzdrav/utils/panels.js` — `mainRows(isStaff, isDoctor, isHead)` / `staffRows()` возвращают `ActionRowBuilder` с кнопками.

## Структура

```
Minzdrav/
├── cogs/
│   ├── emias.js   # /емис
│   ├── staff.js   # /штаб
│   └── help.js    # /помощь
├── events/
│   └── interactionCreate.js # единый роутер кнопок/селектов/модалок (emias:*, staff:*)
├── dataUtils/
│   ├── db.js      # SQLite + миграции (чистая БД)
│   └── emias.js   # домен-логика (без фейков)
├── utils/
│   ├── constants.js, embeds.js (containers), panels.js, permissions.js
├── tasks/
│   ├── statusTask.js (ротация Watching) + reminders.js (24ч/1ч + 08:00 дайджест)
├── locales/ru.json,en.json
├── config.js, schema.txt, README.md
└── data/emias.db (игнорируется, создаётся автоматом)
```

## Установка

1. Скопируй `Minzdrav` в форк `Department-Oversight-CustomCogs`.
2. Для Prisma — добавь `schema.txt` в `schema.prisma` → `npx prisma migrate dev`.
3. Без Prisma — ничего не нужно, используется `data/emias.db`.

## Первый запуск

- Админ сервера: `/штаб` → Добавить → Discord ID, ФИО, роль `Главный врач`.
- Далее главврач: `/штаб` → Добавить остальных.
- Граждане: `/емис` → Привязать (код с сайта) → Записаться.

## Тест

```bash
node index.js Minzdrav
# требует TEST_BOT_TOKEN в .env
# Логи: Загружена команда: /емис, /штаб, /помощь
```
