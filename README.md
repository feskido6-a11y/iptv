# 📺 IPTV — GitHub + MongoDB Atlas

## ⚙️ الإعداد

### 1. أضف Secret في GitHub
```
Settings → Secrets → Actions → New repository secret
Name:  MONGODB_URI
Value: mongodb+srv://USER:PASS@cluster.mongodb.net/iptv
```

### 2. استورد القنوات لـ MongoDB
```bash
npm install
MONGODB_URI="mongodb+srv://..." node import.js playlist.m3u
```

### 3. شغّل GitHub Actions
```
Actions → Generate M3U Playlist → Run workflow ▶️
```

## 🔗 رابطك
```
https://raw.githubusercontent.com/USERNAME/iptv/main/playlist.m3u
```
