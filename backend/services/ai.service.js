const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

function getGeminiConfig() {
  return {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
  };
}

function stripJsonFences(value) {
  return value
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function parseJsonObject(value) {
  const cleaned = stripJsonFences(value);

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');

    if (start === -1 || end === -1 || end <= start) {
      throw new Error('Gemini did not return valid JSON');
    }

    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

function cleanGeneratedTitle(value) {
  if (!value || typeof value !== 'string') return '';

  return value
    .replace(/^\s*[-*\d.)]+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 255);
}

function buildSubtaskPrompt({ task, existingSubTasks }) {
  const existingTitles = existingSubTasks.map((item) => item.title).join('\n- ') || 'None';

  return `
You are an assistant inside a Kanban task management app.
Generate concise implementation checklist items for the task below.

Rules:
- Return only useful subtasks, not explanations.
- Each title must be actionable and under 90 characters.
- Do not duplicate existing checklist items.
- Prefer concrete engineering work items.
- Return 3 to 6 items.

Task:
Title: ${task.title}
Type: ${task.task_type || 'TASK'}
Priority: ${task.priority || 'MEDIUM'}
Description: ${task.description || 'No description'}

Existing checklist items:
- ${existingTitles}
`;
}

function buildChatPrompt({ message, context, history }) {
  const recentHistory = history
    .slice(-8)
    .map((item) => `${item.role === 'assistant' ? 'Assistant' : 'User'}: ${item.content}`)
    .join('\n');

  return `
You are Task Manager Copilot, a senior product/project assistant embedded in a Jira-like Kanban app.
Answer in Vietnamese unless the user clearly asks for English.

You can help with:
- Board health analysis and bottlenecks.
- Sprint or activity digest.
- Task prioritization and due-date risk.
- Suggested task creation.
- Suggested subtasks/checklists.
- Summarizing task descriptions, comments, and board activity.
- Answering questions about the current board data.

Important rules:
- Prefer evidence from the provided project context.
- If the user mentions a task/feature name that is not an exact match, search approximate titles, descriptions, and project context before saying it is missing.
- If no exact task exists but the request is still a valid planning request, provide a useful generic plan and say it is an inferred suggestion.
- Be specific: cite board names, column names, task titles, priority, due date, assignee, and checklist progress when available.
- Be concise but not shallow: give reasoning plus next actions.
- Do not claim that you changed the database.
- If the user asks to create/update/delete something, provide a clear suggested payload or next step.
- For task/subtask suggestions, return practical checklist-style items.
- Use markdown:
  - short headings
  - bullet lists
  - tables only when they improve scanning
- Avoid apologizing repeatedly. Give the best answer possible from context.

Today is ${context.current_date || 'unknown'}.

Project context JSON:
${JSON.stringify(context, null, 2)}

Recent conversation:
${recentHistory || 'None'}

User message:
${message}
`;
}

async function requestGeminiText({ prompt, temperature = 0.25, maxOutputTokens = 1400 }) {
  const { apiKey, model } = getGeminiConfig();

  if (!apiKey) {
    const error = new Error('Missing GEMINI_API_KEY');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(
    `${GEMINI_API_BASE_URL}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens,
        },
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`Gemini request failed: ${detail}`);
    error.statusCode = response.status;
    throw error;
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!text) {
    throw new Error('Gemini returned an empty response');
  }

  return text;
}

async function generateChatReply({ message, context, history = [] }) {
  return requestGeminiText({
    prompt: buildChatPrompt({ message, context, history }),
    temperature: 0.3,
    maxOutputTokens: 1600,
  });
}

async function generateSubTaskTitles({ task, existingSubTasks = [] }) {
  const { apiKey, model } = getGeminiConfig();

  if (!apiKey) {
    const error = new Error('Missing GEMINI_API_KEY');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(
    `${GEMINI_API_BASE_URL}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: buildSubtaskPrompt({ task, existingSubTasks }) }],
          },
        ],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              subtasks: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    title: { type: 'STRING' },
                  },
                  required: ['title'],
                },
              },
            },
            required: ['subtasks'],
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`Gemini request failed: ${detail}`);
    error.statusCode = response.status;
    throw error;
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini returned an empty response');
  }

  const parsed = parseJsonObject(text);
  const existingSet = new Set(
    existingSubTasks.map((item) => item.title.trim().toLowerCase())
  );
  const uniqueTitles = [];

  for (const item of parsed.subtasks || []) {
    const title = cleanGeneratedTitle(item.title);
    const key = title.toLowerCase();

    if (!title || existingSet.has(key) || uniqueTitles.some((current) => current.toLowerCase() === key)) {
      continue;
    }

    uniqueTitles.push(title);
  }

  return uniqueTitles.slice(0, 6);
}

module.exports = {
  generateChatReply,
  generateSubTaskTitles,
};
