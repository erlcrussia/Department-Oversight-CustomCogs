# CONTRIBUTING — Руководство по добавлению когов

## Для фракций

1. Сделайте форк репозитория.
2. Создайте директорию для вашей фракции (если её ещё нет) или используйте существующую (`FSB/`, `FSVNG/`, `MCHS/`, `MVD/`, `Pravo/`, `Minzdrav/`). Для новой фракции скопируйте `Starter-Kit/` как шаблон.
3. Разместите код кога в соответствующих поддиректориях (все файлы — `*.ts`):
   - `cogs/` — слэш-команды (`export default { data, execute }`)
   - `events/` — обработчики событий (`export default { name, once, execute }`)
   - `tasks/` — фоновые задачи (`export default { name, interval, execute }`)
   - `dataUtils/` — файлы для работы с БД (через Prisma)
   - `utils/` — вспомогательные файлы фракции
   - `locales/` — локализация (`ru.json`, `en.json`)
4. Добавьте/обновите `config.ts` с необходимыми настройками (см. `Starter-Kit/config.ts:1`).
5. Запустите локальную проверку:
   ```bash
   npm ci
   npm run typecheck
   npm run build
   npm run check:load
   node dist/index.js <Фракция>  # например, node dist/index.js MVD
   ```
6. Откройте Pull Request в основной репозиторий. CI автоматически запустит `typecheck` → `build` → `check:load` + скан безопасности.

## Формат модулей

Проект использует **TypeScript + ESM** (`"type": "module"` в `package.json`). Все импорты — через `import`, экспорты — через `export default`. В ESM-импортах указывайте расширение `.js` даже когда исходник `.ts` (требование `NodeNext`):

```ts
import { t } from '../../utils/locale.js';
import emias from '../dataUtils/emias.js';
```

Компиляция: `tsconfig.json:1` (`target ES2022`, `module NodeNext`, `outDir dist/`). Результат — `dist/<Фракция>/`.

### Слэш-команды (`cogs/*.ts`)

Каждая команда экспортирует объект с полями `data` (`SlashCommandBuilder`) и `execute(interaction)`. Опционально — `onInteraction`/`handleModal` для компонентов:

```ts
import { SlashCommandBuilder } from 'discord.js';
import { t, getLang } from '../../utils/locale.js';

export default {
  data: new SlashCommandBuilder()
    .setName('привет')
    .setNameLocalizations({ 'en-US': 'hello', 'en-GB': 'hello' })
    .setDescription('Простое приветствие от бота.')
    .setDescriptionLocalizations({
      'en-US': 'A simple greeting from the bot.',
      'en-GB': 'A simple greeting from the bot.',
      'ru': 'Простое приветствие от бота.'
    }),

  async execute(interaction) {
    const lang = await getLang(interaction.guildId);
    await interaction.reply({ content: t(lang, 'emias.help.title', interaction.user.username), allowedMentions: { parse: [] } });
  }
};
```

Эталон: `Starter-Kit/cogs/hello.ts:1`. Реальный пример: `Minzdrav/cogs/emias.ts:1`.

### События (`events/*.ts`)

```ts
export default {
    name: 'ready',
    once: true,
    async execute(...args: any[]) {
        const logger = (global as any).logger || console;
        logger.info('Бот готов!');
    }
};
```

Эталон: `Starter-Kit/events/ready.ts:1`. Загружаются через `index.ts:117` (`loadEvents`).

### Фоновые задачи (`tasks/*.ts`)

```ts
import { ActivityType } from 'discord.js';

export default {
  name: 'status-changer',
  interval: 300000, // 5 минут

  execute: (client, logger) => {
    if (!client.user) return;
    client.user.setActivity('ER:LC Россия', { type: ActivityType.Watching });
    logger.info('Статус обновлён');
  }
};
```

Эталон: `Starter-Kit/tasks/statusTask.ts:1`. Загружаются через `index.ts:72` (`loadCogs`) — определяется по наличию `name` + `interval` + `execute`.

### Конфигурация (`config.ts`)

```ts
const ICON_URL = "https://cdn.erlcrussia.com/images/Moscow-RolePlay-Icon-Website.png";
const HEX_COLOR = 0x0063B0;

export default { ICON_URL, HEX_COLOR };
export { ICON_URL, HEX_COLOR };
```

См. `Starter-Kit/config.ts:1`, `Minzdrav/config.ts:1`, `MVD/config.ts:1`.

## Доступные пакеты

В боте предустановлены пакеты из `package.json:17` в корне репозитория:

| Пакет | Назначение |
|-------|-----------|
| `discord.js` `^14.23.2` | Работа с Discord API |
| `@prisma/client` / `prisma` `^7.4.0` | ORM для работы с базой данных |
| `winston` `^3.17.0` | Логирование |
| `luxon` `^3.7.2` | Работа с датой и временем |
| `axios` `^1.12.2` | HTTP-запросы |
| `dotenv` `^16.6.1` | Загрузка переменных из `.env` |

Если для кога требуется пакет, которого нет в списке — откройте **тикет** для обсуждения перед добавлением. Не редактируйте `package.json`/`package-lock.json` без ревью.

## Требования к коду

- Код пишется на **TypeScript (ESM)** с использованием **discord.js v14**. Допускается `*.ts` только; `*.js` генерируется сборкой в `dist/`.
- Соблюдайте структуру директорий (`cogs/`, `events/`, `tasks/`, `dataUtils/`, `utils/`, `locales/`, `config.ts`).
- Используйте только пакеты из `package.json`. Добавление новых — через тикет.
- Для локальной проверки используйте `npm run typecheck` / `npm run build` / `npm run check:load`. Не коммитьте `dist/` и `node_modules/` (см. `.gitignore:1`).
- Не используйте `eval()`, `Function()`, динамический импорт произвольных путей и другие небезопасные конструкции — CI (`.github/workflows/checks.yml:31`) отклонит PR.
- Не загружайте файлы, не относящиеся к когу (`.env`, токены, логи, `*.db` и т.д.).
- Фоновые задачи не должны чрезмерно нагружать бота (интервал и частота должны быть адекватны задаче; пример — `300000` мс).
- `index.ts:1` **нельзя редактировать**. Для изменения логики тестирования создайте отдельный скрипт.

## Работа с базой данных

- Доступ к БД — через Prisma-клиент (`@prisma/client`), подключение берётся из `process.env` (см. `index.ts:43` — `TEST_BOT_TOKEN`/`DISCORD_TOKEN`).
- Импортируйте Prisma-клиент стандартным способом; указывать свои строки подключения в коде кога **запрещено**.
- Файлы с запросами к базе размещайте в `dataUtils/` вашей фракции.

Пример (`Minzdrav/dataUtils/db.ts:1`, `Minzdrav/dataUtils/emias.ts:1`):

```ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function getUsersByFaction(factionId: string) {
  return prisma.user.findMany({ where: { factionId } });
}

export async function createUser(data: any) {
  return prisma.user.create({ data });
}
```

> **Важно:** если когу требуется новая таблица или изменение схемы — после тестирования поместите файл `schema.txt` с необходимыми изменениями Prisma-схемы в **корень фракции** (например, `Minzdrav/schema.txt:1`). Отдельно укажите это в PR. Основной `schema.prisma` находится в `Department-Oversight`, не в этом репозитории.

## Работа с локализацией

Подробное руководство — в [README.md](./README.md#локализация).

Кратко:
- Локализация каждой фракции — `<Фракция>/locales/ru.json` и `en.json` (не `CustomCogsExtra/` и не корень).
- Прокси-модуль `utils/locale.ts:1` делегирует `t`/`getLang` в основной бот.
- Ключи используют префикс фракции (например, `emias.help.title`).
- Язык кастомного бота зависит от языка основного бота (берётся из общей БД через `getLang`).
- Для слэш-команд используйте `setNameLocalizations` и `setDescriptionLocalizations` на `SlashCommandBuilder` (см. `Starter-Kit/cogs/hello.ts:1`).

## Процесс ревью и CI

1. На каждый PR/Push запускается `.github/workflows/checks.yml:1`: `npm ci` → `npm run typecheck` → `npm run build` → `npm run check:load` + скан на `eval()` и `process.env` в `require()`.
2. Модераторы проверяют код на вредоносные или неоптимальные конструкции.
3. Если код чист и CI зелёный — PR принимается и мержится.
4. Если есть замечания — модератор оставляет комментарии в PR.
5. При грубых нарушениях безопасности PR отклоняется без возможности повторной отправки той же версии.

Локально воспроизвести CI:

```bash
npm run typecheck && npm run build && npm run check:load
```

## Запрещено

- Любые действия от имени бота без явного разрешения (рассылка, спам, удаление сообщений).
- Сбор и утечка пользовательских данных (ID, токены, содержимое ЛС).
- Использование `process.env` без предварительного обсуждения через тикет (сканируется CI).
- Изменение конфигурации самого бота (через `client` и т.д.).
- Обфускация или минификация кода.
- Коммит артефактов сборки (`dist/`), зависимостей (`node_modules/`), секретов (`.env`).
