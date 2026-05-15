<script setup lang="ts">
defineProps<{
  owner: string;
  repo: string;
  releaseCount?: number;
}>();

function formatCount(n?: number): string {
  if (n == null) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}
</script>

<template>
  <div
    style="
      width: 100%;
      height: 100%;
      display: flex;
      position: relative;
      background: #050714;
      color: #ffffff;
      font-family: &quot;Inter&quot;, sans-serif;
      overflow: hidden;
    "
  >
    <div
      style="
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 6px;
        display: flex;
      "
    />

    <div
      style="
        position: absolute;
        top: 56px;
        left: 64px;
        right: 64px;
        bottom: 56px;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
      "
    >
      <div
        style="
          display: flex;
          align-items: center;
          font-size: 24px;
          color: #7dd3fc;
          letter-spacing: 0.06em;
        "
      >
        <img
          src="/favicon.svg"
          width="40"
          height="40"
          alt=""
          style="margin-right: 14px"
        />
        <span style="display: flex">pkg.pr.new</span>
        <span style="display: flex; color: #475569; margin: 0 14px">/</span>
        <span style="display: flex; color: #94a3b8; letter-spacing: 0.08em"
          >Continuous releases</span
        >
      </div>

      <div
        style="
          display: flex;
          flex: 1;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          width: 100%;
        "
      >
        <div
          style="
            display: flex;
            align-items: center;
            font-size: 54px;
            font-weight: 700;
            color: #e2e8f0;
          "
        >
          <img
            :src="`https://github.com/${owner}.png?size=128`"
            width="88"
            height="88"
            alt=""
            style="display: flex; border-radius: 14px; margin-right: 16px"
          />
          {{ owner }}
          <span style="display: flex; color: #64748b">/</span>
          {{ repo }}
        </div>

        <div
          style="
            display: flex;
            align-items: center;
            color: #94a3b8;
            font-size: 24px;
            margin-top: 18px;
          "
        >
          github.com/{{ owner }}/{{ repo }}
        </div>

        <div
          style="
            display: flex;
            align-items: center;
            color: #7dd3fc;
            font-size: 30px;
            font-weight: 600;
            margin-top: 28px;
          "
        >
          <span style="display: flex"
            >{{ formatCount(releaseCount) }} releases</span
          >
        </div>
      </div>
    </div>
  </div>
</template>
