import { GPTOSS } from "./gptoss.ts";

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

// Handle /v1/models endpoint
function handleModelsRequest(): Response {
  return new Response(
    JSON.stringify({
      object: "list",
      data: Object.values(models)
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }
  );
}

// Handle /v1/chat/completions endpoint
async function handleChatRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: {
          message: "Method not allowed",
          type: "invalid_request_error"
        }
      }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  try {
    const body = await request.json();
    const stream = body.stream || false;
    const model = body.model || defaultModel;
    const messages = body.messages || [];

    // Validate model
    if (!Object.keys(models).includes(model)) {
      return new Response(
        JSON.stringify({
          error: {
            message: `Model '${model}' not found`,
            type: "invalid_request_error"
          }
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Validate messages
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({
          error: {
            message: "Messages must be a non-empty array",
            type: "invalid_request_error"
          }
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const gptoss = new GPTOSS();
    const response = await gptoss.chatCompletion({
      model,
      messages,
      stream
    });

    if (stream) {
      // Create SSE stream
      const readable = new ReadableStream({
        async start(controller) {
          try {
            const encoder = new TextEncoder();
            
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
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneData)}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (error) {
            console.error("Stream error:", error);
            controller.error(error);
          }
        }
      });

      return new Response(readable, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        }
      });
    } else {
      // Non-streaming response
      let fullResponse = "";
      for await (const chunk of response) {
        fullResponse += chunk;
      }

      return new Response(
        JSON.stringify({
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
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
          }
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  } catch (error) {
    console.error("Chat completion error:", error);
    return new Response(
      JSON.stringify({
        error: {
          message: "Internal server error",
          type: "server_error"
        }
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}

// Main request handler
async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // Add CORS headers if needed
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };

  // Handle OPTIONS request for CORS
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    let response: Response;
    
    if (url.pathname === "/v1/models" && request.method === "GET") {
      response = handleModelsRequest();
    } else if (url.pathname === "/v1/chat/completions" && request.method === "POST") {
      response = await handleChatRequest(request);
    } else if (url.pathname === "/" && request.method === "GET") {
      response = new Response(
        JSON.stringify({ 
          status: "ok", 
          message: "GPT-OSS API Proxy is running",
          endpoints: ["/v1/models", "/v1/chat/completions"]
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    } else {
      response = new Response(
        JSON.stringify({ 
          error: {
            message: `Path ${url.pathname} not found`,
            type: "invalid_request_error"
          }
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Add CORS headers to response
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (e) {
    console.error("Error in handler:", e);
    return new Response(
      JSON.stringify({ 
        error: {
          message: "Internal server error",
          type: "server_error"
        }
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      }
    );
  }
}

// Start server
console.log("Server starting...");
Deno.serve(handler);
