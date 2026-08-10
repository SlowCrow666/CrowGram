import os

# Папки и расширения, которые нужно пропустить
EXCLUDE_DIRS = {'.git', '__pycache__', 'venv', '.venv', 'build', 'dist', '.idea', '.vscode'}
ALLOWED_EXTENSIONS = {'.py', '.json', '.html', '.css', '.md', '.txt', '.yaml', '.yml', '.env.example'}

OUTPUT_FILE = 'full_project_context.txt'

def pack_project():
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as out:
        out.write("=== СТРУКТУРА ПРОЕКТА ===\n")
        for root, dirs, files in os.walk('.'):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            level = root.replace('.', '').count(os.sep)
            indent = ' ' * 4 * level
            out.write(f"{indent}{os.path.basename(root)}/\n")
            subindent = ' ' * 4 * (level + 1)
            for f in files:
                if any(f.endswith(ext) for ext in ALLOWED_EXTENSIONS):
                    out.write(f"{subindent}{f}\n")
        
        out.write("\n" + "="*50 + "\n\n")

        out.write("=== СОДЕРЖИМОЕ ФАЙЛОВ ===\n\n")
        for root, dirs, files in os.walk('.'):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            for file in files:
                if any(file.endswith(ext) for ext in ALLOWED_EXTENSIONS) and file != OUTPUT_FILE:
                    file_path = os.path.join(root, file)
                    out.write(f"\n--- FILE START: {file_path} ---\n")
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            out.write(f.read())
                    except Exception as e:
                        out.write(f"[Ошибка чтения файла: {e}]\n")
                    out.write(f"\n--- FILE END: {file_path} ---\n")

if __name__ == '__main__':
    pack_project()
    print(f"Готово! Файл сохранен как {OUTPUT_FILE}")