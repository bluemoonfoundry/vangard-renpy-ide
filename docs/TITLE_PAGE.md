---
title: |
  ![](images/logo.png){width=3in}

  **Ren'IDE**
  **User Guide**
subtitle: |
  The Visual IDE for Ren'Py Development

  *See Your Story*
author: Blue Moon Foundry
date: April 2026
version: Version 0.7.1 Public Beta 4
abstract: |
  Welcome to Ren'IDE, the visual development environment designed specifically for Ren'Py visual novel creators. This comprehensive guide covers everything from installation to advanced features, with dedicated sections for writers, artists, and developers.

  Whether you're creating your first visual novel or managing a complex branching narrative with hundreds of scenes, Ren'IDE helps you visualize structure, catch errors early, and streamline your workflow.
keywords: Ren'Py, Visual Novel, IDE, Game Development, Narrative Design, Visual Editor
lang: en-US
documentclass: report
geometry:
  - margin=1in
  - top=1.5in
fontsize: 11pt
linestretch: 1.2
colorlinks: true
linkcolor: blue
urlcolor: blue
toccolor: blue
---

\thispagestyle{empty}

\vspace*{2in}

\begin{center}
\Huge{\textbf{Ren'IDE}}

\LARGE{\textbf{User Guide}}

\vspace{0.5in}

\Large{The Visual IDE for Ren'Py Development}

\vspace{0.3in}

\large{\textit{See Your Story}}

\vspace{1in}

\large{Version 0.7.1 Public Beta 4}

\vspace{0.3in}

\normalsize{April 2026}

\vspace{0.5in}

\normalsize{Blue Moon Foundry}
\end{center}

\vfill

\begin{center}
\small{
Copyright © 2026 Blue Moon Foundry. All rights reserved.\\
\vspace{0.1in}
\textbf{Website:} \url{https://github.com/bluemoonfoundry/vangard-renpy-ide}\\
\textbf{Support:} \url{https://github.com/bluemoonfoundry/vangard-renpy-ide/issues}\\
\textbf{License:} MIT License
}
\end{center}

\newpage

---

# About This Guide

This user guide provides comprehensive documentation for Ren'IDE (Vangard Ren'Py IDE), covering all features, workflows, and best practices for visual novel development.

## Who Should Read This Guide

- **Writers** creating branching narratives and managing complex storylines
- **Artists** managing assets, composing scenes, and creating visual content
- **Developers** writing code, building systems, and integrating with Ren'Py SDK
- **Solo Creators** wearing multiple hats and managing all aspects of development
- **Teams** collaborating on visual novel projects

## What's Covered

This guide is organized into nine sections:

1. **Introduction** — Understanding Ren'IDE, its purpose, and benefits
2. **Getting Started** — Installation, first launch, and basic setup
3. **Interface Overview** — Complete UI tour and navigation
4. **Core Features Tour** — In-depth look at the three canvas system, editor, diagnostics, and statistics
5. **For Writers** — Narrative visualization, character management, and story flow tools
6. **For Artists** — Asset management, visual composers, and artwork workflows
7. **For Developers** — Advanced code editor, screen builder, and technical integration
8. **Complete Feature Reference** — Quick-reference tables for all features
9. **Appendices** — Shortcuts, troubleshooting, FAQ, glossary, and resources

## Document Conventions

Throughout this guide, we use the following conventions:

- **Bold text** indicates UI elements, buttons, and menu items (e.g., **Settings**, **Save All**)
- `Monospace text` indicates code, file names, and keyboard shortcuts (e.g., `script.rpy`, `Ctrl+S`)
- *Italic text* indicates emphasis or new terms being introduced
- 💡 **Tip:** Helpful hints and best practices
- ⚠️ **Warning:** Important cautions to prevent issues
- 📝 **Note:** Additional information and context

## Getting Help

If you encounter issues or have questions not covered in this guide:

- **GitHub Issues:** [Report bugs or request features](https://github.com/bluemoonfoundry/vangard-renpy-ide/issues)
- **Discussions:** [Join the community discussion](https://github.com/bluemoonfoundry/vangard-renpy-ide/discussions)
- **Ren'Py Community:** [Lemma Soft Forums](https://lemmasoft.renai.us/forums/)

## Feedback

We're continuously improving Ren'IDE and this documentation. If you have suggestions, corrections, or additions:

- Open an issue on GitHub
- Submit a pull request with improvements
- Contact us directly through the project repository

## Acknowledgments

Ren'IDE is built on the shoulders of giants. We thank:

- **The Ren'Py Community** for creating an amazing visual novel engine
- **Open Source Contributors** for the libraries and tools that power Ren'IDE
- **Beta Testers** for their invaluable feedback
- **You** for choosing Ren'IDE for your visual novel development

---

\newpage

# Quick Start Guide

New to Ren'IDE? Here's a 5-minute quick start to get you up and running.

## 1. Install Ren'IDE

**Download the latest release:**
- Visit [GitHub Releases](https://github.com/bluemoonfoundry/vangard-renpy-ide/releases/latest)
- Download the installer for your platform (Windows .exe, macOS .dmg, Linux .AppImage)
- Run the installer and follow the prompts

*Detailed installation instructions are in Section 2: Getting Started*

## 2. Launch and Open a Project

**First launch:**
- Open Ren'IDE from your applications folder or start menu
- You'll see the Welcome Screen
- Click **"Open Existing Project"** to open a Ren'Py project folder
- Or click **"Create New Project"** to start from scratch

## 3. Explore the Interface

**Main areas:**
- **Center:** The Story Canvas showing your `.rpy` files as blocks
- **Left:** Project Explorer with your file tree
- **Right:** Story Elements panel with characters, images, audio, and more
- **Bottom:** Code editor (appears when you open a file)

## 4. Navigate Your Story

**Try these actions:**
- Drag blocks on the canvas to organize them
- Double-click a block to open its file in the editor
- Press **Ctrl+G** (or **Cmd+G** on Mac) to quickly jump to any label
- Switch between **Story**, **Route**, and **Choice** canvas tabs to see different views

## 5. Start Creating

**Common tasks:**
- Press **N** to create a new `.rpy` file
- Right-click an image in the Images tab and select "Copy show statement" to insert it into your code
- Use the Menu Builder (Menus tab) to visually design branching choices
- Check the Diagnostics panel for errors and warnings

---

*Ready to dive deeper? Continue to Section 1: Introduction for a comprehensive overview.*

\newpage
