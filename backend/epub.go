// backend/epub.go
// EPUB の構造解析（標準ライブラリのみで実装）
//
// 漫画などの固定レイアウト EPUB は epub.js での描画が不安定（特に右綴じのページ送り）なため、
// 各ページの画像をサーバー側で抽出し、ZIP 漫画と同じ画像ビューワーで表示できるようにする。
// 文章主体のリフロー型 EPUB は従来どおり epub.js でブラウザ描画する。
package main

import (
	"archive/zip"
	"encoding/xml"
	"errors"
	"io"
	"net/url"
	"os"
	"path"
	"regexp"
	"strings"
	"sync"
	"time"
)

// EpubInfo は EPUB の解析結果
type EpubInfo struct {
	// ImageMode が true の場合、Pages の画像を順に表示するだけで本を再現できる（漫画・画集など）
	ImageMode bool
	// FixedLayout は OPF に rendition:layout=pre-paginated 等の指定があるか
	FixedLayout bool
	// Direction はページ送り方向 ("rtl" or "ltr")。spine の page-progression-direction から決定
	Direction string
	// Pages は ImageMode 時の各ページ画像の ZIP 内パス（spine 順）
	Pages []string
	// Cover は表紙画像の ZIP 内パス（見つからなければ空）
	Cover string
}

type opfDoc struct {
	Metadata struct {
		Metas []struct {
			Name     string `xml:"name,attr"`
			Content  string `xml:"content,attr"`
			Property string `xml:"property,attr"`
			Value    string `xml:",chardata"`
		} `xml:"meta"`
	} `xml:"metadata"`
	Manifest struct {
		Items []struct {
			ID         string `xml:"id,attr"`
			Href       string `xml:"href,attr"`
			MediaType  string `xml:"media-type,attr"`
			Properties string `xml:"properties,attr"`
		} `xml:"item"`
	} `xml:"manifest"`
	Spine struct {
		Direction string `xml:"page-progression-direction,attr"`
		Items     []struct {
			IDRef  string `xml:"idref,attr"`
			Linear string `xml:"linear,attr"`
		} `xml:"itemref"`
	} `xml:"spine"`
}

type containerDoc struct {
	Rootfiles []struct {
		FullPath string `xml:"full-path,attr"`
	} `xml:"rootfiles>rootfile"`
}

var (
	reImgSrc     = regexp.MustCompile(`(?is)<img\b[^>]*?\ssrc\s*=\s*["']([^"']+)["']`)
	reSvgImage   = regexp.MustCompile(`(?is)<image\b[^>]*?\s(?:xlink:)?href\s*=\s*["']([^"']+)["']`)
	reBody       = regexp.MustCompile(`(?is)<body\b[^>]*>(.*)</body>`)
	reTags       = regexp.MustCompile(`(?s)<[^>]*>`)
	reEntity     = regexp.MustCompile(`&[#a-zA-Z0-9]+;`)
	reSpaces     = regexp.MustCompile(`\s+`)
	epubCacheMu  sync.Mutex
	epubCacheMap = map[string]epubCacheEntry{}
)

type epubCacheEntry struct {
	modTime time.Time
	size    int64
	info    *EpubInfo
}

// inspectEpubCached はファイルの更新日時とサイズが変わらない限り解析結果を再利用する
func inspectEpubCached(fullPath string) (*EpubInfo, error) {
	st, err := os.Stat(fullPath)
	if err != nil {
		return nil, err
	}
	epubCacheMu.Lock()
	if ent, ok := epubCacheMap[fullPath]; ok && ent.modTime.Equal(st.ModTime()) && ent.size == st.Size() {
		epubCacheMu.Unlock()
		return ent.info, nil
	}
	epubCacheMu.Unlock()

	info, err := inspectEpub(fullPath)
	if err != nil {
		return nil, err
	}
	epubCacheMu.Lock()
	epubCacheMap[fullPath] = epubCacheEntry{modTime: st.ModTime(), size: st.Size(), info: info}
	epubCacheMu.Unlock()
	return info, nil
}

// inspectEpub は EPUB を開いて spine 順のページ画像や表紙を調べる
func inspectEpub(fullPath string) (*EpubInfo, error) {
	r, err := zip.OpenReader(fullPath)
	if err != nil {
		return nil, err
	}
	defer r.Close()
	return inspectEpubZip(&r.Reader)
}

func inspectEpubZip(r *zip.Reader) (*EpubInfo, error) {
	files := zipIndex(r)

	// 1. META-INF/container.xml から OPF の場所を特定
	var opfPath string
	if data, err := readZipEntry(files, "META-INF/container.xml"); err == nil {
		var c containerDoc
		if xml.Unmarshal(data, &c) == nil && len(c.Rootfiles) > 0 {
			opfPath = c.Rootfiles[0].FullPath
		}
	}
	if opfPath == "" {
		// container.xml が壊れている場合は .opf を総当たりで探す
		for name := range files {
			if strings.HasSuffix(strings.ToLower(name), ".opf") {
				opfPath = name
				break
			}
		}
	}
	if opfPath == "" {
		return nil, errors.New("OPFファイルが見つかりません")
	}
	opfData, err := readZipEntry(files, opfPath)
	if err != nil {
		return nil, err
	}
	var opf opfDoc
	if err := xml.Unmarshal(opfData, &opf); err != nil {
		return nil, err
	}
	opfDir := path.Dir(opfPath)

	info := &EpubInfo{Direction: "ltr"}
	if strings.EqualFold(opf.Spine.Direction, "rtl") {
		info.Direction = "rtl"
	}

	coverID := ""
	for _, m := range opf.Metadata.Metas {
		prop := strings.TrimSpace(m.Property)
		val := strings.TrimSpace(m.Value)
		switch {
		case prop == "rendition:layout" && val == "pre-paginated":
			info.FixedLayout = true
		case m.Name == "fixed-layout" && strings.EqualFold(m.Content, "true"):
			info.FixedLayout = true
		case m.Name == "cover":
			coverID = m.Content
		case m.Name == "primary-writing-mode" && strings.HasSuffix(m.Content, "-rl") && opf.Spine.Direction == "":
			info.Direction = "rtl"
		}
	}

	type manifestItem struct{ href, mediaType string }
	manifest := map[string]manifestItem{}
	for _, it := range opf.Manifest.Items {
		href := resolveEpubHref(opfDir, it.Href)
		manifest[it.ID] = manifestItem{href: href, mediaType: it.MediaType}
		if info.Cover == "" && strings.Contains(" "+it.Properties+" ", " cover-image ") {
			info.Cover = href
		}
	}
	if info.Cover == "" && coverID != "" {
		if it, ok := manifest[coverID]; ok && strings.HasPrefix(it.mediaType, "image/") {
			info.Cover = href2key(files, it.href)
		}
	}

	// 2. spine の各ページから画像を抽出
	linearCount := 0
	var pages []string
	textPages := 0
	for _, ref := range opf.Spine.Items {
		if strings.EqualFold(ref.Linear, "no") {
			continue
		}
		it, ok := manifest[ref.IDRef]
		if !ok {
			continue
		}
		linearCount++
		if strings.HasPrefix(it.mediaType, "image/") {
			// spine に画像が直接並んでいるケース
			if key := href2key(files, it.href); key != "" {
				pages = append(pages, key)
			}
			continue
		}
		data, err := readZipEntry(files, it.href)
		if err != nil {
			continue
		}
		html := string(data)
		if hasMeaningfulText(html) {
			textPages++
		}
		if src := firstImageRef(html); src != "" {
			if key := href2key(files, resolveEpubHref(path.Dir(it.href), src)); key != "" {
				pages = append(pages, key)
			}
		}
	}

	// 3. 画像モード判定
	//    ・全ページが画像1枚で構成され、本文テキストがほぼ無い → 画像モード
	//    ・固定レイアウト指定があり、9割以上のページに画像がある → 画像モード
	if len(pages) > 0 && linearCount > 0 {
		ratio := float64(len(pages)) / float64(linearCount)
		if (len(pages) == linearCount && textPages == 0) || (info.FixedLayout && ratio >= 0.9 && textPages*10 <= linearCount) {
			info.ImageMode = true
			info.Pages = pages
		}
	}
	if info.Cover == "" && len(pages) > 0 {
		info.Cover = pages[0]
	}
	if info.Cover != "" {
		info.Cover = href2key(files, info.Cover)
	}
	return info, nil
}

// openEpubEntry は EPUB 内の1ファイルを開く。呼び出し側で両方 Close すること
func openEpubEntry(fullPath, name string) (*zip.ReadCloser, io.ReadCloser, error) {
	r, err := zip.OpenReader(fullPath)
	if err != nil {
		return nil, nil, err
	}
	files := zipIndex(&r.Reader)
	f, ok := files[name]
	if !ok {
		r.Close()
		return nil, nil, os.ErrNotExist
	}
	rc, err := f.Open()
	if err != nil {
		r.Close()
		return nil, nil, err
	}
	return r, rc, nil
}

// readEpubCover は表紙画像のバイト列を返す（サムネイル生成用）
func readEpubCover(fullPath string, info *EpubInfo) []byte {
	if info == nil || info.Cover == "" {
		return nil
	}
	zr, rc, err := openEpubEntry(fullPath, info.Cover)
	if err != nil {
		return nil
	}
	defer zr.Close()
	defer rc.Close()
	data, _ := io.ReadAll(rc)
	return data
}

func zipIndex(r *zip.Reader) map[string]*zip.File {
	files := make(map[string]*zip.File, len(r.File))
	for _, f := range r.File {
		files[f.Name] = f
	}
	return files
}

func readZipEntry(files map[string]*zip.File, name string) ([]byte, error) {
	f, ok := files[name]
	if !ok {
		key := href2key(files, name)
		if key == "" {
			return nil, os.ErrNotExist
		}
		f = files[key]
	}
	rc, err := f.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	return io.ReadAll(io.LimitReader(rc, 32<<20))
}

// href2key は ZIP 内に実在するエントリ名を返す（大文字小文字の揺れを吸収）
func href2key(files map[string]*zip.File, name string) string {
	if _, ok := files[name]; ok {
		return name
	}
	lower := strings.ToLower(name)
	for k := range files {
		if strings.ToLower(k) == lower {
			return k
		}
	}
	return ""
}

// resolveEpubHref は基準ディレクトリからの相対 href を ZIP 内パスに変換する
func resolveEpubHref(baseDir, href string) string {
	if i := strings.IndexAny(href, "#?"); i >= 0 {
		href = href[:i]
	}
	if u, err := url.PathUnescape(href); err == nil {
		href = u
	}
	if strings.HasPrefix(href, "/") {
		return strings.TrimPrefix(path.Clean(href), "/")
	}
	p := path.Clean(path.Join(baseDir, href))
	return strings.TrimPrefix(p, "./")
}

func firstImageRef(html string) string {
	if m := reImgSrc.FindStringSubmatch(html); m != nil {
		return m[1]
	}
	if m := reSvgImage.FindStringSubmatch(html); m != nil {
		return m[1]
	}
	return ""
}

// hasMeaningfulText は本文に読ませるべき文章があるかを判定する
func hasMeaningfulText(html string) bool {
	body := html
	if m := reBody.FindStringSubmatch(html); m != nil {
		body = m[1]
	}
	text := reTags.ReplaceAllString(body, "")
	text = reEntity.ReplaceAllString(text, "")
	text = reSpaces.ReplaceAllString(text, "")
	return len([]rune(text)) > 20
}
