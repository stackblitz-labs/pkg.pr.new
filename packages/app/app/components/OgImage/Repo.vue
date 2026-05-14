<script setup lang="ts">
defineProps<{
  owner: string;
  repo: string;
  releaseCount?: number;
}>();
</script>

<template>
  <div
    style="
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: #0b0b0f;
      color: #ffffff;
      padding: 64px;
      font-family: &quot;Inter&quot;, sans-serif;
    "
  >
    <div
      style="
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 8px;
        background: linear-gradient(90deg, #f38020 0%, #0ea5e9 100%);
      "
    />

    <div style="display: flex; align-items: center; gap: 16px">
      <img src="/favicon.svg" width="56" height="56" alt="" />
      <div style="font-size: 28px; opacity: 0.7">pkg.pr.new</div>
    </div>

    <div style="display: flex; align-items: center; gap: 32px">
      <img
        :src="`https://github.com/${owner}.png?size=200`"
        width="180"
        height="180"
        style="border-radius: 20px"
        alt=""
      />
      <div style="display: flex; flex-direction: column">
        <div style="font-size: 36px; opacity: 0.6">{{ owner }} /</div>
        <div
          style="
            font-size: 84px;
            font-weight: 800;
            line-height: 1;
            letter-spacing: -0.02em;
          "
        >
          {{ repo }}
        </div>
      </div>
    </div>

    <div
      style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 28px;
      "
    >
      <span style="opacity: 0.7">Continuous Releases</span>
      <span
        v-if="releaseCount != null"
        style="
          background: rgba(14, 165, 233, 0.15);
          color: #38bdf8;
          padding: 8px 20px;
          border-radius: 999px;
        "
      >
        {{ releaseCount }} releases
      </span>
    </div>
  </div>
</template>
