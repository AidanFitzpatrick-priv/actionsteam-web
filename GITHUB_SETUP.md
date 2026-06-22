# Push to GitHub (one-time setup)

## 1. Create an empty repo on GitHub

1. Open https://github.com/new
2. Repository name: **actionsteam-web**
3. Visibility: **Private** (recommended for team app)
4. Do **not** add README, .gitignore, or license (this repo already has them)
5. Click **Create repository**

## 2. Push from this folder

```powershell
cd "c:\Users\Aidan\Desktop\projects\Actions Spreadsheet\web"

git remote add origin https://github.com/AidanFitzpatrick-priv/actionsteam-web.git
git push -u origin main
```

Replace the URL if you used a different name or org.

## 3. Connect Railway

See [RAILWAY.md](./RAILWAY.md).
