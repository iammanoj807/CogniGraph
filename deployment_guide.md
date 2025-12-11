# 🚀 Deploying CogniGraph to Hugging Face Spaces

You can deploy your full application (React + FastAPI) to Hugging Face Spaces using the **Docker** SDK.

## Prerequisites
1.  A [Hugging Face Account](https://huggingface.co/join).
2.  Your `GITHUB_TOKEN` (the one you use in `.env` for the models).

## Step 1: Create a New Space
1.  Go to **Hugging Face** -> **New Space**.
2.  **Name**: `CogniGraph` (or similar).
3.  **License**: `MIT` (or your choice).
4.  **SDK**: Select **Docker** (Blank).
5.  **Hardware**: `CPU Basic (Free)` (2 vCPU, 16GB RAM).
6.  Click **Create Space**.

## Step 2: Upload Files
You can upload files via the Web interface or Git.

### Option A: Upload via Web
1.  In your new Space, go to **Files**.
2.  Click **Add file** -> **Upload files**.
3.  Drag and drop the **entire contents** of your project folder:
    *   `backend/` folder
    *   `frontend/` folder
    *   `Dockerfile`
    *   `requirements.txt` (if it's in root, otherwise ensure it's in backend)
4.  Commit changes.

### Option B: Push via Git (Recommended)
1.  Clone the Space repository locally:
    ```bash
    git clone https://huggingface.co/spaces/YOUR_USERNAME/CogniGraph
    ```
2.  Copy your project files into that folder.
3.  Push:
    ```bash
    git add .
    git commit -m "Initial Deploy"
    git push
    ```

## Step 3: Set Secrets (Important!)
Your app needs the API key to work.
1.  Go to your Space's **Settings** tab.
2.  Scroll to **Variables and secrets**.
3.  Click **New secret**.
4.  **Name**: `GITHUB_TOKEN`
5.  **Value**: (Paste your token starting with `github_pat_...`)
6.  Save.

## Step 4: Watch it Build!
1.  Go to the **App** tab.
2.  You will see "Building..." logs.
3.  Once finished (takes ~2-3 mins first time), your app will be live!

---

### Troubleshooting
*   **"Runtime Error"**: Check the **Logs** tab.
*   **Tesseract/Poppler**: These are already installed in our `Dockerfile`.
*   **Rate Limits**: If you hit API limits, check your token status.
