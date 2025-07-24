import { defineEventHandler } from "h3";
import { $fetch } from "ofetch";
import chartData from "../api/chart.get";

interface Run {
  created_at: string;
  stats: { prsAndBranches: number };
}

export default defineEventHandler(async (event) => {
  const { runs } = (await chartData(event)) as { runs: Run[] };
  runs.sort(
    (a: Run, b: Run) => Date.parse(a.created_at) - Date.parse(b.created_at),
  );
  const labels = runs.map((r: Run) => {
    const date = new Date(r.created_at);
    return date.toLocaleString("en-US", { month: "short", year: "numeric" });
  });
  const prsAndBranches = runs.map((r: Run) => r.stats.prsAndBranches);
  function getMinMax(arr: number[]) {
    const filtered = arr.filter((v) => typeof v === "number" && !isNaN(v));
    const min = Math.min(...filtered);
    const max = Math.max(...filtered);
    return { min: min - 10, max: max + 10 };
  }
  const minMax = getMinMax(prsAndBranches);
  const config = {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "PRs & Branches",
          data: prsAndBranches,
          borderColor: "rgb(255, 159, 64)",
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        x: {
          type: "category",
          title: { display: true, text: "Month" },
        },
        y: {
          type: "linear",
          title: { display: true, text: "Count" },
          min: minMax.min,
          max: minMax.max,
          ticks: {
            stepSize: 10,
          },
        },
      },
    },
  };
  const quickChartUrl =
    "https://quickchart.io/chart?c=" +
    encodeURIComponent(JSON.stringify(config)) +
    "&format=png&width=800&height=400";
  const img = await $fetch(quickChartUrl, { responseType: "arrayBuffer" });
  event.node.res.setHeader("Content-Type", "image/png");
  return Buffer.from(img);
});
