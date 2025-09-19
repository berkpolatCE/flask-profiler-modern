## Contributing Guide

Thanks for helping keep Flask-Profiler healthy! This fork is actively maintained by Berk Polat; the notes below describe the expected workflow.

### Making Changes

1. Fork the repository and clone your fork locally.
2. Create a topic branch from `master` (e.g. `git checkout -b feature/my-fix`). Avoid committing directly to `master`.
3. Make focused commits with clear messages. Reference issues where relevant (e.g. `Fixes #15`).
4. Ensure Python code follows [PEP 8](https://www.python.org/dev/peps/pep-0008/) and JavaScript changes respect the existing style.
5. Keep the automated suite happy:
   * Backend: `source .venv/bin/activate && pytest`
   * Frontend (when touching `flask_profiler/static/src/`): `cd flask_profiler/static && npm install && npm run build`
6. Verify that Vite-produced assets (`static/dist/`) are rebuilt if you touched frontend code.
7. Run `git diff --check` to catch stray whitespace before committing.

### Submitting Changes

1. Push your topic branch to your fork.
2. Open a Pull Request against `master` on [berkpolatCE/flask-profiler-modern](https://github.com/berkpolatCE/flask-profiler-modern).
3. Fill in the PR template, call out any manual testing, and wait for maintainer review.

### Where to Start?

Check the [issue tracker](https://github.com/berkpolatCE/flask-profiler-modern/issues) for open items or enhancement ideas. Documentation improvements, example applications, and additional tests are always welcome. If you notice something unclear in the README or docs, submit a PR!

For a refresher on collaborative branching strategies, this post is helpful: http://nvie.com/posts/a-successful-git-branching-model
