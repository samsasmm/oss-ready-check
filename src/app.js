const checks = [
  {
    id: "readme",
    title: "README exists and has substance",
    weight: 14,
    category: "Documentation",
    help: "Detected when the repository has a README with enough content to explain the project.",
    suggestion:
      "Add or expand README.md with purpose, target users, usage steps, screenshots, and maintenance notes.",
    auto: true,
  },
  {
    id: "license",
    title: "Open source license",
    weight: 12,
    category: "Trust",
    help: "Detected from GitHub license metadata or common LICENSE file names.",
    suggestion:
      "Add a LICENSE file so others know what they are allowed to do with the project.",
    auto: true,
  },
  {
    id: "description",
    title: "Repository description",
    weight: 8,
    category: "Clarity",
    help: "Detected when the GitHub repository has a meaningful short description.",
    suggestion:
      "Add a short GitHub repository description that says what the project does and who it helps.",
    auto: true,
  },
  {
    id: "usage",
    title: "Usage or install instructions",
    weight: 10,
    category: "Adoption",
    help: "Detected from README terms such as install, usage, getting started, quick start, or try it.",
    suggestion:
      "Add exact setup or usage steps, including where to run commands and what success looks like.",
    auto: true,
  },
  {
    id: "demo",
    title: "Screenshot, demo, or homepage",
    weight: 8,
    category: "Adoption",
    help: "Detected from repository homepage, README images, demo links, or screenshot references.",
    suggestion:
      "Add a screenshot, live demo, GIF, or sample output so visitors can quickly understand the project.",
    auto: true,
  },
  {
    id: "issues",
    title: "Issue templates",
    weight: 8,
    category: "Maintenance",
    help: "Detected from .github/ISSUE_TEMPLATE files.",
    suggestion:
      "Add bug report and feature request templates so users provide useful information.",
    auto: true,
  },
  {
    id: "contributing",
    title: "Contribution guide",
    weight: 8,
    category: "Maintenance",
    help: "Detected from CONTRIBUTING.md or .github/CONTRIBUTING.md.",
    suggestion:
      "Add CONTRIBUTING.md with good first contribution ideas, project principles, and verification steps.",
    auto: true,
  },
  {
    id: "roadmap",
    title: "Roadmap or maintenance backlog",
    weight: 8,
    category: "Maintenance",
    help: "Detected from ROADMAP.md, docs backlog files, or README roadmap sections.",
    suggestion:
      "Add a short roadmap or maintenance backlog with realistic next releases.",
    auto: true,
  },
  {
    id: "changelog",
    title: "Changelog or release notes",
    weight: 7,
    category: "Release",
    help: "Detected from CHANGELOG.md or release-note wording in documentation.",
    suggestion:
      "Add CHANGELOG.md and update it when each release is prepared.",
    auto: true,
  },
  {
    id: "automation",
    title: "Workflow or verification automation",
    weight: 7,
    category: "Release",
    help: "Detected from GitHub Actions workflows.",
    suggestion:
      "Add a small GitHub Actions workflow for Pages deployment, tests, or basic verification.",
    auto: true,
  },
  {
    id: "activity",
    title: "Recent maintenance activity",
    weight: 7,
    category: "Maintenance",
    help: "Detected from the repository's recent push timestamp.",
    suggestion:
      "Keep the project active with small releases, documentation updates, or issue triage.",
    auto: true,
  },
  {
    id: "scope",
    title: "Small, realistic scope",
    weight: 3,
    category: "Judgment",
    help: "This remains a manual judgment because automation cannot reliably infer project ambition.",
    suggestion:
      "Keep the first release focused on one useful workflow. Move larger ideas into the roadmap.",
    auto: false,
  },
];

const state = {
  owner: "",
  repo: "",
  repoUrl: "",
  selected: new Set(),
  detected: new Map(),
  manualOverrides: new Set(),
  lastScan: null,
};

const checklist = document.querySelector("#checklist");
const score = document.querySelector("#score");
const scoreLabel = document.querySelector("#scoreLabel");
const meterFill = document.querySelector("#meterFill");
const suggestions = document.querySelector("#suggestions");
const report = document.querySelector("#report");
const copyButton = document.querySelector("#copyButton");
const copyStatus = document.querySelector("#copyStatus");
const resetButton = document.querySelector("#resetButton");
const repoUrlInput = document.querySelector("#repoUrl");
const projectType = document.querySelector("#projectType");
const scanButton = document.querySelector("#scanButton");
const scanStatus = document.querySelector("#scanStatus");
const scanSummary = document.querySelector("#scanSummary");

function parseGitHubRepoUrl(value) {
  const cleaned = value.trim();
  const match = cleaned.match(
    /^(?:https?:\/\/github\.com\/)?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:\/.*)?$/,
  );

  if (!match) return null;

  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ""),
    url: `https://github.com/${match[1]}/${match[2].replace(/\.git$/, "")}`,
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    const message = response.status === 404
      ? "Repository or file not found."
      : `GitHub API returned ${response.status}.`;
    throw new Error(message);
  }

  return response.json();
}

async function fetchContent(owner, repo, path) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return fetchJson(`https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`);
}

async function existsAny(owner, repo, paths) {
  for (const path of paths) {
    try {
      await fetchContent(owner, repo, path);
      return { found: true, path };
    } catch {
      // Try the next common path.
    }
  }
  return { found: false, path: "" };
}

async function readTextFile(owner, repo, paths) {
  for (const path of paths) {
    try {
      const file = await fetchContent(owner, repo, path);
      if (Array.isArray(file) || !file.content) continue;
      const decoded = atob(file.content.replace(/\n/g, ""));
      return { found: true, path, text: decoded };
    } catch {
      // Try the next common path.
    }
  }
  return { found: false, path: "", text: "" };
}

function containsAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function daysSince(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

function markDetection(results, id, passed, evidence) {
  results.set(id, {
    passed,
    evidence,
  });
}

async function scanRepository(owner, repo) {
  const repoData = await fetchJson(`https://api.github.com/repos/${owner}/${repo}`);
  const results = new Map();
  const readme = await readTextFile(owner, repo, [
    "README.md",
    "readme.md",
    "README",
    "docs/README.md",
  ]);

  const readmeText = readme.text || "";
  const readmeLower = readmeText.toLowerCase();

  markDetection(
    results,
    "readme",
    readme.found && readmeText.trim().length >= 400,
    readme.found
      ? `${readme.path} found with ${readmeText.trim().length} characters.`
      : "README file was not found.",
  );

  const license = repoData.license?.spdx_id
    ? { found: true, path: repoData.license.spdx_id }
    : await existsAny(owner, repo, ["LICENSE", "LICENSE.md", "COPYING"]);
  markDetection(
    results,
    "license",
    license.found,
    license.found ? `License detected: ${license.path}.` : "No license file detected.",
  );

  markDetection(
    results,
    "description",
    Boolean(repoData.description && repoData.description.trim().length >= 24),
    repoData.description
      ? `Description: ${repoData.description}`
      : "No repository description detected.",
  );

  markDetection(
    results,
    "usage",
    readme.found &&
      containsAny(readmeLower, [
        /install/,
        /usage/,
        /getting started/,
        /quick start/,
        /try it/,
        /run/,
        /open .*browser/,
      ]),
    readme.found
      ? "README checked for usage, install, run, and getting-started wording."
      : "README not available for usage scan.",
  );

  markDetection(
    results,
    "demo",
    Boolean(repoData.homepage) ||
      containsAny(readmeLower, [
        /!\[[^\]]*]/,
        /screenshot/,
        /demo/,
        /github\.io/,
        /live demo/,
        /sample output/,
      ]),
    repoData.homepage
      ? `Homepage detected: ${repoData.homepage}`
      : "README checked for screenshots, demo links, and sample output.",
  );

  const issueTemplates = await existsAny(owner, repo, [
    ".github/ISSUE_TEMPLATE",
    ".github/ISSUE_TEMPLATE/bug_report.md",
    ".github/ISSUE_TEMPLATE/feature_request.md",
  ]);
  markDetection(
    results,
    "issues",
    issueTemplates.found,
    issueTemplates.found
      ? `Issue template path detected: ${issueTemplates.path}.`
      : "No issue template path detected.",
  );

  const contributing = await existsAny(owner, repo, [
    "CONTRIBUTING.md",
    ".github/CONTRIBUTING.md",
    "docs/CONTRIBUTING.md",
  ]);
  markDetection(
    results,
    "contributing",
    contributing.found,
    contributing.found
      ? `Contribution guide detected: ${contributing.path}.`
      : "No contribution guide detected.",
  );

  const roadmap = await existsAny(owner, repo, [
    "ROADMAP.md",
    "docs/roadmap.md",
    "docs/maintenance-backlog.md",
    "BACKLOG.md",
  ]);
  markDetection(
    results,
    "roadmap",
    roadmap.found || containsAny(readmeLower, [/roadmap/, /planned/, /next release/]),
    roadmap.found
      ? `Roadmap or backlog detected: ${roadmap.path}.`
      : "README checked for roadmap language.",
  );

  const changelog = await existsAny(owner, repo, [
    "CHANGELOG.md",
    "HISTORY.md",
    "RELEASES.md",
  ]);
  markDetection(
    results,
    "changelog",
    changelog.found || containsAny(readmeLower, [/changelog/, /release notes/]),
    changelog.found
      ? `Changelog detected: ${changelog.path}.`
      : "README checked for changelog and release-note language.",
  );

  const workflows = await existsAny(owner, repo, [
    ".github/workflows",
    ".github/workflows/pages.yml",
    ".github/workflows/ci.yml",
  ]);
  markDetection(
    results,
    "automation",
    workflows.found,
    workflows.found
      ? `Workflow path detected: ${workflows.path}.`
      : "No GitHub Actions workflow detected.",
  );

  const lastPushDays = daysSince(repoData.pushed_at);
  markDetection(
    results,
    "activity",
    lastPushDays <= 90,
    Number.isFinite(lastPushDays)
      ? `Last push was ${lastPushDays} day(s) ago.`
      : "Could not read recent push date.",
  );

  return {
    repoData,
    readme,
    results,
  };
}

function currentSelectedIds() {
  return checks
    .filter((item) => {
      if (item.auto && state.detected.has(item.id)) {
        return state.detected.get(item.id).passed;
      }
      return state.manualOverrides.has(item.id);
    })
    .map((item) => item.id);
}

function getScore(selected) {
  return checks
    .filter((item) => selected.includes(item.id))
    .reduce((total, item) => total + item.weight, 0);
}

function labelForScore(value) {
  if (value >= 85) return "Strong readiness. This repository is close to public-release quality.";
  if (value >= 65) return "Good foundation. A few missing signals still reduce trust or maintainability.";
  if (value >= 40) return "Promising start. Focus on documentation, usage, and maintenance basics.";
  if (value > 0) return "Early stage. Add the basics before inviting users or contributors.";
  return "Scan a public GitHub repository to start.";
}

function renderChecklist() {
  const selected = new Set(currentSelectedIds());
  checklist.innerHTML = checks
    .map((item) => {
      const detection = state.detected.get(item.id);
      const checked = selected.has(item.id);
      const statusClass = detection
        ? detection.passed
          ? "passed"
          : "missing"
        : item.auto
          ? "unknown"
          : "manual";
      const statusText = detection
        ? detection.passed
          ? "Detected"
          : "Missing"
        : item.auto
          ? "Not scanned"
          : "Manual";
      const disabled = item.auto && detection ? "disabled" : "";

      return `
        <label class="check-item ${statusClass}" for="${item.id}">
          <input id="${item.id}" type="checkbox" data-id="${item.id}" ${checked ? "checked" : ""} ${disabled} />
          <span>
            <span class="check-title">${item.title}</span>
            <p class="check-help">${item.help}</p>
            <span class="evidence">${detection?.evidence || item.suggestion}</span>
          </span>
          <span class="weight">${item.weight} pts</span>
          <span class="status-pill">${statusText}</span>
        </label>
      `;
    })
    .join("");
}

function buildReport(selected, value) {
  const repoName = state.owner && state.repo
    ? `${state.owner}/${state.repo}`
    : repoUrlInput.value.trim() || "Unscanned repository";
  const type = projectType.options[projectType.selectedIndex].text;
  const complete = checks.filter((item) => selected.includes(item.id));
  const missing = checks.filter((item) => !selected.includes(item.id));

  const completeLines = complete.length
    ? complete.map((item) => `- ${item.title}`).join("\n")
    : "- No completed signals detected yet.";

  const missingLines = missing.length
    ? missing
        .map((item) => {
          const detection = state.detected.get(item.id);
          const evidence = detection?.evidence ? ` Evidence: ${detection.evidence}` : "";
          return `- ${item.title}: ${item.suggestion}${evidence}`;
        })
        .join("\n")
    : "- No missing checks. Prepare a release and keep maintaining the project.";

  const scanLine = state.lastScan
    ? `Scanned: ${state.lastScan}`
    : "Scanned: not scanned yet";

  return `# OSS Readiness Report

Repository: ${repoName}
Project type: ${type}
Score: ${value}/100
${scanLine}

## Detected Strengths

${completeLines}

## Recommended Improvements

${missingLines}

## Next Step

Focus on the top 1-3 missing items before asking users or contributors to try the project.
`;
}

function updateSummary() {
  if (!state.detected.size) {
    scanSummary.innerHTML = `
      <div class="summary-item"><strong>0</strong><span>detected</span></div>
      <div class="summary-item"><strong>0</strong><span>missing</span></div>
      <div class="summary-item"><strong>Manual</strong><span>fallback ready</span></div>
    `;
    return;
  }

  const autoChecks = checks.filter((item) => item.auto);
  const detectedCount = autoChecks.filter((item) => state.detected.get(item.id)?.passed).length;
  const missingCount = autoChecks.length - detectedCount;
  scanSummary.innerHTML = `
    <div class="summary-item"><strong>${detectedCount}</strong><span>detected</span></div>
    <div class="summary-item"><strong>${missingCount}</strong><span>missing</span></div>
    <div class="summary-item"><strong>${autoChecks.length}</strong><span>auto checks</span></div>
  `;
}

function updateResults() {
  const selected = currentSelectedIds();
  const value = getScore(selected);
  const missing = checks.filter((item) => !selected.includes(item.id)).slice(0, 5);

  score.textContent = value;
  meterFill.style.width = `${value}%`;
  scoreLabel.textContent = labelForScore(value);

  suggestions.innerHTML = missing.length
    ? missing
        .map((item) => {
          const detection = state.detected.get(item.id);
          const evidence = detection?.evidence ? `<span>${detection.evidence}</span>` : "";
          return `<li><strong>${item.title}</strong>${item.suggestion}${evidence}</li>`;
        })
        .join("")
    : '<li class="complete">All readiness checks are selected. Prepare a release and keep the repository active.</li>';

  report.value = buildReport(selected, value);
  copyStatus.textContent = "";
  updateSummary();
}

function setScanStatus(message, type = "neutral") {
  scanStatus.textContent = message;
  scanStatus.dataset.type = type;
}

async function handleScan() {
  const parsed = parseGitHubRepoUrl(repoUrlInput.value);
  if (!parsed) {
    setScanStatus("Enter a valid GitHub repository URL, for example https://github.com/samsasmm/oss-ready-check.", "error");
    return;
  }

  scanButton.disabled = true;
  setScanStatus("Scanning public GitHub repository...", "neutral");

  try {
    const scan = await scanRepository(parsed.owner, parsed.repo);
    state.owner = parsed.owner;
    state.repo = parsed.repo;
    state.repoUrl = parsed.url;
    state.detected = scan.results;
    state.lastScan = new Date().toLocaleString();
    renderChecklist();
    updateResults();
    setScanStatus(`Scan complete for ${parsed.owner}/${parsed.repo}.`, "success");
  } catch (error) {
    setScanStatus(`${error.message} Public repositories work best. GitHub rate limits may also apply.`, "error");
  } finally {
    scanButton.disabled = false;
  }
}

async function copyReport() {
  try {
    await navigator.clipboard.writeText(report.value);
    copyStatus.textContent = "Report copied.";
  } catch {
    report.select();
    document.execCommand("copy");
    copyStatus.textContent = "Report selected and copied.";
  }
}

function resetAll() {
  state.owner = "";
  state.repo = "";
  state.repoUrl = "";
  state.selected = new Set();
  state.detected = new Map();
  state.manualOverrides = new Set();
  state.lastScan = null;
  repoUrlInput.value = "";
  projectType.value = "tool";
  setScanStatus("Enter a public GitHub repository URL to begin.", "neutral");
  renderChecklist();
  updateResults();
}

renderChecklist();
updateResults();
setScanStatus("Enter a public GitHub repository URL to begin.", "neutral");

checklist.addEventListener("change", (event) => {
  const input = event.target.closest("input[type='checkbox']");
  if (!input) return;

  if (input.checked) {
    state.manualOverrides.add(input.dataset.id);
  } else {
    state.manualOverrides.delete(input.dataset.id);
  }
  updateResults();
});

repoUrlInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") handleScan();
});
projectType.addEventListener("change", updateResults);
scanButton.addEventListener("click", handleScan);
copyButton.addEventListener("click", copyReport);
resetButton.addEventListener("click", resetAll);
