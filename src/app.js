const checks = [
  {
    id: "purpose",
    title: "Clear project purpose",
    weight: 12,
    help: "A visitor can understand what the project does and who it helps within the first minute.",
    suggestion:
      "Add a short project purpose near the top of the README: what it does, who it helps, and why it exists.",
  },
  {
    id: "license",
    title: "Open source license",
    weight: 12,
    help: "The repository includes a license file so others know what they are allowed to do.",
    suggestion:
      "Add a LICENSE file. MIT is a common beginner-friendly option for small tools, but choose intentionally.",
  },
  {
    id: "install",
    title: "Install or usage instructions",
    weight: 11,
    help: "A new user can run or try the project without guessing the steps.",
    suggestion:
      "Write a small usage section with exact steps and what the user should see when it works.",
  },
  {
    id: "screenshot",
    title: "Screenshot or demo",
    weight: 9,
    help: "The README shows what the project looks like or what output it produces.",
    suggestion:
      "Add at least one screenshot, demo GIF, or sample output so visitors can quickly understand the result.",
  },
  {
    id: "roadmap",
    title: "Roadmap",
    weight: 9,
    help: "The project shows what is planned next without promising too much.",
    suggestion:
      "Add a short roadmap with v0.1.0, v0.2.0, and later ideas. Keep it realistic.",
  },
  {
    id: "issues",
    title: "Issue templates",
    weight: 9,
    help: "Users have a clear way to report bugs or suggest improvements.",
    suggestion:
      "Add bug report and feature request templates under .github/ISSUE_TEMPLATE.",
  },
  {
    id: "contributing",
    title: "Contribution guide",
    weight: 9,
    help: "Potential contributors know what kinds of changes are welcome.",
    suggestion:
      "Add CONTRIBUTING.md with good first contribution ideas and project principles.",
  },
  {
    id: "changelog",
    title: "Changelog or release notes",
    weight: 8,
    help: "Users can see what changed between versions.",
    suggestion:
      "Add CHANGELOG.md and update it when you prepare each release.",
  },
  {
    id: "maintainer",
    title: "Maintainer expectations",
    weight: 8,
    help: "The project explains what maintainers will review, accept, and prioritize.",
    suggestion:
      "Document contribution principles, review style, and what is out of scope.",
  },
  {
    id: "verification",
    title: "Verification steps",
    weight: 7,
    help: "The README or contribution guide explains how to test the project after changes.",
    suggestion:
      "Add a short verification section. For a static app, explain how to open the page and check core behavior.",
  },
  {
    id: "scope",
    title: "Small, realistic scope",
    weight: 6,
    help: "The first release is focused enough to finish and maintain.",
    suggestion:
      "Trim the first release to one useful workflow. Put bigger ideas in the roadmap instead of v0.1.0.",
  },
];

const checklist = document.querySelector("#checklist");
const score = document.querySelector("#score");
const scoreLabel = document.querySelector("#scoreLabel");
const meterFill = document.querySelector("#meterFill");
const suggestions = document.querySelector("#suggestions");
const report = document.querySelector("#report");
const copyButton = document.querySelector("#copyButton");
const copyStatus = document.querySelector("#copyStatus");
const resetButton = document.querySelector("#resetButton");
const repoName = document.querySelector("#repoName");
const projectType = document.querySelector("#projectType");

function renderChecklist() {
  checklist.innerHTML = checks
    .map(
      (item) => `
        <label class="check-item" for="${item.id}">
          <input id="${item.id}" type="checkbox" data-id="${item.id}" />
          <span>
            <span class="check-title">${item.title}</span>
            <p class="check-help">${item.help}</p>
          </span>
          <span class="weight">${item.weight} pts</span>
        </label>
      `,
    )
    .join("");
}

function selectedIds() {
  return Array.from(checklist.querySelectorAll("input:checked")).map(
    (input) => input.dataset.id,
  );
}

function getScore(selected) {
  return checks
    .filter((item) => selected.includes(item.id))
    .reduce((total, item) => total + item.weight, 0);
}

function labelForScore(value) {
  if (value >= 85) return "Strong readiness. Prepare screenshots and release notes before publishing.";
  if (value >= 65) return "Good foundation. A few missing pieces still reduce trust and maintainability.";
  if (value >= 40) return "Promising start. Focus on the highest-value missing items first.";
  if (value > 0) return "Early stage. Add the basics before inviting users or contributors.";
  return "Start by checking what exists.";
}

function buildReport(selected, value) {
  const name = repoName.value.trim() || "Untitled repository";
  const type = projectType.options[projectType.selectedIndex].text;
  const complete = checks.filter((item) => selected.includes(item.id));
  const missing = checks.filter((item) => !selected.includes(item.id));

  const completeLines = complete.length
    ? complete.map((item) => `- ${item.title}`).join("\n")
    : "- No completed checks selected yet.";

  const missingLines = missing.length
    ? missing.map((item) => `- ${item.title}: ${item.suggestion}`).join("\n")
    : "- No missing checks. Prepare a release and keep maintaining the project.";

  return `# OSS Readiness Report

Repository: ${name}
Project type: ${type}
Score: ${value}/100

## Completed Signals

${completeLines}

## Recommended Improvements

${missingLines}

## Next Step

Focus on the top 1-3 missing items before asking users or contributors to try the project.
`;
}

function updateResults() {
  const selected = selectedIds();
  const value = getScore(selected);
  const missing = checks.filter((item) => !selected.includes(item.id)).slice(0, 5);

  score.textContent = value;
  meterFill.style.width = `${value}%`;
  scoreLabel.textContent = labelForScore(value);

  suggestions.innerHTML = missing.length
    ? missing.map((item) => `<li>${item.suggestion}</li>`).join("")
    : '<li class="complete">All readiness checks are selected. Prepare a release and keep the repository active.</li>';

  report.value = buildReport(selected, value);
  copyStatus.textContent = "";
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
  checklist.querySelectorAll("input").forEach((input) => {
    input.checked = false;
  });
  repoName.value = "";
  projectType.value = "tool";
  updateResults();
}

renderChecklist();
updateResults();

checklist.addEventListener("change", updateResults);
repoName.addEventListener("input", updateResults);
projectType.addEventListener("change", updateResults);
copyButton.addEventListener("click", copyReport);
resetButton.addEventListener("click", resetAll);

