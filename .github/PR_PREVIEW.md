# PR Preview Deployment System

This document explains the automatic PR preview deployment system that creates a separate Heroku app for each Pull Request.

## Overview

The PR preview system automatically:
- ✅ Creates a unique Heroku app for each PR
- ✅ Deploys the PR branch to the preview app
- ✅ Runs database migrations in isolation
- ✅ Posts preview links directly in the PR
- ✅ Updates the preview when new commits are pushed
- ✅ Cleans up the preview app when PR is closed/merged

## How It Works

### 1. **PR Preview Creation** (`deploy-pr-preview.yml`)

**Triggers:**
- When a PR is opened against `dev-2`, `main`, or `develop`
- When new commits are pushed to an open PR
- When a draft PR is marked as ready for review

**Process:**
1. Builds and tests the PR branch
2. Creates a unique Heroku app: `{BASE_APP_NAME}-pr-{PR_NUMBER}`
3. Copies environment variables from the main app
4. Provisions a PostgreSQL database
5. Deploys the PR code
6. Runs database migrations
7. Performs health checks
8. Comments on the PR with preview links

### 2. **PR Preview Cleanup** (`cleanup-pr-preview.yml`)

**Triggers:**
- When a PR is closed (merged or rejected)

**Process:**
1. Identifies the preview app for the PR
2. Deletes the Heroku app and all associated resources
3. Updates the PR comment to reflect cleanup status

### 3. **Preview Status Checks** (`pr-preview-status.yml`)

**Triggers:**
- PR lifecycle events

**Process:**
1. Sets GitHub status checks for the preview deployment
2. Provides quick access to preview URLs in PR status

## Preview App Naming Convention

Preview apps are named using this pattern:
```
{BASE_APP_NAME}-pr-{PR_NUMBER}
```

**Examples:**
- Base app: `myapp-backend`
- PR #123: `myapp-backend-pr-123`
- PR #456: `myapp-backend-pr-456`

**Naming Rules:**
- Converted to lowercase
- Special characters replaced with hyphens
- Multiple hyphens collapsed to single hyphens
- Truncated to 30 characters (Heroku limit)

## Database Isolation

Each preview app gets:
- 🗄️ **Separate Database**: Independent PostgreSQL instance
- 🔄 **Fresh Migrations**: All migrations run from scratch
- 🔒 **Data Isolation**: No impact on production or other previews
- 🧹 **Auto Cleanup**: Database deleted with the app

## Environment Variables

Preview apps automatically inherit environment variables from the main app, including:
- Database connection strings (auto-configured)
- API keys and secrets
- Third-party service configurations
- Feature flags

## Cost Management

### Heroku Resource Usage

**Per Preview App:**
- 1 × Dyno (free tier or eco)
- 1 × PostgreSQL Essential-0 (free tier)
- Temporary duration (deleted on PR close)

**Cost Optimization:**
- Preview apps use minimal resources
- Automatic cleanup prevents resource accumulation
- Database uses free PostgreSQL tier

### Recommended Limits

For cost control, consider:
- Limiting previews to specific branches only
- Setting up auto-sleep for preview apps
- Using draft PRs to skip preview creation
- Manual cleanup of stale preview apps

## Security Considerations

### Environment Isolation
- Each preview runs in complete isolation
- Sensitive environment variables are copied securely
- Database credentials are unique per preview
- No cross-preview data access

### Access Control
- Preview URLs are public but contain random app names
- No authentication bypass in preview mode
- Same security measures as production app
- Environment-specific configurations maintained

## Usage Examples

### 1. **Creating a Preview**
```bash
# Create a new branch
git checkout -b feature/new-api-endpoint

# Make your changes and commit
git add .
git commit -m "Add new API endpoint"

# Push and create PR
git push origin feature/new-api-endpoint
# Create PR via GitHub UI

# Preview app automatically created and linked in PR
```

### 2. **Updating a Preview**
```bash
# Make additional changes
git add .
git commit -m "Fix API endpoint validation"

# Push updates
git push origin feature/new-api-endpoint

# Preview app automatically updated
```

### 3. **Testing the Preview**
```bash
# Get preview URL from PR comment
PREVIEW_URL="https://myapp-backend-pr-123.herokuapp.com"

# Test health endpoint
curl $PREVIEW_URL/health

# Test API endpoints
curl $PREVIEW_URL/api/v1/users

# Access Swagger docs
open $PREVIEW_URL/api-docs
```

## Workflow Configuration

### Required Secrets

The same secrets used for main deployment:
- `HEROKU_API_KEY`: Your Heroku API token
- `HEROKU_APP_NAME`: Base app name for generating preview names
- `HEROKU_EMAIL`: Your Heroku account email

### Branch Configuration

Update the workflow triggers in each file to match your branch strategy:

```yaml
on:
  pull_request:
    branches:
      - dev-2        # Your main development branch
      - main         # Production branch
      - develop      # Additional development branch
```

## Troubleshooting

### Common Issues

1. **Preview Creation Fails**
   ```
   Error: App name already exists
   ```
   - **Solution**: Check if old preview wasn't cleaned up
   - **Action**: Manually delete the Heroku app or run cleanup workflow

2. **Database Migration Errors**
   ```
   Error: Migration failed
   ```
   - **Solution**: Check migration syntax and dependencies
   - **Action**: Fix migrations and push new commit

3. **Health Check Timeouts**
   ```
   Error: Health check failed after 10 attempts
   ```
   - **Solution**: Check application startup logs
   - **Action**: Review Heroku logs: `heroku logs --tail -a {preview-app-name}`

4. **Resource Limits**
   ```
   Error: You've reached your app limit
   ```
   - **Solution**: Clean up unused preview apps
   - **Action**: Run manual cleanup or upgrade Heroku plan

### Manual Operations

**List all preview apps:**
```bash
heroku apps | grep "pr-"
```

**Clean up specific preview:**
```bash
heroku apps:destroy myapp-backend-pr-123 --confirm myapp-backend-pr-123
```

**Check preview app logs:**
```bash
heroku logs --tail -a myapp-backend-pr-123
```

**Run commands in preview:**
```bash
heroku run npm run migrate -a myapp-backend-pr-123
```

## Monitoring and Analytics

### GitHub Actions
- View deployment status in the Actions tab
- Monitor resource usage and timing
- Track success/failure rates

### Heroku Dashboard
- Monitor preview app performance
- Track database usage
- View application metrics

### PR Comments
- Deployment status and links
- Health check results
- Quick access to logs and metrics

## Best Practices

### For Developers
1. **Use Draft PRs**: Create as draft to skip preview creation during initial development
2. **Meaningful Commits**: Clear commit messages help track preview updates
3. **Test Thoroughly**: Use preview to validate changes before merging
4. **Clean Branches**: Delete feature branches after merging to trigger cleanup

### For Maintainers
1. **Monitor Costs**: Regular review of preview app usage
2. **Update Docs**: Keep preview URLs in PR descriptions
3. **Resource Limits**: Set appropriate Heroku plan limits
4. **Security Review**: Regular audit of environment variable access

## Advanced Configuration

### Custom Preview Domains
```yaml
# Add custom domain mapping in deploy workflow
- name: Add custom domain
  run: |
    heroku domains:add $APP_NAME.preview.yourcompany.com -a $APP_NAME
```

### Slack Notifications
```yaml
# Add Slack notification step
- name: Notify Slack
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: "PR Preview: ${{ steps.deploy.outputs.preview-url }}"
```

### Database Seeding
```yaml
# Add database seeding step
- name: Seed database
  run: |
    heroku run npm run seed -a $APP_NAME
```

This preview system provides a complete staging environment for every PR, enabling thorough testing and collaboration before merging changes!