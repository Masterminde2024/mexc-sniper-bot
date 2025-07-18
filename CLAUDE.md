# Claude Code Configuration

## Package Manager & Build Commands

**Primary Package Manager: Bun** - Use `bun` for all package management and script execution.

### Make Commands (Preferred)
Use `make` commands for all development tasks. Run `make help` to see all available commands:

**Essential Development Commands:**
- `make install` - Install all dependencies with bun
- `make dev` - Start development servers (Next.js + Inngest)
- `make build` - Build production bundles
- `make test` - Run all tests with performance optimizations
- `make lint` - Run all linters and formatters
- `make type-check` - Run TypeScript type checking

**Quick Aliases:**
- `make i` - Install dependencies
- `make d` - Start development  
- `make b` - Build project
- `make t` - Run tests
- `make l` - Lint code

**Testing Commands:**
- `make test-unit` - Run unit tests
- `make test-integration` - Run integration tests  
- `make test-e2e` - Run E2E tests
- `make test-all` - Run complete test suite
- `make test-quick` - Fast parallel test execution

**Alternative Bun Commands (if make unavailable):**
- `bun run build` - Build the project
- `bun run test` - Run the full test suite
- `bun run lint` - Run ESLint and format checks
- `bun run type-check` - Run TypeScript type checking

### Development Workflow
1. **Setup**: `make install && make setup`
2. **Development**: `make dev` (starts all required servers)
3. **Testing**: `make test` (performance optimized)
4. **Pre-commit**: `make pre-commit` (lint + type-check)
5. **Build**: `make build`

**Always run `vercel build` before git push**
- Keep files under 500 lines of code
  - Remove redundant code
  - Use TypeScript everywhere
  - Type-safe priority
  - Zod validation
  - Clear minimal code
  - Ensure all tests pass and project compiles without errors
  - Create files in TDD flow (test first, fail, implement, pass)
  - Write conventional commits
## Claude-Flow Complete Command Reference

Claude-Flow Complete Command Reference
Core System Commands
./claude-flow start [--ui] [--port 3000] [--host localhost]: Start orchestration system with optional web UI
./claude-flow status: Show comprehensive system status
./claude-flow monitor: Real-time system monitoring dashboard
./claude-flow config <subcommand>: Configuration management (show, get, set, init, validate)
Agent Management
./claude-flow agent spawn <type> [--name <name>]: Create AI agents (researcher, coder, analyst, etc.)
./claude-flow agent list: List all active agents
./claude-flow spawn <type>: Quick agent spawning (alias for agent spawn)
Task Orchestration
./claude-flow task create <type> [description]: Create and manage tasks
./claude-flow task list: View active task queue
./claude-flow workflow <file>: Execute workflow automation files
Memory Management
./claude-flow memory store <key> <data>: Store persistent data across sessions
./claude-flow memory get <key>: Retrieve stored information
./claude-flow memory list: List all memory keys
./claude-flow memory export <file>: Export memory to file
./claude-flow memory import <file>: Import memory from file
./claude-flow memory stats: Memory usage statistics
./claude-flow memory cleanup: Clean unused memory entries
SPARC Development Modes
./claude-flow sparc "<task>": Run orchestrator mode (default)
./claude-flow sparc run <mode> "<task>": Run specific SPARC mode
./claude-flow sparc tdd "<feature>": Test-driven development mode
./claude-flow sparc modes: List all 17 available SPARC modes
Available SPARC modes: orchestrator, coder, researcher, tdd, architect, reviewer, debugger, tester, analyzer, optimizer, documenter, designer, innovator, swarm-coordinator, memory-manager, batch-executor, workflow-manager

Swarm Coordination
./claude-flow swarm "<objective>" [options]: Multi-agent swarm coordination
--strategy: research, development, analysis, testing, optimization, maintenance
--mode: centralized, distributed, hierarchical, mesh, hybrid
--max-agents <n>: Maximum number of agents (default: 5)
--parallel: Enable parallel execution
--monitor: Real-time monitoring
--output <format>: json, sqlite, csv, html
MCP Server Integration
./claude-flow mcp start [--port 3000] [--host localhost]: Start MCP server
./claude-flow mcp status: Show MCP server status
./claude-flow mcp tools: List available MCP tools
Claude Integration
./claude-flow claude auth: Authenticate with Claude API
./claude-flow claude models: List available Claude models
./claude-flow claude chat: Interactive chat mode
Session Management
./claude-flow session: Manage terminal sessions
./claude-flow repl: Start interactive REPL mode
Enterprise Features
./claude-flow project <subcommand>: Project management (Enterprise)
./claude-flow deploy <subcommand>: Deployment operations (Enterprise)
./claude-flow cloud <subcommand>: Cloud infrastructure management (Enterprise)
./claude-flow security <subcommand>: Security and compliance tools (Enterprise)
./claude-flow analytics <subcommand>: Analytics and insights (Enterprise)
Project Initialization
./claude-flow init: Initialize Claude-Flow project
./claude-flow init --sparc: Initialize with full SPARC development environment
Quick Start Workflows
Research Workflow
# Start a research swarm with distributed coordination
./claude-flow swarm "Research modern web frameworks" --strategy research --mode distributed --parallel --monitor

# Or use SPARC researcher mode for focused research
./claude-flow sparc run researcher "Analyze React vs Vue vs Angular performance characteristics"

# Store findings in memory for later use
./claude-flow memory store "research_findings" "Key insights from framework analysis"
Development Workflow
# Start orchestration system with web UI
./claude-flow start --ui --port 3000

# Run TDD workflow for new feature
./claude-flow sparc tdd "User authentication system with JWT tokens"

# Development swarm for complex projects
./claude-flow swarm "Build e-commerce API with payment integration" --strategy development --mode hierarchical --max-agents 8 --monitor

# Check system status
./claude-flow status
Analysis Workflow
# Analyze codebase performance
./claude-flow sparc run analyzer "Identify performance bottlenecks in current codebase"

# Data analysis swarm
./claude-flow swarm "Analyze user behavior patterns from logs" --strategy analysis --mode mesh --parallel --output sqlite

# Store analysis results
./claude-flow memory store "performance_analysis" "Bottlenecks identified in database queries"
Maintenance Workflow
# System maintenance with safety controls
./claude-flow swarm "Update dependencies and security patches" --strategy maintenance --mode centralized --monitor

# Security review
./claude-flow sparc run reviewer "Security audit of authentication system"

# Export maintenance logs
./claude-flow memory export maintenance_log.json
Integration Patterns
Memory-Driven Coordination
Use Memory to coordinate information across multiple SPARC modes and swarm operations:

# Store architecture decisions
./claude-flow memory store "system_architecture" "Microservices with API Gateway pattern"

# All subsequent operations can reference this decision
./claude-flow sparc run coder "Implement user service based on system_architecture in memory"
./claude-flow sparc run tester "Create integration tests for microservices architecture"
Multi-Stage Development
Coordinate complex development through staged execution:

# Stage 1: Research and planning
./claude-flow sparc run researcher "Research authentication best practices"
./claude-flow sparc run architect "Design authentication system architecture"

# Stage 2: Implementation
./claude-flow sparc tdd "User registration and login functionality"
./claude-flow sparc run coder "Implement JWT token management"

# Stage 3: Testing and deployment
./claude-flow sparc run tester "Comprehensive security testing"
./claude-flow swarm "Deploy authentication system" --strategy maintenance --mode centralized
Enterprise Integration
For enterprise environments with additional tooling:

# Project management integration
./claude-flow project create "authentication-system"
./claude-flow project switch "authentication-system"

# Security compliance
./claude-flow security scan
./claude-flow security audit

# Analytics and monitoring
./claude-flow analytics dashboard
./claude-flow deploy production --monitor
Advanced Batch Tool Patterns
TodoWrite Coordination
Always use TodoWrite for complex task coordination:

TodoWrite([
  {
    id: "architecture_design",
    content: "Design system architecture and component interfaces",
    status: "pending",
    priority: "high",
    dependencies: [],
    estimatedTime: "60min",
    assignedAgent: "architect"
  },
  {
    id: "frontend_development",
    content: "Develop React components and user interface",
    status: "pending",
    priority: "medium",
    dependencies: ["architecture_design"],
    estimatedTime: "120min",
    assignedAgent: "frontend_team"
  }
]);
Task and Memory Integration
Launch coordinated agents with shared memory:

// Store architecture in memory
Task("System Architect", "Design architecture and store specs in Memory");

// Other agents use memory for coordination
Task("Frontend Team", "Develop UI using Memory architecture specs");
Task("Backend Team", "Implement APIs according to Memory specifications");
Code Style Preferences
Use ES modules (import/export) syntax
Destructure imports when possible
Use TypeScript for all new code
Follow existing naming conventions
Add JSDoc comments for public APIs
Use async/await instead of Promise chains
Prefer const/let over var
Workflow Guidelines
Always run typecheck after making code changes
Run tests before committing changes
Use meaningful commit messages
Create feature branches for new functionality
Ensure all tests pass before merging
Important Notes
Use TodoWrite extensively for all complex task coordination
Leverage Task tool for parallel agent execution on independent work
Store all important information in Memory for cross-agent coordination
Use batch file operations whenever reading/writing multiple files
Check .claude/commands/ for detailed command documentation
All swarm operations include automatic batch tool coordination
Monitor progress with TodoRead during long-running operations
Enable parallel execution with --parallel flags for maximum efficiency
This configuration ensures optimal use of Claude Code's batch tools for swarm orchestration and parallel task execution with full Claude-Flow capabilities.

## Memory Bank Integration

**Single Source of Truth**
- The `memory-bank/` directory stores project knowledge in markdown files (`projectbrief.md`, `productContext.md`, `activeContext.md`, `systemPatterns.md`, `techContext.md`, `progress.md`).
- Every agent and developer **MUST** read all memory-bank files at the start of each task/session.

**Update Policy**
1. After implementing any significant code or documentation change.
2. When decisions, patterns, or tech choices evolve.
3. When new issues arise or milestones are completed.
4. Whenever the user explicitly requests a **Memory Bank update**.

Updates should focus especially on `activeContext.md` (current focus/next steps) and `progress.md` (status/known issues).

Automate where possible:
- Use `scripts/pre-task-load-memory.ts` as a Taskmaster pre-task hook to load the Memory Bank into context.
- Add a commit hook that reminds contributors to update relevant Memory Bank files.

---

## Test Accounts
- Test account for ryan@ryanlisse.com (password: Testing2025!)