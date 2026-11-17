// backend/main.go
package main

import (
	"database/sql"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	_ "modernc.org/sqlite"
)

func main() {
	// 1. データディレクトリのパス設定（環境変数があれば優先、なければローカル開発用パス）
	dbPath := getEnv("DB_PATH", filepath.Join("..", "data", "app", "library.db"))
	booksDir := getEnv("BOOKS_DIR", filepath.Join("..", "data", "books"))
	thumbDir := getEnv("THUMBNAIL_DIR", filepath.Join("..", "data", "app", "thumbnails"))

	// ディレクトリが存在しない場合は自動作成
	_ = os.MkdirAll(filepath.Dir(dbPath), 0755)
	_ = os.MkdirAll(booksDir, 0755)
	_ = os.MkdirAll(thumbDir, 0755)

	// 2. SQLite接続（Pure Goドライバ "sqlite" を指定）
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatalf("DB接続失敗: %v", err)
	}
	defer db.Close()

	// WALモード（読み書きの並行処理高速化）と外部キー制約を有効化
	if _, err := db.Exec(`PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;`); err != nil {
		log.Printf("WALモードへの切替をスキップしました（標準モードで動作します）: %v", err)
	}
	if _, err := db.Exec(`PRAGMA foreign_keys = ON;`); err != nil {
		log.Fatalf("PRAGMA設定失敗: %v", err)
	}

	// テーブル作成と初期管理者の生成
	if err := initDB(db); err != nil {
		log.Fatalf("DB初期化失敗: %v", err)
	}

	// 3. Echoサーバーの初期化
	e := echo.New()
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())

	// 認証・ユーザールートの登録
	registerAuthRoutes(e, db)

	// スキャン・サムネイル・管理者ルートの登録
	registerScannerAndAdminRoutes(e, db, booksDir, thumbDir)

	// ホームページ・複合検索ルートの登録
	registerBookSearchRoutes(e, db)

	// 作品詳細・しおり・お気に入り・ページ配信ルートの登録
	registerBookDetailAndMediaRoutes(e, db, booksDir)

	// 本番（Docker）環境用のReactビルド成果物（SPA）配信設定
	staticDir := getEnv("STATIC_DIR", "./dist")
	if info, err := os.Stat(staticDir); err == nil && info.IsDir() {
		registerStaticRoutes(e, staticDir)
	}

	log.Println("バックエンドサーバーを起動します: http://localhost:8080")
	e.Logger.Fatal(e.Start(":8080"))
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

// registerStaticRoutes は SPA のビルド成果物を配信する
// 存在するファイル（JS/CSS/画像）はそのまま返し、存在しないパス（/search や /books/1 などの
// React Router の URL）は index.html を返す。PWA 用にキャッシュヘッダーも出し分ける。
func registerStaticRoutes(e *echo.Echo, staticDir string) {
	e.GET("/*", func(c echo.Context) error {
		reqPath := c.Request().URL.Path
		if strings.HasPrefix(reqPath, "/api") {
			return echo.ErrNotFound
		}
		h := c.Response().Header()
		fullPath := filepath.Join(staticDir, filepath.Clean("/"+reqPath))
		if stat, err := os.Stat(fullPath); err == nil && !stat.IsDir() {
			switch {
			case strings.HasPrefix(reqPath, "/assets/"):
				// Vite のハッシュ付きファイルは内容が変わると名前も変わるので長期キャッシュ
				h.Set("Cache-Control", "public, max-age=31536000, immutable")
			case reqPath == "/sw.js" || reqPath == "/index.html":
				h.Set("Cache-Control", "no-cache")
			case strings.HasSuffix(reqPath, ".webmanifest"):
				h.Set(echo.HeaderContentType, "application/manifest+json")
				h.Set("Cache-Control", "no-cache")
			default:
				h.Set("Cache-Control", "public, max-age=86400")
			}
			return c.File(fullPath)
		}
		h.Set("Cache-Control", "no-cache")
		return c.File(filepath.Join(staticDir, "index.html"))
	})
}
