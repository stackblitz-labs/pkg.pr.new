import fetch from 'node-fetch';

function formatMonth(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

async function main() {
  const res = await fetch('http://localhost:3000/api/chart');
  const { runs } = await res.json();

  // Sort by date
  runs.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));

  // Format labels as 'May 2025', 'Jun 2025', etc.
  const labels = runs.map(r => formatMonth(r.created_at));
  const orgs = runs.map(r => r.stats.orgs);
  const repos = runs.map(r => r.stats.repos);
  const prsAndBranches = runs.map(r => r.stats.prsAndBranches);
  const commits = runs.map(r => r.stats.commits);

  // Orgs & Repos
  const orgsReposConfig = {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Organizations',
          data: orgs,
          borderColor: 'rgb(54, 162, 235)',
          fill: false,
        },
        {
          label: 'Repositories',
          data: repos,
          borderColor: 'rgb(255, 99, 132)',
          fill: false,
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        x: {
          type: 'category',
          title: { display: true, text: 'Month' }
        },
        y: {
          type: 'logarithmic',
          title: { display: true, text: 'Count' }
        }
      }
    }
  };

  // PRs & Branches
  const prsBranchesConfig = {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'PRs & Branches',
          data: prsAndBranches,
          borderColor: 'rgb(255, 159, 64)',
          fill: false,
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        x: {
          type: 'category',
          title: { display: true, text: 'Month' }
        },
        y: {
          type: 'logarithmic',
          title: { display: true, text: 'Count' }
        }
      }
    }
  };

  // Commits
  const commitsConfig = {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Commits',
          data: commits,
          borderColor: 'rgb(153, 102, 255)',
          fill: false,
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        x: {
          type: 'category',
          title: { display: true, text: 'Month' }
        },
        y: {
          type: 'logarithmic',
          title: { display: true, text: 'Count' }
        }
      }
    }
  };

  function quickChartUrl(config) {
    return 'https://quickchart.io/chart?c=' + encodeURIComponent(JSON.stringify(config));
  }

  console.log('\nOrgs & Repos Chart:\n');
  console.log(`![Orgs & Repos](${quickChartUrl(orgsReposConfig)})\n`);
  console.log('\nPRs & Branches Chart:\n');
  console.log(`![PRs & Branches](${quickChartUrl(prsBranchesConfig)})\n`);
  console.log('\nCommits Chart:\n');
  console.log(`![Commits](${quickChartUrl(commitsConfig)})\n`);
}

main(); 