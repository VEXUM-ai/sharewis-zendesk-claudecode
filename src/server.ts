#!/usr/bin/env node

import express from "express";
import cors from "cors";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosInstance } from "axios";
import { randomUUID } from "crypto";

// Zendesk APIクライアント
class ZendeskClient {
  private axiosInstance: AxiosInstance;
  private subdomain: string;

  constructor(subdomain: string, email: string, apiToken: string) {
    this.subdomain = subdomain;
    const auth = Buffer.from(`${email}/token:${apiToken}`).toString("base64");

    this.axiosInstance = axios.create({
      baseURL: `https://${subdomain}.zendesk.com/api/v2`,
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    });
  }

  async searchTickets(query: string) {
    const response = await this.axiosInstance.get("/search.json", {
      params: { query: `type:ticket ${query}` },
    });
    return response.data;
  }

  async getTicket(ticketId: number) {
    const response = await this.axiosInstance.get(`/tickets/${ticketId}.json`);
    return response.data;
  }

  async createTicket(subject: string, comment: string, priority?: string, tags?: string[]) {
    const response = await this.axiosInstance.post("/tickets.json", {
      ticket: {
        subject,
        comment: { body: comment },
        priority: priority || "normal",
        tags: tags || [],
      },
    });
    return response.data;
  }

  async updateTicket(ticketId: number, updates: any) {
    const response = await this.axiosInstance.put(`/tickets/${ticketId}.json`, {
      ticket: updates,
    });
    return response.data;
  }

  async addComment(ticketId: number, comment: string, isPublic: boolean = true) {
    const response = await this.axiosInstance.put(`/tickets/${ticketId}.json`, {
      ticket: {
        comment: { body: comment, public: isPublic },
      },
    });
    return response.data;
  }

  async searchUsers(query: string) {
    const response = await this.axiosInstance.get("/search.json", {
      params: { query: `type:user ${query}` },
    });
    return response.data;
  }

  async getUser(userId: number) {
    const response = await this.axiosInstance.get(`/users/${userId}.json`);
    return response.data;
  }

  async searchOrganizations(query: string) {
    const response = await this.axiosInstance.get("/search.json", {
      params: { query: `type:organization ${query}` },
    });
    return response.data;
  }

  async getOrganization(orgId: number) {
    const response = await this.axiosInstance.get(`/organizations/${orgId}.json`);
    return response.data;
  }

  async getTicketComments(ticketId: number) {
    const response = await this.axiosInstance.get(`/tickets/${ticketId}/comments.json`);
    return response.data;
  }
}

// 環境変数から認証情報を取得
const ZENDESK_SUBDOMAIN = process.env.ZENDESK_SUBDOMAIN;
const ZENDESK_EMAIL = process.env.ZENDESK_EMAIL;
const ZENDESK_API_TOKEN = process.env.ZENDESK_API_TOKEN;

let zendeskClient: ZendeskClient | null = null;

if (ZENDESK_SUBDOMAIN && ZENDESK_EMAIL && ZENDESK_API_TOKEN) {
  zendeskClient = new ZendeskClient(
    ZENDESK_SUBDOMAIN,
    ZENDESK_EMAIL,
    ZENDESK_API_TOKEN
  );
}

// ツール定義
const TOOLS: Tool[] = [
  {
    name: "search_tickets",
    description: "Search for Zendesk tickets using a query string",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_ticket",
    description: "Get detailed information about a specific ticket",
    inputSchema: {
      type: "object",
      properties: {
        ticket_id: { type: "number", description: "Ticket ID" },
      },
      required: ["ticket_id"],
    },
  },
  {
    name: "create_ticket",
    description: "Create a new Zendesk ticket",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Ticket subject" },
        comment: { type: "string", description: "Initial comment" },
        priority: {
          type: "string",
          enum: ["low", "normal", "high", "urgent"],
          description: "Priority level",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags",
        },
      },
      required: ["subject", "comment"],
    },
  },
  {
    name: "update_ticket",
    description: "Update an existing ticket",
    inputSchema: {
      type: "object",
      properties: {
        ticket_id: { type: "number", description: "Ticket ID" },
        status: {
          type: "string",
          enum: ["new", "open", "pending", "hold", "solved", "closed"],
        },
        priority: {
          type: "string",
          enum: ["low", "normal", "high", "urgent"],
        },
        subject: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["ticket_id"],
    },
  },
  {
    name: "add_comment",
    description: "Add a comment to a ticket",
    inputSchema: {
      type: "object",
      properties: {
        ticket_id: { type: "number", description: "Ticket ID" },
        comment: { type: "string", description: "Comment text" },
        is_public: { type: "boolean", default: true },
      },
      required: ["ticket_id", "comment"],
    },
  },
  {
    name: "get_ticket_comments",
    description: "Get all comments for a ticket",
    inputSchema: {
      type: "object",
      properties: {
        ticket_id: { type: "number", description: "Ticket ID" },
      },
      required: ["ticket_id"],
    },
  },
  {
    name: "search_users",
    description: "Search for Zendesk users",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_user",
    description: "Get user details",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "number", description: "User ID" },
      },
      required: ["user_id"],
    },
  },
  {
    name: "search_organizations",
    description: "Search for organizations",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_organization",
    description: "Get organization details",
    inputSchema: {
      type: "object",
      properties: {
        org_id: { type: "number", description: "Organization ID" },
      },
      required: ["org_id"],
    },
  },
];

// ツール実行ハンドラー
async function executeTool(name: string, args: any) {
  if (!zendeskClient) {
    throw new Error("Zendesk credentials not configured");
  }

  switch (name) {
    case "search_tickets":
      return await zendeskClient.searchTickets(args.query);
    case "get_ticket":
      return await zendeskClient.getTicket(args.ticket_id);
    case "create_ticket":
      return await zendeskClient.createTicket(
        args.subject,
        args.comment,
        args.priority,
        args.tags
      );
    case "update_ticket": {
      const updates: any = {};
      if (args.status) updates.status = args.status;
      if (args.priority) updates.priority = args.priority;
      if (args.subject) updates.subject = args.subject;
      if (args.tags) updates.tags = args.tags;
      return await zendeskClient.updateTicket(args.ticket_id, updates);
    }
    case "add_comment":
      return await zendeskClient.addComment(
        args.ticket_id,
        args.comment,
        args.is_public ?? true
      );
    case "get_ticket_comments":
      return await zendeskClient.getTicketComments(args.ticket_id);
    case "search_users":
      return await zendeskClient.searchUsers(args.query);
    case "get_user":
      return await zendeskClient.getUser(args.user_id);
    case "search_organizations":
      return await zendeskClient.searchOrganizations(args.query);
    case "get_organization":
      return await zendeskClient.getOrganization(args.org_id);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// MCP Server インスタンスを作成する関数
function createMCPServer() {
  const server = new Server(
    {
      name: "zendesk-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // ツール一覧ハンドラー
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // ツール実行ハンドラー
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (!zendeskClient) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Zendesk credentials not configured. Please set ZENDESK_SUBDOMAIN, ZENDESK_EMAIL, and ZENDESK_API_TOKEN environment variables.",
          },
        ],
        isError: true,
      };
    }

    try {
      const { name, arguments: args } = request.params;

      if (!args) {
        return {
          content: [
            {
              type: "text",
              text: "Error: No arguments provided",
            },
          ],
          isError: true,
        };
      }

      const result = await executeTool(name, args);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

// セッション管理
const transports: Record<string, StreamableHTTPServerTransport> = {};

// initializeリクエストかどうかを判定
function isInitializeRequest(body: any): boolean {
  return (
    body &&
    body.jsonrpc === "2.0" &&
    body.method === "initialize" &&
    body.params !== undefined
  );
}

// HTTP サーバー設定
const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: "*",
    exposedHeaders: ["Mcp-Session-Id"],
  })
);
app.use(express.json());

// ヘルスチェック
app.get("/", (req, res) => {
  res.json({
    name: "zendesk-mcp-server",
    version: "1.0.0",
    status: "running",
    credentials_configured: !!zendeskClient,
    mcp_endpoint: "/mcp",
  });
});

// ツール一覧（後方互換性）
app.get("/tools", (req, res) => {
  res.json({ tools: TOOLS });
});

// ツール実行（後方互換性）
app.post("/tools/:toolName", async (req, res) => {
  try {
    const { toolName } = req.params;
    const args = req.body;

    const result = await executeTool(toolName, args);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// MCP over SSE エンドポイント
app.all("/mcp", async (req, res) => {
  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport = sessionId ? transports[sessionId] : undefined;

    // 新しいセッションの初期化
    if (!transport && req.method === "POST" && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          if (transport) {
            transports[sid] = transport;
            console.log(`MCP session initialized: ${sid}`);
          }
        },
      });

      transport.onclose = () => {
        if (transport && transport.sessionId) {
          delete transports[transport.sessionId];
          console.log(`MCP session closed: ${transport.sessionId}`);
        }
      };

      const mcpServer = createMCPServer();
      await mcpServer.connect(transport);
    }

    // セッションが見つからない場合
    if (!transport) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session or initialize request",
        },
        id: null,
      });
      return;
    }

    // リクエストを処理
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP endpoint error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : String(error),
        },
        id: null,
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Zendesk MCP Server listening on port ${PORT}`);
  console.log(`Credentials configured: ${!!zendeskClient}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
});
