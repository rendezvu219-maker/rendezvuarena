# Captain Management Scripts

This directory contains scripts for managing team captain permissions and roles in the Rendezvu Arena database.

## Overview

The scripts handle common captain management tasks including:
- Fixing permission inconsistencies
- Transferring captain roles between team members
- Validating captain permissions
- Listing teams and their captain status

## Database Configuration

All scripts use the `DATABASE_PATH` environment variable to locate the SQLite database. If not set, they default to `./data/rendezvu-arena.sqlite`.

For Railway production environments, scripts automatically use the `RAILWAY_VOLUME_MOUNT_PATH` environment variable.

## Scripts

### 1. captain-manager.js (Recommended)
A comprehensive script for all captain management operations.

```bash
# List all teams and their captains
node captain-manager.js list

# Check captain status for a specific team
node captain-manager.js check <team_id>

# Transfer captain role from one user to another
node captain-manager.js transfer <team_id> <from_user_id> <to_user_id>

# Fix captain permission inconsistencies
node captain-manager.js fix

# Validate captain permissions without making changes
node captain-manager.js validate
```

### 2. fix-captain-permissions.js
Detects and fixes inconsistencies between team captain assignments and team members.

```bash
node fix-captain-permissions.js
```

This script fixes:
- Users marked as captains in `team_members` but not set as `captain_user_id` in teams
- Duplicate user entries in the same team
- Team captains without proper `team_members` entries

### 3. fix-captain-permissions-railway.js
Same as `fix-captain-permissions.js` but optimized for Railway production environment with volume mounts.

```bash
node fix-captain-permissions-railway.js
```

### 4. list-teams.js
Lists all teams and searches for specific members (originally for VKON and SonGoku).

```bash
node list-teams.js
```

### 5. transfer-captain-evernight.js
Specific script for transferring captain role in Team Evernight from SonGoku to VKON.

```bash
node transfer-captain-evernight.js
```

## Environment Variables

- `DATABASE_PATH`: Path to SQLite database file
- `RAILWAY_VOLUME_MOUNT_PATH`: Railway volume mount path (for production)
- `AUTO_CONFIRM=true`: Skip confirmation prompts (use with caution)

## Common Issues Handled

### Inconsistent Captain Data
- Users with `is_captain = 1` in `team_members` but team's `captain_user_id` doesn't match
- Teams with `captain_user_id` set but no corresponding captain member
- Multiple entries for the same user in a team

### Captain Transfer Validation
- Both current and new captain must have linked user accounts
- Cannot transfer to the same user
- Team must exist

## Usage Examples

### Fix permission issues interactively
```bash
node captain-manager.js fix
```

### Transfer captain role
```bash
# First, check the current team status
node captain-manager.js check 123

# Then transfer captain from user 456 to user 789
node captain-manager.js transfer 123 456 789
```

### Validate without changes
```bash
node captain-manager.js validate
```

### Auto-confirm for automation
```bash
AUTO_CONFIRM=true node captain-manager.js fix
```

## Database Utilities

All scripts share common utilities from `database-utils.js`:
- `connectDatabase()`: Safe database connection with error handling
- `confirmAction()`: Interactive confirmation prompts
- `validateCaptainTransfer()`: Validation logic for captain transfers
- `logSection()`: Consistent section logging

## Safety Features

- **Confirmation prompts**: All data-modifying operations require confirmation
- **Validation**: Extensive validation before making changes
- **Error handling**: Comprehensive error handling with clear messages
- **Transaction support**: Captain transfers use database transactions
- **Dry-run mode**: Use `validate` command to check without changes

## Best Practices

1. Always run `validate` before running `fix` to understand what will be changed
2. Test scripts on a backup database first
3. Use `AUTO_CONFIRM=true` only in automated/CI environments
4. Keep database backups before running modification scripts
5. Use `captain-manager.js` for most operations - it's the most comprehensive tool

## Troubleshooting

### Database not found
Ensure `DATABASE_PATH` is set correctly or the database file exists at the default location.

### Permission denied
Make sure the database file is writable by the user running the script.

### Captain transfer fails
Check that both users have linked user accounts (`user_id` is not NULL) and are active team members.
