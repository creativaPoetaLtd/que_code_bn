# GitHub Actions Deployment Guide

## 🚀 Automatic Deployment System

This repository includes a comprehensive deployment system with:

- **Main Deployment**: Automatic deployment to production when PRs are merged to `dev-2`
- **PR Previews**: Individual preview environments for every Pull Request
- **Auto Cleanup**: Automatic cleanup of resources when PRs are closed

## 📦 Main Deployment

[![Deploy to Heroku](https://github.com/creativaPoetaLtd/que_code_bn/actions/workflows/deploy-to-heroku.yml/badge.svg?branch=dev-2)](https://github.com/creativaPoetaLtd/que_code_bn/actions/workflows/deploy-to-heroku.yml)

### Triggers
- Direct push to `dev-2` branch
- Pull Request merged into `dev-2` branch

### Process
1. **Build & Test**: Linting, building, and validation
2. **Deploy**: Deploy to main Heroku app
3. **Migrate**: Run database migrations safely
4. **Verify**: Health checks ensure successful deployment
5. **Notify**: Deployment status reported

## 🔄 PR Preview System

### What You Get
- **Unique URL** for each PR: `https://yourapp-pr-123.herokuapp.com`
- **Isolated Database** with fresh migrations
- **Auto-generated Comment** with preview links
- **Health Monitoring** and status checks
- **Automatic Cleanup** when PR closes

### Preview Workflow
1. **Create PR** → Preview app automatically created
2. **Push Updates** → Preview app automatically updated
3. **Test Changes** → Use preview URL to validate
4. **Close/Merge PR** → Preview app automatically deleted

### Preview Links in PR Comments
```
🚀 Preview Deployment
✅ Deployment Successful

Preview URL: https://yourapp-pr-123.herokuapp.com
Health Check: https://yourapp-pr-123.herokuapp.com/health
API Base: https://yourapp-pr-123.herokuapp.com/api/v1

📊 Quick Links
- 🔍 Health Status
- 📚 API Documentation  
- 🗄️ Database Status
```

## ⚙️ Setup Instructions

### 1. Initial Setup
```bash
# Run the setup script
./scripts/setup-deployment.sh
```

### 2. Required GitHub Secrets
| Secret | Description | Example |
|--------|-------------|---------|
| `HEROKU_API_KEY` | Your Heroku API token | `xxxxxxxx-xxxx-xxxx...` |
| `HEROKU_APP_NAME` | Main app name (base for previews) | `myapp-backend` |
| `HEROKU_EMAIL` | Your Heroku account email | `user@example.com` |

### 3. Setting Up Secrets

**Via GitHub CLI:**
```bash
gh secret set HEROKU_API_KEY --body "your-api-key"
gh secret set HEROKU_APP_NAME --body "your-app-name"  
gh secret set HEROKU_EMAIL --body "your-email@example.com"
```

**Via GitHub Web Interface:**
1. Go to repository Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add each secret with the appropriate value

## 🔧 Workflow Files

| File | Purpose |
|------|---------|
| `deploy-to-heroku.yml` | Main production deployment |
| `deploy-pr-preview.yml` | Create/update PR previews |
| `cleanup-pr-preview.yml` | Clean up PR previews |
| `pr-preview-status.yml` | GitHub status checks |

## 📊 Monitoring & Management

### GitHub Actions
- View deployment status in the **Actions** tab
- Monitor build times and success rates
- Access detailed logs for troubleshooting

### Heroku Dashboard
- Monitor app performance and metrics
- View logs: `heroku logs --tail -a your-app-name`
- Manage environment variables

### PR Comments
- Automatic status updates
- Direct links to preview environments
- Health check results

## 🛠️ Manual Operations

### List Preview Apps
```bash
heroku apps | grep "pr-"
```

### Clean Up Specific Preview
```bash
heroku apps:destroy your-app-pr-123 --confirm your-app-pr-123
```

### View Preview Logs
```bash
heroku logs --tail -a your-app-pr-123
```

### Run Commands in Preview
```bash
heroku run npm run migrate -a your-app-pr-123
heroku run npm run seed -a your-app-pr-123
```

## 💰 Cost Management

### Resource Usage Per PR
- **1 Dyno**: Free or Eco tier
- **1 Database**: PostgreSQL Essential-0 (free)
- **Duration**: Only while PR is open

### Cost Optimization Tips
- Use draft PRs during development (skips preview creation)
- Close PRs promptly after merging
- Regular cleanup of stale preview apps
- Monitor Heroku usage dashboard

## 🔒 Security Features

### Environment Isolation
- Each preview runs in complete isolation
- Unique database credentials per preview
- No cross-preview data access
- Environment variables copied securely

### Access Control
- Preview URLs contain random app names
- Same authentication as main app
- Environment-specific configurations
- Automatic secret rotation support

## 🚨 Troubleshooting

### Common Issues

**Preview Creation Fails**
```bash
# Check if old preview exists
heroku apps:info your-app-pr-123

# Manual cleanup if needed
heroku apps:destroy your-app-pr-123 --confirm your-app-pr-123
```

**Migration Errors**
```bash
# Check migration status
heroku run npx sequelize-cli db:migrate:status -a your-app-pr-123

# View detailed logs
heroku logs --tail -a your-app-pr-123
```

**Health Check Failures**
```bash
# Test health endpoint
curl https://your-app-pr-123.herokuapp.com/health

# Check application startup
heroku ps -a your-app-pr-123
```

### Getting Help
- Check [workflow logs](https://github.com/creativaPoetaLtd/que_code_bn/actions)
- Review [deployment documentation](.github/DEPLOYMENT.md)
- Read [PR preview guide](.github/PR_PREVIEW.md)

## 🎯 Best Practices

### For Developers
- Create meaningful commit messages
- Use draft PRs during active development
- Test thoroughly using preview environments
- Include deployment notes in PR descriptions

### For Reviewers
- Use preview links to validate changes
- Test edge cases in isolated environment
- Verify database migrations work correctly
- Check API documentation updates

### For Maintainers
- Monitor preview app usage regularly
- Update workflow configurations as needed
- Review and rotate secrets periodically
- Maintain documentation and troubleshooting guides

## 📚 Additional Resources

- **[Deployment Guide](.github/DEPLOYMENT.md)**: Detailed main deployment documentation
- **[PR Preview Guide](.github/PR_PREVIEW.md)**: Comprehensive preview system documentation  
- **[Status Badges](.github/BADGE.md)**: GitHub Actions status badges
- **[Configuration](.github/preview-config.yml)**: Preview system settings

---

**Questions or Issues?** Open an issue or check the documentation in the `.github/` directory.