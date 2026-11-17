// backend/books_search.go
package main

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
)

type BookCardDTO struct {
	ID            int      `json:"id"`
	Title         string   `json:"title"`
	FileType      string   `json:"file_type"`
	PageCount     int      `json:"page_count"`
	SaleType      string   `json:"sale_type"`
	BookType      string   `json:"book_type"`
	PageDirection string   `json:"page_direction"`
	ReleaseDate   string   `json:"release_date"`
	SeriesNumber  *float64 `json:"series_number"`
	ParodyName    string   `json:"parody_name"`
	AuthorName    string   `json:"author_name"`
	BookmarkPage  int      `json:"bookmark_page"`
	IsFavorite    bool     `json:"is_favorite"`
}

// 書籍IDリストからタイル表示用のカード情報を一括構築するヘルパー
func fetchBookCardsByIDs(db *sql.DB, userID int, ids []int) ([]BookCardDTO, error) {
	if len(ids) == 0 {
		return []BookCardDTO{}, nil
	}

	placeholders := make([]string, len(ids))
	args := make([]interface{}, 0, len(ids)+2)
	args = append(args, userID, userID)
	for i, id := range ids {
		placeholders[i] = "?"
		args = append(args, id)
	}

	query := `
		SELECT 
			b.id, b.title, b.file_type, b.page_count, b.sale_type, b.book_type, 
			b.page_direction, b.release_date, b.series_number,
			COALESCE(bm.current_page, 0) AS bookmark_page,
			CASE WHEN fav.book_id IS NOT NULL THEN 1 ELSE 0 END AS is_fav
		FROM books b
		LEFT JOIN bookmarks bm ON b.id = bm.book_id AND bm.user_id = ?
		LEFT JOIN favorites fav ON b.id = fav.book_id AND fav.user_id = ?
		WHERE b.id IN (` + strings.Join(placeholders, ",") + `)
	`

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cardMap := make(map[int]BookCardDTO)
	for rows.Next() {
		var c BookCardDTO
		var sNum sql.NullFloat64
		var isFav int
		_ = rows.Scan(
			&c.ID, &c.Title, &c.FileType, &c.PageCount, &c.SaleType, &c.BookType,
			&c.PageDirection, &c.ReleaseDate, &sNum, &c.BookmarkPage, &isFav,
		)
		if sNum.Valid {
			val := sNum.Float64
			c.SeriesNumber = &val
		}
		c.IsFavorite = isFav == 1

		// タイル下部に表示する代表の「原作タグ」と「作者タグ」を1つずつ取得
		_ = db.QueryRow(`
			SELECT t.name FROM tags t JOIN book_tags bt ON t.id = bt.tag_id 
			WHERE bt.book_id = ? AND t.category = 'parody' LIMIT 1
		`, c.ID).Scan(&c.ParodyName)

		_ = db.QueryRow(`
			SELECT t.name FROM tags t JOIN book_tags bt ON t.id = bt.tag_id 
			WHERE bt.book_id = ? AND t.category = 'author' LIMIT 1
		`, c.ID).Scan(&c.AuthorName)

		cardMap[c.ID] = c
	}

	// 元の並び順（ソート順）を維持してスライスへ格納
	result := make([]BookCardDTO, 0, len(ids))
	for _, id := range ids {
		if card, ok := cardMap[id]; ok {
			result = append(result, card)
		}
	}
	return result, nil
}

func parseIDCSV(csv string) []int {
	if strings.TrimSpace(csv) == "" {
		return nil
	}
	parts := strings.Split(csv, ",")
	var res []int
	for _, p := range parts {
		if id, err := strconv.Atoi(strings.TrimSpace(p)); err == nil && id > 0 {
			res = append(res, id)
		}
	}
	return res
}

func registerBookSearchRoutes(e *echo.Echo, db *sql.DB) {
	api := e.Group("/api", authMiddleware)

	// 1. ホームページ用データ取得（しおり作品一覧 ＋ ランダムピックアップ12冊）
	api.GET("/home", func(c echo.Context) error {
		userID := c.Get("user_id").(int)

		// ① しおりが挟まっている作品ID（更新日時が新しい順）
		bmRows, err := db.Query(`
			SELECT b.id FROM books b
			JOIN bookmarks bm ON b.id = bm.book_id
			WHERE bm.user_id = ? AND b.is_organized = 1
			ORDER BY bm.updated_at DESC
		`, userID)
		var bmIDs []int
		if err == nil {
			for bmRows.Next() {
				var id int
				_ = bmRows.Scan(&id)
				bmIDs = append(bmIDs, id)
			}
			bmRows.Close()
		}

		// ② ランダムピックアップ作品ID（12件）
		randRows, err := db.Query(`
			SELECT id FROM books WHERE is_organized = 1 ORDER BY RANDOM() LIMIT 12
		`)
		var randIDs []int
		if err == nil {
			for randRows.Next() {
				var id int
				_ = randRows.Scan(&id)
				randIDs = append(randIDs, id)
			}
			randRows.Close()
		}

		bookmarks, _ := fetchBookCardsByIDs(db, userID, bmIDs)
		randoms, _ := fetchBookCardsByIDs(db, userID, randIDs)

		return c.JSON(http.StatusOK, map[string]interface{}{
			"bookmarks": bookmarks,
			"random":    randoms,
		})
	})

	// 2. 複合検索API（通常検索・お気に入り内検索・しおり内検索すべてに対応）
	api.GET("/books/search", func(c echo.Context) error {
		userID := c.Get("user_id").(int)

		q := strings.TrimSpace(c.QueryParam("q"))
		saleType := c.QueryParam("sale_type")
		bookType := c.QueryParam("book_type")
		includeTags := parseIDCSV(c.QueryParam("include_tags"))
		excludeTags := parseIDCSV(c.QueryParam("exclude_tags"))
		tagMode := c.QueryParam("tag_mode") // "and" または "or"
		if tagMode != "or" {
			tagMode = "and"
		}
		scope := c.QueryParam("scope") // "all", "favorites", "bookmarks"
		sortParam := c.QueryParam("sort")

		page, _ := strconv.Atoi(c.QueryParam("page"))
		if page < 1 {
			page = 1
		}
		limit, _ := strconv.Atoi(c.QueryParam("limit"))
		if limit < 1 || limit > 100 {
			limit = 24
		}
		offset := (page - 1) * limit

		where := []string{"b.is_organized = 1"}
		var args []interface{}

		// スコープ絞り込み（お気に入りページ / しおりページ用）
		if scope == "favorites" {
			where = append(where, "EXISTS (SELECT 1 FROM favorites f WHERE f.book_id = b.id AND f.user_id = ?)")
			args = append(args, userID)
		} else if scope == "bookmarks" {
			where = append(where, "EXISTS (SELECT 1 FROM bookmarks bm WHERE bm.book_id = b.id AND bm.user_id = ?)")
			args = append(args, userID)
		}

		// 区分・キーワード絞り込み
		if saleType != "" {
			where = append(where, "b.sale_type = ?")
			args = append(args, saleType)
		}
		if bookType != "" {
			where = append(where, "b.book_type = ?")
			args = append(args, bookType)
		}
		if q != "" {
			where = append(where, `(
				b.title LIKE ? OR EXISTS (
					SELECT 1 FROM book_tags bt JOIN tags t ON bt.tag_id = t.id 
					WHERE bt.book_id = b.id AND (t.name LIKE ? OR t.reading LIKE ?)
				)
			)`)
			like := "%" + q + "%"
			args = append(args, like, like, like)
		}

		// 含めるタグ（AND / OR 切り替え）
		if len(includeTags) > 0 {
			if tagMode == "or" {
				ph := make([]string, len(includeTags))
				for i, tid := range includeTags {
					ph[i] = "?"
					args = append(args, tid)
				}
				where = append(where, "EXISTS (SELECT 1 FROM book_tags bt WHERE bt.book_id = b.id AND bt.tag_id IN ("+strings.Join(ph, ",")+"))")
			} else {
				for _, tid := range includeTags {
					where = append(where, "EXISTS (SELECT 1 FROM book_tags bt WHERE bt.book_id = b.id AND bt.tag_id = ?)")
					args = append(args, tid)
				}
			}
		}

		// 除外タグ（NOT検索）
		if len(excludeTags) > 0 {
			ph := make([]string, len(excludeTags))
			for i, tid := range excludeTags {
				ph[i] = "?"
				args = append(args, tid)
			}
			where = append(where, "NOT EXISTS (SELECT 1 FROM book_tags bt WHERE bt.book_id = b.id AND bt.tag_id IN ("+strings.Join(ph, ",")+"))")
		}

		whereClause := strings.Join(where, " AND ")

		// 総件数の取得
		var total int
		countQuery := "SELECT COUNT(*) FROM books b WHERE " + whereClause
		_ = db.QueryRow(countQuery, args...).Scan(&total)

		// ソート順の決定
		orderBy := "b.id DESC"
		switch sortParam {
		case "created_asc":
			orderBy = "b.id ASC"
		case "release_desc":
			orderBy = "b.release_date DESC, b.id DESC"
		case "release_asc":
			orderBy = "b.release_date ASC, b.id ASC"
		case "title_asc":
			orderBy = "b.title COLLATE NOCASE ASC"
		case "series_asc":
			orderBy = "COALESCE(b.series_number, 999999) ASC, b.id ASC"
		}

		idQuery := "SELECT b.id FROM books b WHERE " + whereClause + " ORDER BY " + orderBy + " LIMIT ? OFFSET ?"
		queryArgs := append(args, limit, offset)

		rows, err := db.Query(idQuery, queryArgs...)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		defer rows.Close()

		var ids []int
		for rows.Next() {
			var id int
			_ = rows.Scan(&id)
			ids = append(ids, id)
		}

		books, _ := fetchBookCardsByIDs(db, userID, ids)
		totalPages := (total + limit - 1) / limit
		if totalPages == 0 {
			totalPages = 1
		}

		return c.JSON(http.StatusOK, map[string]interface{}{
			"books":       books,
			"total":       total,
			"page":        page,
			"total_pages": totalPages,
		})
	})
}
