# Notion Terminal MCP

[![MCP](https://img.shields.io/badge/MCP-Streamable_HTTP-7c3aed)](https://modelcontextprotocol.io/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Аутентифицированный, готовый к продакшену удаленный сервер **Model Context Protocol (MCP)**, предоставляющий инструменты **исполнения терминальных команд** и **работы с файловой системой** для **Notion Custom Agents**, Claude, Cursor и автономных ИИ-агентов по протоколам **Streamable HTTP** и **MCP SSE**.

Включает встроенное автоматическое публичное туннелирование через официальный **Ngrok Node.js SDK** (`@ngrok/ngrok`).

[🇷🇺 Документация на русском (USER_GUIDE_RU.md)](USER_GUIDE_RU.md) | [🇬🇧 English Documentation (USER_GUIDE.md)](USER_GUIDE.md) | [🤖 Спецификация агента (AGENTS.md)](AGENTS.md)

---

## Возможности

- 🖥️ **Десктопное приложение Liquid Glass Dark**: Современный графический интерфейс на Electron + React с интеграцией в системный трей (сворачивание с панели задач, работа в фоне), карточками статуса, журналом действий в реальном времени, кнопками копирования данных подключения и визуальным редактором настроек.
- ⚡ **Двойная поддержка транспортов MCP**: Поддержка современного **Streamable HTTP** (`/mcp`) и стандартного **Server-Sent Events** (`/sse` + `/messages`) для совместимости с Notion, Claude, Cursor и другими клиентами.
- 🌐 **Встроенный туннель Ngrok**: Проброс локального сервера наружу одной командой (`npm run start` или `npm run dev`) благодаря SDK `@ngrok/ngrok`.
- 💻 **Выполнение терминальных команд**: Запуск команд в PowerShell или CMD с настраиваемыми таймаутами, рабочими директориями и гарантированным завершением дерева дочерних процессов.
- 🌍 **Автоматизация браузера**: Запуск браузеров хоста (Chrome/Edge), навигация, выполнение произвольного JavaScript, клики, ввод текста, тестирование локальных сервисов (`http://localhost:...`) и создание скриншотов.
- 📁 **Файловые операции**: Полный набор инструментов для чтения, записи, точечной замены кода (`file_replace`), умного поиска grep/glob (`file_search`), перемещения, создания папок и удаления.
- 🔒 **Безопасность и изоляция**:
  - **Режим песочницы (`FULL_ACCESS=false`)**: Строгое ограничение файловых путей рамками папки `FILES_ROOT` с защитой от выхода за пределы (path traversal).
  - **Полный доступ (`FULL_ACCESS=true`)**: Неограниченный доступ к файлам системы с правами пользователя хоста.
  - **Timing-Safe авторизация**: Защита от атак по времени (`crypto.timingSafeEqual`) для Bearer токенов и API ключей.
  - **Валидация Host-заголовков**: Защита от DNS Rebinding и подделки заголовков.
- 🤖 **Agent-First архитектура**: Детальные спецификации и JSON-схемы, оптимизированные для нейросетевых моделей ([AGENTS.md](AGENTS.md)).

---

## Быстрый старт

### 1. Установка

Клонируйте репозиторий и установите зависимости:

```bash
git clone https://github.com/Speedstu/notion-terminal-mcp.git
cd notion-terminal-mcp
npm install
```

### 2. Настройка окружения

Скопируйте `.env.example` в `.env` или запустите установочный скрипт:

```powershell
# Автоматическая настройка (генерирует надежный 32+ байтный ключ)
.\setup.ps1
```

Или вручную:

```powershell
Copy-Item .env.example .env
# Генерация криптографически стойкого токена:
npm run token
```

Отредактируйте файл `.env`:

```ini
# Обязательно: Секретный API ключ для авторизации Notion
MCP_API_KEY=ваш_сгенерированный_32_байтный_ключ

PORT=3000
HOST=127.0.0.1

# Публичный туннель Ngrok (Рекомендуется для Notion)
NGROK_ENABLED=true
NGROK_AUTHTOKEN=ваш_токен_ngrok
NGROK_DOMAIN=ваш-статический-домен.ngrok-free.app

# Безопасность и песочница
FULL_ACCESS=false
FILES_ROOT=./workspace
ALLOWED_HOSTS=localhost:3000;127.0.0.1:3000;*.ngrok-free.app;*.ngrok.app;*.ngrok-free.dev;*.trycloudflare.com
```

### 3. Сборка и запуск

#### Вариант А: Быстрые батники Windows (.bat)
- Запустите двойным кликом **`build.bat`** для интерактивного меню сборщика (Portable .exe, Setup инсталлятор, оба сразу, распаковка или очистка).
- Запустите **`build-portable.bat`** для мгновенной сборки портативного `release\Notion Terminal MCP Portable.exe` в один клик.

#### Вариант Б: Консоль (Node.js & npm)
```bash
# Сборка TypeScript
npm run build

# Запуск сервера
npm run start
```

Для запуска в режиме разработки с автоперезагрузкой:

```bash
npm run dev
```

При старте с `NGROK_ENABLED=true` сервер выведет готовые параметры для подключения в Notion:

```text
============================================================
             NOTION MCP AGENT CONNECTION READY             
============================================================
URL to paste into Notion:  https://your-domain.ngrok-free.app/mcp

Authentication Header:
  Header Name:   Authorization
  Header Value:  Bearer <ваш_токен>
============================================================
```

#### Альтернатива: Бесплатный Cloudflare Quick Tunnel (Без регистрации)

Если у вас нет учетной записи Ngrok, просто запустите:

```powershell
.\start-public.ps1
```

Скрипт автоматически:
1. Скачает и проверит цифровую подпись Authenticode официального бинарника `cloudflared.exe`.
2. Скомпилирует TypeScript (`npm run build`).
3. Запустит локальный MCP-сервер на `http://127.0.0.1:3000`.
4. Поднимет туннель Cloudflare (`https://<случайный-домен>.trycloudflare.com`).
5. Выведет готовый URL (`https://<домен>.trycloudflare.com/mcp`) и заголовок `Authorization`.

---

## Подключение к Notion Custom Agents

1. В Notion перейдите в **Settings & members** → **Connections** (или в настройки вашего **Notion Custom Agent**).
2. Нажмите **Add Connection** → выберите **Custom MCP**.
3. Укажите **Server URL**:
   ```text
   https://ваш-домен-туннеля/mcp
   ```
4. Настройте **Authentication**:
   - Header Name: `Authorization`
   - Header Value: `Bearer <ВАШ_MCP_API_KEY>` (или `x-api-key: <ВАШ_MCP_API_KEY>`)
5. Нажмите **Connect**. Notion автоматически обнаружит все **20 инструментов**.

---

## Доступные инструменты MCP (20 инструментов)

Полные JSON-схемы и описания параметров смотрите в [AGENTS.md](AGENTS.md).

### 🖥️ Исполнение команд (Terminal)
| Инструмент | Описание |
|---|---|
| `terminal_execute` | Запуск команд PowerShell или CMD на хосте с нативной поддержкой UTF-8, таймаутами, выбором `cwd` и завершением дерева процессов. |

### 📁 Файловые операции (Filesystem)
| Инструмент | Описание |
|---|---|
| `file_search` | Поиск файлов по glob-маске (`*.ts`) и/или поиск regex/текста внутри файлов (grep). |
| `file_replace` | Безопасная точечная замена блоков кода или текста в файле без перезаписи всего файла. |
| `file_read` | Чтение файлов (UTF-8 текст или Base64 бинарные данные) с постраничной навигацией по смещению. |
| `file_write` | Создание, перезапись или добавление данных в файлы (автоматически создает родительские папки). |
| `file_list` | Листинг директорий (плоский или рекурсивный) с размерами файлов и метаданными. |
| `file_stat` | Просмотр метаданных файла/папки (размер, дата создания/изменения, права). |
| `file_mkdir` | Рекурсивное создание директорий со всеми промежуточными папками. |
| `file_move` | Перемещение и переименование файлов/директорий с опцией перезаписи. |
| `file_delete` | Безвозвратное удаление файлов или директорий (`recursive: true` для непустых папок). |

### 🗂️ Управление проектами (Workspace)
| Инструмент | Описание |
|---|---|
| `workspace_get_cwd` | Просмотр текущей активной рабочей директории и базового пути песочницы. |
| `workspace_set_cwd` | Переключение активной папки проекта, позволяющее агенту оперировать короткими относительными путями. |

### 🌐 Автоматизация браузера (Browser)
| Инструмент | Описание |
|---|---|
| `browser_open` | Запуск браузера хоста (Chrome или Edge) и открытие URL. По умолчанию открывает видимое окно (`headless: false`). |
| `browser_navigate` | Переход по URL в активной вкладке с настраиваемыми условиями ожидания (`load`, `networkidle0`). |
| `browser_evaluate` | Выполнение произвольного кода JavaScript в контексте страницы с возвратом результата в JSON. |
| `browser_click` | Клик по элементу страницы по CSS-селектору. |
| `browser_type` | Ввод текста в элементы input/textarea с возможностью предварительной очистки. |
| `browser_get_content` | Извлечение текста страницы, HTML DOM или заголовка. |
| `browser_screenshot` | Создание скриншота видимой части или всей страницы (в PNG-файл или base64). |
| `browser_close` | Корректное закрытие браузера и освобождение ресурсов. |

---

## Пакетные файлы Windows и скрипты сборки

Для быстрой работы без ввода команд вручную в корень добавлены:

- **`build.bat`** — Интерактивное меню сборки:
  - `[1]` Собрать Portable версию (`release\Notion Terminal MCP Portable.exe`)
  - `[2]` Собрать Установщик Setup (`release\Notion Terminal MCP Setup 1.0.0.exe`)
  - `[3]` Собрать Всё (Portable + Setup)
  - `[4]` Распаковать в `release\win-unpacked`
  - `[5]` Очистить папку `release/`
  - Поддерживает вызовы из командной строки: `build.bat portable`, `build.bat installer`, `build.bat all`, `build.bat dir`, `build.bat clean`.
- **`build-portable.bat`** — Быстрый запуск сборки портативной версии в один клик.
- **`build.ps1`** — Автоматизированный скрипт сборки на PowerShell.

---

## NPM-скрипты

- `npm run app:start` — Сборка и запуск графического приложения Desktop GUI (Electron + Liquid Glass UI).
- `npm run app:dev` — Запуск Desktop приложения в режиме разработки с горячей перезагрузкой (Vite + Electron).
- `npm run package:portable` — Сборка автономной **Portable `.exe`** версии. Выход: `release/Notion Terminal MCP Portable.exe`.
- `npm run package:installer` — Сборка инсталлятора Windows **Setup `.exe`** (NSIS мастер). Выход: `release/Notion Terminal MCP Setup 1.0.0.exe`.
- `npm run package:exe` — Одновременная сборка **обоих** вариантов (Portable + Installer).
- `npm run build` — Компиляция TypeScript сервера, Electron процессов и Vite React интерфейса.
- `npm run start` — Запуск консольного MCP-сервера из `dist/index.js`.
- `npm run dev` — Запуск консольного MCP-сервера с автоматической перезагрузкой (`tsx watch`).
- `npm run check` — Полная проверка типов TypeScript.
- `npm run token` — Генерация криптографически стойкого случайного ключа для `MCP_API_KEY`.

---

## Сборка исполняемых файлов (.exe)

| Команда | Способ | Результат в `release/` |
|---|---|---|
| `build-portable.bat` / `npm run package:portable` | Батник / npm | `Notion Terminal MCP Portable.exe` |
| `npm run package:installer` | Батник / npm | `Notion Terminal MCP Setup 1.0.0.exe` |
| `build.bat all` / `npm run package:exe` | Батник / npm | Оба файла выше |

> [!TIP]
> **Настоящий Portable режим**: При запуске `Notion Terminal MCP Portable.exe` конфигурация (`.env`) и папка проектов `workspace/` создаются **прямо рядом с файлом .exe**. Вы можете носить папку на флешке со всеми настройками. Для версии из инсталлятора настройки хранятся в `%APPDATA%\notion-terminal-mcp\config\.env`.
