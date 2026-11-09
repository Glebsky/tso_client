# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

This project acts as a portable desktop client for "The Settlers Online".

- **Client Wrapper (`client/`)**: A C# WPF Windows application that serves as the container and launcher. It orchestrates the game runtime.
- **Core Assets (`client/files/content/`)**: Contains the game resources, Adobe AIR runtime environment, and ActionScript/SWF files that drive the actual gameplay.
- **Game Library (`library/`)**: Defines ActionScript 3 base classes, communication VOs, and models, providing interfaces for the JavaScript scripts to interact with the game.
- **Userscripts (`userscripts/`, `client/files/content/scripts/`)**: These are JavaScript files that enhance game functionality by interacting with the underlying game library/engine functionality exposed through the Adobe AIR environment.

## Common Tasks

### Building
The project is built using MSBuild.

```bash
# Build the client solution
msbuild client.sln /p:Configuration=Release
```

### Development Workflow
Development typically involves:
1.  **C# Wrapper Development**: Modifying code in `client/`. Requires rebuilding the solution with the command above.
2.  **Script Development**: Modifying JS files in `client/files/content/scripts/` or `userscripts/`. These changes generally take effect upon reloading or restarting the client application.
3.  **Testing**: Run the compiled `client/files/content/client.exe` (or `client64.exe`) to observe changes within the game environment.

## Guidelines for Claude
- **Scripts**: 
  - Always audit existing `userscripts/` before creating new ones. Many scripts, such as `user_buffenhancer.js`, `user_drunken_miner.js`, and `user_spec_auto.js`, serve as reliable models for engine interaction.
  - Prioritize refactoring, extending, or modularizing existing scripts over creating redundant new files.
  - Ensure interaction with the game library (`library/`) adheres to existing patterns found in `userscripts/`.
- **Testing**: After any change to `client/` or scripts, retest using `client.exe` to ensure the game still launches correctly.
- **Documentation**: If adding new helper functions in `library/`, update this `CLAUDE.md`'s architecture section if necessary.
