// backend/book_detail_and_media.go
package main

import (
	"archive/zip"
	"database/sql"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
)

func registerBookDetailAndMediaRoutes(e *echo.Echo, db *sql.DB, booksDir string) {
	api := e.Group("/api", authMiddleware)

	// 1. 作品詳細情報の取得（タグ一覧、しおり状態、お気に入り状態、同シリーズ作品を含む）
	api.GET("/books/:id", func(c echo.Context) error {
		userID := c.Get("user_id").(int)
		bookID, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "不正なIDです"})
		}

		var (
			id, pageCount                                          int
			title, filePath, fileType, saleType, bookType, pageDir string
			releaseDate, createdAt, updatedAt                      string
			seriesNum                                              sql.NullFloat64
			bookmarkPage                                           int
			epubCfi                                                string
			isFav                                                  int
		)

		err = db.QueryRow(`
			SELECT 
				b.id, b.title, b.file_path, b.file_type, b.page_count,
				b.sale_type, b.book_type, b.page_direction, b.release_date, b.series_number,
				DATE(b.created_at), DATE(b.updated_at),
				COALESCE(bm.current_page, 0), COALESCE(bm.epub_cfi, ''),
				CASE WHEN fav.book_id IS NOT NULL THEN 1 ELSE 0 END
			FROM books b
			LEFT JOIN bookmarks bm ON b.id = bm.book_id AND bm.user_id = ?
			LEFT JOIN favorites fav ON b.id = fav.book_id AND fav.user_id = ?
			WHERE b.id = ?
		`, userID, userID, bookID).Scan(
			&id, &title, &filePath, &fileType, &pageCount,
			&saleType, &bookType, &pageDir, &releaseDate, &seriesNum,
			&createdAt, &updatedAt, &bookmarkPage, &epubCfi, &isFav,
		)
		if err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "作品が見つかりません"})
		}

		// タグ一覧取得
		tagRows, _ := db.Query(`
			SELECT t.id, t.category, t.name, t.reading
			FROM tags t JOIN book_tags bt ON t.id = bt.tag_id
			WHERE bt.book_id = ?
			ORDER BY t.id ASC
		`, bookID)
		tags := []TagDTO{}
		var seriesTagID int
		for tagRows.Next() {
			var t TagDTO
			_ = tagRows.Scan(&t.ID, &t.Category, &t.Name, &t.Reading)
			tags = append(tags, t)
			if t.Category == "series" && seriesTagID == 0 {
				seriesTagID = t.ID
			}
		}
		tagRows.Close()

		// 同じシリーズの作品一覧（連番順）を取得
		var seriesBooks []BookCardDTO
		if seriesTagID > 0 {
			sRows, err := db.Query(`
				SELECT b.id FROM books b
				JOIN book_tags bt ON b.id = bt.book_id
				WHERE bt.tag_id = ? AND b.is_organized = 1
				ORDER BY COALESCE(b.series_number, 999999) ASC, b.id ASC
			`, seriesTagID)
			if err == nil {
				var sIDs []int
				for sRows.Next() {
					var sid int
					_ = sRows.Scan(&sid)
					sIDs = append(sIDs, sid)
				}
				sRows.Close()
				seriesBooks, _ = fetchBookCardsByIDs(db, userID, sIDs)
			}
		}

		var sNumVal interface{} = nil
		if seriesNum.Valid {
			sNumVal = seriesNum.Float64
		}

		return c.JSON(http.StatusOK, map[string]interface{}{
			"id":             id,
			"title":          title,
			"file_type":      fileType,
			"page_count":     pageCount,
			"sale_type":      saleType,
			"book_type":      bookType,
			"page_direction": pageDir,
			"release_date":   releaseDate,
			"series_number":  sNumVal,
			"created_at":     createdAt,
			"updated_at":     updatedAt,
			"bookmark_page":  bookmarkPage,
			"epub_cfi":       epubCfi,
			"is_favorite":    isFav == 1,
			"tags":           tags,
			"series_books":   seriesBooks,
		})
	})

	// 2. お気に入り登録 / 解除トグルAPI
	api.POST("/books/:id/favorite", func(c echo.Context) error {
		userID := c.Get("user_id").(int)
		bookID, _ := strconv.Atoi(c.Param("id"))

		var exists int
		_ = db.QueryRow("SELECT COUNT(*) FROM favorites WHERE user_id = ? AND book_id = ?", userID, bookID).Scan(&exists)
		if exists > 0 {
			_, _ = db.Exec("DELETE FROM favorites WHERE user_id = ? AND book_id = ?", userID, bookID)
			return c.JSON(http.StatusOK, map[string]bool{"is_favorite": false})
		}
		_, _ = db.Exec("INSERT INTO favorites (user_id, book_id) VALUES (?, ?)", userID, bookID)
		return c.JSON(http.StatusOK, map[string]bool{"is_favorite": true})
	})

	// 3. 自動しおりの保存・上書きAPI（最終ページ到達時は自動消去してクリーンにする）
	api.PUT("/books/:id/bookmark", func(c echo.Context) error {
		userID := c.Get("user_id").(int)
		bookID, _ := strconv.Atoi(c.Param("id"))

		var req struct {
			CurrentPage int    `json:"current_page"`
			EpubCfi     string `json:"epub_cfi"`
			IsFinished  bool   `json:"is_finished"`
		}
		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "不正なリクエスト"})
		}

		var pageCount int
		_ = db.QueryRow("SELECT page_count FROM books WHERE id = ?", bookID).Scan(&pageCount)

		// 最終ページに到達した場合、または IsFinished フラグが true の場合はしおりを自動削除
		if req.IsFinished || (pageCount > 0 && req.CurrentPage >= pageCount) {
			_, _ = db.Exec("DELETE FROM bookmarks WHERE user_id = ? AND book_id = ?", userID, bookID)
			return c.JSON(http.StatusOK, map[string]interface{}{"bookmark_page": 0, "cleaned": true})
		}

		_, err := db.Exec(`
			INSERT INTO bookmarks (user_id, book_id, current_page, epub_cfi, updated_at)
			VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT(user_id, book_id) DO UPDATE SET
				current_page = excluded.current_page,
				epub_cfi = excluded.epub_cfi,
				updated_at = CURRENT_TIMESTAMP
		`, userID, bookID, req.CurrentPage, req.EpubCfi)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		return c.JSON(http.StatusOK, map[string]interface{}{"bookmark_page": req.CurrentPage, "cleaned": false})
	})

	// 4. しおりを手動で外す（進捗リセット）API
	api.DELETE("/books/:id/bookmark", func(c echo.Context) error {
		userID := c.Get("user_id").(int)
		bookID, _ := strconv.Atoi(c.Param("id"))
		_, _ = db.Exec("DELETE FROM bookmarks WHERE user_id = ? AND book_id = ?", userID, bookID)
		return c.JSON(http.StatusOK, map[string]string{"message": "しおりを外しました"})
	})

	// 5. ZIP/CBZ・画像フォルダ内の特定ページ画像をオンメモリ配信 (1始まり: page_num = 1, 2, ...)
	api.GET("/books/:id/pages/:page_num", func(c echo.Context) error {
		bookID, _ := strconv.Atoi(c.Param("id"))
		pageNum, _ := strconv.Atoi(c.Param("page_num"))
		if pageNum < 1 {
			pageNum = 1
		}

		var relPath, fileType string
		err := db.QueryRow("SELECT file_path, file_type FROM books WHERE id = ?", bookID).Scan(&relPath, &fileType)
		if err != nil {
			return c.NoContent(http.StatusNotFound)
		}

		fullPath := filepath.Join(booksDir, filepath.FromSlash(relPath))

		if fileType == "zip" {
			r, err := zip.OpenReader(fullPath)
			if err != nil {
				return c.NoContent(http.StatusNotFound)
			}
			defer r.Close()

			imgFiles := listZipImages(&r.Reader)
			if pageNum > len(imgFiles) {
				return c.NoContent(http.StatusNotFound)
			}

			target := imgFiles[pageNum-1]
			rc, err := target.Open()
			if err != nil {
				return c.NoContent(http.StatusInternalServerError)
			}
			defer rc.Close()

			contentType := mime.TypeByExtension(strings.ToLower(filepath.Ext(target.Name)))
			if contentType == "" {
				contentType = "image/jpeg"
			}
			c.Response().Header().Set("Cache-Control", "private, max-age=86400")
			return c.Stream(http.StatusOK, contentType, rc)
		}

		// 固定レイアウト（漫画）EPUB：spine 順のページ画像を配信
		if fileType == "epub" {
			info, err := inspectEpubCached(fullPath)
			if err != nil || !info.ImageMode || pageNum > len(info.Pages) {
				return c.NoContent(http.StatusNotFound)
			}
			name := info.Pages[pageNum-1]
			zr, rc, err := openEpubEntry(fullPath, name)
			if err != nil {
				return c.NoContent(http.StatusNotFound)
			}
			defer zr.Close()
			defer rc.Close()
			contentType := mime.TypeByExtension(strings.ToLower(filepath.Ext(name)))
			if contentType == "" {
				contentType = "image/jpeg"
			}
			c.Response().Header().Set("Cache-Control", "private, max-age=86400")
			return c.Stream(http.StatusOK, contentType, rc)
		}

		if fileType == "dir" {
			entries, err := os.ReadDir(fullPath)
			if err != nil {
				return c.NoContent(http.StatusNotFound)
			}
			var imgs []string
			for _, e := range entries {
				if !e.IsDir() && isImageFile(e.Name()) && !strings.HasPrefix(e.Name(), ".") {
					imgs = append(imgs, filepath.Join(fullPath, e.Name()))
				}
			}
			sort.Strings(imgs)
			if pageNum > len(imgs) {
				return c.NoContent(http.StatusNotFound)
			}
			return c.File(imgs[pageNum-1])
		}

		return c.NoContent(http.StatusBadRequest)
	})

	// 6. PDF / EPUB / TXT の生ファイル配信エンドポイント
	api.GET("/books/:id/file", func(c echo.Context) error {
		bookID, _ := strconv.Atoi(c.Param("id"))
		var relPath string
		err := db.QueryRow("SELECT file_path FROM books WHERE id = ?", bookID).Scan(&relPath)
		if err != nil {
			return c.NoContent(http.StatusNotFound)
		}
		fullPath := filepath.Join(booksDir, filepath.FromSlash(relPath))
		f, err := os.Open(fullPath)
		if err != nil {
			return c.NoContent(http.StatusNotFound)
		}
		defer f.Close()

		ext := strings.ToLower(filepath.Ext(fullPath))
		switch ext {
		case ".txt":
			data, _ := io.ReadAll(f)
			return c.Blob(http.StatusOK, "text/plain; charset=utf-8", data)
		case ".epub":
			c.Response().Header().Set(echo.HeaderContentType, "application/epub+zip")
			return c.File(fullPath)
		default:
			return c.File(fullPath)
		}
	})

	// 7. EPUB の表示モード判定（画像ページ型 or リフロー型）
	api.GET("/books/:id/epub", func(c echo.Context) error {
		bookID, _ := strconv.Atoi(c.Param("id"))
		var relPath, fileType string
		var pageCount int
		err := db.QueryRow("SELECT file_path, file_type, page_count FROM books WHERE id = ?", bookID).Scan(&relPath, &fileType, &pageCount)
		if err != nil || fileType != "epub" {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "EPUBが見つかりません"})
		}
		fullPath := filepath.Join(booksDir, filepath.FromSlash(relPath))
		info, err := inspectEpubCached(fullPath)
		if err != nil {
			return c.JSON(http.StatusUnprocessableEntity, map[string]string{"error": "EPUBの解析に失敗しました: " + err.Error()})
		}
		mode := "reflow"
		pages := 0
		if info.ImageMode {
			mode = "image"
			pages = len(info.Pages)
			// 旧バージョンで登録された作品はページ数が 0 のままなので補正（読了判定に使用）
			if pageCount != pages {
				_, _ = db.Exec("UPDATE books SET page_count = ? WHERE id = ?", pages, bookID)
			}
		}
		return c.JSON(http.StatusOK, map[string]interface{}{
			"mode":         mode,
			"page_count":   pages,
			"direction":    info.Direction,
			"fixed_layout": info.FixedLayout,
		})
	})
}

// listZipImages は ZIP 内の画像ファイルをファイル名順に返す
func listZipImages(r *zip.Reader) []*zip.File {
	var imgFiles []*zip.File
	for _, f := range r.File {
		if !f.FileInfo().IsDir() && isImageFile(f.Name) && !strings.HasPrefix(filepath.Base(f.Name), ".") {
			imgFiles = append(imgFiles, f)
		}
	}
	sort.Slice(imgFiles, func(i, j int) bool {
		return imgFiles[i].Name < imgFiles[j].Name
	})
	return imgFiles
}
