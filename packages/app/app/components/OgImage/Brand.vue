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
      font-family: 'Inter', sans-serif;
      overflow: hidden;
    "
  >
    <div
      style="
        position: absolute;
        top: -100px;
        left: -120px;
        width: 600px;
        height: 600px;
        display: flex;
        background: #0c2235;
        border-radius: 600px;
        opacity: 0.9;
      "
    />
    <div
      style="
        position: absolute;
        top: 120px;
        left: -40px;
        width: 360px;
        height: 360px;
        display: flex;
        background: #1e3a5f;
        border-radius: 360px;
        opacity: 0.5;
      "
    />
    <div
      style="
        position: absolute;
        bottom: -160px;
        right: -120px;
        width: 480px;
        height: 480px;
        display: flex;
        background: #1a1208;
        border-radius: 480px;
        opacity: 0.7;
      "
    />

    <!-- top accent bar -->
    <div
      style="
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 6px;
        display: flex;
        background: linear-gradient(90deg, #f38020 0%, #38bdf8 55%, #0ea5e9 100%);
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
          letter-spacing: 0.18em;
          text-transform: uppercase;
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
        <span style="display: flex">Continuous (Preview) Releases</span>
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
          text-shadow: 0 0 28px rgba(56, 189, 248, 0.65);
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
