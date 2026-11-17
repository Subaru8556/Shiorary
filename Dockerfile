# ==========================================
# Stage 1: フロントエンド (React) のビルド
# ==========================================
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

# パッケージのインストール（キャッシュ効率化）
COPY frontend/package*.json ./
RUN npm ci

# ソースをコピーして本番ビルド (/app/frontend/dist が生成される)
COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: バックエンド (Go) のビルド
# ==========================================
FROM golang:alpine AS backend-builder
WORKDIR /app/backend

# go.mod が要求するバージョンがイメージより新しい場合でも自動取得を許可する
ENV GOTOOLCHAIN=auto

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
# Pure Go構成のため CGO_ENABLED=0 で完全静的バイナリを生成
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/book-server .

# ==========================================
# Stage 3: 本番実行用イメージ (Alpine)
# ==========================================
FROM alpine:3.20
WORKDIR /app

# openBDへのHTTPS通信用ルート証明書とタイムゾーンデータを導入
RUN apk --no-cache add ca-certificates tzdata

# GoバイナリとReactビルド成果物をコピー
COPY --from=backend-builder /app/book-server /app/book-server
COPY --from=frontend-builder /app/frontend/dist /app/dist

# データ保存用ディレクトリの作成
RUN mkdir -p /data/books /data/app/thumbnails

ENV TZ=Asia/Tokyo
ENV DB_PATH=/data/app/library.db
ENV THUMBNAIL_DIR=/data/app/thumbnails
ENV BOOKS_DIR=/data/books
ENV STATIC_DIR=/app/dist

# コンテナ内部でのみ8080番ポートをリッスン（ホストへは公開しない）
EXPOSE 8080

CMD ["/app/book-server"]