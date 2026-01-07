# MCP Smoke Test Results
**Date:** 2026-01-07  
**Agent:** GitHub Copilot Agent  
**Issue:** MCP smoke test: Supabase + Vercel + Context7 integrations

## Executive Summary

This smoke test validates the configuration and usability of three MCP (Model Context Protocol) integrations:
- **Context7 MCP** ✅ Partially configured (tools available but API key missing)
- **Supabase MCP** ❌ Not configured (secrets exist but MCP server not in config)
- **Vercel MCP** ❌ Not configured (secrets exist but MCP server not in config)

---

## 1. MCP Server Start Verification

### MCP Configuration Location
- **Config File:** `/home/runner/work/_temp/mcp-server/mcp-config.json`
- **Total MCP Tools:** 51

### Available MCP Servers
The following MCP servers are configured and available:
1. ✅ **github-mcp-server** (45 tools) - GitHub operations
2. ✅ **context7** (2 tools) - Documentation lookup
3. ✅ **playwright** (4 tools) - Browser automation

### Missing MCP Servers
1. ❌ **Supabase MCP Server** - Not found in mcp-config.json
2. ❌ **Vercel MCP Server** - Not found in mcp-config.json

### Environment Secrets Status
**Configured Secrets (from COPILOT_AGENT_INJECTED_SECRET_NAMES):**
- ✅ `COPILOT_MCP_SUPABASE_ACCESS_TOKEN`
- ✅ `COPILOT_MCP_SUPABASE_PROJECT_REF`
- ✅ `COPILOT_MCP_VERCEL_ACCESS_TOKEN`

**Missing Secrets:**
- ❌ `COPILOT_MCP_CONTEXT7_API_KEY` (not found in environment)

---

## 2. Context7 Tool Check

### Test: Fetch Documentation

**Test 1: Supabase MCP Server Documentation**
```
Query: "Supabase MCP server usage / auth"
Result: ❌ FAILED
Error: "Invalid API key. Please check your API key. API keys should start with 'ctx7sk' prefix."
```

**Test 2: Vercel MCP Server Documentation**
```
Query: "Vercel MCP server usage / auth"
Result: ❌ FAILED
Error: "Invalid API key. Please check your API key. API keys should start with 'ctx7sk' prefix."
```

### Analysis
- Context7 MCP tools are registered (`context7/query-docs`, `context7/resolve-library-id`)
- API authentication is failing due to missing or invalid `COPILOT_MCP_CONTEXT7_API_KEY`
- The secret needs to be added to the repository Copilot environment with a valid API key starting with `ctx7sk` prefix

---

## 3. Supabase MCP Smoke Test

### Status: ❌ NOT CONFIGURED

**Issue:** Supabase MCP server is not present in the MCP configuration file.

**Evidence:**
- Searched mcp-config.json for "supabase" (case-insensitive): 0 matches
- Only github-mcp-server, context7, and playwright are configured

**Secrets Available:**
- ✅ `COPILOT_MCP_SUPABASE_ACCESS_TOKEN` (exists)
- ✅ `COPILOT_MCP_SUPABASE_PROJECT_REF` (exists)

**Could Not Test:**
- List projects
- List tables
- Describe schema
- Any read-only operations

---

## 4. Vercel MCP Smoke Test

### Status: ❌ NOT CONFIGURED

**Issue:** Vercel MCP server is not present in the MCP configuration file.

**Evidence:**
- Searched mcp-config.json for "vercel" (case-insensitive): 0 matches
- Only github-mcp-server, context7, and playwright are configured

**Secrets Available:**
- ✅ `COPILOT_MCP_VERCEL_ACCESS_TOKEN` (exists)

**Could Not Test:**
- List projects
- List deployments (most recent 5)
- Any read-only operations

---

## 5. Summary & Remediation

### Status by Integration

| Integration | MCP Server | Secrets | Functional | Notes |
|------------|-----------|---------|-----------|-------|
| **Context7** | ✅ Configured | ❌ Missing | ❌ Not Working | API key missing/invalid |
| **Supabase** | ❌ Not Configured | ✅ Present | ❌ Cannot Test | MCP server not added to config |
| **Vercel** | ❌ Not Configured | ✅ Present | ❌ Cannot Test | MCP server not added to config |

### Exact Fixes Needed

#### 1. Context7 MCP - Add API Key
**Issue:** Missing `COPILOT_MCP_CONTEXT7_API_KEY` environment secret  
**Fix:**
1. Obtain a valid Context7 API key (starts with `ctx7sk` prefix)
2. Add secret to repository: Settings → Copilot → Environment secrets
3. Secret name: `COPILOT_MCP_CONTEXT7_API_KEY`
4. Secret value: Your Context7 API key

#### 2. Supabase MCP - Add Server Configuration
**Issue:** Supabase MCP server not in mcp-config.json  
**Fix:**
1. Navigate to: Repository Settings → Copilot → Coding agent → MCP configuration
2. Add Supabase MCP server configuration with the following structure:
   ```json
   {
     "command": "npx",
     "args": ["-y", "@modelcontextprotocol/server-supabase"],
     "env": {
       "SUPABASE_ACCESS_TOKEN": "${COPILOT_MCP_SUPABASE_ACCESS_TOKEN}",
       "SUPABASE_PROJECT_REF": "${COPILOT_MCP_SUPABASE_PROJECT_REF}"
     }
   }
   ```
3. Verify the secrets are correctly mapped

#### 3. Vercel MCP - Add Server Configuration
**Issue:** Vercel MCP server not in mcp-config.json  
**Fix:**
1. Navigate to: Repository Settings → Copilot → Coding agent → MCP configuration
2. Add Vercel MCP server configuration with the following structure:
   ```json
   {
     "command": "npx",
     "args": ["-y", "@modelcontextprotocol/server-vercel"],
     "env": {
       "VERCEL_ACCESS_TOKEN": "${COPILOT_MCP_VERCEL_ACCESS_TOKEN}"
     }
   }
   ```
3. Verify the secret is correctly mapped

### Auth / Permission Issues
- **Context7:** Invalid/missing API key
- **Supabase:** Cannot verify - MCP server not configured
- **Vercel:** Cannot verify - MCP server not configured

### Next Steps
1. Add `COPILOT_MCP_CONTEXT7_API_KEY` secret to repository
2. Add Supabase MCP server to MCP configuration
3. Add Vercel MCP server to MCP configuration
4. Re-run this smoke test to verify all integrations work correctly

---

## Appendix: MCP Configuration Details

### Currently Configured MCP Servers

**GitHub MCP Server:** 45 tools for repository operations
- Actions (workflows, runs, jobs, artifacts)
- Code scanning alerts
- Commits, branches, tags
- File contents
- Issues and pull requests
- Releases
- Search (code, issues, PRs, repositories, users)
- Secret scanning alerts

**Context7:** 2 tools for documentation
- `context7/resolve-library-id` - Resolve package names to library IDs
- `context7/query-docs` - Query documentation for libraries

**Playwright:** 4 tools for browser automation
- Browser control
- Console messages
- Network requests
- Screenshots and snapshots

### Test Environment
- **Runner:** ubuntu-latest
- **Node.js:** 20.x
- **MCP Config Path:** /home/runner/work/_temp/mcp-server/mcp-config.json
- **Repository:** InsightsLog/Insights
