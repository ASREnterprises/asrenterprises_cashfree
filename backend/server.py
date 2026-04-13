from fastapi import FastAPI, APIRouter, HTTPException, Header, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import httpx
from pathlib import Path
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

GITHUB_API = "https://api.github.com"

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# Models
class LoginRequest(BaseModel):
    token: str


def gh_headers(token: str) -> dict:
    return {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }


def parse_token(authorization: str) -> str:
    if authorization.startswith("token "):
        return authorization[6:]
    if authorization.startswith("Bearer "):
        return authorization[7:]
    return authorization


# ─── Auth ────────────────────────────────────────────────────────────────

@api_router.post("/auth/login")
async def login(req: LoginRequest):
    if not req.token or not req.token.strip():
        raise HTTPException(status_code=422, detail="Token is required")
    async with httpx.AsyncClient(timeout=15.0) as http:
        r = await http.get(f"{GITHUB_API}/user", headers=gh_headers(req.token))
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid GitHub token")
        u = r.json()

    await db.users.update_one(
        {"github_id": u["id"]},
        {"$set": {
            "github_id": u["id"],
            "login": u["login"],
            "name": u.get("name"),
            "avatar_url": u.get("avatar_url"),
            "bio": u.get("bio"),
            "public_repos": u.get("public_repos", 0),
            "followers": u.get("followers", 0),
            "following": u.get("following", 0),
            "html_url": u.get("html_url"),
            "company": u.get("company"),
            "location": u.get("location"),
            "blog": u.get("blog"),
            "twitter_username": u.get("twitter_username"),
            "created_at": u.get("created_at"),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True
    )

    return {
        "login": u["login"],
        "name": u.get("name"),
        "avatar_url": u.get("avatar_url"),
        "bio": u.get("bio"),
        "public_repos": u.get("public_repos", 0),
        "followers": u.get("followers", 0),
        "following": u.get("following", 0),
        "html_url": u.get("html_url"),
        "company": u.get("company"),
        "location": u.get("location"),
        "blog": u.get("blog"),
        "twitter_username": u.get("twitter_username"),
        "created_at": u.get("created_at"),
    }


# ─── User ────────────────────────────────────────────────────────────────

@api_router.get("/user/profile")
async def user_profile(authorization: str = Header(...)):
    token = parse_token(authorization)
    async with httpx.AsyncClient(timeout=15.0) as http:
        r = await http.get(f"{GITHUB_API}/user", headers=gh_headers(token))
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail="Failed to fetch profile")
        return r.json()


@api_router.get("/user/repos")
async def user_repos(
    authorization: str = Header(...),
    sort: str = "updated",
    direction: str = "desc",
    per_page: int = 30,
    page: int = 1,
    type: str = "all",
):
    token = parse_token(authorization)
    async with httpx.AsyncClient(timeout=15.0) as http:
        r = await http.get(
            f"{GITHUB_API}/user/repos",
            headers=gh_headers(token),
            params={"sort": sort, "direction": direction, "per_page": per_page, "page": page, "type": type},
        )
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail="Failed to fetch repos")
        return r.json()


# ─── Repository ──────────────────────────────────────────────────────────

@api_router.get("/repos/{owner}/{repo}")
async def get_repo(owner: str, repo: str, authorization: str = Header(...)):
    token = parse_token(authorization)
    async with httpx.AsyncClient(timeout=15.0) as http:
        r = await http.get(f"{GITHUB_API}/repos/{owner}/{repo}", headers=gh_headers(token))
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail="Repository not found")
        return r.json()


@api_router.get("/repos/{owner}/{repo}/contents")
async def get_contents(owner: str, repo: str, authorization: str = Header(...), path: str = ""):
    token = parse_token(authorization)
    url = f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}" if path else f"{GITHUB_API}/repos/{owner}/{repo}/contents"
    async with httpx.AsyncClient(timeout=15.0) as http:
        r = await http.get(url, headers=gh_headers(token))
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail="Failed to fetch contents")
        return r.json()


@api_router.get("/repos/{owner}/{repo}/readme")
async def get_readme(owner: str, repo: str, authorization: str = Header(...)):
    token = parse_token(authorization)
    headers = {**gh_headers(token), "Accept": "application/vnd.github.html+json"}
    async with httpx.AsyncClient(timeout=15.0) as http:
        r = await http.get(f"{GITHUB_API}/repos/{owner}/{repo}/readme", headers=headers)
        if r.status_code == 404:
            return {"html": "<p>No README found.</p>"}
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail="Failed to fetch README")
        return {"html": r.text}


@api_router.get("/repos/{owner}/{repo}/commits")
async def get_commits(
    owner: str, repo: str, authorization: str = Header(...),
    per_page: int = 30, page: int = 1,
):
    token = parse_token(authorization)
    async with httpx.AsyncClient(timeout=15.0) as http:
        r = await http.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/commits",
            headers=gh_headers(token),
            params={"per_page": per_page, "page": page},
        )
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail="Failed to fetch commits")
        return r.json()


@api_router.get("/repos/{owner}/{repo}/issues")
async def get_issues(
    owner: str, repo: str, authorization: str = Header(...),
    state: str = "open", per_page: int = 30, page: int = 1,
):
    token = parse_token(authorization)
    async with httpx.AsyncClient(timeout=15.0) as http:
        r = await http.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/issues",
            headers=gh_headers(token),
            params={"state": state, "per_page": per_page, "page": page},
        )
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail="Failed to fetch issues")
        return r.json()


@api_router.get("/repos/{owner}/{repo}/pulls")
async def get_pulls(
    owner: str, repo: str, authorization: str = Header(...),
    state: str = "open", per_page: int = 30, page: int = 1,
):
    token = parse_token(authorization)
    async with httpx.AsyncClient(timeout=15.0) as http:
        r = await http.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/pulls",
            headers=gh_headers(token),
            params={"state": state, "per_page": per_page, "page": page},
        )
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail="Failed to fetch pull requests")
        return r.json()


# ─── Search ──────────────────────────────────────────────────────────────

@api_router.get("/search/repos")
async def search_repos(
    q: str = Query(...),
    authorization: str = Header(...),
    sort: str = "stars",
    order: str = "desc",
    per_page: int = 30,
    page: int = 1,
):
    token = parse_token(authorization)
    async with httpx.AsyncClient(timeout=15.0) as http:
        r = await http.get(
            f"{GITHUB_API}/search/repositories",
            headers=gh_headers(token),
            params={"q": q, "sort": sort, "order": order, "per_page": per_page, "page": page},
        )
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail="Search failed")
        return r.json()


# ─── Health ──────────────────────────────────────────────────────────────

@api_router.get("/health")
async def health():
    return {"status": "ok"}


# Include router & middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
