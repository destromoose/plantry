#!/bin/bash

# Initialize Git repository if not already initialized
if [ ! -d ".git" ]; then
  echo "Initializing Git repository..."
  git init
else
  echo "Git repository already initialized."
fi

# Add all files to the repository
git add .

# Create initial commit
git commit -m "Initial commit: Project setup"

# Add GitHub remote (replace with your repository URL)
echo "Enter your GitHub repository URL (e.g., https://github.com/yourusername/plantry.git):"
read repo_url

if [ -n "$repo_url" ]; then
  git remote add origin $repo_url
  echo "Added remote origin: $repo_url"
  
  # Ask if user wants to push now
  echo "Do you want to push to the remote repository now? (y/n)"
  read push_now
  
  if [ "$push_now" = "y" ] || [ "$push_now" = "Y" ]; then
    git push -u origin main
    echo "Pushed to remote repository."
  else
    echo "You can push later using 'git push -u origin main'."
  fi
else
  echo "No repository URL provided. You can add a remote later with 'git remote add origin <URL>'."
fi

echo "Git initialization complete!"
echo "Next steps:"
echo "1. Create a new branch for development: git checkout -b develop"
echo "2. Install dependencies: pnpm install"
echo "3. Start the development server: pnpm dev" 