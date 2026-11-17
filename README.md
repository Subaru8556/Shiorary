<p align="center">
  <img src="frontend/public/shiorary-logo.svg" width="112" alt="Shiorary">
</p>

<h1 align="center">Shiorary</h1>

<p align="center">
  漫画・小説・同人誌を、自分だけの閉じた書庫で。<br>
  セルフホスト型の電子書庫サーバー
</p>

<p align="center">
  <img alt="Go" src="https://img.shields.io/badge/Go-Echo%20v4-2a5a40">
  <img alt="React" src="https://img.shields.io/badge/React-19-2a5a40">
  <img alt="SQLite" src="https://img.shields.io/badge/SQLite-Pure%20Go-2a5a40">
  <img alt="PWA" src="https://img.shields.io/badge/PWA-iPhone%20%2F%20Android-2a5a40">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-2a5a40">
</p>

---

**Shiorary**（シオラリー）は、手元の ZIP・EPUB・PDF・TXT などの電子書籍を一か所にまとめ、PC・タブレット・スマホのブラウザから読めるようにする、自分専用の書庫サーバーです。

Go のシングルバイナリと React で作られており、Docker でまとめて起動できます。**Cloudflare Zero Trust（Tunnel / WARP）** と組み合わせることで、自宅サーバーのポートを外部に一切開けずに、外出先から安全に自分の本棚へアクセスできます。

> **名前とロゴの由来**
> 「栞（しおり）」＋「library（書庫）」。しおりの語源は **枝折（しおり）**――山道で枝を折って、帰り道の目印にしたことに由来します。ロゴは、しおりの中に折れた小枝と若葉を描いたものです。

## 目次

- [主な機能](#主な機能)
- [対応フォーマット](#対応フォーマット)
- [クイックスタート](#クイックスタート)
- [外出先から使う（Cloudflare Zero Trust）](#外出先から使うcloudflare-zero-trust)
- [使い方](#使い方)
- [ビューワーの操作](#ビューワーの操作)
- [スマホ・タブレットでアプリとして使う（PWA）](#スマホタブレットでアプリとして使うpwa)
- [設定（環境変数）](#設定環境変数)
- [アップデート・バックアップ](#アップデートバックアップ)
- [開発](#開発)
- [ディレクトリ構成](#ディレクトリ構成)
- [よくある質問・トラブルシューティング](#よくある質問トラブルシューティング)
- [セキュリティについて](#セキュリティについて)
- [ライセンス](#ライセンス)

---

## 主な機能

### 📖 読む
- **形式ごとに最適化したビューワー**
  - 画像の本（ZIP / CBZ / 画像フォルダ / 漫画 EPUB）：右綴じ・左綴じ、見開き（画面の向きで自動切替）、表紙の単独表示、縦スクロール
  - 文章の本（EPUB / TXT）：画面サイズに合わせた自動ページ分割、縦書き・横書き、文字サイズ、背景色（和紙・白・夜間）、目次ジャンプ、青空文庫形式のルビ
  - PDF：ブラウザ内蔵のビューワーで表示
- **タップ・スワイプ・キーボードでページ送り**。右綴じの本は自動で「左へ進む」操作になります
- **自動しおり**：読んだ位置をユーザーごとに自動保存。最後のページまで読むとしおりは自動で外れます

### 🗂 整理する
- 販売区分（同人誌 / 商業誌）・書籍区分（漫画 / 小説 / その他）での分類
- 5種類のタグ（原作 / キャラクター / 作者 / シリーズ / イベント）と読み仮名、表記ゆれの統合
- **ISBN から書誌情報と書影を自動取得**（openBD を利用）
- シリーズの巻数管理と、作品ページでの同シリーズ一覧
- 表紙サムネイルを自動生成（WebP・Pure Go 実装）

### 🔎 探す
- キーワード・区分・タグを組み合わせた複合検索
- タグの **AND / OR 切替** と **除外（NOT）** 指定
- お気に入り・しおり一覧の中でも同じ条件で検索・並び替え

### 📱 どこでも
- スマホ・タブレット・PC それぞれに合わせたレイアウト（スマホは下部タブバー、PC はサイドバー）
- iPhone / iPad / Android の **ホーム画面に追加して、アプリのように全画面で起動**（PWA）
- 複数ユーザー対応。しおり・お気に入り・表示設定はユーザーごとに保存

---

## 対応フォーマット

| 形式 | 拡張子 | 表示方法 | 補足 |
| :--- | :--- | :--- | :--- |
| 画像アーカイブ | `.zip` `.cbz` | 画像ビューワー | 中の画像をファイル名順に表示。展開せずにそのまま配信します |
| 画像フォルダ | フォルダ | 画像ビューワー | フォルダ1つ＝本1冊として扱います |
| EPUB（漫画など固定レイアウト） | `.epub` | 画像ビューワー | サーバー側でページ画像を取り出して表示。綴じ方向も自動判定 |
| EPUB（小説などリフロー型） | `.epub` | EPUB ビューワー | 縦書き・右綴じに対応 |
| テキスト | `.txt` | テキストビューワー | **UTF-8** で保存してください。ルビ記法（`｜漢字《かんじ》`）に対応 |
| PDF | `.pdf` | ブラウザ内蔵ビューワー | |

画像は `jpg` `jpeg` `png` `webp` `gif` に対応しています。

---

## クイックスタート

### 必要なもの

- Docker / Docker Compose
- （外出先から使う場合）Cloudflare アカウントと Zero Trust の設定

### 1. リポジトリを取得

```bash
git clone https://github.com/Subaru8556/Shiorary.git
cd Shiorary
mkdir -p data/books data/app/thumbnails
```

### 2. `.env` を作成

リポジトリ直下に `.env` を作成します。

```dotenv
# ログイン情報（JWT）の署名に使う秘密鍵。長いランダムな文字列にしてください
SESSION_SECRET=ここに長いランダムな文字列

# Cloudflare Zero Trust で発行した Tunnel のトークン（外出先から使う場合）
TUNNEL_TOKEN=ここにトークン
```

`SESSION_SECRET` は、たとえば次のコマンドで作れます。

```bash
openssl rand -base64 48
```

> `.env` は `.gitignore` 済みです。トークンや秘密鍵をコミットしないよう注意してください。

### 3. 起動

環境に合わせて Compose ファイルを選びます。

```bash
# Linux
docker compose -f linux-docker-compose.yml up -d --build

# Windows（Docker Desktop）
docker compose -f windows-docker-compose.yml up -d --build
```

| ファイル | 違い |
| :--- | :--- |
| `linux-docker-compose.yml` | 本もデータベースも `./data` 以下に直接保存します |
| `windows-docker-compose.yml` | データベースとサムネイルは Docker のボリューム（`app_data`）に保存します。Windows のフォルダ共有上で SQLite を動かすと不安定になりやすいためです |

### 4. 初回ログイン

初回起動時に管理者アカウントが自動で作られます。

| ユーザー名 | パスワード |
| :--- | :--- |
| `admin` | `admin123` |

**ログインしたら、すぐに「設定」からパスワードを変更してください。**

> このサーバーはホストのポートを公開しません（Compose ファイルに `ports:` がありません）。アクセスは次の章の Cloudflare Tunnel 経由で行います。手元の PC だけで試したい場合は、一時的に `book-server` に `ports: ["8080:8080"]` を追加して `http://localhost:8080` を開いてください。

---

## 外出先から使う（Cloudflare Zero Trust）

Shiorary はポートを開けずに公開する構成を前提にしています。

```text
スマホ / PC ──(WARP / Cloudflare Access)──▶ Cloudflare ──(Tunnel)──▶ cloudflared ──▶ book-server:8080
```

1. Cloudflare Zero Trust ダッシュボードで **Tunnel を作成**し、表示されたトークンを `.env` の `TUNNEL_TOKEN` に設定します。
2. Tunnel の公開先を設定します。主に2通りあります。
   - **Public Hostname（おすすめ）**：`https://books.example.com` のような URL を作り、サービスに `http://book-server:8080` を指定。必ず **Access のアプリケーションとポリシー**（自分のメールアドレスだけ許可、WARP 接続端末のみ許可など）で保護してください。HTTPS になるので PWA の全機能が使えます。
   - **Private Network**：`172.28.0.0/24` をルートとして追加し、WARP に接続した端末から `http://172.28.0.10:8080` で開きます。インターネット上に URL は出ませんが、HTTP のため Service Worker（PWA のキャッシュ機能）は動きません。
3. `docker compose ... up -d` で `cloudflared` コンテナが起動すると、Tunnel がつながります。

> ダッシュボードのメニュー名は Cloudflare 側の更新で変わることがあります。

---

## 使い方

### 本を追加する

1. 本のファイルを `data/books/` に置きます。
   - ZIP / CBZ / EPUB / PDF / TXT は、そのまま置く
   - 画像フォルダは、フォルダごと置く（フォルダ1つ＝1冊）
   - **`data/books/` の直下だけ**を読み込みます。サブフォルダの中にあるファイルは対象外です（画像フォルダとして扱われます）
2. 管理者でログインし、メニューの **「作品の登録・管理」→「フォルダをスキャン」** を押します（サーバー起動時にも自動でスキャンされます）。
3. 新しいファイルは **「未整理」** タブに並びます。タイトル・区分・タグなどを入力して保存すると、一般の一覧に表示されるようになります。

### 書誌情報を整える

- **ISBN 参照**：商業誌は ISBN を入力すると、タイトル・著者・発売日・書影を openBD から取得します（保存ボタンで確定）
- **表紙の変更**：画像をアップロードして表紙を差し替えられます
- **タグ管理**：タグ名・読み仮名の変更や、表記ゆれのタグを1つに統合できます

### 作品を削除する

作品ページの管理者メニュー、または管理画面から3種類の削除ができます。

| 操作 | 内容 |
| :--- | :--- |
| 未整理へ戻す | 一般の一覧から外し、未整理一覧へ戻します（情報は残ります） |
| DB登録を削除 | 登録情報とサムネイルを削除します。元ファイルは残るので、次のスキャンで未整理として再登録されます |
| ファイルごと削除 | 登録情報に加えて `data/books/` の元ファイルも削除します。**元に戻せません** |

### ユーザーを追加する

管理者は **「設定」→「ユーザーアカウント管理」** から、一般ユーザーや管理者を追加・削除できます。一般ユーザーは本の閲覧・検索・お気に入り・しおりのみ使えます。

---

## ビューワーの操作

| 操作 | 動き |
| :--- | :--- |
| 画面の左右をタップ / クリック | ページ送り（右綴じの本は **左側で次へ**、左綴じの本は右側で次へ） |
| 左右にスワイプ | ページ送り |
| 画面の中央をタップ | 上下のメニューを表示 / 非表示 |
| `←` `→` キー | ページ送り（綴じ方向に合わせて自動で切替） |
| `Space` / `PageDown` | 次へ（`Shift`+`Space` / `PageUp` で前へ） |
| 下部のスライダー | 好きな位置へ移動 |
| 右上の ⚙ | 表示設定（めくり方・綴じ方向・見開き・文字サイズ・背景色など） |

- 見開きの「自動」は、横向きで幅の広い画面（PC やタブレットの横持ち）で見開き表示になります。
- 表示設定は端末ごとに保存されます。ユーザー全体の初期値は「設定」で変更できます。

---

## スマホ・タブレットでアプリとして使う（PWA）

**iPhone / iPad（Safari）**
1. Safari で Shiorary を開いてログイン
2. 共有ボタン → **「ホーム画面に追加」** → 「追加」
3. ホーム画面のアイコンから全画面で起動できます

**Android（Chrome）・PC（Chrome / Edge）**
メニューの **「アプリをインストール」** または「ホーム画面に追加」を選びます。

> - ホーム画面から初めて起動したときにログイン画面が出た場合は、もう一度ログインしてください（ブラウザとログイン状態が別に管理される場合があります）。
> - Service Worker は HTTPS 接続でのみ動きます。HTTP（Private Network 経由など）でもホーム画面への追加はできますが、起動の高速化などのキャッシュ機能は働きません。
> - アイコンや名前を変更した場合は、一度ホーム画面から削除して追加し直してください。

---

## 設定（環境変数）

| 変数 | 既定値（Docker） | 説明 |
| :--- | :--- | :--- |
| `SESSION_SECRET` | なし（**必須**） | ログイン用トークン（JWT）の署名鍵。未設定だと開発用の固定値が使われ危険です |
| `TUNNEL_TOKEN` | なし | Cloudflare Tunnel のトークン（`cloudflared` コンテナが使用） |
| `BOOKS_DIR` | `/data/books` | 本のファイルを置くフォルダ |
| `DB_PATH` | `/data/app/library.db` | SQLite データベースの保存先 |
| `THUMBNAIL_DIR` | `/data/app/thumbnails` | 表紙サムネイルの保存先 |
| `STATIC_DIR` | `/app/dist` | フロントエンドのビルド成果物の場所 |
| `TZ` | `Asia/Tokyo` | タイムゾーン |

Docker を使わずに動かす場合、`BOOKS_DIR` などを省略すると `backend/` から見た `../data/...` が使われます。

---

## アップデート・バックアップ

### アップデート

```bash
git pull
docker compose -f windows-docker-compose.yml up -d --build   # Linux は linux-docker-compose.yml
```

データベースの構造は起動時に自動で更新されます。

### バックアップ

バックアップが必要なのは次の2つです。

| 対象 | 場所 |
| :--- | :--- |
| 本のファイル | `data/books/` |
| データベース・サムネイル | Linux：`data/app/`<br>Windows：Docker ボリューム `app_data` |

Windows でボリュームの中身を保存する例：

```bash
docker run --rm -v shiorary_app_data:/data -v "%cd%":/backup alpine tar czf /backup/app_data.tgz -C /data .
```

> ボリューム名には Compose のプロジェクト名（通常はフォルダ名）が先頭に付きます。`docker volume ls` で確認してください。<br>
> SQLite は書き込み中にコピーすると壊れることがあるため、`docker compose ... stop book-server` で止めてから保存するのが安全です。

---

## 開発

### 必要なもの

- Go（`backend/go.mod` に書かれたバージョン。古い場合は自動で取得されます）
- Node.js 22 以降

### 起動

```bash
# バックエンド（http://localhost:8080）
cd backend
SESSION_SECRET=dev go run .

# フロントエンド（http://localhost:5173、/api はバックエンドへ転送）
cd frontend
npm install
npm run dev
```

開発時は `../data/` 以下（リポジトリ直下の `data/`）が使われます。Service Worker は本番ビルドでのみ有効になります。

### 技術スタック

| レイヤー | 使用技術 |
| :--- | :--- |
| バックエンド | Go, Echo v4, SQLite（`modernc.org/sqlite`：Pure Go / CGO 不要）, `HugoSmits86/nativewebp`, JWT（Cookie） |
| フロントエンド | React 19, TypeScript, Vite, Tailwind CSS v4, Zustand, React Router, Lucide Icons, epub.js |
| インフラ | Docker（マルチステージビルド / Alpine Linux）, Cloudflare Tunnel（`cloudflared`） |

### API の概要

すべて `/api` 以下です。`/api/auth/login` 以外はログインが必要で、`/api/admin` 以下は管理者のみ使えます。

| 分類 | 主なエンドポイント |
| :--- | :--- |
| 認証・ユーザー | `POST /auth/login` `POST /auth/logout` `GET /auth/me` `PUT /user/settings` |
| 一覧・検索 | `GET /home` `GET /books/search` `GET /tags` `GET /thumbnails/:id` |
| 作品・閲覧 | `GET /books/:id` `GET /books/:id/pages/:n` `GET /books/:id/file` `GET /books/:id/epub` |
| しおり・お気に入り | `PUT/DELETE /books/:id/bookmark` `POST /books/:id/favorite` |
| 管理 | `POST /admin/scan` `GET/PUT/DELETE /admin/books/...` `GET /admin/metadata/isbn/:isbn` `PUT /admin/tags/:id` `POST /admin/tags/merge` `GET/POST/DELETE /admin/users` |

---

## ディレクトリ構成

```text
.
├── backend/                       # Go バックエンド
│   ├── main.go                    # 起動処理・静的ファイル配信（PWA 用のキャッシュ制御）
│   ├── db.go                      # SQLite のテーブル定義・初期管理者の作成
│   ├── auth.go                    # ログイン（JWT / Cookie）・ユーザー設定・ユーザー管理
│   ├── scanner_and_admin.go       # フォルダスキャン・サムネイル生成・書誌 / タグ管理
│   ├── books_search.go            # ホーム・複合検索（AND / OR / NOT）
│   ├── book_detail_and_media.go   # 作品詳細・しおり / お気に入り・ページ画像の配信
│   └── epub.go                    # EPUB の解析（固定レイアウト判定・ページ画像抽出・表紙取得）
├── frontend/                      # React フロントエンド（SPA）
│   ├── public/                    # ロゴ・PWA アイコン・manifest・Service Worker
│   └── src/
│       ├── pages/                 # 各画面（ホーム・検索・タグ・作品詳細・ビューワー・設定・管理）
│       ├── reader/                # 形式別ビューワー（画像・EPUB・TXT・PDF）と操作系
│       ├── admin/                 # 管理画面の部品（作品一覧・編集フォーム・タグ管理）
│       ├── components/            # 共通レイアウト・メニュー・作品タイル・UI 部品
│       ├── lib/                   # API 呼び出し・型定義・端末設定の保存
│       └── store/                 # ログイン状態の管理
├── data/                          # 実データ（Git 管理外）
│   ├── books/                     # 本のファイル置き場
│   └── app/                       # データベース（library.db）とサムネイル
├── Dockerfile                     # マルチステージビルド
├── linux-docker-compose.yml       # Linux 用
└── windows-docker-compose.yml     # Windows 用
```

---

## よくある質問・トラブルシューティング

<details>
<summary><b>本を置いたのに一覧に出てこない</b></summary>

- 「作品の登録・管理」→「フォルダをスキャン」を押したか確認してください。
- スキャンした本は、まず **「未整理」** に入ります。情報を保存して登録するまで、一般の一覧には表示されません。
- `data/books/` の **直下** に置かれているか確認してください。
</details>

<details>
<summary><b>TXT が文字化けする</b></summary>

TXT は UTF-8 として読み込みます。Shift_JIS などで保存されたファイルは、UTF-8 に変換してから置いてください。
</details>

<details>
<summary><b>iPhone で PDF が1ページ目しか表示されない</b></summary>

iPhone / iPad の Safari は、埋め込み表示の PDF を1ページ目しか出さないことがあります。ビューワー下部の「別タブで開く」を使ってください。
</details>

<details>
<summary><b>漫画の EPUB が文章のビューワーで開く／その逆</b></summary>

EPUB の中身（固定レイアウト指定と、各ページが画像1枚かどうか）から自動で判定しています。判定がうまくいかない EPUB があれば、Issue でお知らせください。
</details>

<details>
<summary><b>ホーム画面のアイコンや名前が古いまま</b></summary>

ホーム画面に追加したアイコンは自動では更新されません。一度削除して、もう一度追加してください。
</details>

<details>
<summary><b>管理者のパスワードを忘れた</b></summary>

別の管理者アカウントがあれば、そこからユーザーを作り直せます。管理者が1人もログインできない場合は、データベースのバックアップを取ったうえで `users` テーブルを空にして再起動すると、初期管理者（`admin` / `admin123`）が作り直されます。
</details>

---

## セキュリティについて

- **`SESSION_SECRET` は必ず設定**してください。未設定だと開発用の固定値で署名され、ログイン情報を偽造される恐れがあります。
- **初期パスワード `admin123` は、最初のログイン後すぐに変更**してください。
- インターネットに公開する場合は、Cloudflare Access などで **アクセスできる人を限定**してください。Shiorary 自体のログインだけに頼らない構成をおすすめします。
- Compose ファイルではホストのポートを公開していません。ポートを開ける場合は、外部から直接アクセスできないよう注意してください。

---

## ライセンス

[MIT License](LICENSE) © 2026 Subaru8556
