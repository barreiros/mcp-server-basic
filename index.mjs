import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Setup logging
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const logDir = process.env.MCP_LOGS_DIR || path.join(__dirname, 'logs')
const logFile = path.join(logDir, 'mcp-server.log')

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

function log(message) {
  const timestamp = new Date().toISOString()
  const logMessage = `${timestamp} - ${message}\n`
  console.error(logMessage.trim())
  fs.appendFileSync(logFile, logMessage)
}

log('Starting MCP server...')

const server = new Server(
  {
    name: 'barrilete',
    version: '1.0.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
)

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'file:///example.txt',
        name: 'Example Resource',
      },
    ],
  }
})

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === 'file:///example.txt') {
    return {
      contents: [
        {
          uri: 'file:///example.txt',
          mimeType: 'text/plain',
          text: 'This is the content of the example resource.',
        },
      ],
    }
  } else {
    throw new Error('Resource not found')
  }
})

// Add tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  log('Listing tools')
  return {
    tools: [
      {
        name: 'echo',
        description: 'Echo back the input message',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Message to echo back',
            },
          },
          required: ['message'],
        },
      },
    ],
  }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  log(`Tool called: ${request.params.name}`)
  log(`Arguments: ${JSON.stringify(request.params.arguments)}`)

  if (request.params.name === 'echo') {
    const message = request.params.arguments.message
    log(`Echoing message: ${message}`)

    return {
      content: [
        {
          type: 'text',
          text: `Echo: ${message}`,
        },
      ],
    }
  } else {
    log(`Unknown tool: ${request.params.name}`)
    throw new Error(`Unknown tool: ${request.params.name}`)
  }
})

// Add error handling
server.onerror = (error) => {
  log(`MCP Server Error: ${error.message}`)
  if (error.stack) {
    log(`Stack trace: ${error.stack}`)
  }
}

// Setup graceful shutdown
process.on('SIGINT', async () => {
  log('Received SIGINT signal. Shutting down...')
  try {
    await server.close()
    log('Server closed successfully')
  } catch (error) {
    log(`Error during shutdown: ${error.message}`)
  }
  process.exit(0)
})

process.on('SIGTERM', async () => {
  log('Received SIGTERM signal. Shutting down...')
  try {
    await server.close()
    log('Server closed successfully')
  } catch (error) {
    log(`Error during shutdown: ${error.message}`)
  }
  process.exit(0)
})

// Connect to transport
try {
  log('Connecting to StdioServerTransport...')
  const transport = new StdioServerTransport()
  await server.connect(transport)
  log('MCP server connected and running')
} catch (error) {
  log(`Failed to connect to transport: ${error.message}`)
  if (error.stack) {
    log(`Stack trace: ${error.stack}`)
  }
  process.exit(1)
}
