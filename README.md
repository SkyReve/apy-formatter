# Reve APY Formatter

> Full IntelliSense for Applicable Python (APY) files — auto-completion, go-to-definition, hover, signature help, and real-time diagnostics.

[![VS Code](https://img.shields.io/badge/VS%20Code-1.86+-blue.svg)](https://code.visualstudio.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## ✨ Features

| Feature              | Description                                                            |
| -------------------- | ---------------------------------------------------------------------- |
| **Auto-Completion**  | Smart suggestions for modules, functions, classes, and runtime objects |
| **Go to Definition** | Jump to source with `Ctrl+Click` or `F12`                              |
| **Hover Info**       | View function signatures on mouse hover                                |
| **Signature Help**   | Parameter hints while typing function calls                            |
| **Diagnostics**      | Real-time syntax and type errors powered by Pylance                    |

## 🚀 Quick Start

1. **Install** the extension from VS Code Marketplace
2. **Open** a folder containing `.apy` files
3. **Done!** IntelliSense works automatically

The extension will prompt you to create configuration files for optimal experience.

## 📁 Supported Project Structure

```
your-project/
├── src/
│   ├── apis/          # API endpoint files (*.apy)
│   ├── libs/          # Shared library modules (*.apy, *.py)
│   └── tables/        # Table definitions (*.yaml)
├── pyrightconfig.json # Auto-generated
└── apy_runtime.pyi    # Auto-generated
```

## ⚙️ Commands

| Command                     | Description                                  |
| --------------------------- | -------------------------------------------- |
| `APY: Initialize Workspace` | Create or update configuration files         |
| `APY: Open Virtual Python`  | View the generated Python file for debugging |

## 🔧 Settings

| Setting                    | Default  | Description                                                              |
| -------------------------- | -------- | ------------------------------------------------------------------------ |
| `apy.bootstrap.promptMode` | `always` | When to prompt for missing config files (`always`, `onMissing`, `never`) |

## 🐛 Issues & Feedback

Found a bug or have a feature request?  
Please report on [GitHub Issues](https://github.com/SkyReve/apy-formatter/issues).

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.
