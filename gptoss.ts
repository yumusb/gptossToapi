// gptoss.ts - GPT-OSS API client
export class GPTOSS {
  private apiEndpoint = "https://api.gpt-oss.com/chatkit";

  async *chatCompletion(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    stream: boolean;
  }): AsyncGenerator<string, void, unknown> {
    const { model, messages } = params;
    const userMessage = messages.filter(m => m.role === "user").pop()?.content || "";

    const data = {
      "op": "threads.create",
      "params": {
        "input": {
          "text": userMessage,
          "content": [{ "type": "input_text", "text": userMessage }],
          "quoted_text": "",
          "attachments": []
        }
      }
    };

    const headers = {
      "accept": "text/event-stream",
      "x-reasoning-effort": "high",
      "x-selected-model": model,
      "x-show-reasoning": "true"
    };

    try {
      const response = await fetch(this.apiEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data:")) {
            const jsonStr = line.substring(5).trim();
            if (jsonStr === "[DONE]") continue;

            try {
              const data = JSON.parse(jsonStr);
              if (data.type === "thread.item_updated") {
                const entry = data.update?.entry || data.update;
                if (entry?.type === "assistant_message.content_part.text_delta") {
                  yield entry.delta;
                }
              }
            } catch (e) {
              console.error("Error parsing SSE data:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error in GPT-OSS communication:", error);
      throw error;
    }
  }
}
