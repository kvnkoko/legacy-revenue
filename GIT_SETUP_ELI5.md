# Put your project on Git and GitHub (ELI5)

Git = a tool that tracks every change to your code.  
GitHub = a website that stores your code so you can share it and deploy it (e.g. to Vercel).

---

## Part 1: Install Git (if you don’t have it)

1. Go to [git-scm.com/downloads](https://git-scm.com/downloads).
2. Download for your computer (Mac/Windows/Linux).
3. Run the installer and use the default options.
4. Close and reopen your terminal. Type `git --version`. If you see a version number, Git is installed.

---

## Part 2: Create a GitHub account and a new repo

1. Go to [github.com](https://github.com) and sign up (or log in).
2. Click the **+** in the top-right corner → **New repository**.
3. **Repository name:** e.g. `legacy-revenue-portal` (no spaces).
4. **Description:** optional, e.g. “Legacy revenue finance portal”.
5. Choose **Private** if only you and your team should see it, or **Public** if you’re fine with it being visible.
6. **Do not** check “Add a README” or “Add .gitignore” — your folder already has code.
7. Click **Create repository**.

You’ll see a page that says “Quick setup” and shows a URL like  
`https://github.com/YOUR_USERNAME/legacy-revenue-portal.git`.  
Keep that page open; you’ll need that URL in Part 4.

---

## Part 3: Turn your project folder into a Git repo and add files

Open **Terminal** (Mac) or **Command Prompt / PowerShell** (Windows) and go into your app folder.

**If your app is inside a folder called `legacy-revenue-portal`:**

```bash
cd path/to/legacy-revenue-portal
```

Example on Mac if the folder is on your Desktop:

```bash
cd ~/Desktop/legacy\ revenue/legacy-revenue-portal
```

Or in your case (from the “legacy revenue” folder):

```bash
cd legacy-revenue-portal
```

Then run these commands **one at a time**:

```bash
git init
```
*(This means: “Start tracking this folder with Git.”)*

```bash
git add .
```
*(This means: “Stage all my files to be saved.”)*

```bash
git status
```
*(You should see a list of files in green. That’s good.)*

```bash
git commit -m "Initial commit - Legacy Revenue Portal"
```
*(This means: “Save this snapshot of my project.”)*

```bash
git branch -M main
```
*(This names your main branch “main”.)*

---

## Part 4: Connect your folder to GitHub and push

You need the repo URL from Part 2. It looks like:

`https://github.com/YOUR_USERNAME/legacy-revenue-portal.git`

**Replace YOUR_USERNAME with your actual GitHub username.**

Then run (use your real URL):

```bash
git remote add origin https://github.com/YOUR_USERNAME/legacy-revenue-portal.git
```
*(This means: “My code will live at this GitHub address.”)*

```bash
git push -u origin main
```
*(This sends your code to GitHub. You may be asked to log in.)*

- If it asks for a **password**, use a **Personal Access Token** (see below), not your normal GitHub password.
- When it finishes, refresh your GitHub repo page — you should see all your files there.

---

## If Git asks for a password: use a Personal Access Token

GitHub doesn’t use your account password for command-line pushes anymore. You use a **token** instead.

1. On GitHub: click your profile picture (top right) → **Settings**.
2. Left sidebar, near the bottom: **Developer settings**.
3. **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**.
4. Name it something like “My laptop” or “Vercel deploy”.
5. Choose an expiration (e.g. 90 days or “No expiration” if you’re okay with that).
6. Under **Scopes**, check **repo** (full control of private repositories).
7. Click **Generate token**.
8. **Copy the token** and store it somewhere safe. You won’t see it again.
9. When `git push` asks for a password, **paste this token** (not your GitHub password).

---

## Quick checklist

- [ ] Git installed (`git --version` works).
- [ ] GitHub account created.
- [ ] New repo created on GitHub (no README added).
- [ ] In Terminal: `cd` into `legacy-revenue-portal`.
- [ ] `git init` → `git add .` → `git commit -m "Initial commit - Legacy Revenue Portal"` → `git branch -M main`.
- [ ] `git remote add origin YOUR_REPO_URL.git`
- [ ] `git push -u origin main` (use token as password if asked).
- [ ] Repo on GitHub shows your files.

After this, your repo is on Git and GitHub. You can then follow the Vercel deploy guide and connect this repo to Vercel.
