# Troubleshooting Agent Rules Hub

This guide covers common issues and their solutions when using Agent Rules Hub.

## Installation Issues

### Bootstrap Script Warns or Fails

**Problem**: `./scripts/bootstrap-home.sh` prints warnings or exits early

**What is expected**:

- `node` is the only hard requirement for the basic generated-file wiring
- missing `ais` is now a **warning**, not a hard failure
- missing `superpowers` is only a warning for optional shared skill discovery (Codex/OpenCode)

**Solutions**:

1. **Missing `ais` binary** (optional):
   ```bash
   # Install ai-rules-sync if you want its extra registration helpers
   npm install -g @ai-rules/cli
   # Or point to a custom binary
   export AIS_BIN=/path/to/ais
   ```

2. **Missing superpowers checkout** (optional for base wiring):
   ```bash
   # Clone superpowers or point the helper at a real checkout
   export SUPERPOWERS_ROOT=/path/to/superpowers
   ```

3. **Node.js not found** (required):
   ```bash
   # Install Node.js 20+
   # On Ubuntu/Debian:
   sudo apt install nodejs npm
   # On macOS:
   brew install node
   ```

### Dashboard Won't Start

**Problem**: `npm run dashboard` fails or port already in use

**Solutions**:

1. **Port already in use**:
   ```bash
   # Find process using port 4848
   lsof -i :4848
   # Kill the process or use different port
   AGENT_RULES_DASHBOARD_PORT=4849 npm run dashboard
   ```

2. **Missing dependencies**:
   ```bash
   npm install
   ```

3. **Permission denied on systemd service**:
   ```bash
   # Use user-level systemd
   systemctl --user status agent-rules-hub-dashboard
   ```

## Configuration Issues

### Instructions Not Syncing

**Problem**: CLI isn't reading generated instructions from the hub

**Solutions**:

1. **Run bootstrap** from the dashboard **Run Bootstrap** button or with the shell helper:
   ```bash
   ./scripts/bootstrap-home.sh
   ```

2. **Check home-level path**:
   ```bash
   ./scripts/show-capabilities.sh
   # Look for "Resolved:" line - should match hub's generated path
   ```

3. **Manually verify symlink**:
   ```bash
   ls -la ~/.codex/AGENTS.md  # Should point to hub's generated/codex/AGENTS.md
   ls -la ~/.claude/CLAUDE.md  # Should point to hub's generated/claude/CLAUDE.md
   ```

### Profile Shows "Broken" Status

**Problem**: Dashboard shows CLI profile as "broken"

**Solutions**:

1. **Check config parse errors first**:
   ```bash
   npm run dashboard
   # Then inspect the warning summary or the affected runtime config file
   ```

2. **Codex wiring looks stale**:
   ```bash
   ./scripts/bootstrap-home.sh
   ```

3. **Claude plugin is external, not controlled by bootstrap**:
   ```bash
   claude plugins list | grep superpowers
   # Disable it manually if you do not want Claude routed through that plugin
   claude plugins disable superpowers@claude-plugins-official
   ```

4. **Gemini extension is external, not controlled by bootstrap**:
   ```bash
   gemini extensions list | grep superpowers
   # Disable it manually if you do not want Gemini routed through that extension
   gemini extensions disable --scope user superpowers
   gemini extensions disable --scope workspace superpowers
   ```

5. **OpenCode plugin profile is optional, not required**:
   ```bash
   # Only if you want the hub-managed OpenCode plugin profile
   bash scripts/set-opencode-plugin.sh oh-my-opencode
   ```

### Profile Shows "Detected" Status

**Problem**: Dashboard shows a CLI as "detected" instead of "managed"

**Explanation**: This is normal when the hub found the CLI, but its instruction path is not currently wired to this repo's generated delivery path.

Common examples:

- the CLI is using its own existing home rule path instead of the hub-managed one
- the home/config instruction path is not currently wired to this repo
- OpenCode config does not include the managed instructions path

### OpenCode Plugin Profiles

**Problem**: OpenCode plugin behavior is confusing

**Explanation**: Plugin arrays in `opencode.jsonc` are editable from the hub, but plugin package behavior is external. Mixed profiles are shown as mixed profiles.

**Useful checks**:

1. **Show current OpenCode plugin profile** from the dashboard Operations section
2. **Set a clean profile if needed**:
   ```bash
   bash scripts/set-opencode-plugin.sh oh-my-opencode
   # or
   bash scripts/set-opencode-plugin.sh none
   ```
3. **Refresh Snapshot** after changing plugin config

## CLI-Specific Issues

### Codex Issues

**Problem**: Codex not using generated AGENTS.md

**Check orchestrator mode**:
```bash
bash scripts/set-codex-orchestrator.sh status
```

**Switch mode**:
```bash
bash scripts/set-codex-orchestrator.sh omx-primary
bash scripts/set-codex-orchestrator.sh hybrid-tools-only
```

**Verify AGENTS.md**:
```bash
cat ~/.codex/AGENTS.md  # Should contain generated content
```

### Claude Code Issues

**Problem**: Claude plugin state differs from what you expected

**Check plugin**:
```bash
claude plugins list | grep superpowers
```

**Plugin installed but disabled**:
```bash
# Check plugin status in output above
# Enable via Claude settings if needed
```

**Restart Claude** - Plugin changes require fresh session

### Gemini CLI Issues

**Problem**: Gemini extension state differs from what you expected

**Check extension**:
```bash
gemini extensions list | grep superpowers
```

**Extension not linked**:
```bash
# Bootstrap does not manage Gemini extension install/link lifecycle.
# Link/install it through Gemini CLI if you want extension behavior.
gemini extensions list
```

**Check extension source**:
```bash
# If you intentionally use a linked extension, source should show Type: link
gemini extensions list
```

## Dashboard Issues

### API Calls Return 403 Forbidden

**Problem**: Dashboard API calls failing with 403

**Cause**: Token mismatch or wrong origin

**Solutions**:

1. **Refresh the page** - New token generated on each server start
2. **Check origin** - Dashboard only works from `http://127.0.0.1:4848` or `http://localhost:4848`
3. **Restart server**:
   ```bash
   # Kill and restart
   pkill -f "node dashboard/server.mjs"
   npm run dashboard
   ```

### Edits Not Saving

**Problem**: File edits in dashboard don't persist

**Solutions**:

1. **Check file permissions**:
   ```bash
   ls -la shared/overlays/*.md
   ```

2. **Read-only file** - You're editing a generated file. Edit the source overlay instead.

3. **Disk full** - Check available space

### State Not Updating

**Problem**: Dashboard shows stale information

**Solutions**:

1. **Refresh the page** - Simple reload
2. **Use Refresh Snapshot** - Non-destructive re-discovery of the current machine state

3. **Manually re-run bootstrap**:
   ```bash
   ./scripts/bootstrap-home.sh
   ```

3. **Restart dashboard server**

## systemd Service Issues

### Service Won't Start

**Problem**: `systemctl --user start agent-rules-hub-dashboard` fails

**Solutions**:

1. **Reinstall the service from the helper**:
   ```bash
   ./scripts/install-dashboard-service.sh
   ```

2. **Reload systemd**:
   ```bash
   systemctl --user daemon-reload
   ```

3. **Check journal logs**:
   ```bash
   journalctl --user -u agent-rules-hub-dashboard -n 50
   ```

### Service Not Persisting After Reboot

**Problem**: Dashboard not running after system restart

**Solutions**:

1. **Enable service**:
   ```bash
   systemctl --user enable agent-rules-hub-dashboard
   ```

2. **Check user lingering**:
   ```bash
   # For headless systems, enable lingering
   loginctl enable-linger $USER
   ```

3. **Verify environment** - systemd user session may have different PATH/environment

## Runtime Config Issues

### Config Parse Errors

**Problem**: "Config parse error" in dashboard warnings

**Solutions**:

1. **Validate JSONC/JSON**:
   ```bash
   # For Claude
   cat ~/.claude/settings.json | jq .
   # For OpenCode (JSONC)
   cat ~/.config/opencode/opencode.jsonc
   ```

2. **Validate TOML**:
   ```bash
   # For Codex
   cat ~/.codex/config.toml
   # Look for syntax errors
   ```

3. **Fix and reload dashboard**

### Gateway URL Issues

**Problem**: Wrong API gateway configured

**Solution**: Edit the relevant config file and verify URL

```bash
# Claude
nano ~/.claude/settings.json
# Check ANTHROPIC_BASE_URL

# Codex
nano ~/.codex/config.toml
# Check base_url in model_providers section
```

## File System Issues

### Broken Symlinks

**Problem**: `ls -la` shows broken symlinks in home config

**Solutions**:

1. **Re-run bootstrap**:
   ```bash
   ./scripts/bootstrap-home.sh
   ```

2. **Manually fix**:
   ```bash
   # Remove broken link
   rm ~/.codex/AGENTS.md
   # Re-run bootstrap to recreate
   ./scripts/bootstrap-home.sh
   ```

### Permission Denied

**Problem**: Cannot write to config files

**Solutions**:

1. **Check ownership**:
   ```bash
   ls -la ~/.codex/ ~/.claude/ ~/.config/opencode/
   ```

2. **Fix permissions**:
   ```bash
   # Take ownership of your own config directories
   chown -R $USER:$USER ~/.codex ~/.claude ~/.config/opencode
   ```

## Getting Help

If none of these solutions work:

1. **Check GitHub Issues** - https://github.com/obdagli/agent-rules-hub/issues
2. **Create a new issue** with:
   - Your OS and version
   - Node.js version (`node --version`)
   - Output of `./scripts/show-capabilities.sh`
   - Relevant error messages
   - Steps to reproduce

3. **Enable debug logging**:
   ```bash
   # Run dashboard with verbose output
   NODE_DEBUG=* npm run dashboard
   ```

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `warning: ais is not installed` | ai-rules-sync not installed | Optional; install `@ai-rules/cli` only if you want ais registration helpers |
| `warning: bootstrap only wires generated instruction files and local config paths` | Bootstrap intentionally avoids auto-steering external superpowers add-ons | Manage Claude/Gemini/OpenCode add-ons manually if you want them |
| `Invalid TOML` | config.toml has syntax error | Fix TOML syntax |
| `Forbidden` (API 403) | Token mismatch or wrong origin | Refresh page or restart server |
| `Unknown or disallowed file` | Trying to edit non-managed file | Edit only files shown in dashboard Files pane |
| `Home path still points at legacy` | Bootstrap not run or failed | Run `./scripts/bootstrap-home.sh` |
