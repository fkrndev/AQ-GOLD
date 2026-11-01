"""Local judge for `maintkit verify`.

The criteria runner (tests/hidden/run_criteria.py) grades the judged
criteria of tests/grader/rubric.toml by starting a judge with a kit directory
it wrote (criteria.toml and prompt.md). On the platform that judge is the
platform's own runtime; on your machine it is this script, which asks the
chat-completions endpoint you name for each criterion and writes the results
where the runner reads them.

Each criterion is a yes/no question: yes is 1, no is 0. The platform asks
each question once; with more samples a criterion's value is their median
(the lower one with an even count, as on the platform).

    python3 judge.py <kit dir> --workspace <dir> --output <reward.json>

Settings come from the environment the runner hands over:
  GRADER_JUDGE_BASE_URL  the endpoint (.../v1); /chat/completions is appended
  GRADER_JUDGE_KEY       its key, sent as a bearer token
  and the model is the kit's [judge] judge value (MAINTKIT_JUDGE_MODEL).

A local score is an estimate: the platform's judge decides on submit. This
judge does not run the check for text addressed to the evaluator.
Standard library only, so it runs on whatever python3 the image has.
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

def answer_rules():
    return ("Answer with one JSON object and nothing else:\n"
            '{"score": "yes" or "no", "reasoning": "one or two sentences"}\n'
            '"yes" means the change meets the criterion; "no" means it does not.')


def parse_value(text):
    text = text.strip()
    if text.startswith('"'):
        return json.loads(text)
    if text.startswith("["):
        return json.loads(text)
    if text in ("true", "false"):
        return text == "true"
    try:
        return int(text)
    except ValueError:
        return float(text)


def parse_kit(text):
    """The subset of TOML run_criteria.py writes: a [judge] table and
    [[criterion]] tables of key = value lines, where a value is a JSON-style
    string, a number, a boolean, a list of strings, or a '''multi-line'''
    string."""
    judge, criteria, current = {}, [], None
    lines = text.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        i += 1
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped == "[judge]":
            current = judge
            continue
        if stripped == "[[criterion]]":
            current = {}
            criteria.append(current)
            continue
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$", stripped)
        if not m or current is None:
            raise ValueError("unreadable kit line: " + stripped[:80])
        key, raw = m.group(1), m.group(2)
        if raw.startswith("'''"):
            body = raw[3:]
            parts = []
            if body.endswith("'''") and body != "":
                parts.append(body[:-3])
            else:
                if body:
                    parts.append(body)
                while i < len(lines):
                    nxt = lines[i]
                    i += 1
                    if nxt.endswith("'''"):
                        parts.append(nxt[:-3])
                        break
                    parts.append(nxt)
                else:
                    raise ValueError("unterminated multi-line string for " + key)
            value = "\n".join(parts)
            if value.startswith("\n"):
                value = value[1:]
            current[key] = value
        else:
            current[key] = parse_value(raw)
    return judge, criteria


def read_inputs(paths):
    parts = []
    for path in paths:
        try:
            with open(path, encoding="utf-8", errors="replace") as fh:
                parts.append("## " + os.path.basename(path) + "\n" + fh.read())
        except OSError:
            parts.append("## " + os.path.basename(path) + "\n(missing)")
    return "\n\n".join(parts)


def ask(base, key, model, system, user, timeout, effort):
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    if effort:
        body["reasoning_effort"] = effort
    request = urllib.request.Request(
        base.rstrip("/") + "/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + key},
        method="POST",
    )
    last = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            content = payload["choices"][0]["message"]["content"] or ""
            found = re.search(r"\{.*\}", content, re.S)
            if not found:
                raise ValueError("the answer held no JSON object")
            answer = json.loads(found.group(0))
            score = str(answer.get("score") or "").strip().lower()
            if score not in ("yes", "no"):
                raise ValueError('the answer\'s score is not "yes" or "no"')
            return (1.0 if score == "yes" else 0.0), str(answer.get("reasoning") or "")
        except urllib.error.HTTPError as exc:
            last = "the endpoint answered HTTP %d" % exc.code
            if exc.code < 500 and exc.code != 429:
                break
        except Exception as exc:  # noqa: BLE001 - every failure is reported, then retried
            last = str(exc)[:200]
        time.sleep(2 * (attempt + 1))
    raise RuntimeError(last or "the judge call failed")


def median(values):
    """the platform judge's rule: the lower median"""
    ordered = sorted(values)
    return ordered[(len(ordered) - 1) // 2]


def main(argv):
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    kit_dir = argv[0]
    output = None
    if "--output" in argv:
        output = argv[argv.index("--output") + 1]
    if not output:
        print("usage: judge.py <kit dir> --output <reward.json>", file=sys.stderr)
        return 2
    base = (os.environ.get("GRADER_JUDGE_BASE_URL") or "").strip()
    key = os.environ.get("GRADER_JUDGE_KEY") or ""
    if not base:
        raise RuntimeError("GRADER_JUDGE_BASE_URL is not set: name your chat-completions endpoint")
    with open(os.path.join(kit_dir, "criteria.toml"), encoding="utf-8") as fh:
        judge, criteria = parse_kit(fh.read())
    with open(os.path.join(kit_dir, "prompt.md"), encoding="utf-8") as fh:
        template = fh.read()
    user = "<submission>\n" + read_inputs(judge.get("files") or []) + "\n</submission>"
    samples = max(1, int(judge.get("samples") or 1))
    timeout = max(30, int(judge.get("timeout") or 300))
    rows = []
    for c in criteria:
        if c.get("type") != "binary":
            raise RuntimeError("criterion %s is not a yes/no criterion" % c.get("id"))
        text = "Criterion " + str(c.get("id")) + ":\n" + str(c.get("description") or "") + "\n\n" + answer_rules() + "\n"
        system = template.replace("{criteria}", text)
        values, reasons, errors = [], [], []
        for _ in range(samples):
            try:
                value, reasoning = ask(base, key, str(judge.get("judge") or ""), system, user, timeout,
                                       judge.get("reasoning_effort"))
                values.append(value)
                reasons.append(reasoning)
            except RuntimeError as exc:
                errors.append(str(exc).replace(key, "[redacted]") if key else str(exc))
        if errors:
            rows.append({"id": c.get("id"), "name": c.get("id"), "error": errors[0]})
            continue
        rows.append({"id": c.get("id"), "name": c.get("id"), "value": median(values), "reasoning": reasons[0],
                     "samples": ["yes" if v else "no" for v in values]})
    details = {"criteria": rows, "guard": {"flagged": False}, "usage": {}}
    out_dir = os.path.dirname(os.path.abspath(output))
    with open(os.path.join(out_dir, "reward-details.json"), "w", encoding="utf-8") as fh:
        json.dump(details, fh)
    scored = [r["value"] for r in rows if "value" in r]
    with open(output, "w", encoding="utf-8") as fh:
        json.dump({"reward": (sum(scored) / len(scored)) if scored else 0.0}, fh)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except Exception as exc:  # noqa: BLE001 - the runner reads the last error line
        print("JudgeError: " + str(exc)[:300], file=sys.stderr)
        sys.exit(1)
