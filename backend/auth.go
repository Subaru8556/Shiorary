// backend/auth.go
package main

import (
	"database/sql"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

type jwtCustomClaims struct {
	UserID   int    `json:"user_id"`
	Username string `json:"username"`
	IsAdmin  bool   `json:"is_admin"`
	jwt.RegisteredClaims
}

type UserResponse struct {
	ID              int    `json:"id"`
	Username        string `json:"username"`
	IsAdmin         bool   `json:"is_admin"`
	PrefImageScroll string `json:"pref_image_scroll"`
	PrefPdfScroll   string `json:"pref_pdf_scroll"`
	PrefEpubScroll  string `json:"pref_epub_scroll"`
	PrefTxtScroll   string `json:"pref_txt_scroll"`
}

func getJWTSecret() []byte {
	secret := os.Getenv("SESSION_SECRET")
	if secret == "" {
		secret = "default-dev-secret-key-change-in-prod"
	}
	return []byte(secret)
}

// 認証ミドルウェア（未ログイン時は 401 Unauthorized を返す）
func authMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		cookie, err := c.Cookie("auth_token")
		if err != nil {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "ログインが必要です"})
		}

		token, err := jwt.ParseWithClaims(cookie.Value, &jwtCustomClaims{}, func(token *jwt.Token) (interface{}, error) {
			return getJWTSecret(), nil
		})
		if err != nil || !token.Valid {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "セッションが無効です"})
		}

		claims, ok := token.Claims.(*jwtCustomClaims)
		if !ok {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "認証情報の読み取りに失敗しました"})
		}

		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("is_admin", claims.IsAdmin)
		return next(c)
	}
}

// 管理者専用ミドルウェア
func adminMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		isAdmin, ok := c.Get("is_admin").(bool)
		if !ok || !isAdmin {
			return c.JSON(http.StatusForbidden, map[string]string{"error": "管理者権限が必要です"})
		}
		return next(c)
	}
}

func registerAuthRoutes(e *echo.Echo, db *sql.DB) {
	// 1. ログインAPI
	e.POST("/api/auth/login", func(c echo.Context) error {
		var req struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "不正なリクエストです"})
		}

		var id int
		var hash string
		var isAdmin int
		err := db.QueryRow("SELECT id, password_hash, is_admin FROM users WHERE username = ?", req.Username).
			Scan(&id, &hash, &isAdmin)
		if err != nil {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "ユーザー名またはパスワードが間違っています"})
		}

		if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)); err != nil {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "ユーザー名またはパスワードが間違っています"})
		}

		claims := &jwtCustomClaims{
			UserID:   id,
			Username: req.Username,
			IsAdmin:  isAdmin == 1,
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)), // 30日間有効
			},
		}
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		t, err := token.SignedString(getJWTSecret())
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "トークン生成失敗"})
		}

		c.SetCookie(&http.Cookie{
			Name:     "auth_token",
			Value:    t,
			Path:     "/",
			HttpOnly: true,
			MaxAge:   30 * 24 * 3600,
			SameSite: http.SameSiteLaxMode,
		})

		return getUserProfile(c, db, id)
	})

	// 2. ログアウトAPI
	e.POST("/api/auth/logout", func(c echo.Context) error {
		c.SetCookie(&http.Cookie{
			Name:     "auth_token",
			Value:    "",
			Path:     "/",
			HttpOnly: true,
			MaxAge:   -1,
		})
		return c.JSON(http.StatusOK, map[string]string{"message": "ログアウトしました"})
	})

	// ここから下は要ログインのAPIグループ
	api := e.Group("/api", authMiddleware)

	// 3. 現在のログインユーザー情報取得
	api.GET("/auth/me", func(c echo.Context) error {
		userID := c.Get("user_id").(int)
		return getUserProfile(c, db, userID)
	})

	// 4. ユーザー自身の設定更新（ユーザー名・パスワード・スクロール設定）
	api.PUT("/user/settings", func(c echo.Context) error {
		userID := c.Get("user_id").(int)
		var req struct {
			Username        string `json:"username"`
			NewPassword     string `json:"new_password"`
			PrefImageScroll string `json:"pref_image_scroll"`
			PrefPdfScroll   string `json:"pref_pdf_scroll"`
			PrefEpubScroll  string `json:"pref_epub_scroll"`
			PrefTxtScroll   string `json:"pref_txt_scroll"`
		}
		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "不正なリクエスト"})
		}

		_, err := db.Exec(`
			UPDATE users SET 
				username = ?, pref_image_scroll = ?, pref_pdf_scroll = ?, pref_epub_scroll = ?, pref_txt_scroll = ?
			WHERE id = ?`,
			req.Username, req.PrefImageScroll, req.PrefPdfScroll, req.PrefEpubScroll, req.PrefTxtScroll, userID,
		)
		if err != nil {
			return c.JSON(http.StatusConflict, map[string]string{"error": "ユーザー名が既に使用されているか更新に失敗しました"})
		}

		if req.NewPassword != "" {
			hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
			if err == nil {
				_, _ = db.Exec("UPDATE users SET password_hash = ? WHERE id = ?", string(hash), userID)
			}
		}

		return getUserProfile(c, db, userID)
	})

	// 5. 管理者専用：ユーザー一覧・作成・削除
	admin := api.Group("/admin", adminMiddleware)

	admin.GET("/users", func(c echo.Context) error {
		rows, err := db.Query("SELECT id, username, is_admin, created_at FROM users ORDER BY id ASC")
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		defer rows.Close()

		var users []map[string]interface{}
		for rows.Next() {
			var id, isAdmin int
			var username, createdAt string
			_ = rows.Scan(&id, &username, &isAdmin, &createdAt)
			users = append(users, map[string]interface{}{
				"id":         id,
				"username":   username,
				"is_admin":   isAdmin == 1,
				"created_at": createdAt,
			})
		}
		return c.JSON(http.StatusOK, users)
	})

	admin.POST("/users", func(c echo.Context) error {
		var req struct {
			Username string `json:"username"`
			Password string `json:"password"`
			IsAdmin  bool   `json:"is_admin"`
		}
		if err := c.Bind(&req); err != nil || req.Username == "" || req.Password == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "ユーザー名とパスワードは必須です"})
		}
		hash, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		isAdminInt := 0
		if req.IsAdmin {
			isAdminInt = 1
		}
		_, err := db.Exec("INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)", req.Username, string(hash), isAdminInt)
		if err != nil {
			return c.JSON(http.StatusConflict, map[string]string{"error": "そのユーザー名は既に存在します"})
		}
		return c.JSON(http.StatusCreated, map[string]string{"message": "作成しました"})
	})

	admin.DELETE("/users/:id", func(c echo.Context) error {
		targetID, _ := strconv.Atoi(c.Param("id"))
		currentID := c.Get("user_id").(int)
		if targetID == currentID {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "自分自身のアカウントは削除できません"})
		}
		_, _ = db.Exec("DELETE FROM users WHERE id = ?", targetID)
		return c.JSON(http.StatusOK, map[string]string{"message": "削除しました"})
	})
}

func getUserProfile(c echo.Context, db *sql.DB, userID int) error {
	var u UserResponse
	var isAdmin int
	err := db.QueryRow(`
		SELECT id, username, is_admin, pref_image_scroll, pref_pdf_scroll, pref_epub_scroll, pref_txt_scroll 
		FROM users WHERE id = ?`, userID,
	).Scan(&u.ID, &u.Username, &isAdmin, &u.PrefImageScroll, &u.PrefPdfScroll, &u.PrefEpubScroll, &u.PrefTxtScroll)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "ユーザーが見つかりません"})
	}
	u.IsAdmin = isAdmin == 1
	return c.JSON(http.StatusOK, u)
}
