// backend/scanner_and_admin.go
package main

import (
	"archive/zip"
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"image"
	_ "image/gif"
	"image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/HugoSmits86/nativewebp"
	"github.com/labstack/echo/v4"
	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

type TagDTO struct {
	ID       int    `json:"id"`
	Category string `json:"category"`
	Name     string `json:"name"`
	Reading  string `json:"reading"`
	Count    int    `json:"count,omitempty"`
}

func isImageFile(name string) bool {
	ext := strings.ToLower(filepath.Ext(name))
	return ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".webp" || ext == ".gif"
}

// 元画像の保存と低解像度WebPサムネイル（幅360px）の自動生成
func generateThumbnails(bookID int, imgData []byte, thumbDir string) (string, string, error) {
	img, _, err := image.Decode(bytes.NewReader(imgData))
	if err != nil {
		return "", "", err
	}

	origName := fmt.Sprintf("book_%d_orig.jpg", bookID)
	webpName := fmt.Sprintf("book_%d_thumb.webp", bookID)
	origPath := filepath.Join(thumbDir, origName)
	webpPath := filepath.Join(thumbDir, webpName)

	// 1. 作品情報ページ用の元画像保存
	origFile, err := os.Create(origPath)
	if err != nil {
		return "", "", err
	}
	defer origFile.Close()
	_ = jpeg.Encode(origFile, img, &jpeg.Options{Quality: 92})

	// 2. 一覧タイル表示用の低解像度WebP生成（幅360pxに縮小）
	bounds := img.Bounds()
	targetWidth := 360
	targetHeight := bounds.Dy()
	if bounds.Dx() > targetWidth {
		targetHeight = int(float64(bounds.Dy()) * (float64(targetWidth) / float64(bounds.Dx())))
	} else {
		targetWidth = bounds.Dx()
	}

	dst := image.NewRGBA(image.Rect(0, 0, targetWidth, targetHeight))
	draw.CatmullRom.Scale(dst, dst.Bounds(), img, bounds, draw.Over, nil)

	webpFile, err := os.Create(webpPath)
	if err != nil {
		return "", "", err
	}
	defer webpFile.Close()
	if err := nativewebp.Encode(webpFile, dst, nil); err != nil {
		return "", "", err
	}

	return origName, webpName, nil
}

// ZIP/CBZからページ数と1ページ目の画像を抽出
func inspectZip(fullPath string) (int, []byte) {
	r, err := zip.OpenReader(fullPath)
	if err != nil {
		return 0, nil
	}
	defer r.Close()

	imgFiles := listZipImages(&r.Reader)
	if len(imgFiles) == 0 {
		return 0, nil
	}

	rc, err := imgFiles[0].Open()
	if err != nil {
		return len(imgFiles), nil
	}
	defer rc.Close()
	data, _ := io.ReadAll(rc)
	return len(imgFiles), data
}

// 画像フォルダからページ数と1ページ目の画像を抽出
func inspectDir(fullPath string) (int, []byte) {
	entries, err := os.ReadDir(fullPath)
	if err != nil {
		return 0, nil
	}
	var imgs []string
	for _, e := range entries {
		if !e.IsDir() && isImageFile(e.Name()) && !strings.HasPrefix(e.Name(), ".") {
			imgs = append(imgs, filepath.Join(fullPath, e.Name()))
		}
	}
	sort.Strings(imgs)
	if len(imgs) == 0 {
		return 0, nil
	}
	data, _ := os.ReadFile(imgs[0])
	return len(imgs), data
}

// BOOKS_DIR を走査して新規書籍を「未整理 (is_organized=0)」としてDB登録
func scanBooksDir(db *sql.DB, booksDir, thumbDir string) (int, error) {
	entries, err := os.ReadDir(booksDir)
	if err != nil {
		return 0, err
	}

	addedCount := 0
	for _, entry := range entries {
		name := entry.Name()
		if strings.HasPrefix(name, ".") {
			continue
		}

		relPath := filepath.ToSlash(name)
		var exists int
		_ = db.QueryRow("SELECT COUNT(*) FROM books WHERE file_path = ?", relPath).Scan(&exists)
		if exists > 0 {
			continue
		}

		fullPath := filepath.Join(booksDir, name)
		var fileType, title, bookType string
		pageDir := "rtl"
		var pageCount int
		var coverBytes []byte

		if entry.IsDir() {
			pageCount, coverBytes = inspectDir(fullPath)
			if pageCount == 0 {
				continue
			}
			fileType = "dir"
			title = name
			bookType = "漫画"
		} else {
			ext := strings.ToLower(filepath.Ext(name))
			title = strings.TrimSuffix(name, filepath.Ext(name))
			switch ext {
			case ".zip", ".cbz":
				fileType = "zip"
				bookType = "漫画"
				pageCount, coverBytes = inspectZip(fullPath)
			case ".pdf":
				fileType = "pdf"
				bookType = "漫画"
			case ".epub":
				fileType = "epub"
				bookType = "小説"
				// 固定レイアウト（漫画）EPUB は画像ページ数・綴じ方向・表紙を取得
				if info, err := inspectEpub(fullPath); err == nil {
					if info.ImageMode {
						bookType = "漫画"
						pageCount = len(info.Pages)
					}
					pageDir = info.Direction
					coverBytes = readEpubCover(fullPath, info)
				}
			case ".txt":
				fileType = "txt"
				bookType = "小説"
			default:
				continue
			}
		}

		res, err := db.Exec(`
			INSERT INTO books (title, file_path, file_type, page_count, is_organized, sale_type, book_type, page_direction)
			VALUES (?, ?, ?, ?, 0, '同人誌', ?, ?)
		`, title, relPath, fileType, pageCount, bookType, pageDir)
		if err != nil {
			continue
		}

		bookID, _ := res.LastInsertId()
		if len(coverBytes) > 0 {
			orig, webp, err := generateThumbnails(int(bookID), coverBytes, thumbDir)
			if err == nil {
				_, _ = db.Exec("UPDATE books SET thumb_original = ?, thumb_webp = ? WHERE id = ?", orig, webp, bookID)
			}
		}
		addedCount++
	}
	backfillEpubMetadata(db, booksDir, thumbDir)
	return addedCount, nil
}

// backfillEpubMetadata は登録済み EPUB のうち、ページ数やサムネイルが未取得のものを補完する
// （EPUB の画像ページ表示に対応する前に登録された作品向け）
func backfillEpubMetadata(db *sql.DB, booksDir, thumbDir string) {
	rows, err := db.Query(`
		SELECT id, file_path, page_count, thumb_webp FROM books
		WHERE file_type = 'epub' AND (page_count = 0 OR thumb_webp = '')
	`)
	if err != nil {
		return
	}
	type target struct {
		id        int
		relPath   string
		pageCount int
		thumb     string
	}
	var targets []target
	for rows.Next() {
		var t target
		if rows.Scan(&t.id, &t.relPath, &t.pageCount, &t.thumb) == nil {
			targets = append(targets, t)
		}
	}
	rows.Close()

	for _, t := range targets {
		fullPath := filepath.Join(booksDir, filepath.FromSlash(t.relPath))
		info, err := inspectEpubCached(fullPath)
		if err != nil {
			continue
		}
		if info.ImageMode && t.pageCount != len(info.Pages) {
			_, _ = db.Exec("UPDATE books SET page_count = ? WHERE id = ?", len(info.Pages), t.id)
		}
		if t.thumb == "" {
			if cover := readEpubCover(fullPath, info); len(cover) > 0 {
				if orig, webp, err := generateThumbnails(t.id, cover, thumbDir); err == nil {
					_, _ = db.Exec("UPDATE books SET thumb_original = ?, thumb_webp = ? WHERE id = ?", orig, webp, t.id)
				}
			}
		}
	}
}

func registerScannerAndAdminRoutes(e *echo.Echo, db *sql.DB, booksDir, thumbDir string) {
	// 起動時に1回自動スキャンを実行
	_, _ = scanBooksDir(db, booksDir, thumbDir)

	api := e.Group("/api", authMiddleware)
	admin := api.Group("/admin", adminMiddleware)

	// 1. サムネイル画像配信エンドポイント (?type=orig で元画像、デフォルトは低解像度WebP)
	api.GET("/thumbnails/:book_id", func(c echo.Context) error {
		bookID := c.Param("book_id")
		imgType := c.QueryParam("type")

		var orig, webp string
		err := db.QueryRow("SELECT thumb_original, thumb_webp FROM books WHERE id = ?", bookID).Scan(&orig, &webp)
		if err != nil {
			return c.NoContent(http.StatusNotFound)
		}

		target := webp
		if imgType == "orig" || target == "" {
			target = orig
		}
		if target == "" {
			return c.NoContent(http.StatusNotFound)
		}
		return c.File(filepath.Join(thumbDir, target))
	})

	// 2. タグサジェスト＆一覧取得API（カテゴリ制限＋表示名・読み仮名の部分一致）
	api.GET("/tags", func(c echo.Context) error {
		category := c.QueryParam("category")
		q := strings.TrimSpace(c.QueryParam("q"))

		query := `
			SELECT t.id, t.category, t.name, t.reading, COUNT(bt.book_id) as cnt
			FROM tags t
			LEFT JOIN book_tags bt ON t.id = bt.tag_id
			WHERE 1=1
		`
		var args []interface{}
		if category != "" {
			query += " AND t.category = ?"
			args = append(args, category)
		}
		if q != "" {
			query += " AND (t.name LIKE ? OR t.reading LIKE ?)"
			like := "%" + q + "%"
			args = append(args, like, like)
		}
		query += " GROUP BY t.id ORDER BY cnt DESC, t.name ASC"

		rows, err := db.Query(query, args...)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		defer rows.Close()

		tags := []TagDTO{}
		for rows.Next() {
			var t TagDTO
			_ = rows.Scan(&t.ID, &t.Category, &t.Name, &t.Reading, &t.Count)
			tags = append(tags, t)
		}
		return c.JSON(http.StatusOK, tags)
	})

	// 3. 管理者：手動ディレクトリスキャン実行
	admin.POST("/scan", func(c echo.Context) error {
		added, err := scanBooksDir(db, booksDir, thumbDir)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusOK, map[string]interface{}{"added": added})
	})

	// 4. 管理者：書籍リスト取得（status=unorganized で未整理一覧）
	admin.GET("/books", func(c echo.Context) error {
		status := c.QueryParam("status")
		orgVal := 0
		if status == "organized" {
			orgVal = 1
		}

		rows, err := db.Query(`
			SELECT id, title, file_path, file_type, page_count, sale_type, book_type, page_direction, release_date, series_number
			FROM books WHERE is_organized = ? ORDER BY id DESC
		`, orgVal)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		defer rows.Close()

		var result []map[string]interface{}
		for rows.Next() {
			var id, pageCount int
			var title, filePath, fileType, saleType, bookType, pageDir, releaseDate string
			var seriesNum sql.NullFloat64
			_ = rows.Scan(&id, &title, &filePath, &fileType, &pageCount, &saleType, &bookType, &pageDir, &releaseDate, &seriesNum)

			// 紐づくタグの取得
			tagRows, _ := db.Query(`
				SELECT t.id, t.category, t.name, t.reading 
				FROM tags t JOIN book_tags bt ON t.id = bt.tag_id 
				WHERE bt.book_id = ?
			`, id)
			tags := []TagDTO{}
			for tagRows.Next() {
				var t TagDTO
				_ = tagRows.Scan(&t.ID, &t.Category, &t.Name, &t.Reading)
				tags = append(tags, t)
			}
			tagRows.Close()

			var sNum interface{} = nil
			if seriesNum.Valid {
				sNum = seriesNum.Float64
			}

			result = append(result, map[string]interface{}{
				"id":             id,
				"title":          title,
				"file_path":      filePath,
				"file_type":      fileType,
				"page_count":     pageCount,
				"sale_type":      saleType,
				"book_type":      bookType,
				"page_direction": pageDir,
				"release_date":   releaseDate,
				"series_number":  sNum,
				"tags":           tags,
			})
		}
		return c.JSON(http.StatusOK, result)
	})

	// 5. 管理者：作品メタデータ・タグの保存（本登録）
	admin.PUT("/books/:id", func(c echo.Context) error {
		bookID, _ := strconv.Atoi(c.Param("id"))
		var req struct {
			Title         string   `json:"title"`
			SaleType      string   `json:"sale_type"`
			BookType      string   `json:"book_type"`
			PageDirection string   `json:"page_direction"`
			ReleaseDate   string   `json:"release_date"`
			SeriesNumber  *float64 `json:"series_number"`
			Tags          []struct {
				Category string `json:"category"`
				Name     string `json:"name"`
				Reading  string `json:"reading"`
			} `json:"tags"`
		}
		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "リクエスト形式が不正です"})
		}

		tx, err := db.Begin()
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		defer tx.Rollback()

		_, err = tx.Exec(`
			UPDATE books SET 
				title = ?, sale_type = ?, book_type = ?, page_direction = ?, 
				release_date = ?, series_number = ?, is_organized = 1, updated_at = CURRENT_TIMESTAMP
			WHERE id = ?
		`, req.Title, req.SaleType, req.BookType, req.PageDirection, req.ReleaseDate, req.SeriesNumber, bookID)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		// タグの再紐づけ
		_, _ = tx.Exec("DELETE FROM book_tags WHERE book_id = ?", bookID)
		for _, t := range req.Tags {
			name := strings.TrimSpace(t.Name)
			if name == "" {
				continue
			}
			_, _ = tx.Exec(`
				INSERT INTO tags (category, name, reading) VALUES (?, ?, ?)
				ON CONFLICT(category, name) DO UPDATE SET 
				reading = CASE WHEN excluded.reading != '' THEN excluded.reading ELSE tags.reading END
			`, t.Category, name, strings.TrimSpace(t.Reading))

			var tagID int
			_ = tx.QueryRow("SELECT id FROM tags WHERE category = ? AND name = ?", t.Category, name).Scan(&tagID)
			if tagID > 0 {
				_, _ = tx.Exec("INSERT OR IGNORE INTO book_tags (book_id, tag_id) VALUES (?, ?)", bookID, tagID)
			}
		}

		_ = tx.Commit()
		return c.JSON(http.StatusOK, map[string]string{"message": "登録しました"})
	})

	// 6. 管理者：カスタム表紙画像のアップロード更新（PDF/EPUBや商業誌書影用）
	admin.POST("/books/:id/cover", func(c echo.Context) error {
		bookID, _ := strconv.Atoi(c.Param("id"))
		file, err := c.FormFile("cover")
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "画像ファイルが必要です"})
		}
		src, err := file.Open()
		if err != nil {
			return err
		}
		defer src.Close()
		data, _ := io.ReadAll(src)

		orig, webp, err := generateThumbnails(bookID, data, thumbDir)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "画像の変換に失敗しました"})
		}
		_, _ = db.Exec("UPDATE books SET thumb_original = ?, thumb_webp = ? WHERE id = ?", orig, webp, bookID)
		return c.JSON(http.StatusOK, map[string]string{"message": "サムネイルを更新しました"})
	})

	// 7. 管理者：商業誌メタデータ自動取得 (openBD API連携)
	admin.GET("/metadata/isbn/:isbn", func(c echo.Context) error {
		isbn := strings.ReplaceAll(c.Param("isbn"), "-", "")
		resp, err := http.Get("https://api.openbd.jp/v1/get?isbn=" + isbn)
		if err != nil {
			return c.JSON(http.StatusBadGateway, map[string]string{"error": "外部API通信エラー"})
		}
		defer resp.Body.Close()

		var data []map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&data); err != nil || len(data) == 0 || data[0] == nil {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "該当するISBNの情報が見つかりませんでした"})
		}

		summary, ok := data[0]["summary"].(map[string]interface{})
		if !ok {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "書誌情報が見つかりません"})
		}

		// 書影URLが取得でき、かつ book_id が指定されている場合はサムネイルも自動ダウンロード・生成
		bookIDStr := c.QueryParam("book_id")
		coverURL, _ := summary["cover"].(string)
		if bookIDStr != "" && coverURL != "" {
			if bookID, err := strconv.Atoi(bookIDStr); err == nil {
				if imgResp, err := http.Get(coverURL); err == nil {
					defer imgResp.Body.Close()
					if imgBytes, err := io.ReadAll(imgResp.Body); err == nil {
						if orig, webp, err := generateThumbnails(bookID, imgBytes, thumbDir); err == nil {
							_, _ = db.Exec("UPDATE books SET thumb_original = ?, thumb_webp = ? WHERE id = ?", orig, webp, bookID)
						}
					}
				}
			}
		}

		return c.JSON(http.StatusOK, map[string]interface{}{
			"title":       summary["title"],
			"author":      summary["author"],
			"pubdate":     summary["pubdate"],
			"cover":       coverURL,
			"cover_saved": coverURL != "" && bookIDStr != "",
		})
	})

	// 8. 管理者：タグの名称・読み仮名変更
	admin.PUT("/tags/:id", func(c echo.Context) error {
		tagID, _ := strconv.Atoi(c.Param("id"))
		var req struct {
			Name    string `json:"name"`
			Reading string `json:"reading"`
		}
		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "不正なリクエスト"})
		}
		_, err := db.Exec("UPDATE tags SET name = ?, reading = ? WHERE id = ?", strings.TrimSpace(req.Name), strings.TrimSpace(req.Reading), tagID)
		if err != nil {
			return c.JSON(http.StatusConflict, map[string]string{"error": "同名タグが既に存在します"})
		}
		return c.JSON(http.StatusOK, map[string]string{"message": "更新しました"})
	})

	// 9. 管理者：タグの統合（名寄せマージ）
	admin.POST("/tags/merge", func(c echo.Context) error {
		var req struct {
			SourceTagID int `json:"source_tag_id"` // 統合元（消える側）
			TargetTagID int `json:"target_tag_id"` // 統合先（残る側）
		}
		if err := c.Bind(&req); err != nil || req.SourceTagID == req.TargetTagID {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "異なる2つのタグを選択してください"})
		}

		tx, _ := db.Begin()
		defer tx.Rollback()

		_, _ = tx.Exec("INSERT OR IGNORE INTO book_tags (book_id, tag_id) SELECT book_id, ? FROM book_tags WHERE tag_id = ?", req.TargetTagID, req.SourceTagID)
		_, _ = tx.Exec("DELETE FROM tags WHERE id = ?", req.SourceTagID)
		_ = tx.Commit()

		return c.JSON(http.StatusOK, map[string]string{"message": "タグを統合しました"})
	})

	// 10. 管理者：作品の削除 または 未整理状態へ戻す
	// mode クエリパラメータ:
	//   "unorganize"  -> DBやタグは残し、未整理一覧(is_organized=0)へ戻す
	//   "db_only"     -> DBレコードと生成サムネイルを削除（元ファイルは残す）
	//   "with_file"   -> DBレコード、サムネイル、および data/books 内の元ファイルをすべて削除
	admin.DELETE("/books/:id", func(c echo.Context) error {
		bookID, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "不正なIDです"})
		}
		mode := c.QueryParam("mode")

		// モード1: 未整理一覧へ戻す
		if mode == "unorganize" {
			_, err := db.Exec("UPDATE books SET is_organized = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?", bookID)
			if err != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
			return c.JSON(http.StatusOK, map[string]string{"message": "作品を未整理一覧へ戻しました"})
		}

		// 削除前にファイルパスとサムネイル名を取得
		var relPath, origThumb, webpThumb string
		err = db.QueryRow("SELECT file_path, thumb_original, thumb_webp FROM books WHERE id = ?", bookID).
			Scan(&relPath, &origThumb, &webpThumb)
		if err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "作品が見つかりません"})
		}

		// モード3: 元の書籍ファイル（ZIPやフォルダ）もディスクから削除する場合
		if mode == "with_file" && relPath != "" {
			fullBookPath := filepath.Join(booksDir, filepath.FromSlash(relPath))
			if err := os.RemoveAll(fullBookPath); err != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{
					"error": "元ファイルの削除に失敗しました（読み取り専用等の可能性があります）: " + err.Error(),
				})
			}
		}

		// 生成済みサムネイル画像（元画像・WebP）の削除
		if origThumb != "" {
			_ = os.Remove(filepath.Join(thumbDir, origThumb))
		}
		if webpThumb != "" {
			_ = os.Remove(filepath.Join(thumbDir, webpThumb))
		}

		// DBレコードの削除（ON DELETE CASCADE により book_tags, bookmarks, favorites も自動削除される）
		if _, err := db.Exec("DELETE FROM books WHERE id = ?", bookID); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		// 空になった孤立タグ（どの本にも紐づいていないタグ）も掃除したい場合は以下を有効化可能
		// _, _ = db.Exec("DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM book_tags)")

		return c.JSON(http.StatusOK, map[string]string{"message": "作品を削除しました"})
	})
}
