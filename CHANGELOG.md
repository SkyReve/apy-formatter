# Change Log

All notable changes to the "reve-apy-formatter" extension will be documented in this file.

## [0.3.1] - 2026-01-22

### Added
- **Go to Definition** for functions, classes, and variables in `src/libs`
- **Hover Provider** showing function/method signatures
- **Signature Help** with parameter hints for function calls
- **Real-time Diagnostics** powered by Pylance
- **Runtime Object Support** for `reve`, `logger`, `exceptions`, `Response`
- **Database Table Navigation** - `database["TableName"]` jumps to `tables/TableName.yaml`
- **Bootstrap File Management**
  - Auto-generates `pyrightconfig.json` and `apy_runtime.pyi`
  - Merges with existing config without overwriting user settings
- **Commands**
  - `APY: Initialize Workspace` - Create/update configuration files
  - `APY: Open Virtual Python` - View generated Python for debugging

### Changed
- Replaced custom formatters with Pylance-based IntelliSense
- Extension now requires Python and Pylance extensions (auto-installed)
- Improved auto-completion for `src/libs` modules with full signatures
- Updated README for VS Code Marketplace

### Removed
- Black, Ruff, autopep8 formatter integration (use VS Code Python formatting instead)

---

## [0.2.1] - Initial Release 🎉

### Added
- Code formatting support for:
  - **Black** (`black`)
  - **Ruff** (`ruff`)
  - **autopep8** (`autopep8`)
- Auto completion for:
  - **`reve` global members**
  - **Hidden imports** (e.g., `math`, `datetime`)
- Customizable **formatting settings**.
