#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosInstance } from "axios";

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

  // チケットを検索
  async searchTickets(query: string) {
    const response = await this.axiosInstance.get("/search.json", {
      params: {
        query: `type:ticket ${query}`,
      },
    });
    return response.data;
  }

  // チケットを取得（コメント履歴も含む）
  async getTicket(ticketId: number) {
    const ticketResponse = await this.axiosInstance.get(`/tickets/${ticketId}.json`);

    // 全コメントを取得（ページネーション対応）
    const allComments: any[] = [];
    let nextPageUrl: string | null = `/tickets/${ticketId}/comments.json?sort_order=asc`;

    while (nextPageUrl) {
      const commentsResponse: any = await this.axiosInstance.get(nextPageUrl);
      allComments.push(...commentsResponse.data.comments);

      // 次のページがあるかチェック
      nextPageUrl = commentsResponse.data.next_page;
      if (nextPageUrl) {
        // 絶対URLから相対パスに変換
        nextPageUrl = nextPageUrl.replace(this.axiosInstance.defaults.baseURL || '', '');
      }
    }

    return {
      ticket: ticketResponse.data.ticket,
      comments: allComments,
      total_comments: allComments.length,
    };
  }

  // チケットを作成
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

  // チケットを更新
  async updateTicket(ticketId: number, updates: any) {
    const response = await this.axiosInstance.put(`/tickets/${ticketId}.json`, {
      ticket: updates,
    });
    return response.data;
  }

  // チケットにコメントを追加
  async addComment(ticketId: number, comment: string, isPublic: boolean = true) {
    const response = await this.axiosInstance.put(`/tickets/${ticketId}.json`, {
      ticket: {
        comment: {
          body: comment,
          public: isPublic,
        },
      },
    });
    return response.data;
  }

  // ユーザーを検索
  async searchUsers(query: string) {
    const response = await this.axiosInstance.get("/search.json", {
      params: {
        query: `type:user ${query}`,
      },
    });
    return response.data;
  }

  // ユーザーを取得
  async getUser(userId: number) {
    const response = await this.axiosInstance.get(`/users/${userId}.json`);
    return response.data;
  }

  // 組織を検索
  async searchOrganizations(query: string) {
    const response = await this.axiosInstance.get("/search.json", {
      params: {
        query: `type:organization ${query}`,
      },
    });
    return response.data;
  }

  // 組織を取得
  async getOrganization(orgId: number) {
    const response = await this.axiosInstance.get(`/organizations/${orgId}.json`);
    return response.data;
  }

  // チケットのコメント一覧を取得（全ページ取得）
  async getTicketComments(ticketId: number) {
    const allComments: any[] = [];
    let nextPageUrl: string | null = `/tickets/${ticketId}/comments.json?sort_order=asc`;

    while (nextPageUrl) {
      const response: any = await this.axiosInstance.get(nextPageUrl);
      allComments.push(...response.data.comments);

      nextPageUrl = response.data.next_page;
      if (nextPageUrl) {
        nextPageUrl = nextPageUrl.replace(this.axiosInstance.defaults.baseURL || '', '');
      }
    }

    return {
      comments: allComments,
      count: allComments.length,
    };
  }

  // ヘルプセンター記事を検索
  async searchArticles(query: string, locale: string = "ja") {
    try {
      const response = await this.axiosInstance.get("/help_center/articles/search.json", {
        params: {
          query,
          locale,
        },
      });

      // 記事の詳細を取得（本文を含む）
      const results = response.data.results || [];
      const articlesWithDetails = await Promise.all(
        results.slice(0, 5).map(async (article: any) => {
          try {
            const detailResponse = await this.axiosInstance.get(
              `/help_center/articles/${article.id}.json`
            );
            return {
              id: article.id,
              title: article.title,
              url: article.html_url,
              snippet: article.snippet,
              body: detailResponse.data.article.body,
              section_id: detailResponse.data.article.section_id,
              created_at: detailResponse.data.article.created_at,
              updated_at: detailResponse.data.article.updated_at,
            };
          } catch (error) {
            // 詳細取得に失敗した場合は基本情報のみ返す
            return {
              id: article.id,
              title: article.title,
              url: article.html_url,
              snippet: article.snippet,
            };
          }
        })
      );

      return {
        results: articlesWithDetails,
        count: response.data.count,
        page: response.data.page,
        page_count: response.data.page_count,
      };
    } catch (error) {
      console.error("Help Center search error:", error);
      throw error;
    }
  }

  // ヘルプセンター記事を取得
  async getArticle(articleId: number, locale: string = "ja") {
    const response = await this.axiosInstance.get(
      `/help_center/articles/${articleId}.json`
    );
    return {
      article: response.data.article,
    };
  }

  // ヘルプセンターのセクション内記事一覧を取得
  async getArticlesBySection(sectionId: number, locale: string = "ja") {
    const response = await this.axiosInstance.get(
      `/help_center/sections/${sectionId}/articles.json`
    );
    return {
      articles: response.data.articles,
      count: response.data.count,
    };
  }
}

// MCPサーバーの設定
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

// ツール一覧
const TOOLS: Tool[] = [
  {
    name: "search_tickets",
    description: "Search for Zendesk tickets using a query string. Query can include status, priority, tags, etc.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (e.g., 'status:open priority:high', 'tag:urgent')",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_ticket",
    description: "Get detailed information about a specific Zendesk ticket by ID including ALL comment history (supports pagination to retrieve complete conversation thread)",
    inputSchema: {
      type: "object",
      properties: {
        ticket_id: {
          type: "number",
          description: "The ID of the ticket to retrieve",
        },
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
        subject: {
          type: "string",
          description: "The subject/title of the ticket",
        },
        comment: {
          type: "string",
          description: "The initial comment/description for the ticket",
        },
        priority: {
          type: "string",
          description: "Priority level (low, normal, high, urgent)",
          enum: ["low", "normal", "high", "urgent"],
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags to add to the ticket",
        },
      },
      required: ["subject", "comment"],
    },
  },
  {
    name: "update_ticket",
    description: "Update an existing Zendesk ticket",
    inputSchema: {
      type: "object",
      properties: {
        ticket_id: {
          type: "number",
          description: "The ID of the ticket to update",
        },
        status: {
          type: "string",
          description: "New status (new, open, pending, hold, solved, closed)",
          enum: ["new", "open", "pending", "hold", "solved", "closed"],
        },
        priority: {
          type: "string",
          description: "New priority (low, normal, high, urgent)",
          enum: ["low", "normal", "high", "urgent"],
        },
        subject: {
          type: "string",
          description: "New subject/title",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags to set (replaces existing tags)",
        },
      },
      required: ["ticket_id"],
    },
  },
  {
    name: "add_comment",
    description: "Add a comment to an existing Zendesk ticket",
    inputSchema: {
      type: "object",
      properties: {
        ticket_id: {
          type: "number",
          description: "The ID of the ticket",
        },
        comment: {
          type: "string",
          description: "The comment text to add",
        },
        is_public: {
          type: "boolean",
          description: "Whether the comment is public (visible to end users) or internal",
          default: true,
        },
      },
      required: ["ticket_id", "comment"],
    },
  },
  {
    name: "get_ticket_comments",
    description: "Get all comments for a specific Zendesk ticket",
    inputSchema: {
      type: "object",
      properties: {
        ticket_id: {
          type: "number",
          description: "The ID of the ticket",
        },
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
        query: {
          type: "string",
          description: "Search query (e.g., 'email:user@example.com', 'name:John')",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_user",
    description: "Get detailed information about a specific Zendesk user by ID",
    inputSchema: {
      type: "object",
      properties: {
        user_id: {
          type: "number",
          description: "The ID of the user to retrieve",
        },
      },
      required: ["user_id"],
    },
  },
  {
    name: "search_organizations",
    description: "Search for Zendesk organizations",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (e.g., 'name:Acme Corp')",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_organization",
    description: "Get detailed information about a specific Zendesk organization by ID",
    inputSchema: {
      type: "object",
      properties: {
        org_id: {
          type: "number",
          description: "The ID of the organization to retrieve",
        },
      },
      required: ["org_id"],
    },
  },
  {
    name: "search_articles",
    description: "Search for Help Center articles using a query string. Use this to find relevant knowledge base articles.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query to find articles (e.g., 'CRM integration', 'CSV upload')",
        },
        locale: {
          type: "string",
          description: "Locale for the articles (default: 'ja' for Japanese)",
          default: "ja",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_article",
    description: "Get detailed information about a specific Help Center article by ID",
    inputSchema: {
      type: "object",
      properties: {
        article_id: {
          type: "number",
          description: "The ID of the article to retrieve",
        },
        locale: {
          type: "string",
          description: "Locale for the article (default: 'ja' for Japanese)",
          default: "ja",
        },
      },
      required: ["article_id"],
    },
  },
  {
    name: "get_articles_by_section",
    description: "Get all articles within a specific Help Center section",
    inputSchema: {
      type: "object",
      properties: {
        section_id: {
          type: "number",
          description: "The ID of the section",
        },
        locale: {
          type: "string",
          description: "Locale for the articles (default: 'ja' for Japanese)",
          default: "ja",
        },
      },
      required: ["section_id"],
    },
  },
];

// ツール一覧を返す
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// ツール実行
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (!zendeskClient) {
    return {
      content: [
        {
          type: "text",
          text: "Error: Zendesk credentials not configured. Please set ZENDESK_SUBDOMAIN, ZENDESK_EMAIL, and ZENDESK_API_TOKEN environment variables.",
        },
      ],
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

    switch (name) {
      case "search_tickets": {
        const result = await zendeskClient.searchTickets(args.query as string);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_ticket": {
        const result = await zendeskClient.getTicket(args.ticket_id as number);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "create_ticket": {
        const result = await zendeskClient.createTicket(
          args.subject as string,
          args.comment as string,
          args.priority as string | undefined,
          args.tags as string[] | undefined
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "update_ticket": {
        const updates: any = {};
        if (args.status) updates.status = args.status;
        if (args.priority) updates.priority = args.priority;
        if (args.subject) updates.subject = args.subject;
        if (args.tags) updates.tags = args.tags;

        const result = await zendeskClient.updateTicket(
          args.ticket_id as number,
          updates
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "add_comment": {
        const result = await zendeskClient.addComment(
          args.ticket_id as number,
          args.comment as string,
          args.is_public !== undefined ? (args.is_public as boolean) : true
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_ticket_comments": {
        const result = await zendeskClient.getTicketComments(args.ticket_id as number);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "search_users": {
        const result = await zendeskClient.searchUsers(args.query as string);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_user": {
        const result = await zendeskClient.getUser(args.user_id as number);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "search_organizations": {
        const result = await zendeskClient.searchOrganizations(args.query as string);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_organization": {
        const result = await zendeskClient.getOrganization(args.org_id as number);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "search_articles": {
        const result = await zendeskClient.searchArticles(
          args.query as string,
          (args.locale as string) || "ja"
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_article": {
        const result = await zendeskClient.getArticle(
          args.article_id as number,
          (args.locale as string) || "ja"
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_articles_by_section": {
        const result = await zendeskClient.getArticlesBySection(
          args.section_id as number,
          (args.locale as string) || "ja"
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
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

// サーバーを起動
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Zendesk MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
