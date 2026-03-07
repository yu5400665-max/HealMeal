import os
import subprocess
import sys


def run(command: list[str], env: dict[str, str]) -> None:
    print(f"[app.py] running: {' '.join(command)}", flush=True)
    subprocess.check_call(command, env=env)


def main() -> None:
    env = os.environ.copy()
    env["HOSTNAME"] = "0.0.0.0"
    env["PORT"] = "7860"
    run(["npm", "run", "start"], env)


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as exc:
        print(f"[app.py] process failed with code {exc.returncode}", flush=True)
        sys.exit(exc.returncode)
