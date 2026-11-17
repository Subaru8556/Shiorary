// backend/db.go
package main

import (
	"database/sql"
	"log"

	"golang.org/x/crypto/bcrypt"
)

func initDB(db *sql.DB) error {
	schema := `
	-- 1. ユーザーテーブル（権限・閲覧デフォルト設定を含む）
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL,
		is_admin INTEGER NOT NULL DEFAULT 0, -- 1: 管理者, 0: 一般ユーザー
		-- 形式別のスクロールデフォルト ('vertical' または 'horizontal')
		pref_image_scroll TEXT NOT NULL DEFAULT 'horizontal',
		pref_pdf_scroll TEXT NOT NULL DEFAULT 'horizontal',
		pref_epub_scroll TEXT NOT NULL DEFAULT 'horizontal',
		pref_txt_scroll TEXT NOT NULL DEFAULT 'horizontal',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	-- 2. 書籍（作品）テーブル
	CREATE TABLE IF NOT EXISTS books (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		title TEXT NOT NULL,
		file_path TEXT NOT NULL UNIQUE,      -- BOOKS_DIRからの相対パス（スラッシュ区切り）
		file_type TEXT NOT NULL,             -- 'zip', 'pdf', 'epub', 'txt', 'dir'
		page_count INTEGER NOT NULL DEFAULT 0,
		is_organized INTEGER NOT NULL DEFAULT 0, -- 0: 未整理, 1: 登録済み
		
		-- 単一選択の固定属性
		sale_type TEXT NOT NULL DEFAULT '同人誌',      -- '商業誌' or '同人誌'
		book_type TEXT NOT NULL DEFAULT '漫画',        -- '小説' or '漫画' or 'その他'
		page_direction TEXT NOT NULL DEFAULT 'rtl',    -- 'rtl' (右綴じ) or 'ltr' (左綴じ)
		
		-- 単一値メタデータ
		release_date TEXT NOT NULL DEFAULT '',         -- 発売日・頒布日 (YYYY-MM-DD等)
		series_number REAL,                            -- シリーズ内連番 (1, 2, 1.5 など。NULL許容)
		
		-- サムネイル画像パス
		thumb_original TEXT NOT NULL DEFAULT '',       -- 作品情報ページ用の元画像パス
		thumb_webp TEXT NOT NULL DEFAULT '',           -- 一覧タイル表示用の低解像度WebPパス
		
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	-- 3. タグマスタテーブル（カテゴリ別・読み仮名対応）
	CREATE TABLE IF NOT EXISTS tags (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		category TEXT NOT NULL, -- 'parody'(原作), 'character'(キャラ), 'author'(作者), 'series'(シリーズ), 'event'(イベント)
		name TEXT NOT NULL,
		reading TEXT NOT NULL DEFAULT '', -- 読み仮名・別名（サジェスト検索用）
		UNIQUE(category, name)
	);

	-- 4. 書籍とタグの中間テーブル（多対多）
	CREATE TABLE IF NOT EXISTS book_tags (
		book_id INTEGER NOT NULL,
		tag_id INTEGER NOT NULL,
		PRIMARY KEY (book_id, tag_id),
		FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
		FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
	);

	-- 5. 自動しおりテーブル（ユーザー毎・作品毎）
	CREATE TABLE IF NOT EXISTS bookmarks (
		user_id INTEGER NOT NULL,
		book_id INTEGER NOT NULL,
		current_page INTEGER NOT NULL DEFAULT 1, -- 画像・PDF用の現在ページ
		epub_cfi TEXT NOT NULL DEFAULT '',       -- EPUB・テキスト用の現在位置識別子
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (user_id, book_id),
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
		FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
	);

	-- 6. お気に入りテーブル（ユーザー毎・作品毎）
	CREATE TABLE IF NOT EXISTS favorites (
		user_id INTEGER NOT NULL,
		book_id INTEGER NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (user_id, book_id),
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
		FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
	);

	-- 検索高速化用インデックス
	CREATE INDEX IF NOT EXISTS idx_books_organized ON books(is_organized);
	CREATE INDEX IF NOT EXISTS idx_tags_category_name ON tags(category, name);
	CREATE INDEX IF NOT EXISTS idx_tags_reading ON tags(reading);
	CREATE INDEX IF NOT EXISTS idx_book_tags_tag_id ON book_tags(tag_id);
	`

	if _, err := db.Exec(schema); err != nil {
		return err
	}

	// 初期管理者アカウントの自動作成（ユーザーが0人の場合のみ）
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count); err != nil {
		return err
	}

	if count == 0 {
		hash, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		_, err = db.Exec(
			"INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)",
			"admin", string(hash),
		)
		if err != nil {
			return err
		}
		log.Println("初期管理者アカウントを作成しました (ユーザー名: admin / パスワード: admin123)")
	}

	return nil
}
