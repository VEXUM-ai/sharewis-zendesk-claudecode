# Zendesk MCP Server

Model Context Protocol (MCP) サーバーで、ChatGPTやClaude CodeからZendeskを操作できます。

このサーバーは2つのモードで動作します：
- **Stdio Mode**: ChatGPT Desktop AppやClaude Codeで使用（ローカル実行）
- **HTTP Mode**: Render.comなどでホスティングして、HTTP API経由で使用

## 機能

このMCPサーバーは、以下のZendesk操作をサポートしています：

### チケット管理
- `search_tickets` - チケットを検索
- `get_ticket` - チケットの詳細を取得（**コメント履歴も含む**）
- `create_ticket` - 新規チケットを作成
- `update_ticket` - チケットを更新
- `add_comment` - チケットにコメントを追加
- `get_ticket_comments` - チケットのコメント一覧を取得

### ユーザー管理
- `search_users` - ユーザーを検索
- `get_user` - ユーザーの詳細を取得

### 組織管理
- `search_organizations` - 組織を検索
- `get_organization` - 組織の詳細を取得

### ヘルプセンター（ナレッジベース）
- `search_articles` - ヘルプセンター記事を検索
- `get_article` - 特定の記事の詳細を取得
- `get_articles_by_section` - セクション内の記事一覧を取得

## デプロイ方法

### オプション A: Render.comでホスティング（推奨）

#### 1. GitHubリポジトリをRender.comに接続

1. [Render.com](https://render.com/)にアクセスしてサインアップ/ログイン
2. "New +" ボタンをクリックして "Web Service" を選択
3. このGitHubリポジトリを接続: `https://github.com/VEXUM-ai/sharewis-zendesk-claudecode`
4. 以下の設定を入力：
   - **Name**: `zendesk-mcp-server`（任意の名前）
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

#### 2. 環境変数を設定

Render.comのダッシュボードで以下の環境変数を追加：

- `ZENDESK_SUBDOMAIN`: あなたのZendeskサブドメイン（例: `yourcompany`）
- `ZENDESK_EMAIL`: Zendeskアカウントのメールアドレス
- `ZENDESK_API_TOKEN`: ZendeskのAPIトークン
- `PORT`: `3000`（Renderが自動設定）

#### 3. デプロイ

"Create Web Service" をクリックすると、自動的にデプロイが開始されます。

デプロイが完了すると、以下のようなURLが発行されます：
```
https://zendesk-mcp-server.onrender.com
```

#### 4. 動作確認

ブラウザまたはcurlでアクセス：
```bash
curl https://zendesk-mcp-server.onrender.com/
```

レスポンス例：
```json
{
  "name": "zendesk-mcp-server",
  "version": "1.0.0",
  "status": "running",
  "credentials_configured": true
}
```

#### 5. HTTP APIの使い方

**ツール一覧を取得：**
```bash
curl https://zendesk-mcp-server.onrender.com/tools
```

**チケットを検索：**
```bash
curl -X POST https://zendesk-mcp-server.onrender.com/tools/search_tickets \
  -H "Content-Type: application/json" \
  -d '{"query": "status:open"}'
```

**チケットを作成：**
```bash
curl -X POST https://zendesk-mcp-server.onrender.com/tools/create_ticket \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "テストチケット",
    "comment": "これはテストです",
    "priority": "high"
  }'
```

**ヘルプセンター記事を検索：**
```bash
curl -X POST https://zendesk-mcp-server.onrender.com/tools/search_articles \
  -H "Content-Type: application/json" \
  -d '{
    "query": "CRM連携",
    "locale": "ja"
  }'
```

**MCP互換エンドポイント（JSON-RPC）：**
```bash
curl -X POST https://zendesk-mcp-server.onrender.com/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

### オプション B: ローカル実行（ChatGPT Desktop / Claude Code）

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. ビルド

```bash
npm run build
```

### 3. ChatGPT Desktop Appで設定

ChatGPT Desktop Appの設定ファイルを編集します。

**macOS/Linux:**
```
~/Library/Application Support/ChatGPT/mcp_config.json
```

**Windows:**
```
%APPDATA%\ChatGPT\mcp_config.json
```

設定例（Stdio Mode）：

```json
{
  "mcpServers": {
    "zendesk": {
      "command": "node",
      "args": [
        "/path/to/zendesk-claudecode/dist/index.js"
      ],
      "env": {
        "ZENDESK_SUBDOMAIN": "yourcompany",
        "ZENDESK_EMAIL": "your-email@example.com",
        "ZENDESK_API_TOKEN": "your-api-token-here"
      }
    }
  }
}
```

### 4. ChatGPTを再起動

ChatGPT Desktop Appを再起動して、MCPサーバーを読み込みます。

---

## Zendesk認証情報の取得方法

1. Zendeskにログイン
2. 管理センター（歯車アイコン）> アプリとインテグレーション > API > Zendesk API
3. 「トークンアクセスを有効にする」を有効化
4. 「新しいトークンを追加」をクリック
5. トークンの説明を入力して「保存」

取得した情報：
- **サブドメイン**: `yourcompany.zendesk.com` の `yourcompany` 部分
- **メールアドレス**: Zendeskアカウントのメールアドレス
- **APIトークン**: 生成されたトークン文字列

## 使い方

ChatGPTで以下のようなリクエストができます：

### チケット検索
```
Zendeskで未解決のチケットを検索してください
```

### チケット作成
```
"テスト問題"というタイトルで、優先度が高いZendeskチケットを作成してください
```

### チケット更新
```
チケット番号123のステータスを「解決済み」に変更してください
```

### コメント追加
```
チケット番号456に「対応しました」というコメントを追加してください
```

### ヘルプセンター記事検索
```
CRM連携設定についてのヘルプセンター記事を検索してください
```

```
ユーザーのCSV一括登録についての記事を探してください
```

## ツール詳細

### search_tickets

チケットを検索します。

**パラメータ:**
- `query` (string): 検索クエリ
  - 例: `status:open priority:high`
  - 例: `tag:urgent`
  - 例: `subject:エラー`

### get_ticket

チケットの詳細情報を取得します（**コメント履歴も含む**）。

**パラメータ:**
- `ticket_id` (number): チケットID

**レスポンス:**
- `ticket`: チケットの基本情報
- `comments`: チケットの全コメント履歴（時系列順）

### create_ticket

新しいチケットを作成します。

**パラメータ:**
- `subject` (string): 件名
- `comment` (string): 初期コメント
- `priority` (string, optional): 優先度（low, normal, high, urgent）
- `tags` (array, optional): タグの配列

### update_ticket

既存のチケットを更新します。

**パラメータ:**
- `ticket_id` (number): チケットID
- `status` (string, optional): ステータス（new, open, pending, hold, solved, closed）
- `priority` (string, optional): 優先度（low, normal, high, urgent）
- `subject` (string, optional): 新しい件名
- `tags` (array, optional): タグの配列

### add_comment

チケットにコメントを追加します。

**パラメータ:**
- `ticket_id` (number): チケットID
- `comment` (string): コメントテキスト
- `is_public` (boolean, optional): 公開コメントかどうか（デフォルト: true）

### get_ticket_comments

チケットの全コメントを取得します。

**パラメータ:**
- `ticket_id` (number): チケットID

### search_users

ユーザーを検索します。

**パラメータ:**
- `query` (string): 検索クエリ
  - 例: `email:user@example.com`
  - 例: `name:田中`

### get_user

ユーザーの詳細情報を取得します。

**パラメータ:**
- `user_id` (number): ユーザーID

### search_organizations

組織を検索します。

**パラメータ:**
- `query` (string): 検索クエリ
  - 例: `name:株式会社〇〇`

### get_organization

組織の詳細情報を取得します。

**パラメータ:**
- `org_id` (number): 組織ID

### search_articles

ヘルプセンター記事を検索します。

**パラメータ:**
- `query` (string): 検索クエリ
  - 例: `CRM連携`
  - 例: `CSV一括登録`
  - 例: `パスワードリセット`
- `locale` (string, optional): 言語ロケール（デフォルト: `ja`）

**使用例:**
```
CRM連携設定についてのヘルプセンター記事を検索してください
```

### get_article

特定のヘルプセンター記事の詳細を取得します。

**パラメータ:**
- `article_id` (number): 記事ID
- `locale` (string, optional): 言語ロケール（デフォルト: `ja`）

**使用例:**
```
記事ID 123456789 の内容を取得してください
```

### get_articles_by_section

特定のセクション内のすべての記事を取得します。

**パラメータ:**
- `section_id` (number): セクションID
- `locale` (string, optional): 言語ロケール（デフォルト: `ja`）

**使用例:**
```
セクションID 987654321 の記事一覧を表示してください
```

## トラブルシューティング

### 認証エラーが発生する場合

1. 環境変数が正しく設定されているか確認
2. APIトークンが有効か確認
3. メールアドレスが正しいか確認
4. Zendesk APIが有効になっているか確認

### ChatGPTでツールが表示されない場合

1. ChatGPT Desktop Appを完全に再起動
2. `mcp_config.json`のパスが正しいか確認
3. コンソールでエラーが出ていないか確認

## ライセンス

MIT

## 参考リンク

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Zendesk API Documentation](https://developer.zendesk.com/api-reference/)
- [ChatGPT Desktop MCP Guide](https://help.openai.com/en/articles/9936905-using-mcp-with-chatgpt-desktop)
