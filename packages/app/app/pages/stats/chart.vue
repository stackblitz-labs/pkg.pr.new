<template>
  <div class="p-4 max-w-xl mx-auto">
    <h1 class="text-2xl mb-4">Growth Over Time</h1>
    <h2 class="text-lg mt-8 mb-2">Organizations & Repositories</h2>
    <canvas ref="orgsReposRef" style="max-width: 100%"></canvas>
    <h2 class="text-lg mt-8 mb-2">PRs & Branches</h2>
    <canvas ref="prsBranchesRef" style="max-width: 100%"></canvas>
    <h2 class="text-lg mt-8 mb-2">Commits</h2>
    <canvas ref="commitsRef" style="max-width: 100%"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  LogarithmicScale
} from 'chart.js'
import 'chartjs-adapter-date-fns'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  LogarithmicScale
)

const orgsReposRef = ref<HTMLCanvasElement|null>(null)
const prsBranchesRef = ref<HTMLCanvasElement|null>(null)
const commitsRef = ref<HTMLCanvasElement|null>(null)

onMounted(async () => {
  const res = await fetch('/api/chart')
  const { runs } = (await res.json()) as { runs: { created_at: string, stats: { orgs: number, repos: number, prsAndBranches: number, commits: number } }[] }
  runs.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))

  const labels = runs.map(r => r.created_at)
  const orgs = runs.map(r => r.stats.orgs)
  const repos = runs.map(r => r.stats.repos)
  const prsAndBranches = runs.map(r => r.stats.prsAndBranches)
  const commits = runs.map(r => r.stats.commits)
  const chartLabels = labels

  if (orgsReposRef.value) {
    new ChartJS(orgsReposRef.value, {
      type: 'line',
      data: {
        labels: chartLabels,
        datasets: [
          {
            label: 'Organizations',
            data: orgs,
            borderColor: 'rgb(54, 162, 235)',
            fill: false,
            tension: 0.1
          },
          {
            label: 'Repositories',
            data: repos,
            borderColor: 'rgb(255, 99, 132)',
            fill: false,
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          x: {
            type: 'time',
            time: { unit: 'day' },
            title: { display: true, text: 'Date' }
          },
          y: {
            type: 'logarithmic',
            title: { display: true, text: 'Count' }
          }
        }
      }
    })
  }

  if (prsBranchesRef.value) {
    new ChartJS(prsBranchesRef.value, {
      type: 'line',
      data: {
        labels: chartLabels,
        datasets: [
          {
            label: 'PRs & Branches',
            data: prsAndBranches,
            borderColor: 'rgb(255, 159, 64)',
            fill: false,
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          x: {
            type: 'time',
            time: { unit: 'day' },
            title: { display: true, text: 'Date' }
          },
          y: {
            type: 'logarithmic',
            title: { display: true, text: 'Count' }
          }
        }
      }
    })
  }

  if (commitsRef.value) {
    new ChartJS(commitsRef.value, {
      type: 'line',
      data: {
        labels: chartLabels,
        datasets: [
          {
            label: 'Commits',
            data: commits,
            borderColor: 'rgb(153, 102, 255)',
            fill: false,
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          x: {
            type: 'time',
            time: { unit: 'day' },
            title: { display: true, text: 'Date' }
          },
          y: {
            type: 'logarithmic',
            title: { display: true, text: 'Count' }
          }
        }
      }
    })
  }
})
</script>

<style scoped>
canvas { max-width: 100%; margin-bottom: 2rem; }
</style>
  