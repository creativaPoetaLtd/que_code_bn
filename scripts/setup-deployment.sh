#!/bin/bash

# GitHub Actions Heroku Deployment Setup Script
# This script helps you set up the required environment for auto-deployment and PR previews

echo "🚀 QueCode Backend - Heroku Deployment Setup"
echo "============================================="
echo ""
echo "This script sets up:"
echo "📦 Main deployment (on dev-2 branch merge)"
echo "🔄 PR preview deployments (for every PR)"
echo "🗑️ Automatic preview cleanup"
echo ""

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Error: This script must be run from the root of your git repository"
    exit 1
fi

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "📋 GitHub CLI is not installed. You can install it from: https://cli.github.com/"
    echo "   Or you can manually add secrets via GitHub web interface."
    echo ""
fi

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo "📋 Heroku CLI is not installed. You can install it from: https://devcenter.heroku.com/articles/heroku-cli"
    echo ""
fi

echo "📝 Required GitHub Secrets Setup"
echo "================================"
echo ""
echo "You need to add the following secrets to your GitHub repository:"
echo ""
echo "1. HEROKU_API_KEY     - Your Heroku API key"
echo "2. HEROKU_APP_NAME    - Your main Heroku app name (base for previews)"
echo "3. HEROKU_EMAIL       - Your Heroku account email"
echo ""

# Get Heroku info if CLI is available
if command -v heroku &> /dev/null; then
    echo "🔍 Detecting Heroku configuration..."
    
    # Check if user is logged in to Heroku
    if heroku auth:whoami &> /dev/null; then
        HEROKU_EMAIL=$(heroku auth:whoami)
        echo "✅ Heroku Email: $HEROKU_EMAIL"
        
        # List Heroku apps
        echo ""
        echo "📱 Your Heroku Apps:"
        heroku apps --json | jq -r '.[].name' 2>/dev/null || heroku apps | grep -v "==="
        echo ""
        echo "💡 Choose your main app name as HEROKU_APP_NAME"
        echo "   Preview apps will be named: {HEROKU_APP_NAME}-pr-{NUMBER}"
        echo ""
        
        # Get API key
        echo "🔑 Your Heroku API Key:"
        echo "   Run: heroku auth:token"
        echo "   Or get it from: https://dashboard.heroku.com/account"
        echo ""
    else
        echo "⚠️  You're not logged in to Heroku CLI. Run: heroku login"
        echo ""
    fi
fi

# Preview deployment information
echo "🔄 PR Preview System"
echo "==================="
echo ""
echo "The PR preview system will:"
echo "• Create a unique Heroku app for each PR"
echo "• Deploy the PR branch automatically"
echo "• Run database migrations in isolation"
echo "• Post preview links in PR comments"
echo "• Clean up when PR is closed/merged"
echo ""
echo "Preview app naming: {HEROKU_APP_NAME}-pr-{PR_NUMBER}"
echo "Example: myapp-backend-pr-123"
echo ""

# Cost estimation
echo "💰 Cost Estimation"
echo "=================="
echo ""
echo "Each PR preview uses:"
echo "• 1 Heroku dyno (free/eco tier)"
echo "• 1 PostgreSQL database (essential-0, free tier)"
echo "• Automatic cleanup when PR closes"
echo ""
echo "💡 Tips to minimize costs:"
echo "• Use draft PRs during development (skips preview)"
echo "• Close/merge PRs promptly"
echo "• Monitor your Heroku dashboard for stale apps"
echo ""

# Instructions for setting secrets
echo "🔧 Setting up GitHub Secrets"
echo "============================"
echo ""

if command -v gh &> /dev/null && gh auth status &> /dev/null; then
    echo "✅ GitHub CLI is available and authenticated!"
    echo ""
    read -p "Would you like to set up secrets now? (y/N): " setup_secrets
    
    if [[ $setup_secrets =~ ^[Yy]$ ]]; then
        echo ""
        read -p "Enter your Heroku API key: " heroku_api_key
        read -p "Enter your main Heroku app name: " heroku_app_name
        read -p "Enter your Heroku email: " heroku_email
        
        echo ""
        echo "Setting up GitHub secrets..."
        
        if gh secret set HEROKU_API_KEY --body "$heroku_api_key"; then
            echo "✅ HEROKU_API_KEY set successfully"
        fi
        
        if gh secret set HEROKU_APP_NAME --body "$heroku_app_name"; then
            echo "✅ HEROKU_APP_NAME set successfully"
        fi
        
        if gh secret set HEROKU_EMAIL --body "$heroku_email"; then
            echo "✅ HEROKU_EMAIL set successfully"
        fi
        
        echo ""
        echo "🎉 GitHub secrets have been configured!"
        echo ""
        echo "Example preview app names:"
        echo "• $heroku_app_name-pr-1"
        echo "• $heroku_app_name-pr-42"
        echo "• $heroku_app_name-pr-123"
    fi
else
    echo "Manual setup required:"
    echo ""
    echo "1. Go to: https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/settings/secrets/actions"
    echo "2. Click 'New repository secret'"
    echo "3. Add each secret with the values from above"
    echo ""
fi

echo ""
echo "🔍 Verifying Setup"
echo "=================="
echo ""

# Check workflow files
workflows_count=0

if [ -f ".github/workflows/deploy-to-heroku.yml" ]; then
    echo "✅ Main deployment workflow exists"
    workflows_count=$((workflows_count + 1))
else
    echo "❌ Main deployment workflow missing"
fi

if [ -f ".github/workflows/deploy-pr-preview.yml" ]; then
    echo "✅ PR preview deployment workflow exists"
    workflows_count=$((workflows_count + 1))
else
    echo "❌ PR preview deployment workflow missing"
fi

if [ -f ".github/workflows/cleanup-pr-preview.yml" ]; then
    echo "✅ PR preview cleanup workflow exists"
    workflows_count=$((workflows_count + 1))
else
    echo "❌ PR preview cleanup workflow missing"
fi

if [ -f ".github/workflows/pr-preview-status.yml" ]; then
    echo "✅ PR preview status workflow exists"
    workflows_count=$((workflows_count + 1))
else
    echo "❌ PR preview status workflow missing"
fi

# Check if health endpoint exists
if grep -q "/health" src/app.ts; then
    echo "✅ Health check endpoint configured"
else
    echo "❌ Health check endpoint missing"
fi

# Check if Procfile exists
if [ -f "Procfile" ]; then
    echo "✅ Procfile exists"
    if grep -q "release.*migrate" Procfile; then
        echo "✅ Migration configured in Procfile"
    else
        echo "⚠️  Migration not configured in Procfile"
    fi
else
    echo "❌ Procfile missing"
fi

echo ""
echo "📊 Setup Summary"
echo "================"
echo ""
echo "Workflows found: $workflows_count/4"

if [ $workflows_count -eq 4 ]; then
    echo "✅ All workflows are properly configured!"
else
    echo "⚠️  Some workflows are missing. Please check the .github/workflows/ directory."
fi

echo ""
echo "📚 Next Steps"
echo "============"
echo ""
echo "1. Commit and push the new workflow files:"
echo "   git add .github/"
echo "   git commit -m 'Add GitHub Actions deployment and PR preview workflows'"
echo "   git push origin $(git branch --show-current)"
echo ""
echo "2. Create a test PR to verify PR preview system:"
echo "   git checkout -b test-pr-preview"
echo "   echo '# Test PR Preview' >> TEST_PREVIEW.md"
echo "   git add TEST_PREVIEW.md"
echo "   git commit -m 'Test PR preview deployment'"
echo "   git push origin test-pr-preview"
echo "   # Then create PR via GitHub UI"
echo ""
echo "3. Monitor deployments in the Actions tab:"
echo "   https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions"
echo ""
echo "4. Test preview functionality:"
echo "   • Check PR comment for preview links"
echo "   • Verify health endpoint: {preview-url}/health"
echo "   • Test API endpoints: {preview-url}/api/v1"
echo ""
echo "📖 Documentation:"
echo "• Main deployment: .github/DEPLOYMENT.md"
echo "• PR previews: .github/PR_PREVIEW.md"
echo "• Status badge: .github/BADGE.md"
echo ""
echo "🎉 Setup complete! Your auto-deployment and PR preview system is ready!"