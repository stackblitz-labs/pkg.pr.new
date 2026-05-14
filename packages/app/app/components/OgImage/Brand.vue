<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    description?: string;
  }>(),
  {
    title: "pkg.pr.new",
    description: "Continuous (pre)Releases for your libraries.",
  },
);
</script>

<template>
  <div
    style="
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: #0b0b0f;
      color: #ffffff;
      padding: 80px;
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

    <img src="/favicon.svg" width="128" height="128" alt="" />

    <div
      style="
        font-size: 88px;
        font-weight: 800;
        margin-top: 32px;
        letter-spacing: -0.02em;
      "
    >
      {{ title }}
    </div>

    <div
      style="
        font-size: 36px;
        opacity: 0.7;
        margin-top: 16px;
        text-align: center;
        max-width: 900px;
      "
    >
      {{ description }}
    </div>

    <div
      style="
        position: absolute;
        bottom: 48px;
        left: 80px;
        right: 80px;
        display: flex;
        justify-content: space-between;
        font-size: 24px;
        opacity: 0.5;
      "
    >
      <span>Continuous (pre)Releases</span>
      <span>pkg.pr.new</span>
    </div>
  </div>
</template>
