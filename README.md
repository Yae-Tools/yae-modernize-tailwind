# Yae Modernize Tailwind

A powerful and opinionated CLI tool designed to automate the migration of your Tailwind CSS classes to newer, more efficient, and often more readable conventions. Say goodbye to manual refactoring and hello to streamlined development!

## ✨ Features

*   **Automated Class Migration:** Automatically updates your Tailwind CSS classes based on predefined conversion rules.
*   **Interactive Mode:** Don't know which conversions to run? The interactive mode guides you through available options.
*   **Git Integration:** Ensures your repository is clean before making changes, preventing accidental data loss (can be overridden).
*   **Flexible Path Specification:** Target specific files, directories, or your entire project with glob patterns.
*   **Monorepo Friendly:** Easily integrate into monorepo setups to migrate classes across multiple packages.
*   **Environment Detection:** Smartly detects your project environment (e.g., React, Vue, Svelte) for better context.

## 🚀 Getting Started

To use `yae-tailwind-migrate`, simply run it via `npx` in your project's root directory:

```bash
npx yae-tailwind-migrate [options]
```

### Prerequisites

*   Node.js (v16 or higher recommended)
*   Git (optional, but recommended for safety checks)

## 📖 Usage

### Basic Usage (Interactive Mode)

If you run the tool without specifying conversions, it will enter an interactive mode, prompting you to select the conversions you want to apply:

```bash
npx yae-tailwind-migrate
```

### Specifying Conversions

You can specify one or more conversions directly using the `-c` or `--conversions` flag:

```bash
npx yae-tailwind-migrate -c size -c margin
```

Or for multiple conversions:

```bash
npx yae-tailwind-migrate -c size margin padding
```

### Targeting Specific Files or Directories

Use the `-p` or `--path` flag to specify which files or directories to process. This accepts glob patterns.

```bash
# Process all JS, JSX, TS, TSX, HTML, CSS, and Svelte files in the 'src' directory
npx yae-tailwind-migrate -p "src/**/*.{js,jsx,ts,tsx,html,css,svelte}" -c size

# Process only a specific file
npx yae-tailwind-migrate -p "components/Button.tsx" -c color-opacity
```

The default path is `./**/*.{js,jsx,ts,tsx,html,css,svelte}`, which covers common file types in the current directory.

### Ignoring Git Clean Check

By default, `yae-tailwind-migrate` will prevent execution if your Git repository has uncommitted changes. To override this behavior, use the `--ignore-git` flag:

```bash
npx yae-tailwind-migrate --ignore-git -c gap
```

## 🔄 Supported Conversions

`yae-tailwind-migrate` currently supports the following class conversions:

*   `size`: Migrates older `w-`, `h-` classes to newer, more consistent sizing conventions.
*   `margin`: Converts margin classes (e.g., `m-`, `mx-`, `my-`, `mt-`, `mb-`, `ml-`, `mr-`) to their updated forms.
*   `padding`: Converts padding classes (e.g., `p-`, `px-`, `py-`, `pt-`, `pb-`, `pl-`, `pr-`) to their updated forms.
*   `color-opacity`: Handles migration of color opacity classes (e.g., `bg-opacity-`, `text-opacity-`).
*   `gap`: Updates `gap-` classes for consistency.

## 🤝 Compatibility

To ensure proper functionality and avoid unexpected issues, please note the following Tailwind CSS version requirements for the conversions:

*   **Arbitrary Values**: Support for arbitrary values (e.g., `w-[100px]`, `m-[1rem]`) requires **Tailwind CSS v2.2** or higher in your project.
*   **`size` Utility Classes**: Conversion to `size-` classes (e.g., `size-4`, `size-full`) requires **Tailwind CSS v3.4** or higher in your project.
*   **Other Conversions**: `margin`, `padding`, `color-opacity`, and `gap` conversions are compatible with **Tailwind CSS v2.0** and higher.

## 📦 Monorepo Support

`yae-tailwind-migrate` is designed with monorepos in mind. You can easily target specific packages or your entire monorepo:

```bash
# Convert files in a specific package
npx yae-tailwind-migrate -p "packages/my-ui-library/**/*.{js,jsx,ts,tsx}" -c size

# Convert files across all packages in your monorepo
npx yae-tailwind-migrate -p "packages/**/*.{js,jsx,ts,tsx,html,css,svelte}" -c margin padding
```

## 🤝 Contributing

Contributions are welcome! If you have a new conversion idea, find a bug, or want to improve the tool, please feel free to open an issue or submit a pull request.

## 📄 License

This project is licensed under the MIT License.
