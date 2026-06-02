#!/usr/bin/env node

import { createInterface } from 'node:readline'
import { createQuizoticClient } from './quizotic-api-client.mjs'

const client = createQuizoticClient()

const tools = [
  {
    name: 'generate_quiz',
    description: 'Generate quiz questions from a topic, text, or URL using Quizotic AI.',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['topic', 'text', 'url'] },
        topic: { type: 'string' },
        text: { type: 'string' },
        url: { type: 'string' },
        questionCount: { type: 'number', minimum: 1, maximum: 30 },
        difficulty: { type: 'string' },
        questionTypes: { type: 'array', items: { type: 'string' } },
      },
      required: ['mode'],
    },
  },
  {
    name: 'create_quiz',
    description: 'Save a generated or manually prepared quiz into Quizotic.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        subject: { type: 'string' },
        language: { type: 'string' },
        theme: { type: 'string' },
        questions: { type: 'array', items: { type: 'object' } },
      },
      required: ['title', 'questions'],
    },
  },
  {
    name: 'publish_self_paced_quiz',
    description: 'Publish a saved quiz as a self-paced Quizotic link.',
    inputSchema: {
      type: 'object',
      properties: {
        quizId: { type: 'string' },
        allowRetries: { type: 'boolean' },
        closesAt: { type: 'string' },
        timeLimitMinutes: { type: 'number' },
      },
      required: ['quizId'],
    },
  },
  {
    name: 'list_quizzes',
    description: 'List quizzes owned by the connected Quizotic API key.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', minimum: 1, maximum: 200 },
        offset: { type: 'number', minimum: 0 },
      },
    },
  },
  {
    name: 'get_report',
    description: 'Fetch session results and teacher insights from Quizotic.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
      },
      required: ['sessionId'],
    },
  },
]

function jsonResult(data) {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  }
}

async function callTool(name, args) {
  switch (name) {
    case 'generate_quiz':
      return jsonResult(await client.generateQuiz(args || {}))
    case 'create_quiz':
      return jsonResult(await client.createQuiz(args || {}))
    case 'publish_self_paced_quiz':
      return jsonResult(await client.publishSelfPacedQuiz(args || {}))
    case 'list_quizzes':
      return jsonResult(await client.listQuizzes(args || {}))
    case 'get_report':
      return jsonResult(await client.getReport(args || {}))
    default:
      throw new Error(`Unknown Quizotic tool: ${name}`)
  }
}

function write(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

async function handle(message) {
  if (!message || typeof message !== 'object') return null

  if (message.method === 'initialize') {
    return {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'quizotic-mcp', version: '0.1.0' },
      capabilities: { tools: {} },
    }
  }

  if (message.method === 'tools/list') {
    return { tools }
  }

  if (message.method === 'tools/call') {
    const { name, arguments: args } = message.params || {}
    return callTool(name, args)
  }

  if (message.method === 'notifications/initialized') return null

  throw new Error(`Unsupported MCP method: ${message.method}`)
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity })

rl.on('line', async line => {
  if (!line.trim()) return

  let message
  try {
    message = JSON.parse(line)
    const result = await handle(message)
    if (message.id !== undefined && result !== null) {
      write({ jsonrpc: '2.0', id: message.id, result })
    }
  } catch (error) {
    if (message?.id !== undefined) {
      write({
        jsonrpc: '2.0',
        id: message.id,
        error: { code: -32000, message: error.message || 'Quizotic MCP error', data: error.payload },
      })
    }
  }
})
