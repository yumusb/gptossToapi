// Import required modules
import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { GPTOSS } from "./gptoss.ts";

// Initialize the application
const app = new Application();
const router = new Router();

// Supported models
const models = {
  "gpt-oss-120b": {
    id: "gpt-oss-120b",
    object: "model",
    created: Date.now(),
    owned_by: "gpt-oss"
  },
  "gpt-oss-20b": {
    id: "gpt-oss-20b",
    object: "model",
    created: Date.now(),
    owned_by: "gpt-oss"
  }
};

const defaultModel = "gpt-oss-120b";

// Models endpoint
router.get("/v1/models", (ctx) => {
  ctx.response.body = {
    object: "list",
    data: Object.values(models)
  };
});

// Chat completions endpoint
router.post("/v1/chat/completions", async (ctx) => {
  try {
    const body = await ctx.request.body().value;
    const stream = body.stream || false;
    const model = body.model || defaultModel;
    const messages = body.messages || [];

    // Validate model
    if (!Object.keys(models).includes(model)) {
      ctx.response.status = 400;
      ctx.response.body = {
        error: {
          message: `Model '${model}' not found`,
          type: "invalid_request_error"
        }
      };
      return;
    }

    // Validate messages
    if (!Array.isArray(messages) || messages.length === 0) {
      ctx.response.status = 400;
      ctx.response.body = {
        error: {
          message: "Messages must be a non-empty array",
          type: "invalid_request_error"
        }
      };
      return;
    }

    const gptoss = new GPTOSS();
    const response = await gptoss.chatCompletion({
      model,
      messages,
      stream
    });

    if (stream) {
      // Set SSE headers
      ctx.response.headers.set("Content-Type", "text/event-stream");
      ctx.response.headers.set("Cache-Control", "no-cache");
      ctx.response.headers.set("Connection", "keep-alive");

      // Create a stream and pipe the GPT-OSS response
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of response) {
              const data = {
                id: `chatcmpl-${crypto.randomUUID()}`,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [{
                  index: 0,
                  delta: {
                    content: chunk
                  },
                  finish_reason: null
                }]
              };
              const encoder = new TextEncoder();
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            }
            // Send done event
            const doneData = {
              id: `chatcmpl-${crypto.randomUUID()}`,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [{
                index: 0,
                delta: {},
                finish_reason: "stop"
              }]
            };
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneData)}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        }
      });

      ctx.response.body = readable;
    } else {
      // Non-streaming response
      let fullResponse = "";
      for await (const chunk of response) {
        fullResponse += chunk;
      }

      ctx.response.body = {
        id: `chatcmpl-${crypto.randomUUID()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: fullResponse
          },
          finish_reason: "stop"
        }],
        usage: {
          prompt_tokens: 0, // You may want to calculate these
          completion_tokens: 0,
          total_tokens: 0
        }
      };
    }
  } catch (error) {
    console.error("Error:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      error: {
        message: "Internal server error",
        type: "server_error"
      }
    };
  }
});

// Health check endpoint
router.get("/", (ctx) => {
  ctx.response.body = { status: "ok", message: "GPT-OSS API Proxy is running" };
});

// Use the router
app.use(router.routes());
app.use(router.allowedMethods());

// Get port from environment variable or use default
const port = parseInt(Deno.env.get("PORT") || "8000");

// Start the server
console.log(`Server starting on port ${port}...`);
await app.listen({ port });
