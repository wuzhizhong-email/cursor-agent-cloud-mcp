import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import * as z from "zod/v4";

const APP_PORT = Number.parseInt(process.env.PORT ?? "3000", 10);
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.REQUEST_TIMEOUT_MS ?? "10000", 10);
const ORDER_DETAIL_API_BASE =
  process.env.ORDER_DETAIL_API_BASE ??
  "https://youxuer8.test.xdf.cn/api/order/rnInterface/test/getOrderDetail";

function createServer() {
  const server = new McpServer({
    name: "tiny-order-mcp-http-server",
    version: "1.0.0",
  });

  server.registerTool(
    "get_order_detail",
    {
      description: "Fetch order detail from upstream order API by order_id",
      inputSchema: {
        order_id: z.string().min(1).describe("Order ID to fetch"),
      },
    },
    async ({ order_id }) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const upstreamUrl = new URL(ORDER_DETAIL_API_BASE);
        upstreamUrl.searchParams.set("orderId", order_id);

        const response = await fetch(upstreamUrl, {
          method: "GET",
          signal: controller.signal,
        });

        const contentType = response.headers.get("content-type") ?? "";
        const isJson = contentType.includes("application/json");
        const body = isJson ? await response.json() : await response.text();

        if (!response.ok) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Upstream API returned ${response.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(body, null, 2),
            },
          ],
          structuredContent: {
            order_id,
            upstream_url: upstreamUrl.toString(),
            data: body,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Failed to fetch order detail for order_id=${order_id}: ${message}`,
            },
          ],
        };
      } finally {
        clearTimeout(timeout);
      }
    }
  );

  return server;
}

const app = createMcpExpressApp();

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.post("/mcp", async (req, res) => {
  const server = createServer();

  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

    res.on("close", async () => {
      await transport.close();
      await server.close();
    });
  } catch (error) {
    console.error("MCP request failed:", error);

    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
});

app.get("/mcp", (_req, res) => {
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed.",
      },
      id: null,
    })
  );
});

app.delete("/mcp", (_req, res) => {
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed.",
      },
      id: null,
    })
  );
});

app.listen(APP_PORT, (error) => {
  if (error) {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
  }

  console.log(`MCP HTTP server listening at http://0.0.0.0:${APP_PORT}/mcp`);
  console.log(`Upstream order API base: ${ORDER_DETAIL_API_BASE}`);
});
