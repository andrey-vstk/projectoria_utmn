# n8n LLM Workflow Contract (Ollama / Local LLM)

## Назначение

Этот workflow вызывается backend-ом при анализе проекта, когда `LLM_PROVIDER=n8n`.

Готовый import-файл: `docs/n8n/workflows/llm-analyze-ollama.workflow.json`.

Backend вызывает `N8N_LLM_WEBHOOK_URL` (POST JSON), получает структурированный ответ и сохраняет его в БД.

## Вход в Webhook

Пример payload:

```json
{
  "prompt": "...полный prompt...",
  "projectTitle": "Название проекта",
  "sourceText": "Исходная стенограмма",
  "departments": [
    { "code": "ШКН", "name": "Школа компьютерных наук", "description": "..." }
  ],
  "expectedSchema": {
    "summary": "string",
    "tasks": [{ "title": "string", "description": "string", "priority": "high|medium|low" }],
    "departmentSuggestions": [
      {
        "departmentCode": "string",
        "relevanceReason": "string",
        "problemFragment": "string",
        "adaptedPitch": "string",
        "emailSubject": "string",
        "emailBody": "string"
      }
    ]
  }
}
```

## Выход из `Respond to Webhook`

Нужно вернуть JSON (не markdown):

```json
{
  "summary": "Краткое описание проблемы",
  "tasks": [
    {
      "title": "Название подзадачи",
      "description": "Описание",
      "priority": "high"
    }
  ],
  "departmentSuggestions": [
    {
      "departmentCode": "ШКН",
      "relevanceReason": "...",
      "problemFragment": "...",
      "adaptedPitch": "...",
      "emailSubject": "...",
      "emailBody": "..."
    }
  ]
}
```

## Рекомендуемая цепочка n8n

1. `Webhook` (POST)
2. `Set`/`Code`: взять `prompt` или собрать prompt вручную из полей
3. `HTTP Request` к Ollama:
   - URL: `http://ollama:11434/api/chat`
   - Method: POST
   - Body:

```json
{
  "model": "llama3.1:8b",
  "messages": [
    { "role": "system", "content": "Верни только валидный JSON" },
    { "role": "user", "content": "={{ $json.prompt }}" }
  ],
  "stream": false
}
```

4. `Code`: извлечь текст ответа модели, распарсить JSON, при ошибке выставить fallback
5. `Respond to Webhook`: вернуть итоговый JSON

## Важные практики

- Делайте в n8n нормализацию ответа (убрать markdown fences, лишний текст).
- Добавьте валидацию обязательных полей перед `Respond to Webhook`.
- Ограничивайте длину входного `sourceText` (или делайте chunking) для стабильности.
- Логируйте `projectTitle` и время обработки, но не храните лишние чувствительные данные.
- В `Code` node не используйте `$env.*`, если доступ к env запрещен политиками n8n.
  Используйте `input.model` из payload (backend уже передает `LLM_MODEL`).
