# gptossToapi
Reverse gpt-oss.com to an openai compatible API
# GPT-OSS API Proxy

## Overview

This project is an API proxy that provides a compatible interface with OpenAI's API specification for interacting with GPT-OSS models. It supports both streaming and non-streaming responses for chat completions.

## Features

- OpenAI API compatible endpoints
- Support for multiple GPT-OSS models
- Streaming response support (Server-Sent Events)
- CORS enabled
- Simple deployment with Deno

## Installation

1. Ensure you have Deno installed (https://deno.land/)
2. Clone this repository
3. Run the server:

```bash
deno run --allow-net main.ts
```

## API Endpoints

### `GET /`
- Returns basic server status and available endpoints

### `GET /v1/models`
- Lists available models
- Response format:
```json
{
  "object": "list",
  "data": [
    {
      "id": "gpt-oss-120b",
      "object": "model",
      "created": 1234567890,
      "owned_by": "gpt-oss"
    },
    {
      "id": "gpt-oss-20b",
      "object": "model",
      "created": 1234567890,
      "owned_by": "gpt-oss"
    }
  ]
}
```

### `POST /v1/chat/completions`
- Processes chat completion requests
- Supports both streaming and non-streaming responses
- Required parameters:
  - `messages`: Array of message objects
  - `model`: Model ID (default: "gpt-oss-120b")
  - `stream`: Boolean to enable streaming

#### Example Request:
```json
{
  "model": "gpt-oss-120b",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "stream": false
}
```

## Configuration

### Available Models
The proxy currently supports these models:
- `gpt-oss-120b`
- `gpt-oss-20b`

The default model is `gpt-oss-120b`.

## Environment Variables

No environment variables are currently required, but you may want to add:
- `PORT` - To specify the server port
- `CORS_ORIGIN` - To restrict CORS access

## Error Handling

The API returns appropriate HTTP status codes and error messages in JSON format for:
- Invalid requests (400)
- Method not allowed (405)
- Not found (404)
- Server errors (500)

## Deployment

This server is designed to run with Deno. For production deployment, consider:
- Using Deno Deploy
- Running behind a reverse proxy (Nginx, Caddy)
- Implementing rate limiting
- Adding authentication


