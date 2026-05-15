<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    tagline?: string;
  }>(),
  {
    title: "pkg.pr.new",
    tagline: "Instant preview releases. Without publishing to npm.",
  },
);
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
    <!-- top accent bar -->
    <div
      style="
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 6px;
        display: flex;
        background: linear-gradient(
          90deg,
          #f38020 0%,
          #38bdf8 55%,
          #0ea5e9 100%
        );
      "
    />

    <div
      style="
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 72px 80px;
        flex: 1;
        z-index: 1;
      "
    >
      <div
        style="
          display: flex;
          align-items: center;
          font-size: 24px;
          letter-spacing: 0.06em;
          color: #7dd3fc;
        "
      >
        <img
          src="/favicon.svg"
          width="48"
          height="48"
          alt=""
          style="margin-right: 18px"
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
          font-size: 132px;
          font-weight: 800;
          color: #38bdf8;
          letter-spacing: -0.045em;
          line-height: 1;
          margin-top: 28px;
        "
      >
        {{ title }}
      </div>

      <div
        style="
          display: flex;
          font-size: 38px;
          color: #cbd5e1;
          margin-top: 28px;
          line-height: 1.25;
        "
      >
        {{ tagline }}
      </div>
    </div>

    <div
      style="
        position: absolute;
        bottom: 28px;
        left: 80px;
        right: 80px;
        display: flex;
        justify-content: flex-start;
        align-items: center;
        font-size: 22px;
        color: #64748b;
        z-index: 1;
      "
    >
      <span style="display: flex">github.com/stackblitz-labs/pkg.pr.new</span>
    </div>
  </div>
</template>
