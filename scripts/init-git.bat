@echo off
echo Plantry Git Initialization Script
echo ================================

REM Check if .git directory exists
if exist ".git" (
    echo Git repository already initialized.
) else (
    echo Initializing Git repository...
    git init
)

REM Add all files to the repository
git add .

REM Create initial commit
git commit -m "Initial commit: Project setup"

REM Add GitHub remote
echo.
echo Enter your GitHub repository URL (e.g., https://github.com/yourusername/plantry.git):
set /p repo_url=

if not "%repo_url%"=="" (
    git remote add origin %repo_url%
    echo Added remote origin: %repo_url%
    
    REM Ask if user wants to push now
    echo.
    echo Do you want to push to the remote repository now? (y/n)
    set /p push_now=
    
    if /i "%push_now%"=="y" (
        git push -u origin main
        echo Pushed to remote repository.
    ) else (
        echo You can push later using 'git push -u origin main'.
    )
) else (
    echo No repository URL provided. You can add a remote later with 'git remote add origin ^<URL^>'.
)

echo.
echo Git initialization complete!
echo.
echo Next steps:
echo 1. Create a new branch for development: git checkout -b develop
echo 2. Install dependencies: pnpm install
echo 3. Start the development server: pnpm dev
echo.

pause 