# GitHub Mobile Client - PRD

## Overview
A comprehensive GitHub mobile client app that allows users to browse repositories, view code, commits, issues, and pull requests using their GitHub Personal Access Token.

## Tech Stack
- **Frontend**: React Native with Expo SDK 54, expo-router for navigation
- **Backend**: FastAPI (Python) as a proxy for GitHub REST API
- **Database**: MongoDB for user persistence
- **Auth**: GitHub Personal Access Token (PAT) based authentication

## Features
1. **Login**: GitHub PAT token authentication with validation
2. **Repository List**: View all user repositories with sort by last updated
3. **Repository Details**: Stars, forks, watchers, language, description, topics
4. **File Browser**: Navigate repository folders and files
5. **File Viewer**: View code files with line numbers
6. **Commit History**: Timeline-style commit list with SHA badges
7. **Issues**: View open/closed issues
8. **Pull Requests**: View open/closed/merged PRs
9. **Search**: Search public repositories across GitHub
10. **README Viewer**: Rendered README with dark theme styling
11. **User Profile**: GitHub profile info with stats, sign out

## Navigation
- Tab-based: Home (repos), Explore (search), Profile
- Stack navigation: Login → Tabs → Repo Detail → File Viewer

## API Endpoints
- POST /api/auth/login - Validate GitHub token
- GET /api/user/profile - Get user profile
- GET /api/user/repos - List user repos
- GET /api/repos/{owner}/{repo} - Repo details
- GET /api/repos/{owner}/{repo}/contents - File browser
- GET /api/repos/{owner}/{repo}/readme - README HTML
- GET /api/repos/{owner}/{repo}/commits - Commit history
- GET /api/repos/{owner}/{repo}/issues - Issues list
- GET /api/repos/{owner}/{repo}/pulls - Pull requests
- GET /api/search/repos - Search repos
- GET /api/health - Health check

## Design
- Dark theme (#0A0A0A background) with Tech Brutalism aesthetic
- Yellow (#FBBF24) and Blue (#3B82F6) accent colors
- Sharp edges, flat components, monospace code fonts
